"""Etiquetas en kichwa a nivel de palabra.

POR VALIDAR: estas palabras deben revisarlas hablantes nativos de kichwa de la sierra antes de usarse en
campo. A propósito no hay frases completas: una frase mal traducida confunde más que ayudar.
"""

POR_VALIDAR = True

PALABRAS = {
    "saludo": "Imanalla",   # ¿cómo está? / hola
    "chakra": "Chakra",     # terreno, parcela
    "tarpuy": "Tarpuy",     # sembrar
    "yaku": "Yaku",         # agua
    "kasa": "Kasa",         # helada
    "tapuy": "Tapuy",       # preguntar
    "ashtawan": "Ashtawan", # más
    "tamya": "Tamya",       # lluvia
    "inti": "Inti",         # sol
}

CULTIVOS = {"maiz": "Sara", "quinua": "Kinwa", "chocho": "Tawri"}


def boton(espanol: str, clave: str, st: dict) -> str:
    """En modo kichwa muestra 'Kichwa · Español'; si no, solo español."""
    if st.get("idioma") == "ki" and clave in PALABRAS:
        return f"{PALABRAS[clave]} · {espanol}"
    return espanol


def cultivo(crop, st: dict) -> str:
    if st.get("idioma") == "ki" and crop.id in CULTIVOS:
        return f"{CULTIVOS[crop.id]} ({crop.nombre})"
    return crop.nombre
