// Server-only Semaphore SMS helpers. Do NOT import from client components —
// this reads SEMAPHORE_API_KEY from the server environment.

export function isSmsConfigured() {
  return Boolean(process.env.SEMAPHORE_API_KEY);
}

export function normalizePhone(phone) {
  const raw = String(phone || "").replace(/\D/g, "");
  if (!raw) return null;
  // PH number normalization. Semaphore accepts 09XX or 639XX.
  if (raw.startsWith("63")) return raw;
  if (raw.startsWith("09") && raw.length === 11) return raw;
  if (raw.startsWith("9") && raw.length === 10) return `0${raw}`;
  return raw;
}

export async function sendSemaphoreSms(phone, message) {
  const apiKey = process.env.SEMAPHORE_API_KEY;
  if (!apiKey) throw new Error("SEMAPHORE_API_KEY is not configured.");
  const sender = process.env.SEMAPHORE_SENDER_NAME || "SEMAPHORE";
  const body = new URLSearchParams({
    apikey: apiKey,
    number: phone,
    message,
    sendername: sender,
  });
  // Without a deadline this request can sit open indefinitely when Semaphore is
  // slow or unreachable, and it holds the whole /api/notify-ticket response
  // open with it — measured at 45s with no reply. A kiosk must never wait on
  // something outside the building.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  let res;
  try {
    res = await fetch("https://api.semaphore.co/api/v4/messages", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === "AbortError") throw new Error("Semaphore timed out after 10s");
    throw err;
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Semaphore ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json().catch(() => null);
}
