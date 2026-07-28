// Pre-recorded announcement clips.
//
// This is the only way the kiosk will ever speak Romblomanon, Asi, or Onhan:
// no TTS engine on any platform supports them, and none is coming. It is also
// the only path that needs nothing installed on the kiosk PC — the clips ship
// inside the installer under public/, so a fresh machine speaks immediately.
//
// A clip set is used only when it covers the whole announcement. Half-recorded
// languages fall back to TTS rather than reading a sentence with holes in it.

const MANIFEST_URL = "/audio/manifest.json";

let manifest = null;
let manifestLoaded = false;
let current = null;   // the in-flight playback, so a new one can cancel it

export async function loadAudioManifest() {
  if (manifestLoaded) return manifest;
  manifestLoaded = true;
  try {
    const res = await fetch(MANIFEST_URL, { cache: "no-cache" });
    if (!res.ok) return (manifest = null);
    const data = await res.json();
    manifest = data && typeof data === "object" ? data : null;
  } catch (_) {
    manifest = null;   // no clips recorded yet — TTS stays in charge
  }
  return manifest;
}

// "PAY-014" -> ["char-p","char-a","char-y","char-1","char-4"]. Leading zeros go,
// matching how the number is spelled aloud by the TTS path.
function charClips(queueNumber) {
  return String(queueNumber)
    .split(/[-\s]+/)
    .flatMap((part) => (/^\d+$/.test(part) ? String(Number(part)) : part))
    .join("")
    .toLowerCase()
    .split("")
    .filter((c) => /[a-z0-9]/.test(c))
    .map((c) => `char-${c}`);
}

// Translates announcement tokens into an ordered clip list, or null when the
// language cannot cover it. Tokens marked `optional` (dynamic service names,
// which can never be pre-recorded) are dropped instead of failing the set.
export function resolveClips(lang, tokens) {
  const available = manifest?.[lang];
  if (!Array.isArray(available) || !available.length) return null;
  const has = new Set(available);

  const clips = [];
  for (const token of tokens) {
    let needed;
    if (token.key) needed = [token.key];
    else if (token.chars) needed = charClips(token.chars);
    else if (token.optional) continue;
    else return null;

    if (!needed.every((name) => has.has(name))) {
      if (token.optional) continue;
      return null;
    }
    clips.push(...needed);
  }
  return clips.length ? clips : null;
}

export function stopClips() {
  if (!current) return;
  current.cancelled = true;
  try {
    current.audio.pause();
    current.audio.src = "";
  } catch (_) {}
  current = null;
}

export function playClips(lang, clips) {
  stopClips();
  if (typeof window === "undefined" || !clips?.length) return;

  const session = { cancelled: false, audio: new window.Audio() };
  current = session;

  let index = 0;
  const next = () => {
    if (session.cancelled || index >= clips.length) {
      if (current === session) current = null;
      return;
    }
    const name = clips[index++];
    session.audio.src = `/audio/${lang}/${encodeURIComponent(name)}.mp3`;
    // A missing or unplayable file must not strand the rest of the sentence.
    session.audio.play().catch(() => next());
  };

  session.audio.addEventListener("ended", next);
  session.audio.addEventListener("error", next);
  next();
}
