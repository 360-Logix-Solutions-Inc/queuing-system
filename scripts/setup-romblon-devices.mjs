// Adds the Municipal Agriculture frontline service and creates device pairing
// codes (kiosk / counter / display) for the San Agustin, Romblon tenant so its
// branded screens can be opened immediately. Isolated to San Agustin's docs.
import { readFileSync } from "node:fs";
import path from "node:path";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";

function parseEnv(f){const o={};let t="";try{t=readFileSync(f,"utf8")}catch{return o}for(const r of t.split(/\r?\n/)){const l=r.trim();if(!l||l.startsWith("#"))continue;const b=l.replace(/^export\s+/,"");const e=b.indexOf("=");if(e===-1)continue;const k=b.slice(0,e).trim();let v=b.slice(e+1).trim();if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);o[k]=v}return o}
const env = parseEnv(path.join(process.cwd(), ".env"));
const cfg = { apiKey: env.FIREBASE_API_KEY, authDomain: env.FIREBASE_AUTH_DOMAIN, projectId: env.FIREBASE_PROJECT_ID, storageBucket: env.FIREBASE_STORAGE_BUCKET, messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID, appId: env.FIREBASE_APP_ID };
if (!cfg.apiKey) { console.error("no firebase config"); process.exit(1); }
const db = getFirestore(initializeApp(cfg));

const clientId = "municipality_of_san_agustin_romblon";

function makeCode(len = 6) {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = ""; for (let i = 0; i < len; i++) c += abc[Math.floor(Math.random() * abc.length)];
  return c;
}

// 1) Add Municipal Agriculture Office as a frontline service (sortOrder 9).
await setDoc(doc(db, "queueServices", `${clientId}_agriculture`), {
  id: "agriculture", name: "Municipal Agriculture Office", prefix: "AG", icon: "AG",
  clientId, active: true, sortOrder: 9, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
}, { merge: true });

// 2) Device pairing codes.
const devices = [
  { type: "kiosk", label: "San Agustin Kiosk", serviceIds: [] },
  { type: "display", label: "San Agustin Display" },
  { type: "counter", label: "San Agustin Counter 1", counterNo: 1 },
];
const created = [];
for (const d of devices) {
  const code = makeCode();
  await setDoc(doc(db, "devicePairings", code), {
    code, clientId, type: d.type,
    counterNo: d.type === "counter" ? (d.counterNo || 1) : null,
    label: d.label, autoPrint: true, silentPrinter: false,
    serviceIds: d.type === "kiosk" ? (d.serviceIds || []) : [],
    active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  created.push({ type: d.type, code });
}

console.log("\n────────────────────────────────────────────");
console.log(" San Agustin device pairing codes");
console.log("────────────────────────────────────────────");
for (const c of created) console.log(` ${c.type.padEnd(8)} code: ${c.code}   ->  /${c.type}?pair=${c.code}`);
console.log("────────────────────────────────────────────");
console.log(" Open those URLs (or enter the code on each device) to see the");
console.log(" San Agustin seal + teal theme + municipal services.\n");
process.exit(0);
