// Server-only queue engine backed by SQLite (better-sqlite3). Ports every
// firebaseClient.js operation to synchronous SQLite transactions. Because Node
// runs one JS callback at a time and these functions never await mid-operation,
// each runs atomically relative to the others — that alone prevents double-calls
// on a shared counter; the wrapping transaction guarantees all-or-nothing writes.
import bcrypt from "bcryptjs";
import { getDb } from "./db.js";
import { publish } from "./bus.js";
import {
  SERVICES,
  DEFAULT_CLIENT_ID,
  RESPONSE_WINDOW_MS,
  RECALL_SPEECH_MS,
  normalizeClientId,
  normalizeService,
  makeCode,
  getTodayKey,
  isTicketExpired,
  sortTicketsForQueue,
} from "../queueConstants.js";

const now = () => Date.now();

// ---------- auth helpers (Phase B: bcrypt + validation) ----------

const BCRYPT_ROUNDS = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isBcryptHash(value) {
  return typeof value === "string" && /^\$2[aby]\$/.test(value);
}

function hashPassword(password) {
  return bcrypt.hashSync(String(password), BCRYPT_ROUNDS);
}

// Verifies against a bcrypt hash; if the stored value is still legacy plaintext
// (pre-Phase-B accounts), compares directly so those users can still log in and
// get transparently upgraded to a hash by the caller.
function verifyPassword(password, stored) {
  if (isBcryptHash(stored)) return bcrypt.compareSync(String(password), stored);
  return String(password) === String(stored ?? "");
}

function validateEmail(email) {
  const clean = String(email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(clean)) throw new Error("Please enter a valid email address.");
  return clean;
}

function validatePassword(password) {
  const value = String(password ?? "");
  if (value.length < 6) throw new Error("Password must be at least 6 characters.");
  return value;
}

// ---------- row mappers (SQLite integers/JSON -> app shapes) ----------

function parseJson(value, fallback) {
  if (value == null) return fallback;
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
}

function mapService(row) {
  if (!row) return null;
  return {
    id: row.id,
    docId: row.docId,
    clientId: row.clientId,
    name: row.name,
    prefix: row.prefix,
    icon: row.icon,
    active: row.active !== 0,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapCounter(row) {
  if (!row) return null;
  return {
    id: row.docId,
    clientId: row.clientId,
    counterNo: row.counterNo,
    label: row.label,
    serviceIds: parseJson(row.serviceIds, []),
    currentTicketId: row.currentTicketId,
    currentQueueNumber: row.currentQueueNumber,
    currentCustomerName: row.currentCustomerName,
    currentServiceName: row.currentServiceName,
    currentPriorityType: row.currentPriorityType,
    paused: row.paused === 1,
    pausedAt: row.pausedAt,
    recallAt: row.recallAt,
    heldAt: row.heldAt,
    responseDeadlineAt: row.responseDeadlineAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapTicket(row) {
  if (!row) return null;
  return { ...row }; // columns already match the app ticket shape
}

function mapPairing(row) {
  if (!row) return null;
  return {
    id: row.code,
    code: row.code,
    clientId: row.clientId,
    type: row.type,
    counterNo: row.counterNo,
    label: row.label,
    autoPrint: row.autoPrint !== 0,
    silentPrinter: row.silentPrinter === 1,
    serviceIds: parseJson(row.serviceIds, []),
    active: row.active !== 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapAdmin(row) {
  if (!row) return null;
  return {
    id: row.email,
    email: row.email,
    password: row.password,
    name: row.name,
    role: row.role,
    clientId: row.clientId,
    clientName: row.clientName,
    active: row.active !== 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapClient(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    status: row.status || "active",
    logo: row.logo || null,
    themeColor: row.themeColor || null,
    smsTemplates: parseJson(row.smsTemplates, null),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ---------- defaults / seeding ----------

export function ensureClientDefaults(clientId = DEFAULT_CLIENT_ID) {
  const cid = normalizeClientId(clientId);
  ensureServices(cid);
  ensureCounters(cid);
}

function ensureServices(cid) {
  const db = getDb();
  const existing = new Set(
    db.prepare("SELECT id FROM services WHERE clientId = ?").all(cid).map((r) => r.id)
  );
  const missing = SERVICES.filter((s) => !existing.has(s.id));
  if (missing.length === 0) return;
  const ts = now();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO services (docId, clientId, id, name, prefix, icon, active, sortOrder, createdAt, updatedAt)
    VALUES (@docId, @clientId, @id, @name, @prefix, @icon, 1, @sortOrder, @ts, @ts)
  `);
  const tx = db.transaction((rows) => {
    rows.forEach((s) => {
      const sortOrder = SERVICES.findIndex((x) => x.id === s.id) + 1;
      insert.run({ docId: `${cid}_${s.id}`, clientId: cid, id: s.id, name: s.name, prefix: s.prefix, icon: s.icon, sortOrder, ts });
    });
  });
  tx(missing);
}

function ensureCounters(cid) {
  const db = getDb();
  const count = db.prepare("SELECT COUNT(*) AS n FROM counters WHERE clientId = ?").get(cid).n;
  if (count > 0) return;
  const ts = now();
  db.prepare(`
    INSERT INTO counters (docId, clientId, counterNo, label, serviceIds, paused, createdAt, updatedAt)
    VALUES (?, ?, 1, 'Counter 1', '[]', 0, ?, ?)
  `).run(`${cid}_1`, cid, ts, ts);
}

// ---------- services ----------

export function getServices(clientId = DEFAULT_CLIENT_ID) {
  const cid = normalizeClientId(clientId);
  ensureClientDefaults(cid);
  const rows = getDb()
    .prepare("SELECT * FROM services WHERE clientId = ? AND active != 0")
    .all(cid)
    .map(mapService);
  rows.sort((a, b) => Number(a.sortOrder || 999) - Number(b.sortOrder || 999) || a.name.localeCompare(b.name));
  return rows;
}

export function listAllServices(clientId = DEFAULT_CLIENT_ID) {
  const cid = normalizeClientId(clientId);
  ensureClientDefaults(cid);
  const rows = getDb().prepare("SELECT * FROM services WHERE clientId = ?").all(cid).map(mapService);
  rows.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return Number(a.sortOrder || 999) - Number(b.sortOrder || 999) || (a.name || "").localeCompare(b.name || "");
  });
  return rows;
}

export function addService(clientId, service, actor = null) {
  const cid = normalizeClientId(clientId);
  const next = normalizeService(service);
  if (!next.id || !next.name || !next.prefix) throw new Error("Service name and prefix are required.");
  const ts = now();
  getDb().prepare(`
    INSERT INTO services (docId, clientId, id, name, prefix, icon, active, sortOrder, createdAt, updatedAt)
    VALUES (@docId, @clientId, @id, @name, @prefix, @icon, 1, @sortOrder, @ts, @ts)
    ON CONFLICT(docId) DO UPDATE SET
      name = @name, prefix = @prefix, icon = @icon, active = 1, updatedAt = @ts
  `).run({ docId: `${cid}_${next.id}`, clientId: cid, id: next.id, name: next.name, prefix: next.prefix, icon: next.icon, sortOrder: ts, ts });
  logActivity(cid, "service.added", { id: next.id, name: next.name, prefix: next.prefix }, actor);
  publish(cid, ["services"]);
  return next;
}

export function removeService(clientId, serviceId, actor = null) {
  const cid = normalizeClientId(clientId);
  getDb().prepare("UPDATE services SET active = 0, updatedAt = ? WHERE docId = ?").run(now(), `${cid}_${serviceId}`);
  logActivity(cid, "service.disabled", { id: serviceId }, actor);
  publish(cid, ["services"]);
}

export function reenableService(clientId, serviceId, actor = null) {
  const cid = normalizeClientId(clientId);
  getDb().prepare("UPDATE services SET active = 1, updatedAt = ? WHERE docId = ?").run(now(), `${cid}_${serviceId}`);
  logActivity(cid, "service.reenabled", { id: serviceId }, actor);
  publish(cid, ["services"]);
}

export function deleteService(clientId, serviceId, actor = null) {
  const cid = normalizeClientId(clientId);
  getDb().prepare("DELETE FROM services WHERE docId = ?").run(`${cid}_${serviceId}`);
  logActivity(cid, "service.deleted", { id: serviceId }, actor);
  publish(cid, ["services"]);
}

export function updateService(clientId, serviceId, updates, actor = null) {
  const cid = normalizeClientId(clientId);
  const sets = ["updatedAt = @ts"];
  const params = { ts: now(), docId: `${cid}_${serviceId}` };
  if (updates?.name) { sets.push("name = @name"); params.name = String(updates.name).trim(); }
  if (updates?.prefix) {
    const prefix = String(updates.prefix).trim().toUpperCase().slice(0, 4);
    sets.push("prefix = @prefix", "icon = @icon");
    params.prefix = prefix; params.icon = prefix;
  }
  getDb().prepare(`UPDATE services SET ${sets.join(", ")} WHERE docId = @docId`).run(params);
  logActivity(cid, "service.updated", { id: serviceId, ...updates }, actor);
  publish(cid, ["services"]);
}

// ---------- counters ----------

export function getCounters(clientId = DEFAULT_CLIENT_ID) {
  const cid = normalizeClientId(clientId);
  ensureClientDefaults(cid);
  return getDb()
    .prepare("SELECT * FROM counters WHERE clientId = ? ORDER BY counterNo")
    .all(cid)
    .map(mapCounter);
}

export function addCounter(label, clientId = DEFAULT_CLIENT_ID, serviceIds = [], actor = null) {
  const cid = normalizeClientId(clientId);
  const db = getDb();
  const maxNo = db.prepare("SELECT COALESCE(MAX(counterNo), 0) AS n FROM counters WHERE clientId = ?").get(cid).n;
  const counterNo = maxNo + 1;
  const cleanLabel = (label && label.trim()) || `Counter ${counterNo}`;
  const ts = now();
  db.prepare(`
    INSERT INTO counters (docId, clientId, counterNo, label, serviceIds, paused, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, 0, ?, ?)
  `).run(`${cid}_${counterNo}`, cid, counterNo, cleanLabel, JSON.stringify(serviceIds || []), ts, ts);
  logActivity(cid, "counter.added", { counterNo, label: cleanLabel }, actor);
  publish(cid, ["counters"]);
  return { counterNo, label: cleanLabel };
}

export function updateCounterLabel(clientId, counterNo, label, actor = null) {
  const cid = normalizeClientId(clientId);
  const cleanLabel = String(label || "").trim() || `Counter ${counterNo}`;
  getDb().prepare("UPDATE counters SET label = ?, updatedAt = ? WHERE docId = ?").run(cleanLabel, now(), `${cid}_${counterNo}`);
  logActivity(cid, "counter.renamed", { counterNo, label: cleanLabel }, actor);
  publish(cid, ["counters"]);
}

export function updateCounterServices(clientId, counterNo, serviceIds) {
  const cid = normalizeClientId(clientId);
  const ids = JSON.stringify(Array.isArray(serviceIds) ? serviceIds : []);
  const ts = now();
  getDb().prepare(`
    INSERT INTO counters (docId, clientId, counterNo, serviceIds, paused, createdAt, updatedAt)
    VALUES (@docId, @cid, @counterNo, @ids, 0, @ts, @ts)
    ON CONFLICT(docId) DO UPDATE SET serviceIds = @ids, updatedAt = @ts
  `).run({ docId: `${cid}_${counterNo}`, cid, counterNo: Number(counterNo), ids, ts });
  publish(cid, ["counters"]);
}

export function removeCounter(counterNo, clientId = DEFAULT_CLIENT_ID, actor = null) {
  const cid = normalizeClientId(clientId);
  const db = getDb();
  const row = db.prepare("SELECT * FROM counters WHERE docId = ?").get(`${cid}_${counterNo}`);
  if (!row) return;
  const tx = db.transaction(() => {
    if (row.currentTicketId) {
      db.prepare(`
        UPDATE tickets SET status = 'cancelled', cancelledReason = 'counter_removed',
          cancelledAt = ?, lastCounterNo = ?, responseDeadlineAt = NULL, updatedAt = ?
        WHERE id = ?
      `).run(now(), row.counterNo || null, now(), row.currentTicketId);
    }
    db.prepare("DELETE FROM counters WHERE docId = ?").run(`${cid}_${counterNo}`);
  });
  tx();
  logActivity(cid, "counter.removed", { counterNo, label: row.label }, actor);
  publish(cid, ["counters", "tickets"]);
}

export function pauseCounter(counterNo, clientId = DEFAULT_CLIENT_ID, actor = null) {
  const cid = normalizeClientId(clientId);
  const ts = now();
  getDb().prepare("UPDATE counters SET paused = 1, pausedAt = ?, updatedAt = ? WHERE docId = ?").run(ts, ts, `${cid}_${counterNo}`);
  logActivity(cid, "counter.paused", { counterNo }, actor);
  publish(cid, ["counters"]);
}

export function resumeCounter(counterNo, clientId = DEFAULT_CLIENT_ID, actor = null) {
  const cid = normalizeClientId(clientId);
  getDb().prepare("UPDATE counters SET paused = 0, pausedAt = NULL, updatedAt = ? WHERE docId = ?").run(now(), `${cid}_${counterNo}`);
  logActivity(cid, "counter.resumed", { counterNo }, actor);
  publish(cid, ["counters"]);
}

// ---------- tickets: reads ----------

export function getWaitingTickets(clientId = DEFAULT_CLIENT_ID, max = 15) {
  const cid = normalizeClientId(clientId);
  const rows = getDb()
    .prepare("SELECT * FROM tickets WHERE clientId = ? AND serviceDate = ? AND status = 'waiting'")
    .all(cid, getTodayKey())
    .map(mapTicket)
    .filter((t) => !isTicketExpired(t))
    .sort(sortTicketsForQueue);
  return max ? rows.slice(0, max) : rows;
}

export function getServingTickets(clientId = DEFAULT_CLIENT_ID) {
  const cid = normalizeClientId(clientId);
  return getDb()
    .prepare("SELECT * FROM tickets WHERE clientId = ? AND serviceDate = ? AND status = 'serving'")
    .all(cid, getTodayKey())
    .map(mapTicket)
    .sort((a, b) => Number(a.counterNo) - Number(b.counterNo));
}

export function getCompletedTickets(clientId = DEFAULT_CLIENT_ID, max = 8) {
  const cid = normalizeClientId(clientId);
  const rows = getDb()
    .prepare("SELECT * FROM tickets WHERE clientId = ? AND serviceDate = ? AND status = 'completed'")
    .all(cid, getTodayKey())
    .map(mapTicket)
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
  return max ? rows.slice(0, max) : rows;
}

export function getAllTickets(clientId = DEFAULT_CLIENT_ID) {
  const cid = normalizeClientId(clientId);
  return getDb()
    .prepare("SELECT * FROM tickets WHERE clientId = ? AND serviceDate = ?")
    .all(cid, getTodayKey())
    .map(mapTicket);
}

export function getTicketsInRange(clientId, fromDate, toDate) {
  const cid = normalizeClientId(clientId);
  return getDb()
    .prepare("SELECT * FROM tickets WHERE clientId = ? AND serviceDate >= ? AND serviceDate <= ?")
    .all(cid, fromDate, toDate)
    .map(mapTicket);
}

// ---------- tickets: create (sequence generator #6) ----------

export function createTicket({ clientId = DEFAULT_CLIENT_ID, serviceId, customerName, phone, priorityType }) {
  const cid = normalizeClientId(clientId);
  ensureClientDefaults(cid);
  const db = getDb();
  const service = getServices(cid).find((s) => s.id === serviceId || s.id === `${cid}_${serviceId}`);
  if (!service) throw new Error("Invalid service selected.");

  const serviceDate = getTodayKey();
  const sequenceId = `${cid}_${serviceDate}_${service.prefix}`;
  const cleanName = String(customerName || "").trim();
  const cleanPhone = String(phone || "").trim();
  const cleanPriority = ["SC", "PWD", "PG"].includes(priorityType) ? priorityType : null;
  const ts = now();

  const tx = db.transaction(() => {
    const seq = db.prepare("SELECT lastNumber FROM sequences WHERE id = ?").get(sequenceId);
    const next = (seq ? Number(seq.lastNumber || 0) : 0) + 1;
    db.prepare(`
      INSERT INTO sequences (id, clientId, serviceDate, prefix, lastNumber, updatedAt)
      VALUES (@id, @cid, @serviceDate, @prefix, @next, @ts)
      ON CONFLICT(id) DO UPDATE SET lastNumber = @next, updatedAt = @ts
    `).run({ id: sequenceId, cid, serviceDate, prefix: service.prefix, next, ts });

    const queueNumber = `${service.prefix}-${String(next).padStart(3, "0")}`;
    const ticketId = `${cid}_${serviceDate}_${queueNumber}`;
    const ticket = {
      id: ticketId,
      clientId: cid,
      serviceDate,
      serviceId: service.id,
      serviceName: service.name,
      prefix: service.prefix,
      queueNumber,
      customerName: cleanName || null,
      phone: cleanPhone || null,
      priorityType: cleanPriority,
      priorityRank: cleanPriority ? 0 : 1,
      status: "waiting",
      counterNo: null,
      lastCounterNo: null,
      calledAt: null,
      completedAt: null,
      cancelledAt: null,
      cancelledReason: null,
      recallAt: null,
      heldAt: null,
      returnedAt: null,
      responseDeadlineAt: null,
      expiresAt: null,
      createdAt: ts,
      updatedAt: ts,
    };
    db.prepare(`
      INSERT INTO tickets (id, clientId, serviceDate, serviceId, serviceName, prefix, queueNumber,
        customerName, phone, priorityType, priorityRank, status, counterNo, lastCounterNo,
        calledAt, completedAt, cancelledAt, cancelledReason, recallAt, heldAt, returnedAt,
        responseDeadlineAt, expiresAt, createdAt, updatedAt)
      VALUES (@id, @clientId, @serviceDate, @serviceId, @serviceName, @prefix, @queueNumber,
        @customerName, @phone, @priorityType, @priorityRank, @status, @counterNo, @lastCounterNo,
        @calledAt, @completedAt, @cancelledAt, @cancelledReason, @recallAt, @heldAt, @returnedAt,
        @responseDeadlineAt, @expiresAt, @createdAt, @updatedAt)
    `).run(ticket);
    return ticket;
  });

  const ticket = tx();
  publish(cid, ["tickets"]);
  return { ...ticket, orgName: process.env.QUEUE_ORG_NAME || "" };
}

// ---------- tickets: callNext (#5) ----------

export function callNext(counterNo, clientId = DEFAULT_CLIENT_ID) {
  const cid = normalizeClientId(clientId);
  ensureClientDefaults(cid);
  sweepQueueTimeouts(cid);
  const db = getDb();
  const docId = `${cid}_${counterNo}`;

  const counter = db.prepare("SELECT * FROM counters WHERE docId = ?").get(docId);
  if (!counter) return null;
  if (counter.currentTicketId) throw new Error(`Counter ${counterNo} still has an active ticket. Complete it first.`);
  if (counter.paused === 1) return null;

  const assigned = parseJson(counter.serviceIds, []);
  const nowMs = now();
  const candidates = db
    .prepare("SELECT * FROM tickets WHERE clientId = ? AND serviceDate = ? AND status = 'waiting'")
    .all(cid, getTodayKey())
    .filter((t) => !isTicketExpired(t, nowMs))
    .filter((t) => assigned.length === 0 || assigned.includes(t.serviceId))
    .sort(sortTicketsForQueue);
  if (candidates.length === 0) return null;

  // Synchronous + transactional: the first waiting candidate is claimed atomically.
  const claim = db.transaction((ticket) => {
    const fresh = db.prepare("SELECT status FROM tickets WHERE id = ?").get(ticket.id);
    if (!fresh || fresh.status !== "waiting") return null;
    const c = db.prepare("SELECT currentTicketId, paused, label, serviceIds FROM counters WHERE docId = ?").get(docId);
    if (!c || c.currentTicketId || c.paused === 1) return null;

    db.prepare(`
      UPDATE tickets SET status = 'serving', counterNo = ?, calledAt = ?,
        responseDeadlineAt = NULL, expiresAt = NULL, returnedAt = NULL, updatedAt = ?
      WHERE id = ?
    `).run(counterNo, nowMs, nowMs, ticket.id);
    db.prepare(`
      UPDATE counters SET currentTicketId = ?, currentQueueNumber = ?, currentCustomerName = ?,
        currentServiceName = ?, currentPriorityType = ?, recallAt = NULL, responseDeadlineAt = NULL, updatedAt = ?
      WHERE docId = ?
    `).run(ticket.id, ticket.queueNumber, ticket.customerName || null, ticket.serviceName,
      ticket.priorityType || null, nowMs, docId);
    return { ...mapTicket(ticket), status: "serving", counterNo, counterLabel: c.label || `Counter ${counterNo}` };
  });

  const result = claim(candidates[0]);
  if (result) publish(cid, ["tickets", "counters"]);
  return result;
}

export function completeCounter(counterNo, clientId = DEFAULT_CLIENT_ID) {
  const cid = normalizeClientId(clientId);
  const db = getDb();
  const docId = `${cid}_${counterNo}`;
  const tx = db.transaction(() => {
    const counter = db.prepare("SELECT currentTicketId FROM counters WHERE docId = ?").get(docId);
    if (!counter || !counter.currentTicketId) return false;
    db.prepare(`
      UPDATE tickets SET status = 'completed', completedAt = ?, responseDeadlineAt = NULL, expiresAt = NULL, updatedAt = ?
      WHERE id = ?
    `).run(now(), now(), counter.currentTicketId);
    clearCounter(docId);
    return true;
  });
  if (tx()) publish(cid, ["tickets", "counters"]);
}

export function holdCounter(counterNo, clientId = DEFAULT_CLIENT_ID) {
  const cid = normalizeClientId(clientId);
  const db = getDb();
  const docId = `${cid}_${counterNo}`;
  const tx = db.transaction(() => {
    const counter = db.prepare("SELECT currentTicketId FROM counters WHERE docId = ?").get(docId);
    if (!counter || !counter.currentTicketId) return false;
    const ts = now();
    db.prepare("UPDATE tickets SET recallAt = NULL, responseDeadlineAt = NULL, heldAt = ?, updatedAt = ? WHERE id = ?")
      .run(ts, ts, counter.currentTicketId);
    db.prepare("UPDATE counters SET recallAt = NULL, responseDeadlineAt = NULL, heldAt = ?, updatedAt = ? WHERE docId = ?")
      .run(ts, ts, docId);
    return true;
  });
  if (tx()) publish(cid, ["tickets", "counters"]);
}

export function recallCounter(counterNo, clientId = DEFAULT_CLIENT_ID) {
  const cid = normalizeClientId(clientId);
  const db = getDb();
  const docId = `${cid}_${counterNo}`;

  const counter = db.prepare("SELECT currentTicketId FROM counters WHERE docId = ?").get(docId);
  if (!counter || !counter.currentTicketId) return;
  const activeTicketId = counter.currentTicketId;
  const ts = now();
  // Phase 1: announce (no countdown yet).
  db.prepare("UPDATE tickets SET recallAt = ?, responseDeadlineAt = NULL, updatedAt = ? WHERE id = ?").run(ts, ts, activeTicketId);
  db.prepare("UPDATE counters SET recallAt = ?, responseDeadlineAt = NULL, updatedAt = ? WHERE docId = ?").run(ts, ts, docId);
  publish(cid, ["tickets", "counters"]);

  // Phase 2: after the speech window, start the 10s no-show countdown — unless
  // Hold was pressed (recallAt cleared) or the counter moved to another ticket.
  setTimeout(() => {
    try {
      const c = db.prepare("SELECT currentTicketId, recallAt FROM counters WHERE docId = ?").get(docId);
      if (!c || c.currentTicketId !== activeTicketId || !c.recallAt) return;
      const deadline = now() + RESPONSE_WINDOW_MS;
      db.prepare("UPDATE counters SET responseDeadlineAt = ?, updatedAt = ? WHERE docId = ?").run(deadline, now(), docId);
      db.prepare("UPDATE tickets SET responseDeadlineAt = ?, updatedAt = ? WHERE id = ?").run(deadline, now(), activeTicketId);
      publish(cid, ["tickets", "counters"]);
    } catch (_) { /* counter may have completed */ }
  }, RECALL_SPEECH_MS);
}

function clearCounter(docId) {
  getDb().prepare(`
    UPDATE counters SET currentTicketId = NULL, currentQueueNumber = NULL, currentCustomerName = NULL,
      currentServiceName = NULL, currentPriorityType = NULL, responseDeadlineAt = NULL, updatedAt = ?
    WHERE docId = ?
  `).run(now(), docId);
}

// ---------- timeout sweep (#7) ----------

export function sweepQueueTimeouts(clientId = DEFAULT_CLIENT_ID) {
  const cid = normalizeClientId(clientId);
  const db = getDb();
  const nowMs = now();
  const serviceDate = getTodayKey();
  let changed = false;

  const serving = db
    .prepare("SELECT * FROM tickets WHERE clientId = ? AND serviceDate = ? AND status = 'serving'")
    .all(cid, serviceDate);
  const sweep = db.transaction(() => {
    serving.forEach((ticket) => {
      const deadline = ticket.responseDeadlineAt;
      if (!deadline || deadline > nowMs) return;
      const fresh = db.prepare("SELECT status FROM tickets WHERE id = ?").get(ticket.id);
      if (!fresh || fresh.status !== "serving") return;
      db.prepare(`
        UPDATE tickets SET status = 'cancelled', cancelledReason = 'no_show_timeout', cancelledAt = ?,
          lastCounterNo = ?, responseDeadlineAt = NULL, expiresAt = NULL, updatedAt = ?
        WHERE id = ?
      `).run(nowMs, ticket.counterNo || null, nowMs, ticket.id);
      if (ticket.counterNo != null) {
        const docId = `${cid}_${ticket.counterNo}`;
        const c = db.prepare("SELECT currentTicketId FROM counters WHERE docId = ?").get(docId);
        if (c && c.currentTicketId === ticket.id) clearCounter(docId);
      }
      changed = true;
    });

    const waiting = db
      .prepare("SELECT * FROM tickets WHERE clientId = ? AND serviceDate = ? AND status = 'waiting'")
      .all(cid, serviceDate);
    waiting.forEach((ticket) => {
      if (!isTicketExpired(ticket, nowMs)) return;
      db.prepare(`
        UPDATE tickets SET status = 'cancelled', cancelledReason = 'no_show_timeout', cancelledAt = ?, updatedAt = ?
        WHERE id = ?
      `).run(nowMs, nowMs, ticket.id);
      changed = true;
    });
  });
  sweep();
  if (changed) publish(cid, ["tickets", "counters"]);
}

// ---------- daily reset (#7) ----------

export function resetTodayQueue(clientId = DEFAULT_CLIENT_ID) {
  const cid = normalizeClientId(clientId);
  const db = getDb();
  const serviceDate = getTodayKey();
  const tx = db.transaction(() => {
    db.prepare("UPDATE tickets SET status = 'cancelled', updatedAt = ? WHERE clientId = ? AND serviceDate = ?")
      .run(now(), cid, serviceDate);
    db.prepare(`
      UPDATE counters SET currentTicketId = NULL, currentQueueNumber = NULL, currentCustomerName = NULL,
        currentServiceName = NULL, currentPriorityType = NULL, responseDeadlineAt = NULL, updatedAt = ?
      WHERE clientId = ?
    `).run(now(), cid);
  });
  tx();
  publish(cid, ["tickets", "counters"]);
}

// ---------- activity log ----------

export function logActivity(clientId, action, details = {}, actor = null) {
  try {
    const cid = normalizeClientId(clientId);
    const actorJson = actor
      ? JSON.stringify({
          name: String(actor.name || "").trim() || actor.email || "",
          email: String(actor.email || "").trim().toLowerCase(),
          role: actor.role || "admin",
        })
      : null;
    getDb().prepare(`
      INSERT INTO activityLogs (clientId, action, details, actor, day, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(cid, action, JSON.stringify(details || {}), actorJson, getTodayKey(), now());
    publish(cid, ["activity"]);
  } catch (_) { /* logging must never break the caller */ }
}

export function logAuthEvent(clientId, type, actor) {
  return logActivity(clientId, `auth.${type}`, {}, actor);
}

export function getActivityLogs(clientId, max = 100) {
  const cid = normalizeClientId(clientId);
  return getDb()
    .prepare("SELECT * FROM activityLogs WHERE clientId = ? ORDER BY timestamp DESC LIMIT ?")
    .all(cid, max)
    .map((r) => ({ id: r.id, clientId: r.clientId, action: r.action, details: parseJson(r.details, {}), actor: parseJson(r.actor, null), day: r.day, timestamp: r.timestamp }));
}

// ---------- SMS templates + logs ----------

export function updateClientSmsTemplates(clientId, templates, actor = null) {
  const cid = normalizeClientId(clientId);
  const json = JSON.stringify({
    confirm: String(templates?.confirm || ""),
    serving: String(templates?.serving || ""),
    near: String(templates?.near || ""),
  });
  getDb().prepare("UPDATE clients SET smsTemplates = ?, updatedAt = ? WHERE id = ?").run(json, now(), cid);
  logActivity(cid, "sms.templates.updated", {}, actor);
  publish(cid, ["clients"]);
}

export function getSmsLogs(clientId, max = 100) {
  const cid = normalizeClientId(clientId);
  return getDb()
    .prepare("SELECT * FROM smsLogs WHERE clientId = ? ORDER BY createdAt DESC LIMIT ?")
    .all(cid, max);
}

// ---------- clients ----------

export function getClientInfo(clientId) {
  if (!clientId) return null;
  const cid = normalizeClientId(clientId);
  return mapClient(getDb().prepare("SELECT * FROM clients WHERE id = ?").get(cid));
}

export function updateClient(clientId, updates, actor = null) {
  const cid = normalizeClientId(clientId);
  const sets = ["updatedAt = @ts"];
  const params = { ts: now(), id: cid };
  if (updates?.name) { sets.push("name = @name"); params.name = String(updates.name).trim(); }
  if (updates?.logo !== undefined) { sets.push("logo = @logo"); params.logo = updates.logo || null; }
  if (updates?.themeColor !== undefined) { sets.push("themeColor = @themeColor"); params.themeColor = updates.themeColor || null; }
  getDb().prepare(`UPDATE clients SET ${sets.join(", ")} WHERE id = @id`).run(params);
  logActivity(cid, "client.updated", { fields: Object.keys(params).filter((k) => k !== "ts" && k !== "id") }, actor);
  publish(cid, ["clients"]);
}

export function createClientWithAdmin({ clientName, adminName, email, password }) {
  const db = getDb();
  const clientId = normalizeClientId(clientName);
  if (!clientId || !String(clientName || "").trim()) throw new Error("Client name is required.");
  const cleanEmail = validateEmail(email);
  const hashed = hashPassword(validatePassword(password));
  const ts = now();
  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO clients (id, name, status, createdAt, updatedAt)
      VALUES (?, ?, 'active', ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, updatedAt = excluded.updatedAt
    `).run(clientId, String(clientName).trim(), ts, ts);
    db.prepare(`
      INSERT INTO admins (email, password, name, role, clientId, clientName, active, createdAt, updatedAt)
      VALUES (?, ?, ?, 'admin', ?, ?, 1, ?, ?)
      ON CONFLICT(email) DO UPDATE SET password = excluded.password, name = excluded.name,
        clientId = excluded.clientId, clientName = excluded.clientName, updatedAt = excluded.updatedAt
    `).run(cleanEmail, hashed, String(adminName || "Admin").trim(), clientId, String(clientName).trim(), ts, ts);
  });
  tx();
  ensureClientDefaults(clientId);
  publish(clientId, ["clients", "admins"]);
  return { clientId, email: cleanEmail };
}

export function listClients() {
  return getDb().prepare("SELECT * FROM clients").all().map(mapClient).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

export function setClientStatus(clientId, status) {
  const cid = normalizeClientId(clientId);
  getDb().prepare("UPDATE clients SET status = ?, updatedAt = ? WHERE id = ?")
    .run(status === "suspended" ? "suspended" : "active", now(), cid);
  publish(cid, ["clients"]);
}

// ---------- admins ----------

export function listAdmins() {
  return getDb().prepare("SELECT * FROM admins").all().map(mapAdmin);
}

export function addAdminToClient(clientId, { email, password, name, role }) {
  const db = getDb();
  const cleanEmail = validateEmail(email);
  const hashed = hashPassword(validatePassword(password));
  if (db.prepare("SELECT email FROM admins WHERE email = ?").get(cleanEmail)) {
    throw new Error("An account with that email already exists.");
  }
  const client = db.prepare("SELECT name FROM clients WHERE id = ?").get(clientId);
  const clientName = client ? client.name : clientId;
  const cleanRole = role === "staff" ? "staff" : "admin";
  const ts = now();
  db.prepare(`
    INSERT INTO admins (email, password, name, role, clientId, clientName, active, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(cleanEmail, hashed, String(name || (cleanRole === "staff" ? "Counter Staff" : "Admin")).trim(), cleanRole, clientId, clientName, ts, ts);
  publish(clientId, ["admins"]);
  return { email: cleanEmail, role: cleanRole };
}

export function setAdminActive(email, active) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  getDb().prepare("UPDATE admins SET active = ?, updatedAt = ? WHERE email = ?").run(active ? 1 : 0, now(), cleanEmail);
}

export function deleteAdmin(email) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  getDb().prepare("DELETE FROM admins WHERE email = ?").run(cleanEmail);
}

export function updateAdminCredentials(currentEmail, updates) {
  const db = getDb();
  const cleanCurrent = String(currentEmail || "").trim().toLowerCase();
  if (!cleanCurrent) throw new Error("Current admin email is required.");
  const existing = db.prepare("SELECT * FROM admins WHERE email = ?").get(cleanCurrent);
  if (!existing) throw new Error("Admin user not found.");

  const newEmail = updates?.email ? validateEmail(updates.email) : null;
  const newPassword = updates?.password ? hashPassword(validatePassword(updates.password)) : null;
  const newName = updates?.name != null ? String(updates.name).trim() : null;

  if (newEmail && newEmail !== cleanCurrent) {
    if (db.prepare("SELECT email FROM admins WHERE email = ?").get(newEmail)) {
      throw new Error("Another admin already uses that email.");
    }
    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO admins (email, password, name, role, clientId, clientName, active, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(newEmail, newPassword || existing.password, newName || existing.name, existing.role,
        existing.clientId, existing.clientName, existing.active, existing.createdAt, now());
      db.prepare("DELETE FROM admins WHERE email = ?").run(cleanCurrent);
    });
    tx();
    return { email: newEmail };
  }

  const sets = ["updatedAt = @ts"];
  const params = { ts: now(), email: cleanCurrent };
  if (newPassword) { sets.push("password = @password"); params.password = newPassword; }
  if (newName) { sets.push("name = @name"); params.name = newName; }
  if (sets.length > 1) db.prepare(`UPDATE admins SET ${sets.join(", ")} WHERE email = @email`).run(params);
  return { email: cleanCurrent };
}

export function adminLogin(email, password) {
  const db = getDb();
  const cleanEmail = String(email || "").trim().toLowerCase();
  const row = db.prepare("SELECT * FROM admins WHERE email = ?").get(cleanEmail);
  if (!row || !verifyPassword(password, row.password)) throw new Error("Invalid admin email or password.");
  // Transparently upgrade any legacy plaintext password to a bcrypt hash on login.
  if (!isBcryptHash(row.password)) {
    db.prepare("UPDATE admins SET password = ?, updatedAt = ? WHERE email = ?").run(hashPassword(password), now(), cleanEmail);
  }
  if (row.active === 0) throw new Error("This admin account has been deactivated. Contact your system owner.");
  const client = db.prepare("SELECT status FROM clients WHERE id = ?").get(row.clientId);
  if (client && client.status === "suspended") {
    throw new Error("This client has been suspended. Please contact the system owner.");
  }
  ensureClientDefaults(row.clientId);
  return mapAdmin(row);
}

// ---------- superadmin ----------

// Internal: returns the stored superadmin record incl. the password hash. Seeds
// from env (hashing the fallback) on first read.
function getSuperAdminRecord() {
  const db = getDb();
  const row = db.prepare("SELECT data FROM systemConfig WHERE id = 'superadmin'").get();
  if (row) {
    const data = parseJson(row.data, {});
    return { email: data.email, password: data.password };
  }
  const fallbackEmail = (process.env.SUPERADMIN_EMAIL || "superadmin@local.test").toLowerCase();
  const fallbackPassword = hashPassword(process.env.SUPERADMIN_PASSWORD || "superadmin123");
  db.prepare("INSERT OR REPLACE INTO systemConfig (id, data) VALUES ('superadmin', ?)")
    .run(JSON.stringify({ email: fallbackEmail, password: fallbackPassword, updatedAt: now() }));
  return { email: fallbackEmail, password: fallbackPassword };
}

// Public: never leaks the password (hash) to the client.
export function getSuperAdminConfig() {
  return { email: getSuperAdminRecord().email, password: "" };
}

export function updateSuperAdminCredentials(updates) {
  const current = getSuperAdminRecord();
  const nextEmail = updates?.email != null ? validateEmail(updates.email) : current.email;
  const nextPassword = updates?.password ? hashPassword(validatePassword(updates.password)) : current.password;
  if (!nextEmail) throw new Error("Email is required.");
  if (!nextPassword) throw new Error("Password is required.");
  getDb().prepare("INSERT OR REPLACE INTO systemConfig (id, data) VALUES ('superadmin', ?)")
    .run(JSON.stringify({ email: nextEmail, password: nextPassword, updatedAt: now() }));
  return { email: nextEmail };
}

export function superAdminLogin(email, password) {
  const record = getSuperAdminRecord();
  const expectedEmail = (record.email || process.env.SUPERADMIN_EMAIL || "superadmin@local.test").toLowerCase();
  if (String(email || "").trim().toLowerCase() !== expectedEmail || !verifyPassword(password, record.password)) {
    throw new Error("Invalid superadmin login.");
  }
  // Upgrade a legacy plaintext superadmin password to a hash on first login.
  if (!isBcryptHash(record.password)) {
    getDb().prepare("INSERT OR REPLACE INTO systemConfig (id, data) VALUES ('superadmin', ?)")
      .run(JSON.stringify({ email: expectedEmail, password: hashPassword(password), updatedAt: now() }));
  }
  return { email: expectedEmail, role: "superadmin" };
}

export function getSystemAnalytics() {
  const db = getDb();
  const today = getTodayKey();
  const clients = db.prepare("SELECT * FROM clients").all().map(mapClient);
  const tickets = db.prepare("SELECT * FROM tickets WHERE serviceDate = ?").all(today);
  const admins = db.prepare("SELECT * FROM admins").all();

  const byClient = {};
  tickets.forEach((t) => {
    const key = t.clientId || "unknown";
    if (!byClient[key]) byClient[key] = { total: 0, completed: 0, cancelled: 0, waiting: 0, serving: 0 };
    byClient[key].total += 1;
    if (t.status === "completed") byClient[key].completed += 1;
    else if (t.status === "cancelled") byClient[key].cancelled += 1;
    else if (t.status === "waiting") byClient[key].waiting += 1;
    else if (t.status === "serving") byClient[key].serving += 1;
  });

  const totalTickets = tickets.length;
  const totalCompleted = tickets.filter((t) => t.status === "completed").length;
  const completionRate = totalTickets ? Math.round((totalCompleted / totalTickets) * 100) : 0;
  const activeClients = clients.filter((c) => (c.status || "active") === "active").length;
  const suspendedClients = clients.filter((c) => c.status === "suspended").length;

  return {
    totalClients: clients.length,
    activeClients,
    suspendedClients,
    totalAdmins: admins.length,
    totalTicketsToday: totalTickets,
    totalCompletedToday: totalCompleted,
    completionRate,
    perClient: clients
      .map((c) => ({ id: c.id, name: c.name, status: c.status || "active", ...(byClient[c.id] || { total: 0, completed: 0, cancelled: 0, waiting: 0, serving: 0 }) }))
      .sort((a, b) => b.total - a.total),
  };
}

// ---------- device pairings ----------

export function getPairings(clientId) {
  const cid = normalizeClientId(clientId);
  return getDb().prepare("SELECT * FROM pairings WHERE clientId = ?").all(cid).map(mapPairing);
}

export function createPairingCode(clientId, device, actor = null) {
  const cid = normalizeClientId(clientId);
  ensureClientDefaults(cid);
  const code = makeCode();
  const type = ["counter", "display"].includes(device.type) ? device.type : "kiosk";
  const typeLabels = { kiosk: "Kiosk", counter: "Counter", display: "Display" };
  const cleanLabel = String(device.label || `${typeLabels[type]} Device`).trim();
  const ts = now();
  getDb().prepare(`
    INSERT INTO pairings (code, clientId, type, counterNo, label, autoPrint, silentPrinter, serviceIds, active, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(code, cid, type, type === "counter" ? Number(device.counterNo || 1) : null, cleanLabel,
    device.autoPrint !== false ? 1 : 0, device.silentPrinter ? 1 : 0,
    JSON.stringify(type === "kiosk" && Array.isArray(device.serviceIds) ? device.serviceIds : []), ts, ts);
  logActivity(cid, "pairing.created", { code, type, label: cleanLabel, counterNo: type === "counter" ? Number(device.counterNo || 1) : null }, actor);
  publish(cid, ["pairings"]);
  return code;
}

export function updatePairingServices(code, serviceIds, actor = null) {
  const db = getDb();
  const cleanCode = String(code || "").trim().toUpperCase();
  if (!cleanCode) throw new Error("Pairing code is required.");
  const before = db.prepare("SELECT * FROM pairings WHERE code = ?").get(cleanCode);
  const cleanIds = Array.isArray(serviceIds) ? serviceIds : [];
  db.prepare("UPDATE pairings SET serviceIds = ?, updatedAt = ? WHERE code = ?").run(JSON.stringify(cleanIds), now(), cleanCode);
  if (before) {
    logActivity(before.clientId, "pairing.services_updated", { code: cleanCode, label: before.label, type: before.type, count: cleanIds.length }, actor);
    publish(before.clientId, ["pairings"]);
  }
}

export function setPairingActive(code, active, actor = null) {
  const db = getDb();
  const cleanCode = String(code || "").trim().toUpperCase();
  if (!cleanCode) throw new Error("Pairing code is required.");
  const before = db.prepare("SELECT * FROM pairings WHERE code = ?").get(cleanCode);
  db.prepare("UPDATE pairings SET active = ?, updatedAt = ? WHERE code = ?").run(active ? 1 : 0, now(), cleanCode);
  if (before) {
    logActivity(before.clientId, active ? "pairing.reenabled" : "pairing.disabled", { code: cleanCode, label: before.label, type: before.type }, actor);
    publish(before.clientId, ["pairings"]);
  }
}

export function deletePairing(code, actor = null) {
  const db = getDb();
  const cleanCode = String(code || "").trim().toUpperCase();
  if (!cleanCode) throw new Error("Pairing code is required.");
  const before = db.prepare("SELECT * FROM pairings WHERE code = ?").get(cleanCode);
  db.prepare("DELETE FROM pairings WHERE code = ?").run(cleanCode);
  if (before) {
    logActivity(before.clientId, "pairing.deleted", { code: cleanCode, label: before.label, type: before.type }, actor);
    publish(before.clientId, ["pairings"]);
  }
}

export function resolvePairingCode(code) {
  const cleanCode = String(code || "").trim().toUpperCase();
  if (!cleanCode) return null;
  const row = getDb().prepare("SELECT * FROM pairings WHERE code = ?").get(cleanCode);
  if (!row || row.active === 0) return null;
  ensureClientDefaults(row.clientId);
  return mapPairing(row);
}
