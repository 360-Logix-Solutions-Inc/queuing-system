// Text-to-speech backends for the build-time clip generator.
//
// Every one of these runs on the BUILD machine and produces MP3 files. The
// kiosk never calls any of them — it plays the finished audio, offline, with no
// key on the device.
//
// Pick with --provider:
//
//   gtranslate  (default)  no account, no key, no card. Standard-quality
//                          voices. Covers Filipino via `tl`. Verified working.
//   google                 Google Cloud TTS. Neural (WaveNet) quality, needs
//                          GOOGLE_TTS_API_KEY. Best result if you have an account.
//   azure                  Azure Speech. Neural, needs AZURE_SPEECH_KEY + REGION.
//
// Quality ranking: azure ≈ google > gtranslate. Availability ranking is the
// exact reverse, which is why gtranslate is the default.

import { spawn } from "node:child_process";

// --- shared -----------------------------------------------------------------

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

function escapeXml(s) {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c])
  );
}

function assertMp3(buf, provider) {
  const isId3 = buf.subarray(0, 3).toString("latin1") === "ID3";
  const isFrame = buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0;
  if (buf.length < 512 || !(isId3 || isFrame)) {
    throw new Error(`${provider} returned ${buf.length} bytes that are not MP3`);
  }
  return buf;
}

// --- gtranslate -------------------------------------------------------------

// Romblomanon, Asi, Onhan and Cebuano have no voice at any provider. They fall
// back to Filipino, whose shared orthography and five-vowel system make it
// intelligible — a stand-in, not a substitute for a native recording.
// (Cebuano has a Translate language code but no TTS voice: it 400s.)
const GTRANSLATE_LOCALE = {
  en: "en", fil: "tl", rol: "tl", bno: "tl", loc: "tl", ceb: "tl",
  ko: "ko", zh: "zh-CN", ja: "ja", de: "de", fr: "fr", es: "es",
};

const gtranslate = {
  id: "gtranslate",
  label: "Google Translate TTS (no account required)",
  needs: [],
  supports: (lang) => Boolean(GTRANSLATE_LOCALE[lang]),
  describe: (lang) => GTRANSLATE_LOCALE[lang],
  // The endpoint rejects anything long, and it is rate limited — the caller
  // paces requests and retries on 429.
  maxChars: 190,

  async synthesize({ lang, text }) {
    const tl = GTRANSLATE_LOCALE[lang];
    if (!tl) throw new Error(`gtranslate has no locale for "${lang}"`);
    if (text.length > gtranslate.maxChars) {
      throw new Error(`text is ${text.length} chars; gtranslate caps at ${gtranslate.maxChars}`);
    }

    const url =
      "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob" +
      `&tl=${encodeURIComponent(tl)}&q=${encodeURIComponent(text)}`;

    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.status === 429) {
      const err = new Error("rate limited");
      err.retryable = true;
      throw err;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return assertMp3(Buffer.from(await res.arrayBuffer()), "gtranslate");
  },
};

// --- google cloud tts -------------------------------------------------------

const GOOGLE_VOICE = {
  en:  { code: "en-PH", name: "en-PH-Standard-A" },
  fil: { code: "fil-PH", name: "fil-PH-Wavenet-A" },
  rol: { code: "fil-PH", name: "fil-PH-Wavenet-A" },
  bno: { code: "fil-PH", name: "fil-PH-Wavenet-A" },
  loc: { code: "fil-PH", name: "fil-PH-Wavenet-A" },
  ceb: { code: "fil-PH", name: "fil-PH-Wavenet-A" },
  ko:  { code: "ko-KR", name: "ko-KR-Wavenet-A" },
  zh:  { code: "cmn-CN", name: "cmn-CN-Wavenet-A" },
  ja:  { code: "ja-JP", name: "ja-JP-Wavenet-A" },
  de:  { code: "de-DE", name: "de-DE-Wavenet-C" },
  fr:  { code: "fr-FR", name: "fr-FR-Wavenet-C" },
  es:  { code: "es-ES", name: "es-ES-Wavenet-C" },
};

const google = {
  id: "google",
  label: "Google Cloud TTS (needs GOOGLE_TTS_API_KEY)",
  needs: ["GOOGLE_TTS_API_KEY"],
  supports: (lang) => Boolean(GOOGLE_VOICE[lang]),
  describe: (lang) => GOOGLE_VOICE[lang]?.name,
  maxChars: 5000,

  async synthesize({ lang, text, env }) {
    const voice = GOOGLE_VOICE[lang];
    if (!voice) throw new Error(`google has no voice for "${lang}"`);

    const res = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${env.GOOGLE_TTS_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode: voice.code, name: voice.name },
          audioConfig: { audioEncoding: "MP3", speakingRate: 0.92 },
        }),
      }
    );
    if (res.status === 429) {
      const err = new Error("rate limited");
      err.retryable = true;
      throw err;
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} — ${(await res.text()).slice(0, 200)}`);
    }
    const { audioContent } = await res.json();
    if (!audioContent) throw new Error("no audioContent in response");
    return assertMp3(Buffer.from(audioContent, "base64"), "google");
  },
};

// --- azure ------------------------------------------------------------------

const AZURE_VOICE = {
  en: "en-PH-RosaNeural",
  fil: "fil-PH-BlessicaNeural",
  rol: "fil-PH-BlessicaNeural",
  bno: "fil-PH-BlessicaNeural",
  loc: "fil-PH-BlessicaNeural",
  ceb: "fil-PH-BlessicaNeural",
  ko: "ko-KR-SunHiNeural",
  zh: "zh-CN-XiaoxiaoNeural",
  ja: "ja-JP-NanamiNeural",
  de: "de-DE-KatjaNeural",
  fr: "fr-FR-DeniseNeural",
  es: "es-ES-ElviraNeural",
};

const azure = {
  id: "azure",
  label: "Azure Speech (needs AZURE_SPEECH_KEY + AZURE_SPEECH_REGION)",
  needs: ["AZURE_SPEECH_KEY", "AZURE_SPEECH_REGION"],
  supports: (lang) => Boolean(AZURE_VOICE[lang]),
  describe: (lang) => AZURE_VOICE[lang],
  maxChars: 5000,

  async synthesize({ lang, text, mode, env }) {
    const voice = AZURE_VOICE[lang];
    if (!voice) throw new Error(`azure has no voice for "${lang}"`);
    const locale = voice.split("-").slice(0, 2).join("-");
    const body =
      mode === "char"
        ? `<say-as interpret-as="characters">${escapeXml(text)}</say-as>`
        : escapeXml(text);
    const ssml =
      `<speak version='1.0' xml:lang='${locale}'><voice name='${voice}'>` +
      `<prosody rate='-8%'>${body}</prosody></voice></speak>`;

    const res = await fetch(
      `https://${env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": env.AZURE_SPEECH_KEY,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
          "User-Agent": "queuing-system-clip-generator",
        },
        body: ssml,
      }
    );
    if (res.status === 429) {
      const err = new Error("rate limited");
      err.retryable = true;
      throw err;
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} — ${(await res.text()).slice(0, 200)}`);
    }
    return assertMp3(Buffer.from(await res.arrayBuffer()), "azure");
  },
};

// --- mms (offline, local model) ---------------------------------------------

// Meta's MMS-TTS is the ONLY engine anywhere with real models for Romblomanon
// and Asi. Every cloud provider renders those two with a Filipino stand-in.
// Onhan (loc) has no MMS model — it is absent upstream, not omitted here.
//
// Codes are ISO 639-3, matching the facebook/mms-tts-<code> repos.
const MMS_MODEL = {
  en: "eng", fil: "tgl", rol: "rol", bno: "bno", ceb: "ceb",
  ko: "kor", ja: "jpn", de: "deu", fr: "fra", es: "spa",
  // zh: MMS splits Chinese into regional codes that do not map cleanly to the
  // kiosk's single `zh`; use another provider for it.
  // loc: no upstream model.
};

// One long-lived Python host for the whole run. Loading a VITS model costs
// several seconds, so spawning per clip would make a 45-file language spend
// almost all its time on imports rather than on speech.
let host = null;

function mmsHost(paths) {
  if (host) return host;

  const child = spawn(paths.python, [paths.mmsScript], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  const queue = [];
  let buffer = "";
  let stderr = "";

  child.stderr.on("data", (c) => { stderr = (stderr + c.toString()).slice(-2000); });
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    let nl;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch (_) { continue; }
      if (msg.ready) continue;               // startup handshake
      const pending = queue.shift();
      if (!pending) continue;
      msg.ok ? pending.resolve() : pending.reject(new Error(msg.error || "mms failed"));
    }
  });

  const fail = (err) => {
    while (queue.length) queue.shift().reject(err);
    host = null;
  };
  child.on("error", (e) => fail(new Error(`cannot run ${paths.python}: ${e.message}`)));
  child.on("close", (code) =>
    fail(new Error(stderr.trim().split("\n").pop() || `python host exited ${code}`))
  );

  host = {
    request: (payload) =>
      new Promise((resolve, reject) => {
        queue.push({ resolve, reject });
        child.stdin.write(`${JSON.stringify(payload)}\n`);
      }),
    dispose: () => { try { child.stdin.end(); } catch (_) {} host = null; },
  };
  return host;
}

// MMS tokenizers are character based and have no entry for digits: `bno`
// errors outright, and `rol` produced ~0.3s of noise rather than a number. So
// digits are handed over as words instead.
//
// These are the standard Visayan numerals, which Romblomanon uses directly and
// Asi speakers understand. Asi's own forms shift l -> y (lima -> yima, walo ->
// wayo); those are NOT used here because they are unverified. Have a native
// speaker check the Asi digits along with the rest of its strings.
const MMS_DIGITS = {
  0: "sero", 1: "isa", 2: "duha", 3: "tatlo", 4: "apat",
  5: "lima", 6: "anom", 7: "pito", 8: "walo", 9: "siyam",
};

const mms = {
  id: "mms",
  label: "Meta MMS-TTS (offline, local model — CC-BY-NC 4.0)",
  needs: [],
  supports: (lang) => Boolean(MMS_MODEL[lang]),
  describe: (lang) => `facebook/mms-tts-${MMS_MODEL[lang]}`,
  maxChars: 500,
  // Local inference: no network round trip to pace, and no rate limit.
  noThrottle: true,

  async synthesize({ lang, text, paths }) {
    const model = MMS_MODEL[lang];
    if (!model) throw new Error(`mms has no model for "${lang}"`);

    const { mkdtempSync, rmSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const { spawn } = await import("node:child_process");

    const dir = mkdtempSync(join(tmpdir(), "mms-"));
    const wav = join(dir, "out.wav");
    const spoken = /^\d$/.test(text) ? MMS_DIGITS[Number(text)] : text;

    try {
      await mmsHost(paths).request({ model, text: spoken, wav });

      // MMS emits WAV; the kiosk player expects MP3. ffmpeg writes to stdout so
      // no second temp file is needed.
      const mp3 = await new Promise((resolve, reject) => {
        const ff = spawn(paths.ffmpeg, [
          "-hide_banner", "-loglevel", "error",
          "-i", wav, "-codec:a", "libmp3lame", "-qscale:a", "4",
          "-f", "mp3", "pipe:1",
        ]);
        const chunks = [];
        let stderr = "";
        ff.stdout.on("data", (c) => chunks.push(c));
        ff.stderr.on("data", (c) => { stderr += c.toString(); });
        ff.on("error", (e) => reject(new Error(`cannot run ffmpeg: ${e.message}`)));
        ff.on("close", (code) =>
          code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(stderr.trim() || `ffmpeg exited ${code}`))
        );
      });

      return assertMp3(mp3, "mms");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },

  // Lets the generator shut the Python host down instead of waiting on an idle
  // child to keep the process alive.
  dispose: () => host?.dispose(),
};

export const PROVIDERS = { gtranslate, google, azure, mms };
export const DEFAULT_PROVIDER = "gtranslate";
