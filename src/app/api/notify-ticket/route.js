import { NextResponse } from "next/server";
import { isSmsConfigured, normalizePhone, sendSemaphoreSms } from "../../../lib/smsSender";
import { getClientSmsTemplates, getWaitContext, formatWaitMinutes, logSms } from "../../../lib/firebaseServer";
import { DEFAULT_SMS_TEMPLATES, renderTemplate } from "../../../lib/smsTemplates";

export const dynamic = "force-dynamic";

// firebaseServer talks to Firestore through the CLIENT SDK, which on the server
// can sit waiting on a connection it never gets. Measured: this route returned
// nothing at all for 45s. Every dependency here is therefore timeboxed, and
// each one degrades to something sendable rather than blocking the reply.
const FIRESTORE_TIMEOUT_MS = 5000;

async function withTimeout(promise, ms, fallback, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((resolve) => {
        timer = setTimeout(() => {
          console.warn(`[notify-ticket] ${label} timed out after ${ms}ms — continuing without it`);
          resolve(fallback);
        }, ms);
      }),
    ]);
  } catch (err) {
    console.warn(`[notify-ticket] ${label} failed: ${err.message}`);
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}

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

    // A per-client template override is a nicety; the shared defaults say the
    // same thing, so a slow lookup must not hold up the message.
    const templates = await withTimeout(
      getClientSmsTemplates(clientId),
      FIRESTORE_TIMEOUT_MS,
      DEFAULT_SMS_TEMPLATES,
      "getClientSmsTemplates"
    );

    // Position + estimated wait only apply to a confirmation (a "serving" ticket
    // is being called now). People-ahead = position - 1. Both are enrichment:
    // send "you are in the queue" without them rather than not at all.
    let waitTime = "";
    let position;
    if (type === "confirm") {
      const ctx = await withTimeout(
        getWaitContext(clientId, payload.queueNumber),
        FIRESTORE_TIMEOUT_MS,
        null,
        "getWaitContext"
      );
      if (ctx) {
        position = ctx.position;
        waitTime = formatWaitMinutes(position - 1, ctx.lanes);
      }
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

    // The audit log must not gate the reply — it is another Firestore write on
    // the same client SDK that can hang. Fire it and answer the caller.
    const record = (status, error) => {
      Promise.resolve(
        logSms({ clientId, type, phone, message, status, error, queueNumber: payload.queueNumber })
      ).catch(() => { /* logging is best-effort */ });
    };

    try {
      await sendSemaphoreSms(phone, message);
      record("sent");
      return NextResponse.json({ sent: true });
    } catch (err) {
      record("failed", err.message);
      return NextResponse.json({ sent: false, error: err.message }, { status: 502 });
    }
  } catch (err) {
    return NextResponse.json({ sent: false, error: err.message }, { status: 500 });
  }
}
