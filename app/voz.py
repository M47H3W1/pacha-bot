"""Audio para quien lee con dificultad.

1. Kichwa: si hay una grabación hecha por un hablante en app/audios/kichwa/<clave>.(ogg|mp3|m4a), se usa esa.
   No existe voz sintética en kichwa, así que las grabaciones humanas son el camino confiable.
2. Español: voz neuronal ecuatoriana (Microsoft Edge, es-EC-AndreaNeural) con caché en disco.
3. Si falla, gTTS como respaldo.
"""
import hashlib
import io
import logging
import os
import re
from pathlib import Path

from .clients import CACHE

log = logging.getLogger(__name__)
VOZ = os.getenv("PACHA_VOZ", "es-EC-AndreaNeural")
VELOCIDAD = os.getenv("PACHA_VOZ_VELOCIDAD", "-8%")
CACHE_AUDIO = CACHE / "audio"
CACHE_AUDIO.mkdir(parents=True, exist_ok=True)
KICHWA = Path(__file__).with_name("audios") / "kichwa"

_EMOJI = re.compile("[\U0001F000-\U0001FAFF☀-➿⬀-⯿️‍⃣]")


def limpiar(texto: str) -> str:
    t = re.sub(r"<[^>]+>", "", texto)
    t = t.replace("→", ", después, ").replace("°C", " grados").replace("m²", " metros cuadrados")
    t = t.replace("·", ",").replace("•", "").replace("«", "").replace("»", "")
    t = _EMOJI.sub("", t)
    t = re.sub(r"[ \t]+", " ", t)
    return re.sub(r"\n\s*", ". ", t).replace("..", ".").replace(":.", ":").strip(" .") + "."


def grabacion_kichwa(clave: str | None) -> bytes | None:
    if not clave:
        return None
    for ext in ("ogg", "mp3", "m4a"):
        f = KICHWA / f"{clave}.{ext}"
        if f.exists():
            return f.read_bytes()
    return None


async def audio(texto: str) -> bytes | None:
    """MP3 con voz natural en español de Ecuador. Usa caché: el mismo texto sale al instante."""
    limpio = limpiar(texto)
    clave = hashlib.sha1(f"{VOZ}|{VELOCIDAD}|{limpio}".encode()).hexdigest()[:20]
    f = CACHE_AUDIO / f"{clave}.mp3"
    if f.exists():
        return f.read_bytes()
    datos = None
    try:
        import edge_tts
        buf = io.BytesIO()
        async for chunk in edge_tts.Communicate(limpio, VOZ, rate=VELOCIDAD).stream():
            if chunk["type"] == "audio":
                buf.write(chunk["data"])
        datos = buf.getvalue() or None
    except Exception as e:
        log.warning("Voz neuronal no disponible (%s); uso gTTS", e)
    if not datos:
        try:
            from gtts import gTTS
            buf = io.BytesIO()
            gTTS(limpio, lang="es", tld="com.mx").write_to_fp(buf)
            datos = buf.getvalue()
        except Exception as e:
            log.warning("No se pudo generar audio: %s", e)
            return None
    f.write_bytes(datos)
    return datos
