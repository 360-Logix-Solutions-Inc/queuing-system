// Client-side trigger for transactional SMS (ticket confirmation, "now serving"
// alert). Fire-and-forget: never blocks the UI and silently ignores failures so
// SMS outages can't break ticketing. The server route builds the actual message
// text and holds the Semaphore API key.
export function notifyTicketSms(payload) {
  if (typeof window === "undefined" || !payload || !payload.phone) return;
  try {
    fetch("/api/notify-ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => { /* silent */ });
  } catch (_) {
    /* silent */
  }
}
