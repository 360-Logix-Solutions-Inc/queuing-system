import { NextResponse } from "next/server";
import { isSmsConfigured, normalizePhone, sendSemaphoreSms } from "../../../lib/smsSender";
import { getClientSmsTemplates, getWaitContext, formatWaitMinutes, logSms } from "../../../lib/firebaseServer";
import { renderTemplate } from "../../../lib/smsTemplates";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const payload = await req.json().catch(() => ({}));
    const type = String(payload.type || "").trim();
    const phone = normalizePhone(payload.phone);
    const clientId = payload.clientId || "default";

    if (type !== "confirm" && type !== "serving") {
      return NextResponse.json({ error: "invalid type" }, { status: 400 });
    }
    if (!isSmsConfigured()) {
      return NextResponse.json({ sent: false, skipped: true, reason: "sms-not-configured" });
    }
    if (!phone) {
      return NextResponse.json({ sent: false, skipped: true, reason: "no-phone" });
    }
    if (!payload.queueNumber) {
      return NextResponse.json({ error: "queueNumber required" }, { status: 400 });
    }

    const templates = await getClientSmsTemplates(clientId);

    // Position + estimated wait only apply to a confirmation (a "serving" ticket
    // is being called now). People-ahead = position - 1.
    let waitTime = "";
    let position;
    if (type === "confirm") {
      const ctx = await getWaitContext(clientId, payload.queueNumber);
      position = ctx.position;
      waitTime = formatWaitMinutes(position - 1, ctx.lanes);
    }

    const message = renderTemplate(templates[type], {
      name: payload.name,
      queueNumber: payload.queueNumber,
      serviceName: payload.serviceName,
      counter: payload.counterLabel,
      position,
      waitTime,
      orgName: payload.orgName,
    });

    try {
      await sendSemaphoreSms(phone, message);
      await logSms({ clientId, type, phone, message, status: "sent", queueNumber: payload.queueNumber });
      return NextResponse.json({ sent: true });
    } catch (err) {
      await logSms({ clientId, type, phone, message, status: "failed", error: err.message, queueNumber: payload.queueNumber });
      return NextResponse.json({ sent: false, error: err.message }, { status: 500 });
    }
  } catch (err) {
    return NextResponse.json({ sent: false, error: err.message }, { status: 500 });
  }
}
