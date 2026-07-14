// Single RPC dispatch endpoint for all local-DB operations. The browser
// localClient POSTs { fn, args } and this invokes the matching server store
// function. Only whitelisted names are callable. Writes publish to the event
// bus inside the store, so every connected device is pushed an update via
// /api/stream. This is the local replacement for direct Firestore SDK calls.
import { NextResponse } from "next/server";
import * as store from "../../../lib/server/store.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Explicit allow-list — never dispatch to arbitrary store internals.
const ALLOWED = new Set([
  // services
  "getServices", "listAllServices", "addService", "removeService", "reenableService", "deleteService", "updateService",
  // counters
  "getCounters", "addCounter", "updateCounterLabel", "updateCounterServices", "removeCounter", "pauseCounter", "resumeCounter",
  // tickets / queue
  "createTicket", "getWaitingTickets", "getServingTickets", "getCompletedTickets", "getAllTickets", "getTicketsInRange",
  "callNext", "completeCounter", "holdCounter", "recallCounter", "sweepQueueTimeouts", "resetTodayQueue",
  // clients
  "getClientInfo", "updateClient", "createClientWithAdmin", "listClients", "setClientStatus", "updateClientSmsTemplates",
  // admins
  "listAdmins", "addAdminToClient", "setAdminActive", "deleteAdmin", "adminLogin", "updateAdminCredentials",
  // superadmin
  "getSuperAdminConfig", "updateSuperAdminCredentials", "superAdminLogin", "getSystemAnalytics",
  // pairings
  "getPairings", "createPairingCode", "updatePairingServices", "setPairingActive", "deletePairing", "resolvePairingCode",
  // activity / sms / misc
  "logActivity", "logAuthEvent", "getActivityLogs", "getSmsLogs", "ensureClientDefaults",
]);

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const { fn, args } = body || {};
  if (typeof fn !== "string" || !ALLOWED.has(fn) || typeof store[fn] !== "function") {
    return NextResponse.json({ ok: false, error: `Unknown operation: ${fn}` }, { status: 400 });
  }

  const callArgs = Array.isArray(args) ? args : [];
  try {
    const result = store[fn](...callArgs);
    return NextResponse.json({ ok: true, result: result === undefined ? null : result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 400 });
  }
}
