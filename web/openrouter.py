"""Preguntas libres con OpenRouter: varios modelos abiertos gratuitos, uno detrás de otro si alguno falla.

La clave va solo en la variable de entorno OPENROUTER_API_KEY (Vercel o .env), nunca en el código.
El modelo solo redacta: los números vienen del motor de Pacha y se le pasan como "hechos".
"""
from __future__ import annotations

import logging
import os

import httpx

log = logging.getLogger("pacha.openrouter")
URL = "https://openrouter.ai/api/v1/chat/completions"
# Modelos gratuitos (lista de openrouter.ai/api/v1/models, nov 2026). Cambian seguido: se ajustan por variable.
MODELOS = os.getenv("OPENROUTER_MODELS", "google/gemma-4-31b-it:free,nvidia/nemotron-3.5-lightning:free,"
                    "google/gemma-4-26b-a4b-it:free,openrouter/free").split(",")
# Modelos que entienden audio, para las notas de voz del agricultor.
MODELOS_AUDIO = os.getenv("OPENROUTER_AUDIO_MODELS", "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free").split(",")

SISTEMA = """Eres Pacha, asistente agrícola para campesinos de la sierra del Ecuador. Tu respuesta se convierte en audio.
Reglas:
- Español sencillo de Ecuador, trato de "usted". Máximo 2 frases muy cortas y claras.
- Sin markdown, sin listas, sin siglas. Puedes empezar con un emoji. Números solo si se pueden contar (meses, veces, baldes).
- Usa solo los HECHOS del terreno que te doy. Si no sabes algo, di que lo consulte con un técnico del MAG o del INIAP.
- No recomiendes químicos ni dosis. Si la pregunta no es del campo, responde amable y vuelve al tema de su tierra.
- Si te llega un audio, primero entiende lo que pregunta el agricultor y responde a eso."""


def disponible() -> bool:
    return bool(os.getenv("OPENROUTER_API_KEY"))


def _llamar(modelos: list[str], mensajes: list[dict]) -> str | None:
    clave = os.getenv("OPENROUTER_API_KEY")
    if not clave:
        return None
    cab = {"Authorization": f"Bearer {clave}", "X-Title": "Pacha"}
    sitio = os.getenv("PACHA_URL")
    if sitio:
        cab["HTTP-Referer"] = sitio
    # OpenRouter acepta hasta 3 modelos de respaldo por llamada; si todos fallan, probamos el siguiente grupo.
    for i in range(0, len(modelos), 3):
        grupo = [m.strip() for m in modelos[i:i + 3] if m.strip()]
        try:
            r = httpx.post(URL, headers=cab, timeout=40, json={
                "models": grupo, "messages": mensajes, "max_tokens": 400, "temperature": 0.4})
            r.raise_for_status()
            j = r.json()
            texto = (j["choices"][0]["message"].get("content") or "").strip()
            if texto:
                log.info("respuesta de %s", j.get("model"))
                return texto
        except Exception as e:
            log.warning("OpenRouter %s falló: %s", grupo, e)
    return None


def responder(pregunta: str | None, hechos: str, historial: list[dict] | None = None,
              audio_wav_b64: str | None = None) -> str | None:
    mensajes = [{"role": "system", "content": SISTEMA + "\n\nHECHOS DEL TERRENO:\n" + hechos}]
    for h in (historial or [])[-6:]:
        if h.get("role") in ("user", "assistant") and h.get("content"):
            mensajes.append({"role": h["role"], "content": str(h["content"])[:600]})
    if audio_wav_b64:
        contenido = [{"type": "text", "text": "Nota de voz del agricultor:"},
                     {"type": "input_audio", "input_audio": {"data": audio_wav_b64, "format": "wav"}}]
        mensajes.append({"role": "user", "content": contenido})
        return _llamar(MODELOS_AUDIO, mensajes)
    mensajes.append({"role": "user", "content": pregunta or ""})
    return _llamar(MODELOS, mensajes)
