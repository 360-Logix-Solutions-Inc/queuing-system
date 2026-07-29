// Read-aloud for the kiosk, over whichever engine the platform actually has.
//
// Two backends:
//   1. Pre-recorded clips — the only path that can speak Romblomanon, Asi and
//      Onhan, and the only one needing nothing installed on the kiosk PC.
//   2. Web Speech API — works in the browser AND inside Electron. Measured on
//      Electron 33 / Windows 11: voices resolve in ~250ms and an utterance
//      fires onstart at ~1s.
//
// The voice list MUST be polled, not awaited via `voiceschanged`: that event
// fires late and unreliably, and a fixed short timeout around it reports zero
// voices on a machine that actually has them — which would hide the read-aloud
// button entirely. Gate on a real voice, never on the API merely existing.

import { loadAudioManifest, playClips, resolveClips, stopClips } from "./kioskAudio";

let cachedVoices = [];
let hasClipSets = false;
let webUsable = false;

function synth() {
  if (typeof window === "undefined") return null;
  return window.speechSynthesis || null;
}

function webVoices() {
  const s = synth();
  if (!s) return [];
  if (!cachedVoices.length) cachedVoices = s.getVoices() || [];
  return cachedVoices;
}

// Resolves to true only when something can actually be heard. Async because
// the Web Speech voice list populates after a delay.
export async function initSpeech() {
  const clipSets = await loadAudioManifest();
  hasClipSets = Boolean(clipSets && Object.keys(clipSets).length);

  // Always probe TTS as well, even when clips exist: a language with no clip
  // set still needs a fallback voice.
  const ttsAvailable = await probeTts();

  // Recorded clips alone are enough to offer read-aloud, even on a machine with
  // no TTS voice installed at all.
  return hasClipSets || ttsAvailable;
}

// Polls until a voice shows up or we give up. Chromium populates the list
// asynchronously and `voiceschanged` is not dependable — polling is what
// actually reports the truth on both browser and Electron.
function pollWebVoices(timeoutMs = 5000) {
  const s = synth();
  if (!s || typeof window.SpeechSynthesisUtterance !== "function") {
    return Promise.resolve([]);
  }
  const immediate = s.getVoices() || [];
  if (immediate.length) {
    cachedVoices = immediate;
    return Promise.resolve(immediate);
  }
  const startedAt = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      const list = s.getVoices() || [];
      if (list.length) {
        cachedVoices = list;
        return resolve(list);
      }
      if (Date.now() - startedAt > timeoutMs) return resolve([]);
      setTimeout(tick, 250);
    };
    tick();
  });
}

async function probeTts() {
  const list = await pollWebVoices();
  webUsable = list.length > 0;
  return webUsable;
}

// Silences both backends, not just the one that spoke last — a half-stop would
// leave a clip playing under the next announcement.
export function stopSpeaking() {
  stopClips();
  const s = synth();
  if (s) {
    try { s.cancel(); } catch (_) {}
  }
}

// The entry point every screen uses. `tokens` describe the announcement in a
// form both backends understand:
//   { key: "doneHint" }                     — a translated line with a clip name
//   { chars: "PAY-014", text: "P A Y, 14" } — spelled out either way
//   { text: service.name, optional: true }  — dynamic; skipped on the clip path,
//                                             since it can never be pre-recorded
export function announce(tokens, lang, locale) {
  stopSpeaking();
  if (!tokens?.length) return;

  if (hasClipSets) {
    const clips = resolveClips(lang, tokens);
    if (clips) {
      playClips(lang, clips);
      return;
    }
  }

  speak(tokens.map((token) => token.text).filter(Boolean), locale);
}

function pickWebVoice(locale) {
  const list = webVoices();
  if (!list.length) return null;
  const wanted = locale.toLowerCase();
  const base = wanted.split("-")[0];
  return (
    list.find((v) => v.lang?.toLowerCase().replace("_", "-") === wanted) ||
    list.find((v) => v.lang?.toLowerCase().startsWith(base)) ||
    null
  );
}

// `lines` are joined with pauses so a queue number is not run into the sentence
// after it. Falsy entries are dropped, so callers can pass conditionals.
export function speak(lines, locale) {
  const text = (Array.isArray(lines) ? lines : [lines])
    .filter(Boolean)
    .join(". ")
    .trim();
  if (!text) return;

  const s = synth();
  if (!webUsable || !s) return;

  stopSpeaking();

  const utterance = new window.SpeechSynthesisUtterance(text);
  const voice = pickWebVoice(locale);
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang || locale;
  utterance.rate = 0.92;   // a touch slower — this is read once, out loud, in public
  utterance.pitch = 1;
  utterance.volume = 1;

  try { s.speak(utterance); } catch (_) {}
}

// Queue numbers like "PAY-014" read badly as a word. Spell the prefix out and
// drop the leading zeros so it comes through as "P A Y, 14".
export function spellQueueNumber(queueNumber) {
  if (!queueNumber) return "";
  return String(queueNumber)
    .split(/[-\s]+/)
    .map((part) =>
      /^\d+$/.test(part) ? String(Number(part)) : part.split("").join(" ")
    )
    .join(", ");
}
