"""Convierte los consejos en audio en español para quien lee con dificultad."""
import io
import logging
import re

log = logging.getLogger(__name__)

_EMOJI = re.compile("[\U0001F000-\U0001FAFF☀-➿⬀-⯿️‍⃣]")


def limpiar(texto: str) -> str:
    t = re.sub(r"<[^>]+>", "", texto)
    t = t.replace("→", ", después, ").replace("°C", " grados").replace("m²", " metros cuadrados")
    t = t.replace("·", ",").replace("•", "")
    t = _EMOJI.sub("", t)
    t = re.sub(r"[ \t]+", " ", t)
    return re.sub(r"\n\s*", ". ", t).replace("..", ".").strip(" .") + "."


def audio(texto: str) -> bytes | None:
    """MP3 con voz en español latinoamericano. None si el servicio no responde."""
    try:
        from gtts import gTTS
        buf = io.BytesIO()
        gTTS(limpiar(texto), lang="es", tld="com.mx").write_to_fp(buf)
        return buf.getvalue()
    except Exception as e:
        log.warning("No se pudo generar audio: %s", e)
        return None
