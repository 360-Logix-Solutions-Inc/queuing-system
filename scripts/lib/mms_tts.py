"""Offline speech synthesis with Meta's MMS-TTS, for the clip generator.

Why this exists: MMS is the only engine anywhere with real models for
Romblomanon (rol) and Asi/Bantoanon (bno). Every cloud provider renders those
two with a Filipino stand-in voice; this renders them in the actual language.

Runs on the BUILD machine only, like every other provider. The kiosk ships
finished MP3s and never sees Python, PyTorch or a model file.

LICENSE: the MMS checkpoints are CC-BY-NC 4.0 — non-commercial. A municipal
queuing system is very likely fine, but that is a call for the LGU's legal or
IT office, not something this script can decide. The other providers carry no
such restriction.

PROTOCOL — a long-lived host, not one process per clip. Loading a VITS model
costs several seconds; doing that 45 times per language would dominate the run.
Reads one JSON request per line on stdin:

    {"model": "rol", "wav": "C:/path/out.wav", "text": "Maghulat lang"}

and answers one JSON line per request:

    {"ok": true}   |   {"ok": false, "error": "..."}

Models are cached in-process, so the cost is paid once per language.
"""

import json
import os
import sys

os.environ.setdefault("TRANSFORMERS_VERBOSITY", "error")
os.environ.setdefault("HF_HUB_DISABLE_PROGRESS_BARS", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

import torch                       # noqa: E402 — after the env vars above
import scipy.io.wavfile            # noqa: E402
from transformers import VitsModel, AutoTokenizer   # noqa: E402

_cache: dict[str, tuple] = {}


def load(model_code: str):
    """Return (tokenizer, model), downloading and caching on first use."""
    if model_code not in _cache:
        model_id = f"facebook/mms-tts-{model_code}"
        tokenizer = AutoTokenizer.from_pretrained(model_id)
        model = VitsModel.from_pretrained(model_id)
        # Slightly slowed, matching the other providers: this is read once, out
        # loud, to someone standing in a lobby.
        model.speaking_rate = 0.9
        model.eval()
        _cache[model_code] = (tokenizer, model)
    return _cache[model_code]


def synthesize(model_code: str, text: str, wav_path: str) -> None:
    tokenizer, model = load(model_code)
    inputs = tokenizer(text, return_tensors="pt")
    with torch.no_grad():
        waveform = model(**inputs).waveform
    scipy.io.wavfile.write(
        wav_path,
        rate=model.config.sampling_rate,
        data=waveform.squeeze().cpu().numpy(),
    )


def main() -> int:
    # Signal readiness so the caller does not race the import of torch.
    print(json.dumps({"ready": True}), flush=True)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            synthesize(req["model"], req["text"], req["wav"])
            print(json.dumps({"ok": True}), flush=True)
        except Exception as err:                  # noqa: BLE001 — reported to Node
            print(json.dumps({"ok": False, "error": str(err)}), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
