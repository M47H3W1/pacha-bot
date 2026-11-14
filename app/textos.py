"""Textos sencillos sin dependencias de Telegram: los usa el bot y la web."""
import datetime as dt

from .catalog import MESES_LARGO

DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
NUMEROS = {1: "una vez", 2: "dos veces", 3: "tres veces"}


def num(x: float, d: int = 0) -> str:
    s = f"{x:,.{d}f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


def cuando(meses: list[int]) -> str:
    """[0,1,2,3,4] -> 'de enero a mayo'; [6,7] -> 'en julio y agosto'. Une meses seguidos, incluso dic-ene."""
    if not meses:
        return ""
    grupos = []
    for m in sorted(meses):
        if grupos and m == grupos[-1][-1] + 1:
            grupos[-1].append(m)
        else:
            grupos.append([m])
    if len(grupos) > 1 and grupos[0][0] == 0 and grupos[-1][-1] == 11:
        grupos[0] = grupos.pop() + grupos[0]
    partes = []
    for g in grupos:
        if len(g) == 1:
            partes.append(f"en {MESES_LARGO[g[0]]}")
        elif len(g) == 2:
            partes.append(f"en {MESES_LARGO[g[0]]} y {MESES_LARGO[g[1]]}")
        else:
            partes.append(f"de {MESES_LARGO[g[0]]} a {MESES_LARGO[g[-1]]}")
    return partes[0] if len(partes) == 1 else ", ".join(partes[:-1]) + " y " + partes[-1]


def clasificar_meses(res: dict):
    tipos = ["lluvia" if p >= 0.8 * e else "seco" if p < 0.5 * e else "medio"
             for p, e in zip(res["lluvia_mes"], res["et0_mes"])]
    heladas = [i for i, p in enumerate(res["prob_helada"]) if p >= 0.2]
    return tipos, heladas


def baldes(n: float) -> str:
    n = max(round(n * 2) / 2, 0.5)
    if n == 0.5:
        return "medio balde"
    entero, medio = int(n), n % 1 == 0.5
    base = f"{entero} balde" + ("s" if entero > 1 else "")
    return base + (" y medio" if medio else "")


def plan_riego(w: dict, ef: float, textura: str) -> dict:
    """Cuántas veces, qué días y cuánto por vez. Cuadro de 3 por 3 pasos ≈ 5 m², balde = 20 L."""
    necesidad = w["falta"] / ef
    if necesidad < 2:
        n = 0
    elif necesidad <= 10:
        n = 1
    elif necesidad <= 25:
        n = 2
    else:
        n = 3
    if n and "arenoso" in textura and n < 3:
        n += 1
    fechas = [dt.date.fromisoformat(f) for f in w["fechas"]]
    lluvia = w["lluvia_dia"]
    elegidos = []
    for i in sorted(range(len(fechas)), key=lambda i: (lluvia[i], i)):
        if len(elegidos) == n:
            break
        if all(abs(i - j) >= 2 for j in elegidos):
            elegidos.append(i)
    for i in sorted(range(len(fechas)), key=lambda i: lluvia[i]):  # si no hubo días separados
        if len(elegidos) < n and i not in elegidos:
            elegidos.append(i)
    elegidos.sort()
    por_vez_mm = necesidad / n if n else 0
    heladas = {d for d, _ in w["heladas"]}
    dias = [{"fecha": f, "regar": i in elegidos, "helada": f in heladas, "lluvia": lluvia[i]}
            for i, f in enumerate(fechas)]
    return {"veces": n, "dias": [fechas[i] for i in elegidos], "baldes_cuadro": por_vez_mm * 5 / 20,
            "heladas": sorted(heladas), "tira": dias}


