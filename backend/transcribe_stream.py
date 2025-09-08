import sys
from faster_whisper import WhisperModel

audio_file = sys.argv[1]
model = WhisperModel("base", device="cpu", compute_type="int8")

segments, _ = model.transcribe(audio_file, beam_size=1, vad_filter=True)
for segment in segments:
    print(segment.text, flush=True)