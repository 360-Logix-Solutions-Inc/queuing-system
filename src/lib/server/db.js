// Server-only SQLite connection + schema. Never import this from a client
// component — better-sqlite3 is a native Node module. The DB file lives in the
// Electron userData dir (QUEUE_DB_PATH set by main.js) or ./data/queue.db in dev.
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

// Cache the connection on globalThis so Next.js dev hot-reload doesn't open a
// new handle (and leak WAL locks) on every module re-evaluation.
const GLOBAL_KEY = "__queueDb__";

function resolveDbPath() {
  if (process.env.QUEUE_DB_PATH) return process.env.QUEUE_DB_PATH;
  const dir = path.join(process.cwd(), "data");
  return path.join(dir, "queue.db");
}

function createConnection() {
  const dbPath = resolveDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  migrate(db);
  return db;
}

export function getDb() {
  if (!globalThis[GLOBAL_KEY]) {
    globalThis[GLOBAL_KEY] = createConnection();
  }
  return globalThis[GLOBAL_KEY];
}

// Create all tables + indexes on first run. Uses IF NOT EXISTS so it is safe to
// call on every connection open.
function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id           TEXT PRIMARY KEY,
      name         TEXT,
      status       TEXT DEFAULT 'active',
      logo         TEXT,
      themeColor   TEXT,
      smsTemplates TEXT,           -- JSON { confirm, serving, near }
      createdAt    INTEGER,
      updatedAt    INTEGER
    );

    CREATE TABLE IF NOT EXISTS services (
      docId      TEXT PRIMARY KEY, -- clientId + '_' + serviceId
      clientId   TEXT NOT NULL,
      id         TEXT NOT NULL,    -- raw service id
      name       TEXT,
      prefix     TEXT,
      icon       TEXT,
      active     INTEGER DEFAULT 1,
      sortOrder  INTEGER,
      createdAt  INTEGER,
      updatedAt  INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_services_client ON services (clientId);

    CREATE TABLE IF NOT EXISTS counters (
      docId               TEXT PRIMARY KEY, -- clientId + '_' + counterNo
      clientId            TEXT NOT NULL,
      counterNo           INTEGER NOT NULL,
      label               TEXT,
      serviceIds          TEXT,             -- JSON array
      currentTicketId     TEXT,
      currentQueueNumber  TEXT,
      currentCustomerName TEXT,
      currentServiceName  TEXT,
      currentPriorityType TEXT,
      paused              INTEGER DEFAULT 0,
      pausedAt            INTEGER,
      recallAt            INTEGER,
      heldAt              INTEGER,
      responseDeadlineAt  INTEGER,
      createdAt           INTEGER,
      updatedAt           INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_counters_client ON counters (clientId);

    CREATE TABLE IF NOT EXISTS sequences (
      id          TEXT PRIMARY KEY, -- clientId + '_' + date + '_' + prefix
      clientId    TEXT,
      serviceDate TEXT,
      prefix      TEXT,
      lastNumber  INTEGER DEFAULT 0,
      updatedAt   INTEGER
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id                 TEXT PRIMARY KEY,
      clientId           TEXT NOT NULL,
      serviceDate        TEXT NOT NULL,
      serviceId          TEXT,
      serviceName        TEXT,
      prefix             TEXT,
      queueNumber        TEXT,
      customerName       TEXT,
      phone              TEXT,
      priorityType       TEXT,
      priorityRank       INTEGER DEFAULT 1,
      status             TEXT DEFAULT 'waiting',
      counterNo          INTEGER,
      lastCounterNo      INTEGER,
      calledAt           INTEGER,
      completedAt        INTEGER,
      cancelledAt        INTEGER,
      cancelledReason    TEXT,
      recallAt           INTEGER,
      heldAt             INTEGER,
      returnedAt         INTEGER,
      responseDeadlineAt INTEGER,
      expiresAt          INTEGER,
      createdAt          INTEGER,
      updatedAt          INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_tickets_lookup ON tickets (clientId, serviceDate, status);
    CREATE INDEX IF NOT EXISTS idx_tickets_date ON tickets (clientId, serviceDate);

    CREATE TABLE IF NOT EXISTS admins (
      email      TEXT PRIMARY KEY,
      password   TEXT,             -- plaintext today; bcrypt hash in Phase B
      name       TEXT,
      role       TEXT DEFAULT 'admin',
      clientId   TEXT,
      clientName TEXT,
      active     INTEGER DEFAULT 1,
      createdAt  INTEGER,
      updatedAt  INTEGER
    );

    CREATE TABLE IF NOT EXISTS pairings (
      code          TEXT PRIMARY KEY,
      clientId      TEXT,
      type          TEXT,          -- kiosk | counter | display
      counterNo     INTEGER,
      label         TEXT,
      autoPrint     INTEGER DEFAULT 1,
      silentPrinter INTEGER DEFAULT 0,
      serviceIds    TEXT,          -- JSON array
      active        INTEGER DEFAULT 1,
      createdAt     INTEGER,
      updatedAt     INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_pairings_client ON pairings (clientId);

    CREATE TABLE IF NOT EXISTS activityLogs (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      clientId  TEXT,
      action    TEXT,
      details   TEXT,              -- JSON
      actor     TEXT,              -- JSON { name, email, role }
      day       TEXT,
      timestamp INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_activity_client ON activityLogs (clientId, timestamp);

    CREATE TABLE IF NOT EXISTS smsLogs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      clientId    TEXT,
      type        TEXT,
      phone       TEXT,
      message     TEXT,
      status      TEXT,            -- sent | failed
      error       TEXT,
      queueNumber TEXT,
      createdAt   INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_sms_client ON smsLogs (clientId, createdAt);

    CREATE TABLE IF NOT EXISTS systemConfig (
      id   TEXT PRIMARY KEY,
      data TEXT               -- JSON
    );
  `);

  // Additive column migrations (SQLite has no "ADD COLUMN IF NOT EXISTS").
  addColumnIfMissing(db, "tickets", "nearNotifiedAt", "INTEGER");
  addColumnIfMissing(db, "tickets", "nearNotifiedPosition", "INTEGER");
}

function addColumnIfMissing(db, table, column, type) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (cols.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}
