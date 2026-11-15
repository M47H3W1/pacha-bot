"""Gemini (API gratuita de Google AI Studio) para explicar resultados y responder preguntas libres."""
import json
import logging
import os

import httpx

log = logging.getLogger(__name__)

SISTEMA = """Eres Pacha, un asistente agrícola para campesinos de la sierra del Ecuador.
Reglas:
- Habla en español sencillo y cálido, con frases cortas. Trata al agricultor de "usted" o "vecino" con respeto.
- Máximo 120 palabras. Sin markdown, sin asteriscos ni tablas. Puedes usar 1 o 2 emojis.
- Usa SOLO los números del CONTEXTO. Si no tienes un dato, dilo y sugiere usar el menú.
- Solo hablas de cultivos de la sierra: papa, maíz suave, haba, arveja, fréjol, cebada, trigo, avena con vicia,
  quinua, chocho, melloco, oca, pasto con trébol.
- 1 mm de agua es 1 litro por metro cuadrado. Explica así el riego.
- No recomiendes marcas ni dosis de pesticidas o fertilizantes químicos; para eso, que consulte a un técnico del MAG,
  de su GAD parroquial o de su asociación.
- Termina recordando con pocas palabras que la decisión es del agricultor y que conviene confirmarlo en su campo.
"""


class Gemini:
    def __init__(self):
        self.key = os.getenv("GEMINI_API_KEY", "").strip()
        self.model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip()
        self.activo = bool(self.key)

    def responder(self, pregunta: str, contexto: dict, historial: list[dict] | None = None,
                  audio_ogg: bytes | None = None) -> str | None:
        """Responde una pregunta escrita o una nota de voz (audio_ogg)."""
        if not self.activo:
            return None
        contents = [{"role": m["role"], "parts": [{"text": m["content"]}]} for m in (historial or [])[-8:]]
        parts = [{"text": f"CONTEXTO (datos de Pacha):\n{json.dumps(contexto, ensure_ascii=False)}\n\n"
                          f"PREGUNTA DEL AGRICULTOR:\n{pregunta}"}]
        if audio_ogg:
            import base64
            parts.insert(0, {"inline_data": {"mime_type": "audio/ogg",
                                             "data": base64.b64encode(audio_ogg).decode()}})
        contents.append({"role": "user", "parts": parts})
        body = {"system_instruction": {"parts": [{"text": SISTEMA}]}, "contents": contents,
                "generationConfig": {"temperature": 0.4, "maxOutputTokens": 600}}
        try:
            r = httpx.post(f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent",
                           headers={"x-goog-api-key": self.key}, json=body, timeout=40)
            r.raise_for_status()
            parts = r.json()["candidates"][0]["content"]["parts"]
            texto = "".join(p.get("text", "") for p in parts).strip()
            return texto.replace("**", "").replace("*", "•") or None
        except Exception as e:
            log.warning("Gemini falló: %s", e)
            return None
