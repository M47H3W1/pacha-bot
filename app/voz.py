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
# Estilos: la voz del chat (adulta y pausada) y la de Pachita en el juego para niños (más aguda, ágil y alegre)
ESTILOS = {"normal": (VOZ, VELOCIDAD, "+0Hz"), "nina": (VOZ, "+4%", "+38Hz")}
# Inglés (juego bilingüe): Ana es una voz infantil de Microsoft; la normal usa Jenny
VOZ_EN = os.getenv("PACHA_VOZ_EN", "en-US-AnaNeural")
ESTILOS_EN = {"normal": ("en-US-JennyNeural", "+0%", "+0Hz"), "nina": (VOZ_EN, "+4%", "+8Hz")}
CACHE_AUDIO = CACHE / "audio"
CACHE_AUDIO.mkdir(parents=True, exist_ok=True)
KICHWA = Path(__file__).with_name("audios") / "kichwa"

_EMOJI = re.compile("[\U0001F000-\U0001FAFF☀-➿⬀-⯿️‍⃣]")


def limpiar(texto: str, lang: str = "es") -> str:
    t = re.sub(r"<[^>]+>", "", texto)
    if lang == "en":
        t = t.replace("→", ", then, ").replace("°C", " degrees").replace("m²", " square meters")
    else:
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


async def audio(texto: str, estilo: str = "normal", lang: str = "es") -> bytes | None:
    """MP3 con voz natural en español de Ecuador (o en inglés). Usa caché: el mismo texto sale al instante."""
    limpio = limpiar(texto, lang)
    tabla = ESTILOS_EN if lang == "en" else ESTILOS
    voz, velocidad, tono = tabla.get(estilo, tabla["normal"])
    clave = hashlib.sha1(f"{voz}|{velocidad}|{tono}|{limpio}".encode()).hexdigest()[:20]
    f = CACHE_AUDIO / f"{clave}.mp3"
    if f.exists():
        return f.read_bytes()
    datos = None
    try:
        import edge_tts
        buf = io.BytesIO()
        async for chunk in edge_tts.Communicate(limpio, voz, rate=velocidad, pitch=tono).stream():
            if chunk["type"] == "audio":
                buf.write(chunk["data"])
        datos = buf.getvalue() or None
    except Exception as e:
        log.warning("Voz neuronal no disponible (%s); uso gTTS", e)
    if not datos:
        try:
            from gtts import gTTS
            buf = io.BytesIO()
            if lang == "en":
                gTTS(limpio, lang="en", tld="com").write_to_fp(buf)
            else:
                gTTS(limpio, lang="es", tld="com.mx").write_to_fp(buf)
            datos = buf.getvalue()
        except Exception as e:
            log.warning("No se pudo generar audio: %s", e)
            return None
    f.write_bytes(datos)
    return datos
