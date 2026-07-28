# Kiosk announcement clips

Drop recorded audio here and the kiosk speaks it instead of using text-to-speech.

This exists because **no TTS engine on any platform supports Romblomanon (Ini),
Asi, or Onhan** — not Windows, not Azure, not Google, not Piper. Recorded clips
are the only way those languages will ever be heard. They are also the only path
that needs nothing installed on the kiosk PC: the files ship inside the installer
(`public/**` is bundled by electron-builder), so a freshly imaged machine speaks
on first boot.

## Layout

```
public/audio/
  manifest.json
  fil/
    greeting.mp3
    greetingSub.mp3
    ...
    char-a.mp3 … char-z.mp3
    char-0.mp3 … char-9.mp3
  rol/
  bno/
  loc/
```

Folder names are the language codes from `src/lib/kioskI18n.js`:
`en, fil, rol, bno, loc, ceb, ko, zh, ja, de, fr, es`.

Format: **MP3**, mono, 44.1 kHz is plenty. Trim the silence at both ends —
clips play back to back, and leading silence turns a sentence into a stutter.

## Required clip names

Sentence clips — record the exact translated line from `kioskI18n.js`:

| Clip name | Screen | English text |
|---|---|---|
| `greeting` | Start | Mabuhay! |
| `greetingSub` | Start | Welcome |
| `startHint` | Start | Tap the button to begin |
| `servicesTitle` | Service picker | Select a service |
| `servicesSub` | Service picker | Tap any service to begin your transaction. |
| `ticketPreviewHint` | Details form | Your queue number is generated when you tap Fall in Line. |
| `fallInLine` | Details form | Fall in Line |
| `yourNumber` | Ticket issued | Your queue number |
| `doneHint` | Ticket issued | Please wait for your number to be called. |

Character clips — used to read the queue number aloud. `PAY-014` plays as
`char-p, char-a, char-y, char-1, char-4` (leading zeros are dropped):

- `char-a` … `char-z` — the letter, spoken as a letter
- `char-0` … `char-9` — the digit

That is 9 sentences + 36 characters = **45 clips per language**.

## manifest.json

Lists which clips actually exist, so the kiosk never probes for missing files.
A language is used **only if it covers the whole announcement** — a half-recorded
set falls back to TTS rather than reading a sentence with holes in it.

```json
{
  "fil": ["greeting", "greetingSub", "startHint", "servicesTitle", "servicesSub",
          "ticketPreviewHint", "fallInLine", "yourNumber", "doneHint",
          "char-a", "char-b", "…", "char-9"],
  "rol": ["…"]
}
```

Regenerate it after adding files:

```bash
node scripts/build-audio-manifest.mjs
```

If `manifest.json` is absent or empty, nothing breaks — the kiosk simply uses
text-to-speech everywhere, exactly as it does today.

## Generating instead of recording

```bash
node scripts/generate-voice-clips.mjs --dry-run   # show the plan, request nothing
node scripts/generate-voice-clips.mjs             # all languages
node scripts/generate-voice-clips.mjs fil rol     # just these
node scripts/build-audio-manifest.mjs             # then refresh the manifest
```

The default provider needs **no account, no API key and no credit card**. Text
comes straight from `src/lib/kioskI18n.js`, so the audio cannot drift from what
is printed on screen.

| `--provider=` | Quality | What it needs |
|---|---|---|
| `gtranslate` *(default)* | standard | nothing |
| `google` | neural (WaveNet) | `GOOGLE_TTS_API_KEY` |
| `azure` | neural | `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` |

Start with the default. If the voices sound too flat for a public lobby,
re-render with `--provider=google --force`; the filenames are identical, so
nothing else changes.

**No key ever reaches a kiosk.** Rendering happens once on the build machine and
the kiosk only ever plays finished MP3s — which is what keeps read-aloud working
with the internet down, the state to design for here.

Romblomanon, Asi, Onhan and Cebuano have no voice at any provider, so they are
rendered with the Filipino voice. Shared orthography and a common five-vowel
system make it intelligible, but the prosody is wrong — treat those four as a
usable stand-in until a native speaker can be recorded.

## Recording notes

- One speaker per language, same room, same mic — switching voices mid-sentence
  is jarring.
- Say the character clips in isolation, flat: "ay", "bee", "see" — not as part
  of a word.
- For Filipino you can generate rather than record: Azure has `fil-PH-BlessicaNeural`
  and `fil-PH-AngeloNeural`. Generate once during development and commit the
  files — the kiosk stays fully offline.
- Ini, Asi, and Onhan must be recorded by a native speaker. There is no
  generator for them.
