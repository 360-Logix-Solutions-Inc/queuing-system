// Renders the kiosk's announcement clips to MP3.
//
//   node scripts/generate-voice-clips.mjs --dry-run          # show the plan
//   node scripts/generate-voice-clips.mjs                    # all languages
//   node scripts/generate-voice-clips.mjs fil rol            # only these
//   node scripts/generate-voice-clips.mjs --provider=google  # better voices
//   node scripts/generate-voice-clips.mjs --force            # re-render existing
//
// Runs at BUILD time, never on the kiosk. That is the whole design:
//   • the announcements are a fixed set, so per-transaction API calls buy
//     nothing but latency, cost, and a hard dependency on the municipal hall's
//     internet staying up;
//   • no API key ever ships to a machine standing in a public lobby;
//   • the kiosk plays finished MP3s, so read-aloud works fully offline.
//
// Default provider needs no account, no key and no credit card. See
// scripts/lib/tts-providers.mjs for the alternatives and their trade-offs.

import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { KIOSK_LANGUAGES, kioskT } from "../src/lib/kioskI18n.js";
import { PROVIDERS, DEFAULT_PROVIDER } from "./lib/tts-providers.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const audioDir = join(root, "public", "audio");

function readEnv() {
  const out = {};
  try {
    for (const line of readFileSync(join(root, ".env"), "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch (_) { /* .env is optional */ }
  return { ...out, ...process.env };
}

const SENTENCE_KEYS = [
  "greeting", "greetingSub", "startHint",
  "servicesTitle", "servicesSub",
  "ticketPreviewHint", "fallInLine",
  "yourNumber", "doneHint",
];
const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");
const DIGITS = "0123456789".split("");

// --- arguments --------------------------------------------------------------

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const force = argv.includes("--force");
const providerId = (argv.find((a) => a.startsWith("--provider="))?.split("=")[1]) || DEFAULT_PROVIDER;
const wanted = argv.filter((a) => !a.startsWith("--"));

const provider = PROVIDERS[providerId];
if (!provider) {
  console.error(`Unknown provider "${providerId}". Available: ${Object.keys(PROVIDERS).join(", ")}`);
  process.exit(1);
}

const env = readEnv();
const missing = provider.needs.filter((k) => !env[k]);
if (missing.length && !dryRun) {
  console.error(
    `Provider "${provider.id}" needs ${missing.join(" and ")} in .env.\n\n` +
    `Or use the default, which needs no account at all:\n` +
    `  node scripts/generate-voice-clips.mjs\n`
  );
  process.exit(1);
}

const languages = KIOSK_LANGUAGES.filter(
  (l) => (!wanted.length || wanted.includes(l.code)) && provider.supports(l.code)
);
if (!languages.length) {
  console.error(`No matching languages for provider "${provider.id}".`);
  process.exit(1);
}

// --- run --------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let written = 0, skipped = 0, failed = 0;

console.log(`Provider: ${provider.label}`);
console.log(`Mode    : ${dryRun ? "dry run — nothing is written or requested" : "rendering"}\n`);

for (const lang of languages) {
  const dir = join(audioDir, lang.code);
  if (!dryRun) mkdirSync(dir, { recursive: true });
  console.log(`${lang.label} [${lang.code}] via ${provider.describe(lang.code)}`);

  const jobs = [
    ...SENTENCE_KEYS.map((key) => ({ name: key, text: kioskT(lang.code, key), mode: "text" })),
    ...LETTERS.map((c) => ({ name: `char-${c}`, text: c.toUpperCase(), mode: "char" })),
    ...DIGITS.map((d) => ({ name: `char-${d}`, text: d, mode: "char" })),
  ];

  for (const job of jobs) {
    const file = join(dir, `${job.name}.mp3`);
    if (!force && existsSync(file)) { skipped++; continue; }
    if (!job.text) { console.warn(`  ! ${job.name}: no text`); failed++; continue; }

    if (dryRun) {
      if (job.mode === "text") console.log(`  ${job.name.padEnd(18)} "${job.text}"`);
      written++;
      continue;
    }

    // One retry on an explicit rate limit; anything else is reported and skipped
    // so a single bad clip cannot abort a 540-file run.
    let audio = null;
    for (let attempt = 0; attempt < 2 && !audio; attempt++) {
      try {
        audio = await provider.synthesize({ ...job, lang: lang.code, env });
      } catch (err) {
        if (err.retryable && attempt === 0) { await sleep(4000); continue; }
        console.error(`  ! ${job.name}: ${err.message}`);
        failed++;
        break;
      }
    }
    if (!audio) continue;

    writeFileSync(file, audio);
    written++;
    process.stdout.write(`  ${job.name.padEnd(18)} ${(audio.length / 1024).toFixed(0)} KB\n`);
    await sleep(providerId === "gtranslate" ? 700 : 120);   // stay under the rate limit
  }
}

console.log(
  `\nDone. ${written} ${dryRun ? "planned" : "written"}, ${skipped} already present, ${failed} failed.` +
  (written && !dryRun ? "\nNow run:  node scripts/build-audio-manifest.mjs" : "")
);
if (failed) process.exitCode = 1;
