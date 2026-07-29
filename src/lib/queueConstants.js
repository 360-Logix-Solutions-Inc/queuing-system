// Shared, environment-agnostic queue constants and pure helpers.
// Safe to import from BOTH the server-side SQLite store and the browser
// localClient — contains no Node or Firebase dependencies.

// Generic default services seeded for a brand-new tenant. Per-tenant service sets
// (e.g. San Agustin's municipal offices) are seeded explicitly and are isolated
// from this list — see scripts/seed-san-agustin.mjs.
// A service may carry an optional per-language `names` map for the kiosk's
// language switcher; serviceName() in kioskI18n.js falls back to `name`. None
// are filled in here on purpose: everyone in Romblon asks for these counters by
// their English names, so translating them would make the screen harder to
// scan, not easier. The field is there for service sets where that is not true.
export const SERVICES = [
  { id: "business_permit", name: "Business Permit", prefix: "BP", icon: "BP" },
  { id: "working_permit", name: "Working Permit", prefix: "WP", icon: "WP" },
  { id: "pwd_senior_id", name: "PWD / Senior Citizen ID", prefix: "ID", icon: "ID" },
  { id: "civil_registry", name: "Civil Registry Documents", prefix: "CR", icon: "CR" },
  { id: "treasury", name: "Treasury / Payment", prefix: "TR", icon: "TR" },
  { id: "assessor", name: "Assessor", prefix: "AS", icon: "AS" },
  { id: "health_certificate", name: "Health Certificate", prefix: "HC", icon: "HC" },
  { id: "barangay_clearance", name: "Barangay Clearance", prefix: "BC", icon: "BC" },
];

export const DEFAULT_CLIENT_ID = "default";
export const RESPONSE_WINDOW_MS = 10000;
export const RECALL_SPEECH_MS = 7000;

export function cleanId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 42);
}

export function normalizeClientId(clientId) {
  return cleanId(clientId) || DEFAULT_CLIENT_ID;
}

export function normalizeService(service) {
  return {
    id: cleanId(service.id || service.name),
    name: String(service.name || "").trim(),
    prefix: String(service.prefix || "").trim().toUpperCase().slice(0, 4),
    icon: String(service.icon || service.prefix || "").trim().toUpperCase().slice(0, 4),
  };
}

export function makeCode(length = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

// Timestamps are stored as integer epoch millis in SQLite, so this is mostly a
// passthrough — kept for parity with the Firestore version's mixed shapes.
export function timestampMillis(value) {
  if (!value) return 0;
  if (typeof value === "object" && typeof value.toMillis === "function") return value.toMillis();
  if (typeof value === "object" && typeof value.seconds === "number") return value.seconds * 1000;
  return Number(value) || 0;
}

export function getTodayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getServiceById(id) {
  return SERVICES.find((service) => service.id === id);
}

export function isTicketExpired(ticket, now = Date.now()) {
  return Boolean(ticket.expiresAt) && timestampMillis(ticket.expiresAt) <= now;
}

export function sortTicketsForQueue(a, b) {
  return (
    Number(a.priorityRank ?? 1) - Number(b.priorityRank ?? 1) ||
    timestampMillis(a.createdAt) - timestampMillis(b.createdAt) ||
    String(a.queueNumber || "").localeCompare(String(b.queueNumber || ""))
  );
}

// Pure analytics — identical semantics to the Firestore version, reused as-is.
export function computeAnalytics(tickets) {
  const total = tickets.length;
  const byStatus = { waiting: 0, serving: 0, completed: 0, cancelled: 0 };
  const byPriority = { regular: 0, PWD: 0, SC: 0, PG: 0 };
  const byService = {};
  const byHour = Array(24).fill(0);
  let totalWaitMs = 0;
  let waitSamples = 0;
  let totalServiceMs = 0;
  let serviceSamples = 0;

  tickets.forEach((ticket) => {
    byStatus[ticket.status] = (byStatus[ticket.status] || 0) + 1;
    if (ticket.priorityType) byPriority[ticket.priorityType] = (byPriority[ticket.priorityType] || 0) + 1;
    else byPriority.regular += 1;
    const key = `${ticket.prefix || "?"} ${ticket.serviceName || "Unknown"}`;
    byService[key] = (byService[key] || 0) + 1;
    const createdMs = timestampMillis(ticket.createdAt);
    const calledMs = timestampMillis(ticket.calledAt);
    const completedMs = timestampMillis(ticket.completedAt);
    if (createdMs) byHour[new Date(createdMs).getHours()] += 1;
    if (createdMs && calledMs) {
      totalWaitMs += calledMs - createdMs;
      waitSamples += 1;
    }
    if (calledMs && completedMs) {
      totalServiceMs += completedMs - calledMs;
      serviceSamples += 1;
    }
  });

  const peakHour = byHour.reduce(
    (best, count, hour) => (count > best.count ? { hour, count } : best),
    { hour: 0, count: 0 }
  );

  return {
    total,
    byStatus,
    byPriority,
    byService,
    byHour,
    averageWaitMs: waitSamples ? Math.round(totalWaitMs / waitSamples) : 0,
    averageServiceMs: serviceSamples ? Math.round(totalServiceMs / serviceSamples) : 0,
    peakHour: peakHour.count ? peakHour : null,
  };
}
