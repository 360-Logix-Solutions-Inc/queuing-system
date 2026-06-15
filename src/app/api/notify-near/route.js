import { NextResponse } from "next/server";
import { collection, query, where, getDocs, runTransaction, serverTimestamp } from "firebase/firestore";
import { isSmsConfigured, normalizePhone, sendSemaphoreSms } from "../../../lib/smsSender";
import { getServerDb, getClientSmsTemplates, getActiveLanes, formatWaitMinutes, logSms } from "../../../lib/firebaseServer";
import { renderTemplate } from "../../../lib/smsTemplates";

export const dynamic = "force-dynamic";

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function timestampMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  return Number(value) || 0;
}

export async function POST(req) {
  try {
    const payload = await req.json().catch(() => ({}));
    const clientId = String(payload.clientId || "").trim();
    if (!clientId) {
      return NextResponse.json({ error: "clientId required" }, { status: 400 });
    }
    // Don't claim tickets as "notified" when SMS is disabled — bail early.
    if (!isSmsConfigured()) {
      return NextResponse.json({ sent: 0, skipped: 0, reason: "sms-not-configured" });
    }
    const threshold = Math.max(1, Number(process.env.NEAR_NOTIFY_THRESHOLD) || 3);

    const db = getServerDb();
    const templates = await getClientSmsTemplates(clientId);
    const lanes = await getActiveLanes(clientId);
    const snap = await getDocs(
      query(
        collection(db, "queueTickets"),
        where("clientId", "==", clientId),
        where("serviceDate", "==", getTodayKey()),
        where("status", "==", "waiting")
      )
    );
    const sorted = snap.docs
      .map((d) => ({ id: d.id, ref: d.ref, ...d.data() }))
      .filter((t) => !t.expiresAt || timestampMillis(t.expiresAt) > Date.now())
      .sort(
        (a, b) =>
          Number(a.priorityRank ?? 1) - Number(b.priorityRank ?? 1) ||
          timestampMillis(a.createdAt) - timestampMillis(b.createdAt)
      );

    const orgName = payload.orgName || "";
    const results = { sent: 0, skipped: 0, errors: [] };
    const limit = Math.min(sorted.length, threshold);

    for (let i = 0; i < limit; i += 1) {
      const ticket = sorted[i];
      const position = i + 1;
      const phone = normalizePhone(ticket.phone);
      if (!phone) { results.skipped += 1; continue; }
      if (ticket.nearNotifiedAt) { results.skipped += 1; continue; }

      let claimed = false;
      try {
        await runTransaction(db, async (tx) => {
          const fresh = await tx.get(ticket.ref);
          if (!fresh.exists()) return;
          const data = fresh.data();
          if (data.nearNotifiedAt) return;
          if (data.status !== "waiting") return;
          tx.update(ticket.ref, {
            nearNotifiedAt: serverTimestamp(),
            nearNotifiedPosition: position,
            updatedAt: serverTimestamp(),
          });
          claimed = true;
        });
      } catch (err) {
        results.errors.push({ id: ticket.id, error: err.message });
        continue;
      }
      if (!claimed) { results.skipped += 1; continue; }

      const message = renderTemplate(templates.near, {
        name: ticket.customerName,
        queueNumber: ticket.queueNumber,
        serviceName: ticket.serviceName,
        position,
        waitTime: formatWaitMinutes(position - 1, lanes),
        orgName,
      });
      try {
        await sendSemaphoreSms(phone, message);
        await logSms({ clientId, type: "near", phone, message, status: "sent", queueNumber: ticket.queueNumber });
        results.sent += 1;
      } catch (err) {
        await logSms({ clientId, type: "near", phone, message, status: "failed", error: err.message, queueNumber: ticket.queueNumber });
        results.errors.push({ id: ticket.id, error: err.message });
      }
    }

    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
