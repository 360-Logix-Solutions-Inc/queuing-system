// Server-only Firestore access for API routes: reads per-client SMS templates
// and writes SMS send logs. Do NOT import from client components.
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { DEFAULT_SMS_TEMPLATES } from "./smsTemplates";

let _db = null;
export function getServerDb() {
  if (_db) return _db;
  const config = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
  };
  const app = getApps()[0] || initializeApp(config);
  // NOTE: `firebase` must stay in serverExternalPackages (next.config.mjs).
  // Bundled into the server, the browser build gets resolved: reads negotiate
  // fine but writes never complete — measured, addDoc still pending after 12s
  // while the identical write from plain Node returned in under a second. That
  // is why smsLogs sat empty while texts were going out. Required at runtime
  // from node_modules instead, the same write lands in ~900ms.
  _db = getFirestore(app);
  return _db;
}

// Mirror of cleanId() in firebaseClient so log clientId matches what the admin
// listener queries with.
export function normalizeClientId(clientId) {
  const clean = String(clientId || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return clean || "default";
}

export async function getClientSmsTemplates(clientId) {
  const fallback = { ...DEFAULT_SMS_TEMPLATES };
  if (!clientId) return fallback;
  try {
    const db = getServerDb();
    const snap = await getDoc(doc(db, "clients", normalizeClientId(clientId)));
    const t = snap.exists() ? snap.data().smsTemplates : null;
    if (!t) return fallback;
    return {
      confirm: t.confirm || fallback.confirm,
      serving: t.serving || fallback.serving,
      near: t.near || fallback.near,
    };
  } catch (_) {
    return fallback;
  }
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Number of counters that can actively serve right now (non-paused), min 1.
export async function getActiveLanes(clientId) {
  try {
    const db = getServerDb();
    const snap = await getDocs(
      query(collection(db, "queueCounters"), where("clientId", "==", normalizeClientId(clientId)))
    );
    return Math.max(1, snap.docs.filter((d) => !d.data().paused).length);
  } catch (_) {
    return 1;
  }
}

function ts(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  return Number(value) || 0;
}

// Waiting count, active lanes, and this ticket's 1-based position in the queue
// (respecting priority order) — used to estimate wait time and show "pang-ilan".
export async function getWaitContext(clientId, queueNumber) {
  try {
    const db = getServerDb();
    const cid = normalizeClientId(clientId);
    const [waitSnap, lanes] = await Promise.all([
      getDocs(
        query(
          collection(db, "queueTickets"),
          where("clientId", "==", cid),
          where("serviceDate", "==", todayKey()),
          where("status", "==", "waiting")
        )
      ),
      getActiveLanes(cid),
    ]);
    const sorted = waitSnap.docs
      .map((d) => d.data())
      .sort(
        (a, b) =>
          Number(a.priorityRank ?? 1) - Number(b.priorityRank ?? 1) ||
          ts(a.createdAt) - ts(b.createdAt)
      );
    let position = sorted.findIndex((t) => t.queueNumber === queueNumber) + 1;
    if (position <= 0) position = sorted.length || 1;
    return { waiting: sorted.length, lanes, position };
  } catch (_) {
    return { waiting: 0, lanes: 1, position: 1 };
  }
}

// Format an estimated wait as a human, formal Tagalog string.
export function formatWaitMinutes(peopleAhead, lanes) {
  const ahead = Math.max(0, Number(peopleAhead) || 0);
  if (ahead <= 0) return ""; // first in line — no wait time at all
  const avg = Math.max(1, Number(process.env.AVG_SERVICE_MINUTES) || 5);
  const mins = Math.max(avg, Math.ceil(ahead / Math.max(1, Number(lanes) || 1)) * avg);
  return `~${mins} min`;
}

// Persist a send attempt. Never throws — logging must not break ticketing.
export async function logSms(entry) {
  try {
    const db = getServerDb();
    await addDoc(collection(db, "smsLogs"), {
      clientId: normalizeClientId(entry.clientId),
      type: entry.type || "",
      phone: entry.phone || "",
      message: entry.message || "",
      status: entry.status || "", // "sent" | "failed"
      error: entry.error || null,
      queueNumber: entry.queueNumber || null,
      createdAt: serverTimestamp(),
    });
  } catch (_) {
    /* swallow */
  }
}
