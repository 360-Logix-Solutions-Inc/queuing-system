// Server-only SMS support backed by SQLite (replaces firebaseServer.js). Reads
// per-client templates, estimates wait/position, records send logs, and claims
// "near" notifications atomically. SMS itself still goes out via Semaphore
// (needs internet) — only the data layer is local now.
import { getDb } from "./db.js";
import { publish } from "./bus.js";
import { normalizeClientId, getTodayKey, isTicketExpired, sortTicketsForQueue } from "../queueConstants.js";
import { DEFAULT_SMS_TEMPLATES } from "../smsTemplates.js";

export function getClientSmsTemplates(clientId) {
  const fallback = { ...DEFAULT_SMS_TEMPLATES };
  if (!clientId) return fallback;
  try {
    const row = getDb().prepare("SELECT smsTemplates FROM clients WHERE id = ?").get(normalizeClientId(clientId));
    if (!row || !row.smsTemplates) return fallback;
    const t = JSON.parse(row.smsTemplates);
    return {
      confirm: t.confirm || fallback.confirm,
      serving: t.serving || fallback.serving,
      near: t.near || fallback.near,
    };
  } catch (_) {
    return fallback;
  }
}

// Number of counters that can actively serve right now (non-paused), min 1.
export function getActiveLanes(clientId) {
  try {
    const n = getDb()
      .prepare("SELECT COUNT(*) AS n FROM counters WHERE clientId = ? AND paused = 0")
      .get(normalizeClientId(clientId)).n;
    return Math.max(1, n);
  } catch (_) {
    return 1;
  }
}

// Waiting count, active lanes, and this ticket's 1-based position in priority order.
export function getWaitContext(clientId, queueNumber) {
  try {
    const cid = normalizeClientId(clientId);
    const sorted = getDb()
      .prepare("SELECT * FROM tickets WHERE clientId = ? AND serviceDate = ? AND status = 'waiting'")
      .all(cid, getTodayKey())
      .sort(sortTicketsForQueue);
    const lanes = getActiveLanes(cid);
    let position = sorted.findIndex((t) => t.queueNumber === queueNumber) + 1;
    if (position <= 0) position = sorted.length || 1;
    return { waiting: sorted.length, lanes, position };
  } catch (_) {
    return { waiting: 0, lanes: 1, position: 1 };
  }
}

export function formatWaitMinutes(peopleAhead, lanes) {
  const ahead = Math.max(0, Number(peopleAhead) || 0);
  if (ahead <= 0) return "";
  const avg = Math.max(1, Number(process.env.AVG_SERVICE_MINUTES) || 5);
  return `~${Math.max(avg, Math.ceil(ahead / Math.max(1, Number(lanes) || 1)) * avg)} min`;
}

// Top-N waiting tickets (priority order) for the "near" notification sweep.
export function getWaitingForNearNotify(clientId, limit) {
  const cid = normalizeClientId(clientId);
  return getDb()
    .prepare("SELECT * FROM tickets WHERE clientId = ? AND serviceDate = ? AND status = 'waiting'")
    .all(cid, getTodayKey())
    .filter((t) => !isTicketExpired(t))
    .sort(sortTicketsForQueue)
    .slice(0, Math.max(0, limit));
}

// Atomically claim a ticket as "near-notified" so two servers never double-send.
// Returns true only if this call is the one that set the flag.
export function markNearNotified(ticketId, position) {
  const info = getDb().prepare(`
    UPDATE tickets SET nearNotifiedAt = ?, nearNotifiedPosition = ?, updatedAt = ?
    WHERE id = ? AND status = 'waiting' AND nearNotifiedAt IS NULL
  `).run(Date.now(), position, Date.now(), ticketId);
  return info.changes > 0;
}

// Persist a send attempt. Never throws — logging must not break ticketing.
export function logSms(entry) {
  try {
    const cid = normalizeClientId(entry.clientId);
    getDb().prepare(`
      INSERT INTO smsLogs (clientId, type, phone, message, status, error, queueNumber, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(cid, entry.type || "", entry.phone || "", entry.message || "", entry.status || "",
      entry.error || null, entry.queueNumber || null, Date.now());
    publish(cid, ["sms"]);
  } catch (_) { /* swallow */ }
}
