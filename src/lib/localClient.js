"use client";
// Browser-side data client for the fully-offline LAN build. Mirrors the exact
// public signatures of firebaseClient.js, but every call goes to the local
// Next.js server: mutations/reads via POST /api/queue, and real-time updates via
// a single Server-Sent-Events channel per client (replacing Firestore onSnapshot).
//
// Drop-in: components only need to swap the import path from ./firebaseClient
// to ./localClient.
import {
  SERVICES,
  DEFAULT_CLIENT_ID,
  getTodayKey,
  getServiceById,
  computeAnalytics,
  timestampMillis,
  normalizeClientId,
} from "./queueConstants";
import { getConfig } from "./queueApp";

// Re-export the pure constants/helpers so existing imports keep resolving.
export { SERVICES, DEFAULT_CLIENT_ID, getTodayKey, getServiceById, computeAnalytics, timestampMillis };

// ---------------------------------------------------------------- RPC
async function call(fn, ...args) {
  const res = await fetch("/api/queue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fn, args }),
    cache: "no-store",
  });
  let json;
  try {
    json = await res.json();
  } catch (_) {
    throw new Error("Unable to reach the queue server.");
  }
  if (!json.ok) throw new Error(json.error || "Request failed.");
  return json.result;
}

// ---------------------------------------------------------------- SSE channels
const channels = new Map(); // clientId -> Channel

class Channel {
  constructor(clientId) {
    this.clientId = clientId;
    this.listeners = new Set();
    this.connListeners = new Set();
    this.connected = false;
    this.es = null;
    this.open();
  }

  open() {
    if (typeof window === "undefined" || this.es) return;
    const es = new EventSource(`/api/stream?clientId=${encodeURIComponent(this.clientId)}`);
    this.es = es;
    es.addEventListener("ready", () => { this.setConnected(true); this.refetchAll(); });
    es.addEventListener("change", (event) => {
      let data;
      try { data = JSON.parse(event.data); } catch (_) { return; }
      const topics = Array.isArray(data.topics) ? data.topics : [];
      this.listeners.forEach((l) => {
        if (l.topics.length === 0 || l.topics.some((t) => topics.includes(t))) l.run();
      });
    });
    es.onopen = () => this.setConnected(true);
    es.onerror = () => { this.setConnected(false); /* EventSource auto-reconnects */ };
  }

  setConnected(value) {
    if (this.connected === value) return;
    this.connected = value;
    this.connListeners.forEach((cb) => { try { cb(value); } catch (_) {} });
  }

  refetchAll() { this.listeners.forEach((l) => l.run()); }

  addListener(topics, read, callback) {
    const listener = { topics, run: null };
    let alive = true;
    listener.run = async () => {
      try {
        const data = await read();
        if (alive) callback(data);
      } catch (_) { /* transient — SSE will re-trigger on reconnect */ }
    };
    this.listeners.add(listener);
    listener.run(); // immediate initial load
    return () => {
      alive = false;
      this.listeners.delete(listener);
      this.maybeClose();
    };
  }

  addConnListener(cb) {
    this.connListeners.add(cb);
    try { cb(this.connected); } catch (_) {}
    return () => {
      this.connListeners.delete(cb);
      this.maybeClose();
    };
  }

  maybeClose() {
    if (this.listeners.size === 0 && this.connListeners.size === 0) {
      try { this.es && this.es.close(); } catch (_) {}
      this.es = null;
      channels.delete(this.clientId);
    }
  }
}

function getChannel(clientId) {
  const cid = normalizeClientId(clientId);
  let channel = channels.get(cid);
  if (!channel) {
    channel = new Channel(cid);
    channels.set(cid, channel);
  }
  return channel;
}

function subscribe(clientId, topics, read, callback) {
  const cid = normalizeClientId(clientId);
  return getChannel(cid).addListener(topics, () => read(cid), callback);
}

// Connection status for the offline / reconnecting banner (#16).
export function subscribeConnection(clientId, callback) {
  return getChannel(clientId).addConnListener(callback);
}

// ---------------------------------------------------------------- init
export async function initFirebase(clientId = DEFAULT_CLIENT_ID) {
  await call("ensureClientDefaults", normalizeClientId(clientId));
  let appConfig = {};
  try { appConfig = await getConfig(); } catch (_) { appConfig = {}; }
  return { appConfig };
}

// ---------------------------------------------------------------- services
export function getServices(clientId = DEFAULT_CLIENT_ID) { return call("getServices", clientId); }
export function addService(clientId, service, actor = null) { return call("addService", clientId, service, actor); }
export function removeService(clientId, serviceId, actor = null) { return call("removeService", clientId, serviceId, actor); }
export function reenableService(clientId, serviceId, actor = null) { return call("reenableService", clientId, serviceId, actor); }
export function deleteService(clientId, serviceId, actor = null) { return call("deleteService", clientId, serviceId, actor); }
export function updateService(clientId, serviceId, updates, actor = null) { return call("updateService", clientId, serviceId, updates, actor); }

export function listenServices(clientId, callback) {
  return subscribe(clientId, ["services"], (cid) => call("getServices", cid), callback);
}
export function listenAllServices(clientId, callback) {
  return subscribe(clientId, ["services"], (cid) => call("listAllServices", cid), callback);
}

// ---------------------------------------------------------------- counters
export function addCounter(label, clientId = DEFAULT_CLIENT_ID, serviceIds = [], actor = null) {
  return call("addCounter", label, clientId, serviceIds, actor);
}
export function updateCounterLabel(clientId, counterNo, label, actor = null) { return call("updateCounterLabel", clientId, counterNo, label, actor); }
export function updateCounterServices(clientId, counterNo, serviceIds) { return call("updateCounterServices", clientId, counterNo, serviceIds); }
export function removeCounter(counterNo, clientId = DEFAULT_CLIENT_ID, actor = null) { return call("removeCounter", counterNo, clientId, actor); }
export function pauseCounter(counterNo, clientId = DEFAULT_CLIENT_ID, actor = null) { return call("pauseCounter", counterNo, clientId, actor); }
export function resumeCounter(counterNo, clientId = DEFAULT_CLIENT_ID, actor = null) { return call("resumeCounter", counterNo, clientId, actor); }

export function listenCounters(callback) { return listenCountersForClient(DEFAULT_CLIENT_ID, callback); }
export function listenCountersForClient(clientId, callback) {
  return subscribe(clientId, ["counters", "tickets"], (cid) => call("getCounters", cid), callback);
}

// ---------------------------------------------------------------- tickets
export function createTicket(payload) { return call("createTicket", payload); }
export function callNext(counterNo, clientId = DEFAULT_CLIENT_ID) { return call("callNext", counterNo, clientId); }
export function completeCounter(counterNo, clientId = DEFAULT_CLIENT_ID) { return call("completeCounter", counterNo, clientId); }
export function holdCounter(counterNo, clientId = DEFAULT_CLIENT_ID) { return call("holdCounter", counterNo, clientId); }
export function recallCounter(counterNo, clientId = DEFAULT_CLIENT_ID) { return call("recallCounter", counterNo, clientId); }
export function sweepQueueTimeouts(clientId = DEFAULT_CLIENT_ID) { return call("sweepQueueTimeouts", clientId); }
export function resetTodayQueue(clientId = DEFAULT_CLIENT_ID) { return call("resetTodayQueue", clientId); }
export function getTicketsInRange(clientId, fromDate, toDate) { return call("getTicketsInRange", clientId, fromDate, toDate); }

export function listenWaitingTickets(callback) { return listenWaitingTicketsForClient(DEFAULT_CLIENT_ID, callback); }
export function listenWaitingTicketsForClient(clientId, callback) {
  return subscribe(clientId, ["tickets"], (cid) => call("getWaitingTickets", cid), callback);
}
export function listenServingTickets(callback) { return listenServingTicketsForClient(DEFAULT_CLIENT_ID, callback); }
export function listenServingTicketsForClient(clientId, callback) {
  return subscribe(clientId, ["tickets", "counters"], (cid) => call("getServingTickets", cid), callback);
}
export function listenCompletedTickets(callback) { return listenCompletedTicketsForClient(DEFAULT_CLIENT_ID, callback); }
export function listenCompletedTicketsForClient(clientId, callback) {
  return subscribe(clientId, ["tickets"], (cid) => call("getCompletedTickets", cid), callback);
}
export function listenAllTickets(clientId, callback) {
  return subscribe(clientId, ["tickets"], (cid) => call("getAllTickets", cid), callback);
}

// ---------------------------------------------------------------- activity / sms
export function logActivity(clientId, action, details = {}, actor = null) { return call("logActivity", clientId, action, details, actor); }
export function logAuthEvent(clientId, type, actor) { return call("logAuthEvent", clientId, type, actor); }
export function listenActivityLogs(clientId, callback, max = 100) {
  return subscribe(clientId, ["activity"], (cid) => call("getActivityLogs", cid, max), callback);
}
export function updateClientSmsTemplates(clientId, templates, actor = null) { return call("updateClientSmsTemplates", clientId, templates, actor); }
export function listenSmsLogs(clientId, callback, max = 100) {
  return subscribe(clientId, ["sms"], (cid) => call("getSmsLogs", cid, max), callback);
}

// ---------------------------------------------------------------- clients
export function getClientInfo(clientId) { return call("getClientInfo", clientId); }
export function updateClient(clientId, updates, actor = null) { return call("updateClient", clientId, updates, actor); }
export function createClientWithAdmin(payload) { return call("createClientWithAdmin", payload); }
export function listClients() { return call("listClients"); }
export function setClientStatus(clientId, status) { return call("setClientStatus", clientId, status); }

// ---------------------------------------------------------------- admins
export function listAdmins() { return call("listAdmins"); }
export function addAdminToClient(clientId, payload) { return call("addAdminToClient", clientId, payload); }
export function setAdminActive(email, active) { return call("setAdminActive", email, active); }
export function deleteAdmin(email) { return call("deleteAdmin", email); }
export function adminLogin(email, password) { return call("adminLogin", email, password); }
export function updateAdminCredentials(currentEmail, updates) { return call("updateAdminCredentials", currentEmail, updates); }

// ---------------------------------------------------------------- superadmin
export function getSuperAdminConfig() { return call("getSuperAdminConfig"); }
export function updateSuperAdminCredentials(updates) { return call("updateSuperAdminCredentials", updates); }
export function superAdminLogin(email, password) { return call("superAdminLogin", email, password); }
export function getSystemAnalytics() { return call("getSystemAnalytics"); }

// ---------------------------------------------------------------- pairings
export function createPairingCode(clientId, device, actor = null) { return call("createPairingCode", clientId, device, actor); }
export function updatePairingServices(code, serviceIds, actor = null) { return call("updatePairingServices", code, serviceIds, actor); }
export function setPairingActive(code, active, actor = null) { return call("setPairingActive", code, active, actor); }
export function deletePairing(code, actor = null) { return call("deletePairing", code, actor); }
export function resolvePairingCode(code) { return call("resolvePairingCode", code); }
export function listenPairings(clientId, callback) {
  return subscribe(clientId, ["pairings"], (cid) => call("getPairings", cid), callback);
}
