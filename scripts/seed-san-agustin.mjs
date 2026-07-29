// Seed a fresh, fully-offline database for the Municipality of San Agustin, Romblon.
// Wipes ALL local data, then creates the default tenant (branding + seal), its
// municipal service offices, one counter, and an admin login.
//
// Run:  node scripts/seed-san-agustin.mjs
// Target DB: QUEUE_DB_PATH env, else ./data/queue.db (dev). In production point
// QUEUE_DB_PATH at the Electron userData queue.db before running.
import { pathToFileURL } from "node:url";
import path from "node:path";

process.env.QUEUE_DB_PATH = process.env.QUEUE_DB_PATH || path.join(process.cwd(), "data", "queue.db");
process.env.QUEUE_ORG_NAME = process.env.QUEUE_ORG_NAME || "Municipality of San Agustin, Romblon";

const ORG_NAME = "Municipality of San Agustin, Romblon";
const LOGO = "/romblon-seal.png";
const THEME = process.env.SEED_THEME || "#0f766e"; // teal
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@sanagustin.gov.ph";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "SanAgustin2026";
const ADMIN_NAME = process.env.SEED_ADMIN_NAME || "San Agustin Admin";

const base = pathToFileURL(path.join(process.cwd(), "src", "lib", "server") + path.sep).href;
const { getDb } = await import(new URL("db.js", base).href);
const store = await import(new URL("store.js", base).href);

const db = getDb();
const now = Date.now();

console.log("Wiping existing data…");
const tables = ["tickets", "sequences", "counters", "services", "pairings", "admins", "clients", "activityLogs", "smsLogs", "systemConfig"];
db.transaction(() => {
  for (const t of tables) db.prepare(`DELETE FROM ${t}`).run();
})();

console.log("Creating default tenant (San Agustin branding)…");
db.prepare(`
  INSERT INTO clients (id, name, status, logo, themeColor, smsTemplates, createdAt, updatedAt)
  VALUES ('default', ?, 'active', ?, ?, NULL, ?, ?)
`).run(ORG_NAME, LOGO, THEME, now, now);

console.log("Seeding municipal services + counter…");
store.ensureClientDefaults("default"); // seeds the San Agustin SERVICES + Counter 1

console.log("Creating admin login…");
store.addAdminToClient("default", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, name: ADMIN_NAME, role: "admin" });

// Force-seed the superadmin record (hashed) so it exists in the fresh DB.
store.getSuperAdminConfig();

const services = store.getServices("default");
const counters = store.getCounters("default");
console.log("\n────────────────────────────────────────────");
console.log(" San Agustin, Romblon — seed complete");
console.log("────────────────────────────────────────────");
console.log(" Org:       ", ORG_NAME);
console.log(" Services:  ", services.map((s) => `${s.prefix} ${s.name}`).join("\n             "));
console.log(" Counters:  ", counters.map((c) => c.label).join(", "));
console.log(" Admin URL:  /admin");
console.log(" Admin login:", ADMIN_EMAIL, "/", ADMIN_PASSWORD, "  <-- CHANGE THIS after first login");
console.log(" Superadmin: /superadmin  (env SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD, default superadmin@local.test / superadmin123)");
console.log("────────────────────────────────────────────\n");
