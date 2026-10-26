"""Unicode tokenization shared by transcript alignment and offline tests."""
import re
import unicodedata

def normalize(text):
    return "".join(c for c in unicodedata.normalize("NFKC", text).lower().replace("gonna", "going") if c.isalnum())

def tokens(text):
    text = unicodedata.normalize("NFKC", text)
    parts = re.findall(r"[\u3400-\u4dbf\u4e00-\u9fff\U00020000-\U0002fa1f]|[^\W_]+(?:['’][^\W_]+)*", text, re.UNICODE)
    # The Latin alternative must not swallow Han adjacent to Latin text.
    out = []
    for part in parts:
        for piece in re.findall(r"[\u3400-\u4dbf\u4e00-\u9fff\U00020000-\U0002fa1f]|[^\u3400-\u4dbf\u4e00-\u9fff\U00020000-\U0002fa1f]+", part):
            value = normalize(piece)
            if value:
                out.append(value)
    return out

def timed_tokens(words):
    # Keep the original recognizer span; do not invent precise character timestamps.
    return [{**word, "w": token} for word in words for token in tokens(word["w"])]
