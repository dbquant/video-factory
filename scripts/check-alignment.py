import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "engine" / "lib"))
from alignment_text import tokens, normalize, timed_tokens
assert tokens("小猫走进花园。") == list("小猫走进花园")
assert tokens("AI小猫，喝tea！") == ["ai", "小", "猫", "喝", "tea"]
assert tokens("Café mañana") == ["café", "mañana"]
assert tokens("don't stop") == ["dont", "stop"]
assert normalize("ＡＢＣ１２３") == "abc123"
assert tokens("，。！") == []
w = timed_tokens([{"w": "小猫", "start": 1, "end": 2}])
assert [x["w"] for x in w] == ["小", "猫"]
assert all(x["start"] == 1 and x["end"] == 2 for x in w)
print("Unicode alignment checks passed.")

# Exercise the real alignment entry point without downloading Whisper or using a GPU.
import json, runpy, tempfile, types
from contextlib import redirect_stdout
from io import StringIO
with tempfile.TemporaryDirectory() as directory:
    root = Path(directory)
    lines = root / "lines.json"
    output = root / "aligned.json"
    lines.write_text(json.dumps([{"id": "s1", "text": "小猫走进花园。"}]), encoding="utf8")
    class Model:
        def __init__(self, *args, **kwargs): pass
        def transcribe(self, media, **kwargs):
            assert kwargs["language"] == "zh"
            words = [types.SimpleNamespace(word=t, start=i, end=i+1) for i,t in enumerate(["小猫", "走进", "花园"])]
            return [types.SimpleNamespace(words=words)], None
    sys.modules["faster_whisper"] = types.SimpleNamespace(WhisperModel=Model)
    sys.argv = ["align.py", "unused.wav", str(lines), str(output), "zh"]
    with redirect_stdout(StringIO()):
        runpy.run_path(str(Path(__file__).resolve().parents[1] / "engine/lib/align.py"), run_name="__main__")
    result = json.loads(output.read_text(encoding="utf8"))
    assert result["lines"] == [{"id": "s1", "start": 0, "end": 3, "found": 1.0}]
    assert result["extras"] == []
print("Chinese transcript alignment integration passed.")
