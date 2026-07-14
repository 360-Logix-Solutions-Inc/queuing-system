// ONE-TIME: create the "Municipality of San Agustin, Romblon" tenant directly in
// the live Firebase project (client doc + bcrypt-hashed admin + municipal
// services + one counter + seal branding). Isolated to San Agustin's own doc IDs
// — does NOT touch any other tenant (e.g. Quezon City).
//
// Run:  node scripts/seed-romblon-firebase.mjs
import { readFileSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

// --- read Firebase config from .env (standalone node has no auto .env load) ---
function parseEnv(file) {
  const out = {};
  let text = "";
  try { text = readFileSync(file, "utf8"); } catch { return out; }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.replace(/^export\s+/, "").indexOf("=");
    if (eq === -1) continue;
    const body = line.replace(/^export\s+/, "");
    const key = body.slice(0, eq).trim();
    let val = body.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    out[key] = val;
  }
  return out;
}

const env = parseEnv(path.join(process.cwd(), ".env"));
const firebaseConfig = {
  apiKey: env.FIREBASE_API_KEY,
  authDomain: env.FIREBASE_AUTH_DOMAIN,
  projectId: env.FIREBASE_PROJECT_ID,
  storageBucket: env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID,
  appId: env.FIREBASE_APP_ID,
};
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error("Missing FIREBASE_* values in .env — cannot connect.");
  process.exit(1);
}

// mirror cleanId() / normalizeClientId() from queueConstants
function cleanId(v) {
  return String(v || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 42);
}

const CLIENT_NAME = process.env.SEED_CLIENT_NAME || "Municipality of San Agustin, Romblon";
const clientId = cleanId(CLIENT_NAME);
const ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL || "admin@sanagustin.gov.ph").toLowerCase();
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "SanAgustin2026";
const ADMIN_NAME = process.env.SEED_ADMIN_NAME || "San Agustin Admin";
const THEME = process.env.SEED_THEME || "#0f766e";

let logo = null;
try { logo = readFileSync(path.join(process.cwd(), "public", "romblon-seal.dataurl.txt"), "utf8").trim(); } catch { logo = "/romblon-seal.png"; }

// Municipal LGU service offices for San Agustin.
const SERVICES = [
  { id: "business_permit", name: "Business Permit & Licensing", prefix: "BP" },
  { id: "treasury", name: "Treasurer's Office (Payments)", prefix: "TR" },
  { id: "assessor", name: "Municipal Assessor's Office", prefix: "AS" },
  { id: "civil_registry", name: "Civil Registry (LCR)", prefix: "CR" },
  { id: "health", name: "Municipal Health Office / RHU", prefix: "HC" },
  { id: "social_welfare", name: "Social Welfare (MSWDO)", prefix: "SW" },
  { id: "engineering", name: "Engineering / Building Permit", prefix: "EN" },
  { id: "mayor_office", name: "Mayor's Office", prefix: "MO" },
];

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log(`Connecting to Firebase project: ${firebaseConfig.projectId}`);
console.log(`Creating tenant "${CLIENT_NAME}" (id: ${clientId})…`);

// 1) Client doc (with seal + theme branding)
await setDoc(doc(db, "clients", clientId), {
  id: clientId,
  name: CLIENT_NAME,
  status: "active",
  logo,
  themeColor: THEME,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
}, { merge: true });

// 2) Admin login (bcrypt-hashed). Do not clobber an existing admin's password.
const adminRef = doc(db, "adminUsers", ADMIN_EMAIL);
const adminSnap = await getDoc(adminRef);
if (adminSnap.exists()) {
  console.log(`! Admin ${ADMIN_EMAIL} already exists — leaving its password unchanged.`);
} else {
  await setDoc(adminRef, {
    email: ADMIN_EMAIL,
    password: bcrypt.hashSync(ADMIN_PASSWORD, 10),
    name: ADMIN_NAME,
    role: "admin",
    clientId,
    clientName: CLIENT_NAME,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// 3) Services
for (let i = 0; i < SERVICES.length; i += 1) {
  const s = SERVICES[i];
  await setDoc(doc(db, "queueServices", `${clientId}_${s.id}`), {
    id: s.id,
    name: s.name,
    prefix: s.prefix,
    icon: s.prefix,
    clientId,
    active: true,
    sortOrder: i + 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// 4) One counter
await setDoc(doc(db, "queueCounters", `${clientId}_1`), {
  clientId,
  counterNo: 1,
  label: "Counter 1",
  serviceIds: [],
  currentTicketId: null,
  currentQueueNumber: null,
  currentCustomerName: null,
  currentServiceName: null,
  currentPriorityType: null,
  responseDeadlineAt: null,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
}, { merge: true });

console.log("\n────────────────────────────────────────────");
console.log(" San Agustin, Romblon tenant CREATED in Firebase");
console.log("────────────────────────────────────────────");
console.log(" Tenant:   ", CLIENT_NAME, `(${clientId})`);
console.log(" Services: ", SERVICES.map((s) => s.prefix).join(", "));
console.log(" Admin URL: /admin");
console.log(" Admin login:", ADMIN_EMAIL, "/", adminSnap.exists() ? "(unchanged — existing account)" : ADMIN_PASSWORD);
console.log("────────────────────────────────────────────\n");
process.exit(0);
