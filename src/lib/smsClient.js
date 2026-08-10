// Client-side trigger for transactional SMS (ticket confirmation, "now serving"
// alert). Fire-and-forget: never blocks the UI. The server route builds the
// actual message text and holds the Semaphore API key.
//
// Offline, the send cannot go through — the server can be on the LAN but
// Semaphore is not. A customer who ticked "send me SMS alerts" would otherwise
// get nothing at all, with no record that anything was owed to them. So failed
// sends are parked in localStorage and retried when the connection returns.

const QUEUE_KEY = "queue_sms_outbox";

// Queue messages go stale: "you are #4 in line" delivered two hours later is
// worse than silence, because by then it is simply wrong. Anything older than
// this is dropped on flush rather than sent.
const MAX_AGE_MS = 30 * 60 * 1000;

function readQueue() {
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (_) {
    return [];
  }
}

function writeQueue(list) {
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(list.slice(-50)));
  } catch (_) {}
}

function enqueue(payload) {
  const list = readQueue();
  list.push({ payload, queuedAt: Date.now() });
  writeQueue(list);
}

// The route can hang: it calls Firestore server-side and then Semaphore, with
// no timeout on either, so a slow or unreachable dependency leaves the request
// open indefinitely. Measured at 45s with no response. Without a deadline here
// the flush loop would await that first entry forever and never drain the rest.
const SEND_TIMEOUT_MS = 8000;

async function send(payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const res = await fetch("/api/notify-ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`sms route returned ${res.status}`);
    return true;
  } finally {
    clearTimeout(timer);
  }
}

export function notifyTicketSms(payload) {
  if (typeof window === "undefined" || !payload || !payload.phone) return;
  send(payload).catch(() => enqueue(payload));
}

// Drains whatever was parked while offline. Safe to call repeatedly; anything
// that fails again stays queued, anything too old is dropped.
export async function flushSmsQueue() {
  if (typeof window === "undefined") return { sent: 0, dropped: 0, kept: 0 };

  const list = readQueue();
  if (!list.length) return { sent: 0, dropped: 0, kept: 0 };

  const now = Date.now();
  const keep = [];
  let sent = 0;
  let dropped = 0;

  for (const entry of list) {
    if (now - Number(entry.queuedAt || 0) > MAX_AGE_MS) {
      dropped++;
      continue;
    }
    try {
      await send(entry.payload);
      sent++;
    } catch (_) {
      keep.push(entry);
    }
  }

  writeQueue(keep);
  return { sent, dropped, kept: keep.length };
}

export function pendingSmsCount() {
  if (typeof window === "undefined") return 0;
  return readQueue().length;
}
