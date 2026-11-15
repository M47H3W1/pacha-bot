"""API de la aplicación (web y móvil): devuelve datos en JSON para que la interfaz dibuje tarjetas y gráficos.

Reutiliza el mismo motor que el chat (`web/servicio.py` y `app/engine.py`). El cliente guarda el estado
(lugar, radio, cultivo, mes) y lo envía en cada llamada; el servidor no guarda nada del usuario.
"""
from __future__ import annotations

import copy
import datetime as dt
import json
import logging
from collections import Counter
from functools import lru_cache
from pathlib import Path

import numpy as np

from app import engine as E
from app.catalog import CASOS, CROPS, MESES, MESES_LARGO, ventana
from app.textos import DIAS, clasificar_meses, plan_riego
from web import servicio as S

log = logging.getLogger("pacha.app")
RAIZ = Path(__file__).resolve().parent.parent
FOTOS = RAIZ / "app" / "imagenes" / "cultivos"

FUENTES = [
    {"id": "power", "nombre": "NASA POWER", "detalle": "Temperatura, humedad, viento, radiación y lluvia diarias (MERRA-2 y CERES), 2001–2024",
     "url": "https://power.larc.nasa.gov/", "agencia": "NASA"},
    {"id": "imerg", "nombre": "GPM IMERG", "detalle": "Lluvia satelital diaria a 0,1° (misión GPM). Validada contra 85 estaciones del INAMHI",
     "url": "https://gpm.nasa.gov/data/imerg", "agencia": "NASA"},
    {"id": "modis", "nombre": "MODIS (Terra/Aqua)", "detalle": "Verdor NDVI, temperatura de superficie y productividad (ORNL DAAC)",
     "url": "https://modis.ornl.gov/", "agencia": "NASA"},
    {"id": "smap", "nombre": "SMAP", "detalle": "Humedad del suelo superficial y en zona de raíces",
     "url": "https://smap.jpl.nasa.gov/", "agencia": "NASA"},
    {"id": "srtm", "nombre": "SRTM / NASADEM", "detalle": "Altura y pendiente a 30 m",
     "url": "https://www.earthdata.nasa.gov/data/instruments/srtm", "agencia": "NASA"},
    {"id": "fao56", "nombre": "FAO-56 Penman-Monteith", "detalle": "Evapotranspiración y coeficientes de cultivo (Kc)",
     "url": "https://www.fao.org/4/x0490e/x0490e00.htm", "agencia": "FAO"},
    {"id": "inamhi", "nombre": "INAMHI", "detalle": "Lluvia mensual de 947 estaciones (1960–2019) para validar y corregir",
     "url": "https://www.datosabiertos.gob.ec/", "agencia": "Ecuador"},
    {"id": "mag", "nombre": "MAG · Geopedológico 1:25.000", "detalle": "Suelo, pendiente y zonificación agroecológica",
     "url": "http://geoportal.agricultura.gob.ec/", "agencia": "Ecuador"},
    {"id": "iniap", "nombre": "INIAP", "detalle": "Variedades, ciclos y épocas de siembra por provincia",
     "url": "https://repositorio.iniap.gob.ec/", "agencia": "Ecuador"},
    {"id": "soilgrids", "nombre": "ISRIC SoilGrids", "detalle": "Textura y carbono del suelo a 250 m (se reemplazará por el MAG)",
     "url": "https://soilgrids.org/", "agencia": "Complementaria"},
    {"id": "ecmwf", "nombre": "ECMWF (vía Open-Meteo)", "detalle": "Corrección de altura y pronóstico de 7 días",
     "url": "https://open-meteo.com/", "agencia": "Complementaria"},
]


@lru_cache(maxsize=1)
def _parroquias() -> dict:
    return json.loads((RAIZ / "app" / "parroquias.json").read_text(encoding="utf-8"))


def parroquias() -> dict:
    return _parroquias()


def fuentes() -> dict:
    return {"fuentes": FUENTES,
            "validacion": {"estaciones": 85, "error_crudo_pct": 40, "error_calibrado_pct": 15,
                           "r_imerg": 0.68, "r_merra2": 0.51,
                           "nota": "Lluvia anual: IMERG calibrado con estaciones INAMHI vecinas (validación cruzada)."}}


def _cultivo(c) -> dict:
    foto = next((f"/img/cultivos/{c.id}{ext}" for ext in (".jpg", ".png", ".webp") if (FOTOS / f"{c.id}{ext}").exists()), None)
    return {"id": c.id, "nombre": c.nombre, "emoji": c.emoji, "foto": foto, "familia": c.familia,
            "fija_n": bool(c.fija_n), "ciclo_dias": c.ciclo_dias, "uso": c.uso, "aporte": c.aporte, "riesgo": c.riesgo}


def _lugar(st: dict, sitio) -> dict:
    m2 = S.area_m2(st.get("radio", 100))
    return {"lat": sitio.lat, "lon": sitio.lon, "elev": round(sitio.elev), "provincia": sitio.provincia,
            "area_m2": round(m2), "area_texto": S.decir_area(m2)}


def parcela(st: dict) -> dict:
    sitio, clima = S.sitio_y_clima(st["lat"], st["lon"])
    res, c = clima.resumen(), S.caracteristicas(sitio, clima)
    tipos, _ = clasificar_meses(res)
    try:
        dz = S.desnivel(st["lat"], st["lon"], st.get("radio", 100))
    except Exception:  # la pendiente es opcional: sin red no se muestra
        dz = None
    suelo = sitio.suelo or {}
    return {
        "lugar": _lugar(st, sitio),
        "suelo": {"textura": suelo.get("textura", "franco").replace(" (supuesto)", ""),
                  "supuesto": "supuesto" in suelo.get("textura", "supuesto"),
                  "mo": suelo.get("mo"), "agua_util_mm": round(c["taw"]),
                  "guarda": "poca" if c["taw"] < 45 else "bien" if c["taw"] >= 70 else "media"},
        "pendiente": None if dz is None else {"desnivel_m": round(dz),
                                               "clase": "plano" if dz < 5 else "suave" if dz < 15 else "fuerte"},
        "clima": {"lluvia_anual": round(res["lluvia_anual"]), "lluvia_seca": round(res["lluvia_seca"]),
                  "et0_anual": round(res["et0_anual"]), "tmin": round(res["tmin"], 1), "tmax": round(res["tmax"], 1),
                  "lluvia_mes": [round(x) for x in res["lluvia_mes"]], "et0_mes": [round(x) for x in res["et0_mes"]],
                  "tipo_mes": tipos, "humedad_mes": [round(h, 2) for h in c["humedad"]],
                  "meses_lluvia": [MESES[i] for i, t in enumerate(tipos) if t == "lluvia"],
                  "meses_secos": [MESES[i] for i, t in enumerate(tipos) if t == "seco"]},
        "tendencia": {"cambio_lluvia_pct": round(c["cambio_lluvia"]), "cambio_temp_c": round(c["cambio_temp"], 1),
                      "decadas": c["decadas"], "calor_dias": round(c["calor"]), "aguaceros": round(c["aguaceros"])},
        "periodo": res["anios"], "metodo": clima.metodo,
        "fuentes": ["power", "fao56", "ecmwf"] + (["soilgrids"] if not suelo.get("textura", "").endswith("(supuesto)") else []),
    }


def _en_temporada(c, mes: int, provincia: str) -> bool:
    v = ventana(c.id, provincia)
    return v is None or mes in v["meses"]


def _ganadores_por_anio(sitio, clima, mes: int, candidatos: set[str]) -> tuple[Counter, int]:
    """Corre la recomendación con un solo año histórico a la vez y cuenta qué cultivo sale primero."""
    ganes, n = Counter(), 0
    for i, y in enumerate(clima.anios):
        c1 = copy.copy(clima)
        c1.anios = [y]
        c1.prob_helada = clima.helada_m[i].astype(float)
        c1.clave = f"{clima.clave}|{y}"
        try:
            with np.errstate(all="ignore"):  # con un solo año, la variación de la lluvia no se define
                filas = [f for f in E.recomendar_para_empezar(sitio, c1, mes, None, n=99) if f["crop"].id in candidatos]
        except Exception:  # años incompletos al final de la serie
            continue
        if filas:
            ganes[filas[0]["crop"].id] += 1
            n += 1
    return ganes, n


def recomendacion(st: dict) -> dict:
    sitio, clima = S.sitio_y_clima(st["lat"], st["lon"])
    mes = int(st.get("mes") or S._mes_siguiente())
    todos = [f for f in E.recomendar_para_empezar(sitio, clima, mes, None, n=99) if f["crop"].id != "descanso"]
    en_epoca = [f for f in todos if _en_temporada(f["crop"], mes, sitio.provincia)]
    base = {"mes": mes, "mes_nombre": MESES_LARGO[mes - 1], "lugar": _lugar(st, sitio)}
    if not en_epoca:
        conteo = {m: sum(1 for c in E.cultivos_aptos(sitio.elev) if c.id != "descanso"
                         and m in (ventana(c.id, sitio.provincia) or {}).get("meses", ())) for m in range(1, 13)}
        mejores = sorted(conteo, key=lambda m: -conteo[m])[:3]
        return {**base, "fuera_de_epoca": True, "cultivos": [],
                "meses_sugeridos": [{"mes": m, "nombre": MESES_LARGO[m - 1]} for m in mejores]}
    ganes, n = _ganadores_por_anio(sitio, clima, mes, {f["crop"].id for f in en_epoca})
    m2 = S.area_m2(st.get("radio", 100))
    out = []
    for f in en_epoca[:3]:
        b = f["banco"]
        litros = b["total_falta"] / S.EFICIENCIA * m2
        out.append({**_cultivo(f["crop"]), "puntaje": f["puntaje"], "veredicto": b["veredicto"],
                    "anios_bien": b["n_bien"], "anios": b["anios"],
                    "gana_anios": ganes.get(f["crop"].id, 0), "gana_de": n,
                    "cosecha": MESES_LARGO[b["mes_ids"][-1] - 1], "mes_critico": b["mes_critico"],
                    "riego_mm": round(b["total_falta"]), "riego_litros": round(litros),
                    "riego_texto": S.agua_larga(litros) if b["total_falta"] >= 5 else "casi no necesita riego",
                    "componentes": {k: round(v, 2) for k, v in f["comp"].items()}})
    return {**base, "fuera_de_epoca": False, "cultivos": out, "anios": n,
            "otros": [_cultivo(f["crop"]) for f in en_epoca[3:]], "metodo": clima.metodo}


def cultivo(st: dict) -> dict:
    sitio, clima = S.sitio_y_clima(st["lat"], st["lon"])
    crop, mes = CROPS[st["crop"]], int(st.get("mes") or S._mes_siguiente())
    b, _, _ = E.analisis_cultivo(clima, crop, mes)
    m2 = S.area_m2(st.get("radio", 100))
    v = ventana(crop.id, sitio.provincia)
    rot = E.comparar_rotaciones(sitio, clima, crop.id, mes)
    rot.sort(key=lambda e: -e["puntaje"])
    rotaciones = []
    for e in rot[:3]:
        m, pasos = mes, []
        for c in e["crops"]:
            pasos.append({**_cultivo(c), "desde": MESES[m - 1]})
            m = (m - 1 + E._meses_ciclo(c)) % 12 + 1
        rotaciones.append({"pasos": pasos, "puntaje": e["puntaje"],
                           "leguminosa": e["leguminosas"][0].nombre if e["leguminosas"] else None,
                           "repite_familia": e["repetidas"] > 0})
    return {"cultivo": _cultivo(crop), "mes": mes, "mes_nombre": MESES_LARGO[mes - 1], "lugar": _lugar(st, sitio),
            "veredicto": b["veredicto"], "anios_bien": b["n_bien"], "anios_mal": b["n_mal"], "anios": b["anios"],
            "epoca": v["texto"] if v else None, "en_epoca": _en_temporada(crop, mes, sitio.provincia),
            "cosecha": MESES_LARGO[b["mes_ids"][-1] - 1], "mes_critico": b["mes_critico"],
            "meses": [{"mes": b["meses"][i], "lluvia_util": round(b["lluvia_util"][i]), "gasto": round(b["gasto"][i]),
                       "falta": round(b["falta"][i]), "estado": b["estado_mes"][i],
                       "riego_texto": S.agua_corta(b["falta"][i] / S.EFICIENCIA * m2)} for i in range(len(b["meses"]))],
            "riego_total_mm": round(b["total_falta"]), "riego_seco_mm": round(b["total_falta_seco"]),
            "riego_total_texto": S.agua_larga(b["total_falta"] / S.EFICIENCIA * m2) if b["total_falta"] >= 5 else "casi nada",
            "lluvia_ciclo": round(b["lluvia_ciclo"]), "lluvia_min": round(b["lluvia_min"]), "lluvia_max": round(b["lluvia_max"]),
            "rotaciones": rotaciones}


def riego(st: dict) -> dict:
    sitio, _ = S.sitio_y_clima(st["lat"], st["lon"])
    crop = CROPS[st["crop"]]
    siembra = dt.date.today() - dt.timedelta(days=int(st.get("dias", 30)))
    w = E.riego_semana(sitio, crop, siembra)
    p = plan_riego(w, S.EFICIENCIA, (sitio.suelo or {}).get("textura", ""))
    m2 = S.area_m2(st.get("radio", 100))
    litros = w["falta"] / S.EFICIENCIA / p["veces"] * m2 if p["veces"] else 0
    return {"cultivo": _cultivo(crop), "etapa": w["etapa"], "dia": w["dia"], "veces": p["veces"],
            "litros_por_vez": round(litros), "agua_por_vez": S.agua_larga(litros) if p["veces"] else None,
            "lluvia_semana": round(w["lluvia"], 1), "gasto_semana": round(w["gasto"], 1),
            "dias": [{"fecha": d["fecha"].isoformat(), "dia": DIAS[d["fecha"].weekday()], "regar": d["regar"],
                      "lluvia": round(d["lluvia"], 1)} for d in p["tira"]]}


def probadas(st: dict) -> dict:
    sitio, clima = S.sitio_y_clima(st["lat"], st["lon"])
    mes = int(st.get("mes") or S._mes_siguiente())
    out = []
    for caso in sorted(CASOS, key=lambda c: c["provincia"] != sitio.provincia):
        ids = [c for c in caso["secuencia"] if c in CROPS]
        e = E.evaluar_rotacion(sitio, clima, ids, mes)
        out.append({"lugar": caso["lugar"], "provincia": caso["provincia"], "periodo": caso["periodo"],
                    "resultado": caso["resultado"], "pasos": [_cultivo(CROPS[c]) for c in ids],
                    "agua": "poca" if e["falta_anual"] < 30 else "a veces" if e["falta_anual"] < 100 else "mucha"})
    return {"casos": out}


ACCIONES = {"parcela": parcela, "recomendacion": recomendacion, "cultivo": cultivo, "riego": riego, "probadas": probadas}


# ---------------------------------------------------------------- juego "Astro Granja"
# El juego solo dibuja: el relieve, las semillas permitidas, el clima diario, la humedad del suelo y el puntaje
# salen de aquí, con el mismo motor (NASA POWER corregido, FAO-56, balance de suelo del equipo).
LOTE_ELEV = 100  # Open-Meteo acepta hasta 100 coordenadas por consulta


def terreno(st: dict) -> dict:
    """Grilla n×n de alturas (m) que cubre el círculo de la tierra. Fuente: modelo de elevación de Open-Meteo (90 m).
    No usa el clima, así el 3D aparece mientras cargan los datos de la NASA."""
    from app import clients
    lat, lon, radio = st["lat"], st["lon"], float(st.get("radio", 100))
    n = int(st.get("n", 17))
    n = max(5, min(33, n | 1))  # impar para que el centro caiga en un punto
    lado = 2 * radio
    paso = lado / (n - 1)
    cos = float(np.cos(np.radians(lat)))
    pts = [(lat + (radio - i * paso) / 111320, lon + (-radio + j * paso) / (111320 * cos))
           for i in range(n) for j in range(n)]  # fila 0 = norte, columna 0 = oeste
    alturas: list[float] = []
    for k in range(0, len(pts), LOTE_ELEV):
        lote = pts[k:k + LOTE_ELEV]
        z = clients.elevaciones(lote)
        if not z or len(z) != len(lote):
            alturas = []
            break
        alturas.extend(float(v) for v in z)
    plano = not alturas
    if plano:  # sin relieve: plano a la altura del punto si se conoce; el juego lo avisa
        try:
            z0 = float(clients.elevation(lat, lon))
        except Exception:
            z0 = 0.0
        alturas = [z0] * (n * n)
    grilla = [alturas[i * n:(i + 1) * n] for i in range(n)]
    z = np.array(grilla)
    gy, gx = np.gradient(z, paso)
    yy, xx = np.mgrid[0:n, 0:n]
    dentro = (yy - n // 2) ** 2 + (xx - n // 2) ** 2 <= (n // 2) ** 2   # solo dentro del círculo
    pend = float(np.mean(np.hypot(gx, gy)[dentro]) * 100)
    clase = "plano" if pend < 5 else "suave" if pend < 12 else "moderada" if pend < 25 else "fuerte"
    return {"pendiente_pct": round(pend, 1), "pendiente_clase": clase, "n": n, "radio": radio, "lado_m": lado, "paso_m": round(paso, 2), "alturas": grilla,
            "min": min(alturas), "max": max(alturas), "centro": grilla[n // 2][n // 2],
            "desnivel_m": round(max(alturas) - min(alturas), 1), "area_m2": round(S.area_m2(radio)),
            "sin_relieve": plano, "fuente": "Open-Meteo elevation (Copernicus DEM, 90 m)"}


def semillas(st: dict) -> dict:
    """Los 13 cultivos del equipo con su época de siembra en la zona y si se pueden sembrar a esta altura y mes."""
    sitio, _ = S.sitio_y_clima(st["lat"], st["lon"])
    mes = int(st.get("mes") or S._mes_siguiente())
    out, meses_zona, por_mes = [], set(), [0] * 12
    for c in CROPS.values():
        if c.id == "descanso":
            continue
        v = ventana(c.id, sitio.provincia)
        meses = sorted(v["meses"]) if v else list(range(1, 13))
        apto = c.alt_min <= sitio.elev <= c.alt_max
        if apto:
            meses_zona.update(meses)
            for m in meses:
                por_mes[m - 1] += 1
        en_epoca = mes in meses
        if not apto:
            razon = (f"quiere más altura (desde {c.alt_min:,} m)".replace(",", ".") if sitio.elev < c.alt_min
                     else f"prefiere tierras más bajas (hasta {c.alt_max:,} m)".replace(",", "."))
        elif not en_epoca:
            razon = f"aquí se siembra {v['texto']}" if v else "no es su época"
        else:
            razon = ""
        out.append({**_cultivo(c), "alt_min": c.alt_min, "alt_max": c.alt_max, "apto": apto, "meses": meses,
                    "epoca_texto": v["texto"] if v else "todo el año", "en_epoca": en_epoca,
                    "se_puede": apto and en_epoca, "razon": razon,
                    "etapas": [round(f * c.ciclo_dias) for f in c.fr]})
    out.sort(key=lambda x: (not x["se_puede"], not x["apto"], x["nombre"]))
    return {"lugar": _lugar(st, sitio), "mes": mes, "mes_nombre": MESES_LARGO[mes - 1],
            "meses_zona": sorted(meses_zona), "siembra_por_mes": por_mes, "cultivos": out}


def _anios_tipicos(clima, mes: int, kc, taw) -> list[int]:
    """Años con el ciclo completo en la serie, del más típico (déficit cercano a la mediana) al menos típico."""
    n, filas = len(kc), []
    for y in clima.anios:
        ini = clima.idx.get(dt.date(y, mes, 1))
        if ini is None or ini + n > len(clima.fechas):
            continue
        sl = slice(ini, ini + n)
        _, d = E._balance_suelo(clima.p[sl], kc * clima.et0[sl], taw)
        filas.append((y, float(d.sum())))
    med = float(np.median([d for _, d in filas]))
    return [y for y, _ in sorted(filas, key=lambda f: abs(f[1] - med))]


def ciclo(st: dict) -> dict:
    """Un ciclo del cultivo día a día con el clima real de un año de NASA POWER y los riegos del jugador.
    riegos: [[día, mm], ...]. m2: área de la parcela del juego (para pasar mm a litros)."""
    sitio, clima = S.sitio_y_clima(st["lat"], st["lon"])
    crop, mes = CROPS[st["crop"]], int(st.get("mes") or S._mes_siguiente())
    kc = E.curva_kc(crop)
    n, taw = len(kc), crop.zr * clima.agua_util
    anios = _anios_tipicos(clima, mes, kc, taw)
    pedido = int(st.get("anio", 0))
    anio = pedido if pedido in anios else anios[0]
    ini = clima.idx[dt.date(anio, mes, 1)]
    sl = slice(ini, ini + n)
    P, etc = clima.p[sl], kc * clima.et0[sl]
    riego = np.zeros(n)
    for d, mm in st.get("riegos", []):
        if 0 <= int(d) < n:
            riego[int(d)] += max(0.0, float(mm))
    reserva = E.RESERVA_INICIAL * taw  # mismo balance diario que banco_de_agua, más el agua que pone el jugador
    dias, falta_tot, secos = [], 0.0, 0
    for d in range(n):
        disponible = reserva + E.LLUVIA_EFECTIVA * P[d] + riego[d]
        uso = min(etc[d], disponible)
        falta = etc[d] - uso
        reserva = min(taw, disponible - uso)
        falta_tot += falta
        seco = bool(etc[d] > 0 and falta >= max(0.5, E.UMBRAL_PROBLEMA * etc[d]))
        secos += seco
        dias.append({"fecha": clima.fechas[ini + d].isoformat(), "lluvia": round(float(P[d]), 1),
                     "tmax": round(float(clima.tmax[ini + d]), 1), "calor": bool(clima.tmax[ini + d] >= S.CALOR),
                     "gasto": round(float(etc[d]), 2), "riego": round(float(riego[d]), 1),
                     "humedad": round(float(reserva / taw), 2), "falta": round(float(falta), 2),
                     "seco": seco, "etapa": E.etapa(crop, d)})
    etc_tot = float(etc.sum())
    ratio = falta_tot / etc_tot if etc_tot else 0.0
    v = ventana(crop.id, sitio.provincia)
    en_epoca = v is None or mes in v["meses"]
    b, _, _ = E.analisis_cultivo(clima, crop, mes)
    agua = max(0.0, 1 - ratio / E.ANIO_MALO)  # 1 sin falta; 0 cuando falta 30 % o más de lo que pide
    puntaje = round(100 * (0.8 * agua + 0.2 * en_epoca))
    m2 = float(st.get("m2") or S.area_m2(st.get("radio", 100)))
    return {"cultivo": _cultivo(crop), "mes": mes, "mes_nombre": MESES_LARGO[mes - 1], "anio": anio,
            "anios": sorted(anios), "dias": dias, "taw_mm": round(taw, 1),
            "etapas": [round(f * crop.ciclo_dias) for f in crop.fr],
            "riego_mm": round(float(riego.sum()), 1), "falta_mm": round(falta_tot, 1), "gasto_mm": round(etc_tot, 1),
            "dias_secos": secos, "puntaje": puntaje, "estrellas": 3 if puntaje >= 85 else 2 if puntaje >= 60 else 1,
            "en_epoca": en_epoca, "epoca": v["texto"] if v else None,
            "veredicto": b["veredicto"], "estado_mes": b["estado_mes"], "meses": b["meses"],
            "m2": round(m2), "litros_por_mm": round(m2 / S.EFICIENCIA, 1),
            "agua": {"gasto_mm": round(b["total_gasto"]), "lluvia_util_mm": round(b["total_lluvia_util"]),
                     "riego_mm": round(b["total_falta"]), "riego_seco_mm": round(b["total_falta_seco"]),
                     "litros_cultivo": round(b["total_gasto"] * m2), "litros_lluvia": round(b["total_lluvia_util"] * m2),
                     "litros_riego": round(b["total_falta"] * m2 / S.EFICIENCIA),
                     "litros_riego_seco": round(b["total_falta_seco"] * m2 / S.EFICIENCIA)},
            "tanque_litros": round(max(b["total_falta_seco"], 20.0) * m2 / S.EFICIENCIA)}


ACCIONES.update({"terreno": terreno, "semillas": semillas, "ciclo": ciclo})
