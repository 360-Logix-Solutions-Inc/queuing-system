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
  const res = await fetch("https://api.semaphore.co/api/v4/messages", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Semaphore ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json().catch(() => null);
}
