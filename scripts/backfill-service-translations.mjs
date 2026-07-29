// Adds a `names` translation map to existing queueServices documents, so the
// kiosk's language switcher also translates the service cards.
//
//   node scripts/backfill-service-translations.mjs <clientId>            # preview
//   node scripts/backfill-service-translations.mjs <clientId> --apply    # write
//
// Previews by default: it prints every intended change and writes nothing until
// --apply is passed.
//
// The translations live in Firestore alongside the service, NOT fetched from a
// translation API at runtime. Firestore's offline cache then carries them, so
// the kiosk keeps showing Korean or German with the internet down — which is
// the state to design for at a municipal hall.
//
// Services whose id is not in the table below are reported and skipped; add an
// entry and re-run. Existing `names` maps are merged into, never overwritten.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, query, where, getDocs, updateDoc, doc,
} from "firebase/firestore";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function readEnv() {
  const out = {};
  try {
    for (const line of readFileSync(path.join(root, ".env"), "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch (_) {}
  return { ...out, ...process.env };
}

const env = readEnv();
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

// Only the visitor languages: Filipino speakers ask for these counters by their
// English names, so translating them there would hurt scanning, not help it.
const TRANSLATIONS = {
  business_permit:     { ko: "사업 허가", zh: "营业执照", ja: "事業許可", de: "Gewerbeerlaubnis", fr: "Permis d'exploitation", es: "Permiso de negocio" },
  working_permit:      { ko: "취업 허가", zh: "工作许可", ja: "就労許可", de: "Arbeitserlaubnis", fr: "Permis de travail", es: "Permiso de trabajo" },
  pwd_senior_id:       { ko: "장애인 · 고령자 신분증", zh: "残障 / 长者证件", ja: "障がい者・高齢者ID", de: "Ausweis für Behinderte / Senioren", fr: "Carte handicap / senior", es: "Credencial discapacidad / adulto mayor" },
  civil_registry:      { ko: "가족관계 서류", zh: "户籍文件", ja: "戸籍関係書類", de: "Personenstandsurkunden", fr: "Actes d'état civil", es: "Documentos del registro civil" },
  treasury:            { ko: "수납 및 납부", zh: "缴费", ja: "納付・支払い", de: "Kasse / Zahlung", fr: "Trésorerie / Paiement", es: "Tesorería / Pago" },
  assessor:            { ko: "재산 평가", zh: "房产评估", ja: "資産評価", de: "Grundstücksbewertung", fr: "Évaluation foncière", es: "Catastro" },
  health_certificate:  { ko: "건강 증명서", zh: "健康证明", ja: "健康証明書", de: "Gesundheitszeugnis", fr: "Certificat de santé", es: "Certificado de salud" },
  barangay_clearance:  { ko: "바랑가이 증명서", zh: "社区证明", ja: "バランガイ証明書", de: "Barangay-Bescheinigung", fr: "Attestation de barangay", es: "Certificado de barangay" },
  mayors_office:       { ko: "시장실", zh: "市长办公室", ja: "市長室", de: "Bürgermeisteramt", fr: "Bureau du maire", es: "Oficina del alcalde" },
  engineering:         { ko: "건설 · 공학과", zh: "工程处", ja: "土木課", de: "Bauamt", fr: "Service technique", es: "Oficina de ingeniería" },
  social_welfare:      { ko: "사회복지과", zh: "社会福利处", ja: "社会福祉課", de: "Sozialamt", fr: "Affaires sociales", es: "Bienestar social" },
  agriculture:         { ko: "농업과", zh: "农业处", ja: "農業課", de: "Landwirtschaftsamt", fr: "Service agricole", es: "Oficina de agricultura" },
};

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const clientId = args.find((a) => !a.startsWith("--"));

if (!clientId) {
  console.error("Usage: node scripts/backfill-service-translations.mjs <clientId> [--apply]");
  process.exit(1);
}

const db = getFirestore(initializeApp(firebaseConfig));

console.log(`Project : ${firebaseConfig.projectId}`);
console.log(`Client  : ${clientId}`);
console.log(`Mode    : ${apply ? "APPLY — will write" : "preview only (pass --apply to write)"}\n`);

const snap = await getDocs(
  query(collection(db, "queueServices"), where("clientId", "==", clientId))
);

if (snap.empty) {
  console.error(`No services found for client "${clientId}".`);
  process.exit(1);
}

let planned = 0;
let unknown = 0;
let unchanged = 0;

for (const d of snap.docs) {
  const data = d.data();
  // Doc ids are `${clientId}_${serviceId}`; fall back to a stored id field.
  const serviceId = data.id || d.id.replace(new RegExp(`^${clientId}_`), "");
  const table = TRANSLATIONS[serviceId];

  if (!table) {
    console.log(`  ?  ${serviceId.padEnd(22)} "${data.name}" — no translations on file, skipped`);
    unknown++;
    continue;
  }

  const existing = data.names || {};
  const merged = { ...table, ...existing };   // never clobber a hand-edited value
  const added = Object.keys(table).filter((k) => existing[k] === undefined);

  if (!added.length) {
    unchanged++;
    continue;
  }

  console.log(`  +  ${serviceId.padEnd(22)} "${data.name}"  ->  ${added.join(", ")}`);
  planned++;

  if (apply) {
    await updateDoc(doc(db, "queueServices", d.id), { names: merged });
  }
}

console.log(
  `\n${apply ? "Wrote" : "Would write"} ${planned} service(s). ` +
  `${unchanged} already complete, ${unknown} with no translation entry.`
);
if (!apply && planned) console.log("Re-run with --apply to write these changes.");
process.exit(0);
