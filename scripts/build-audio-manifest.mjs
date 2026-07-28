// Regenerates public/audio/manifest.json from whatever clips are on disk.
// Run after adding or re-recording files:  node scripts/build-audio-manifest.mjs

import { readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const audioDir = join(root, "public", "audio");

const SENTENCE_CLIPS = [
  "greeting", "greetingSub", "startHint",
  "servicesTitle", "servicesSub",
  "ticketPreviewHint", "fallInLine",
  "yourNumber", "doneHint",
];

const CHAR_CLIPS = [
  ..."abcdefghijklmnopqrstuvwxyz".split("").map((c) => `char-${c}`),
  ..."0123456789".split("").map((c) => `char-${c}`),
];

if (!existsSync(audioDir)) {
  console.error(`No such directory: ${audioDir}`);
  process.exit(1);
}

const manifest = {};
let total = 0;

for (const entry of readdirSync(audioDir)) {
  const langDir = join(audioDir, entry);
  if (!statSync(langDir).isDirectory()) continue;

  const clips = readdirSync(langDir)
    .filter((f) => f.toLowerCase().endsWith(".mp3"))
    .map((f) => f.slice(0, -4))
    .sort();

  if (!clips.length) continue;
  manifest[entry] = clips;
  total += clips.length;

  const missingSentences = SENTENCE_CLIPS.filter((c) => !clips.includes(c));
  const missingChars = CHAR_CLIPS.filter((c) => !clips.includes(c));
  const status = missingSentences.length || missingChars.length ? "PARTIAL" : "complete";

  console.log(`${entry.padEnd(5)} ${String(clips.length).padStart(3)} clips  ${status}`);
  if (missingSentences.length) {
    console.log(`      missing lines: ${missingSentences.join(", ")}`);
  }
  if (missingChars.length) {
    console.log(`      missing chars: ${missingChars.length} of ${CHAR_CLIPS.length}`);
  }
  if (status === "PARTIAL") {
    console.log("      -> falls back to text-to-speech until complete");
  }
}

writeFileSync(join(audioDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const langs = Object.keys(manifest);
console.log(
  langs.length
    ? `\nWrote manifest.json — ${langs.length} language(s), ${total} clips.`
    : "\nWrote empty manifest.json — no clips found; the kiosk will use text-to-speech."
);
