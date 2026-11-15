"""Motor agro-físico de Pacha.

- ET0 diaria FAO-56 Penman-Monteith con NASA POWER, corrigiendo temperatura por altura.
- Lluvia útil mensual con el método USDA-SCS (el que usa CROPWAT de la FAO).
- Banco de agua: riego = max(0, ETc - lluvia útil) / eficiencia, por mes del ciclo.
- Helada: probabilidad de que el aire a 2 m baje de 2 °C al menos un día en el mes.
- Rotaciones: puntaje explicable de agua, suelo, helada e ingreso.
"""
from __future__ import annotations

import datetime as dt
import itertools
import math
from dataclasses import dataclass, field
from functools import lru_cache

import numpy as np

from . import clients
from .catalog import CROPS, MESES, MESES_LARGO, PROVINCIAS, Crop

LAPSE = 0.0065        # °C por metro
FROST_T = 4.0         # °C del aire a 2 m (modelo). En noches despejadas la hoja queda 3-5 °C más fría
                      # y los modelos de celda grande no captan las noches más frías.
SIERRA = dict(lat=(-5.0, 1.5), lon=(-80.5, -77.0), z_min=1500)
INGRESO = {"alto": 1.0, "medio": 0.6, "bajo": 0.3, "ninguno": 0.0}
SENS_HELADA = {"alta": 1.0, "media": 0.5, "baja": 0.2, "ninguna": 0.0}


class FueraDeSierra(Exception):
    pass


# ---------------------------------------------------------------- física básica
def _e0(t):
    return 0.6108 * np.exp(17.27 * t / (t + 237.3))


def et0_penman_monteith(tmax, tmin, rh, u2, rs, doy, lat, z):
    """ET0 diaria (mm/día) según FAO-56, ec. 6. rs en MJ/m²/día."""
    tmean = (tmax + tmin) / 2
    p = 101.3 * ((293 - 0.0065 * z) / 293) ** 5.26
    gamma = 0.000665 * p
    es = (_e0(tmax) + _e0(tmin)) / 2
    ea = np.clip(rh, 1, 100) / 100 * es
    delta = 4098 * _e0(tmean) / (tmean + 237.3) ** 2
    phi = math.radians(lat)
    dr = 1 + 0.033 * np.cos(2 * np.pi * doy / 365)
    dec = 0.409 * np.sin(2 * np.pi * doy / 365 - 1.39)
    ws = np.arccos(np.clip(-np.tan(phi) * np.tan(dec), -1, 1))
    ra = 24 * 60 / np.pi * 0.0820 * dr * (ws * np.sin(phi) * np.sin(dec)
                                          + np.cos(phi) * np.cos(dec) * np.sin(ws))
    rso = (0.75 + 2e-5 * z) * ra
    rns = 0.77 * rs
    ratio = np.clip(rs / np.maximum(rso, 1e-6), 0.25, 1.0)
    rnl = 4.903e-9 * (((tmax + 273.16) ** 4 + (tmin + 273.16) ** 4) / 2) \
        * (0.34 - 0.14 * np.sqrt(ea)) * (1.35 * ratio - 0.35)
    rn = rns - rnl
    num = 0.408 * delta * rn + gamma * 900 / (tmean + 273) * u2 * (es - ea)
    return np.maximum(num / (delta + gamma * (1 + 0.34 * u2)), 0)


def lluvia_util_mensual(p):
    """USDA-SCS (CROPWAT): lluvia efectiva mensual en mm."""
    p = np.asarray(p, dtype=float)
    return np.where(p <= 250, p * (125 - 0.2 * p) / 125, 125 + 0.1 * p)


def curva_kc(crop: Crop, n: int | None = None) -> np.ndarray:
    """Kc diario FAO-56 por tramos (inicial, desarrollo, media, final)."""
    n = n or crop.ciclo_dias
    li, ld, lm, _ = (round(f * n) for f in crop.fr)
    kc = np.empty(n)
    for d in range(n):
        if d < li:
            kc[d] = crop.kc_ini
        elif d < li + ld:
            kc[d] = crop.kc_ini + (crop.kc_mid - crop.kc_ini) * (d - li) / max(ld, 1)
        elif d < li + ld + lm:
            kc[d] = crop.kc_mid
        else:
            late = max(n - (li + ld + lm), 1)
            kc[d] = crop.kc_mid + (crop.kc_end - crop.kc_mid) * (d - li - ld - lm) / late
    return kc


def etapa(crop: Crop, dia: int) -> str:
    li, ld, lm, _ = (round(f * crop.ciclo_dias) for f in crop.fr)
    if dia < 0:
        return "antes de sembrar"
    if dia < li:
        return "recién sembrado"
    if dia < li + ld:
        return "creciendo"
    if dia < li + ld + lm:
        return "en plena producción"
    if dia < crop.ciclo_dias:
        return "madurando"
    return "listo para cosechar"


# ---------------------------------------------------------------- sitio y clima
@dataclass
class Sitio:
    lat: float
    lon: float
    elev: float
    grid_elev: float
    provincia: str
    suelo: dict = field(default_factory=dict)


def provincia_cercana(lat, lon) -> str:
    return min(PROVINCIAS.values(), key=lambda p: (p[1] - lat) ** 2 + (p[2] - lon) ** 2)[0]


def clasificar_suelo(s: dict | None) -> dict:
    if not s:
        return {"textura": "franco (supuesto)", "mo": None, "fuente": "valor por defecto"}
    clay, sand = s["clay"], s["sand"]
    if sand > 70:
        tex = "arenoso"
    elif clay > 40:
        tex = "arcilloso"
    elif sand > 50:
        tex = "franco arenoso"
    elif clay > 27:
        tex = "franco arcilloso"
    else:
        tex = "franco"
    return {"textura": tex, "arcilla": round(clay), "arena": round(sand),
            "mo": round(s["soc"] / 10 * 1.724, 1), "fuente": "SoilGrids (ISRIC)"}


def crear_sitio(lat: float, lon: float, provincia: str | None = None) -> Sitio:
    if not (SIERRA["lat"][0] <= lat <= SIERRA["lat"][1] and SIERRA["lon"][0] <= lon <= SIERRA["lon"][1]):
        raise FueraDeSierra("fuera de Ecuador continental")
    z = clients.elevation(lat, lon)
    if z < SIERRA["z_min"]:
        raise FueraDeSierra(f"altura {z:.0f} m")
    pw = clients.power_daily(lat, lon)
    return Sitio(lat, lon, z, pw["grid_elev"], provincia or provincia_cercana(lat, lon),
                 clasificar_suelo(clients.soil(lat, lon)))


class Clima:
    """Clima diario 2001-2024 del sitio, con escenario opcional (dP fracción, dT °C)."""

    def __init__(self, sitio: Sitio, dP: float = 0.0, dT: float = 0.0):
        self.clave = f"{sitio.lat:.3f},{sitio.lon:.3f},{sitio.elev:.0f},{dP},{dT}"
        par = clients.power_daily(sitio.lat, sitio.lon)["param"]
        keys = sorted(par["T2M_MAX"].keys())
        self.fechas = [dt.date(int(k[:4]), int(k[4:6]), int(k[6:])) for k in keys]
        self.idx = {f: i for i, f in enumerate(self.fechas)}
        mes = np.array([f.month for f in self.fechas])
        self.mes, self.anio = mes, np.array([f.year for f in self.fechas])

        def serie(name):
            a = np.array([par[name][k] for k in keys], dtype=float)
            a[a <= -998] = np.nan
            for m in range(1, 13):  # rellena vacíos con el promedio del mes
                sel = mes == m
                a[sel & np.isnan(a)] = np.nanmean(a[sel])
            return a

        tmax, tmin = serie("T2M_MAX"), serie("T2M_MIN")
        p = np.maximum(serie("PRECTOTCORR"), 0)
        ajuste = self._ajuste_ifs(sitio, tmax, tmin, p)
        if ajuste:
            # Corrección mensual: razón para la lluvia y diferencia para temperaturas.
            # Open-Meteo ya lleva el modelo de 9 km a la altura real, así que esto incluye la altura.
            r_p, d_tx, d_tn = ajuste
            p = p * r_p[mes - 1]
            tmax, tmin = tmax + d_tx[mes - 1], tmin + d_tn[mes - 1]
            self.metodo = "NASA POWER corregido mes a mes con ECMWF 9 km"
            self.factor_lluvia = float(np.mean(r_p))
        else:
            corr = -LAPSE * (sitio.elev - sitio.grid_elev)
            tmax, tmin = tmax + corr, tmin + corr
            self.metodo = "NASA POWER corregido por altura (6,5 °C por km)"
            self.factor_lluvia = 1.0
        self.tmax, self.tmin = tmax + dT, tmin + dT
        textura = (sitio.suelo or {}).get("textura", "")
        self.agua_util = next((v for k, v in sorted(AGUA_UTIL_TEXTURA.items(), key=lambda kv: -len(kv[0]))
                               if k in textura and "supuesto" not in textura), AGUA_UTIL_DEFECTO)
        self.p = p * (1 + dP)
        doy = np.array([f.timetuple().tm_yday for f in self.fechas])
        self.et0 = et0_penman_monteith(self.tmax, self.tmin, serie("RH2M"), serie("WS2M"),
                                       serie("ALLSKY_SFC_SW_DWN"), doy, sitio.lat, sitio.elev)
        self.anios = sorted(set(self.anio.tolist()))
        self.anio_i = {y: i for i, y in enumerate(self.anios)}
        A = len(self.anios)
        self.P_m = np.zeros((A, 12))
        self.ET0_m = np.zeros((A, 12))
        self.helada_m = np.zeros((A, 12), dtype=bool)
        for i, y in enumerate(self.anios):
            for m in range(12):
                sel = (self.anio == y) & (self.mes == m + 1)
                self.P_m[i, m] = self.p[sel].sum()
                self.ET0_m[i, m] = self.et0[sel].sum()
                self.helada_m[i, m] = (self.tmin[sel] <= FROST_T).any()
        self.prob_helada = self.helada_m.mean(axis=0)

    def _ajuste_ifs(self, sitio, tmax, tmin, p):
        ifs = clients.ifs_diario(sitio.lat, sitio.lon)
        if not ifs:
            return None
        sel = [self.idx.get(dt.date.fromisoformat(f)) for f in ifs["fecha"]]
        ok = [(i, j) for j, i in enumerate(sel) if i is not None and ifs["p"][j] is not None
              and ifs["tmin"][j] is not None and ifs["tmax"][j] is not None]
        if len(ok) < 700:
            return None
        ip = np.array([i for i, _ in ok])
        jp = np.array([j for _, j in ok])
        meses = self.mes[ip]
        P_ifs, TX, TN = (np.array(ifs[k], dtype=object)[jp].astype(float) for k in ("p", "tmax", "tmin"))
        r_p, d_tx, d_tn = np.ones(12), np.zeros(12), np.zeros(12)
        for m in range(1, 13):
            s = meses == m
            if s.sum() < 30:
                continue
            base = p[ip][s].sum()
            r_p[m - 1] = np.clip(P_ifs[s].sum() / base, 0.25, 1.5) if base > 0 else 1.0
            d_tx[m - 1] = TX[s].mean() - tmax[ip][s].mean()
            d_tn[m - 1] = TN[s].mean() - tmin[ip][s].mean()
        return r_p, d_tx, d_tn

    def resumen(self) -> dict:
        lluvia = self.P_m.sum(axis=1)
        return {
            "lluvia_anual": float(np.median(lluvia)),
            "lluvia_seca": float(np.percentile(lluvia, 20)),
            "lluvia_humeda": float(np.percentile(lluvia, 80)),
            "lluvia_min": float(lluvia.min()), "lluvia_max": float(lluvia.max()),
            "et0_anual": float(np.median(self.ET0_m.sum(axis=1))),
            "lluvia_mes": np.median(self.P_m, axis=0).tolist(),
            "et0_mes": np.median(self.ET0_m, axis=0).tolist(),
            "prob_helada": self.prob_helada.tolist(),
            "meses_helada": [MESES[m] for m in range(12) if self.prob_helada[m] >= 0.3],
            "tmin": float(np.percentile(self.tmin, 5)),
            "tmax": float(np.percentile(self.tmax, 95)),
            "anios": f"{self.anios[0]}–{self.anios[-1]}",
            "metodo": self.metodo,
        }


# ---------------------------------------------------------------- banco de agua
# Balance diario de agua en el suelo (modelo del equipo, notebook AgroBot v2), corrido sobre NASA POWER.
AGUA_UTIL_TEXTURA = {"arenoso": 70, "franco arenoso": 110, "franco": 150, "franco arcilloso": 160, "arcilloso": 140}
# Cómo se nombra cada textura en el campo de la sierra (el nombre técnico va entre paréntesis)
NOMBRE_LOCAL = {"arenoso": "tierra arenosa, suelta", "franco arenoso": "tierra suelta con arena",
                "franco": "tierra negra de chacra, ni suelta ni pegajosa", "franco arcilloso": "tierra pesada, un poco chocoto",
                "arcilloso": "chocoto, tierra de barro pegajosa"}


def nombre_suelo(textura: str) -> str:
    """'franco' -> 'tierra negra de chacra, ni suelta ni pegajosa (franco)'."""
    t = (textura or "franco").replace(" (supuesto)", "").strip()
    return f"{NOMBRE_LOCAL[t]} ({t})" if t in NOMBRE_LOCAL else t


AGUA_UTIL_DEFECTO = 110   # mm por metro de raíz cuando no hay dato de suelo
RESERVA_INICIAL = 0.5     # suelo a la mitad de su reserva el día de siembra
LLUVIA_EFECTIVA = 0.85    # parte de la lluvia que aprovecha el suelo
FACTOR_SECO = 0.8         # escenario seco: 20 % menos lluvia
UMBRAL_PROBLEMA = 0.15    # un mes "con problema" si falta >= 15 % de lo que pide (y >= 5 mm)
ANIO_BUENO, ANIO_MALO = 0.10, 0.30


def _balance_suelo(P, etc, taw, factor=1.0):
    """Día a día: el cultivo toma de la reserva del suelo más la lluvia efectiva. Devuelve uso y déficit."""
    reserva = RESERVA_INICIAL * taw
    uso, deficit = np.empty(len(P)), np.empty(len(P))
    for d in range(len(P)):
        disponible = reserva + LLUVIA_EFECTIVA * factor * P[d]
        uso[d] = min(etc[d], disponible)
        deficit[d] = etc[d] - uso[d]
        reserva = min(taw, disponible - uso[d])
    return uso, deficit


def banco_de_agua(clima: Clima, crop: Crop, mes_siembra: int) -> dict:
    """Simula el ciclo completo en cada año histórico (siembra el día 1 del mes) con balance de suelo.
    Devuelve el año normal (mediana), el año seco (20 % menos lluvia), un veredicto y el estado de cada mes."""
    kc = curva_kc(crop)
    n = len(kc)
    taw = crop.zr * clima.agua_util
    filas = []
    for y in clima.anios:
        ini = clima.idx.get(dt.date(y, mes_siembra, 1))
        if ini is None or ini + n > len(clima.fechas):
            continue
        sl = slice(ini, ini + n)
        P, etc = clima.p[sl], kc * clima.et0[sl]
        uso, deficit = _balance_suelo(P, etc, taw)
        _, def_seco = _balance_suelo(P, etc, taw, FACTOR_SECO)
        meses = list(dict.fromkeys(zip(clima.anio[sl].tolist(), clima.mes[sl].tolist())))
        clave = list(zip(clima.anio[sl].tolist(), clima.mes[sl].tolist()))
        por_mes = []
        for ym in meses:
            m = np.array([k == ym for k in clave])
            por_mes.append((ym[1], float(uso[m].sum()), float(etc[m].sum()), float(deficit[m].sum()), int(m.sum())))
        filas.append(dict(meses=por_mes, P=float(P.sum()), etc=float(etc.sum()),
                          deficit=float(deficit.sum()), seco=float(def_seco.sum())))
    k = min(len(f["meses"]) for f in filas)
    mes_ids = [m for m, *_ in filas[0]["meses"][:k]]
    dias = [filas[0]["meses"][i][4] for i in range(k)]
    uso_m = np.array([[f["meses"][i][1] for i in range(k)] for f in filas])
    etc_m = np.array([[f["meses"][i][2] for i in range(k)] for f in filas])
    def_m = np.array([[f["meses"][i][3] for i in range(k)] for f in filas])
    problema = (def_m >= np.maximum(5.0, UMBRAL_PROBLEMA * etc_m)) & (etc_m > 0)
    frac = problema.mean(axis=0)
    estados = ["verde" if f <= 0.2 else "amarillo" if f <= 0.5 else "rojo" for f in frac]
    tot_def = np.array([f["deficit"] for f in filas])
    tot_etc = np.array([f["etc"] for f in filas])
    ratio = np.divide(tot_def, tot_etc, out=np.zeros_like(tot_def), where=tot_etc > 0)
    n_anios = len(filas)
    n_bien, n_mal = int((ratio < ANIO_BUENO).sum()), int((ratio >= ANIO_MALO).sum())
    veredicto = "si" if n_bien / n_anios >= 0.7 else "cuidado" if n_mal / n_anios <= 0.3 else "no"
    lluvias = np.array([f["P"] for f in filas])
    falta_med = np.median(def_m, axis=0)
    peor = int(np.argmax(frac + falta_med / 1e4))
    return {
        "cultivo": crop.id, "mes_siembra": mes_siembra,
        "meses": [MESES[m - 1] for m in mes_ids], "mes_ids": mes_ids, "dias": dias,
        "lluvia_util": np.median(uso_m, axis=0).tolist(), "gasto": np.median(etc_m, axis=0).tolist(),
        "falta": falta_med.tolist(), "estado_mes": estados, "frac_problema": frac.tolist(),
        "total_lluvia_util": float(np.median(uso_m.sum(axis=1))),
        "total_gasto": float(np.median(tot_etc)),
        "total_falta": float(np.median(tot_def)),
        "total_falta_seco": float(np.mean([f["seco"] for f in filas])),
        "mes_critico": MESES_LARGO[mes_ids[peor] - 1],
        "falta_semana_critica": float(falta_med[peor] / dias[peor] * 7),
        "lluvia_ciclo": float(np.median(lluvias)), "lluvia_min": float(lluvias.min()),
        "lluvia_max": float(lluvias.max()),
        "cv_lluvia": float(lluvias.std(ddof=1) / lluvias.mean()) if lluvias.mean() > 0 else 0.0,
        "veredicto": veredicto, "n_bien": n_bien, "n_mal": n_mal, "anios": n_anios,
    }


def comparar_fuentes(sitio: Sitio, clima: Clima) -> dict | None:
    """Fuente complementaria: compara lluvia y ET0 anuales de Pacha (NASA corregido) con Open-Meteo/ERA5,
    la fuente que usa el notebook del equipo. Sirve para decir qué tan seguros estamos."""
    otra = clients.era5_anual(sitio.lat, sitio.lon)
    if not otra:
        return None
    p_nasa = float(np.median(clima.P_m.sum(axis=1)))
    e_nasa = float(np.median(clima.ET0_m.sum(axis=1)))
    dif_p = abs(p_nasa - otra["lluvia"]) / max(otra["lluvia"], 1)
    dif_e = abs(e_nasa - otra["et0"]) / max(otra["et0"], 1)
    peor = max(dif_p, dif_e)
    nivel = "alta" if peor <= 0.2 else "media" if peor <= 0.4 else "baja"
    return {"lluvia_nasa": p_nasa, "lluvia_era5": otra["lluvia"], "et0_nasa": e_nasa, "et0_era5": otra["et0"],
            "dif_lluvia": dif_p, "dif_et0": dif_e, "confianza": nivel, "anios_era5": otra["anios"]}


def litros(mm_falta: float, area_m2: float, eficiencia: float) -> dict:
    por_m2 = mm_falta / eficiencia  # 1 mm = 1 litro por m²
    total = por_m2 * area_m2
    return {"por_m2": por_m2, "total": total, "baldes": total / 20, "m3": total / 1000}


def riego_semana(sitio: Sitio, crop: Crop, fecha_siembra: dt.date, hoy: dt.date | None = None) -> dict:
    hoy = hoy or dt.date.today()
    f = clients.forecast_week(sitio.lat, sitio.lon)
    kc = curva_kc(crop)
    dia = (hoy - fecha_siembra).days
    kcs = [kc[min(max(dia + i, 0), len(kc) - 1)] for i in range(len(f["et0"]))]
    gasto = sum(k * (e or 0) for k, e in zip(kcs, f["et0"]))
    lluvia = sum(x or 0 for x in f["lluvia"])
    util = float(lluvia_util_mensual(lluvia * 30 / 7)) * 7 / 30
    heladas = [(dt.date.fromisoformat(d), t) for d, t in zip(f["fecha"], f["tmin"])
               if t is not None and t <= FROST_T]
    return {"dia": dia, "etapa": etapa(crop, dia), "gasto": gasto, "lluvia": lluvia,
            "lluvia_util": util, "falta": max(gasto - util, 0), "heladas": heladas,
            "tmin": f["tmin"], "fechas": f["fecha"], "lluvia_dia": [x or 0 for x in f["lluvia"]],
            "falta_dia": [max(k * (e or 0) - (x or 0) * 0.8, 0) for k, e, x in zip(kcs, f["et0"], f["lluvia"])]}


# ---------------------------------------------------------------- análisis por cultivo
def exposicion_helada(clima: Clima, crop: Crop, mes_siembra: int) -> tuple[float, list]:
    meses = [(mes_siembra - 1 + i) % 12 for i in range(math.ceil(crop.ciclo_dias / 30.4))]
    w = SENS_HELADA[crop.helada]
    probs = [clima.prob_helada[m] for m in meses]
    riesgo = [MESES[m] for m in meses if clima.prob_helada[m] >= 0.3 and w >= 0.5]
    return w * float(np.mean(probs)), riesgo


@lru_cache(maxsize=4096)
def _analisis_cultivo(clave: str, crop_id: str, mes: int):
    clima = _CLIMAS[clave]
    crop = CROPS[crop_id]
    b = banco_de_agua(clima, crop, mes)
    exp, riesgo = exposicion_helada(clima, crop, mes)
    return b, exp, riesgo


_CLIMAS: dict[str, Clima] = {}


def analisis_cultivo(clima: Clima, crop: Crop, mes: int):
    _CLIMAS[clima.clave] = clima
    return _analisis_cultivo(clima.clave, crop.id, mes)


def cultivos_aptos(z: float, incluir_descanso=False) -> list[Crop]:
    out = [c for c in CROPS.values() if c.aptitud_altura(z) > 0]
    return [c for c in out if incluir_descanso or c.id != "descanso"]


PESOS = {
    None: dict(agua=0.3, suelo=0.3, helada=0.2, ingreso=0.2),
    "agua": dict(agua=0.5, suelo=0.2, helada=0.15, ingreso=0.15),
    "suelo": dict(agua=0.2, suelo=0.5, helada=0.15, ingreso=0.15),
    "helada": dict(agua=0.2, suelo=0.2, helada=0.45, ingreso=0.15),
    "ingreso": dict(agua=0.2, suelo=0.2, helada=0.15, ingreso=0.45),
}


def recomendar_para_empezar(sitio: Sitio, clima: Clima, mes: int, prioridad=None, n=3) -> list[dict]:
    w = PESOS.get(prioridad, PESOS[None])
    filas = []
    for c in cultivos_aptos(sitio.elev):
        b, exp, riesgo = analisis_cultivo(clima, c, mes)
        filas.append(dict(crop=c, falta=b["total_falta"], helada=exp, riesgo=riesgo, banco=b))
    fmax = max(f["falta"] for f in filas) or 1
    hmax = max(f["helada"] for f in filas) or 1
    for f in filas:
        c = f["crop"]
        comp = dict(agua=1 - f["falta"] / fmax, helada=1 - f["helada"] / hmax,
                    ingreso=INGRESO[c.ingreso], suelo=0.8 if c.fija_n else 0.4)
        f["comp"] = comp
        f["puntaje"] = round(100 * sum(w[k] * v for k, v in comp.items()) * c.aptitud_altura(sitio.elev))
    filas.sort(key=lambda f: -f["puntaje"])
    return filas[:n]


# ---------------------------------------------------------------- rotaciones
def _meses_ciclo(c: Crop) -> int:
    return max(1, round(c.ciclo_dias / 30.4))


def evaluar_rotacion(sitio, clima, ids: list[str], mes_inicio: int) -> dict:
    mes, falta, falta_seco, helada, riesgos, bancos = mes_inicio, 0.0, 0.0, 0.0, [], []
    crops = [CROPS[i] for i in ids]
    for c in crops:
        b, exp, riesgo = analisis_cultivo(clima, c, mes)
        if c.id != "descanso":  # el terreno en descanso no se riega
            falta += b["total_falta"]
            falta_seco += b["total_falta_seco"]
        helada += exp
        bancos.append(b)
        riesgos += [(c, r) for r in riesgo]
        mes = (mes - 1 + _meses_ciclo(c)) % 12 + 1
    meses_total = sum(_meses_ciclo(c) for c in crops)
    cubierto = sum(_meses_ciclo(c) for c in crops if c.id != "descanso") / meses_total
    fam = [c.familia for c in crops]
    repetidas = sum(1 for a, b in zip(fam, fam[1:]) if a == b and a != "ninguna")
    papa_tras_papa = any(a == b == "solanacea" for a, b in zip(fam, fam[1:]))
    leguminosas = [c for c in crops if c.fija_n]
    suelo = 0.4 * (1 if leguminosas else 0) + 0.3 * cubierto + 0.3 * (1 if repetidas == 0 else 0)
    suelo -= 0.3 if papa_tras_papa else 0
    suelo -= 0.15 if any(c.id == "descanso" for c in crops[1:]) else 0  # suelo desnudo: riesgo de erosión
    aptitud = min(c.aptitud_altura(sitio.elev) for c in crops)
    return dict(ids=ids, crops=crops, falta=falta, falta_seco=falta_seco, helada=helada,
                falta_anual=falta * 12 / meses_total,
                # para puntuar: agua por mes productivo, así el descanso no gana solo por no regarse
                falta_prod=falta * 12 / max(sum(_meses_ciclo(c) for c in crops if c.id != "descanso"), 1),
                riesgos=riesgos, cubierto=cubierto, repetidas=repetidas,
                papa_tras_papa=papa_tras_papa, leguminosas=leguminosas,
                suelo=max(suelo, 0), aptitud=aptitud, meses_total=meses_total,
                ingreso=float(np.mean([INGRESO[c.ingreso] for c in crops])))


def comparar_rotaciones(sitio, clima, primero: str, mes_inicio: int,
                        actual: list[str] | None = None, prioridad=None) -> list[dict]:
    """Devuelve [actual?, mejor, segunda] con puntaje 0-100 y tarjeta de 5 campos."""
    w = PESOS.get(prioridad, PESOS[None])
    aptos = [c.id for c in cultivos_aptos(sitio.elev, incluir_descanso=True)]
    cand = [[primero, a, b] for a, b in itertools.product(aptos, repeat=2)]
    evals = [evaluar_rotacion(sitio, clima, ids, mes_inicio) for ids in cand]
    act = evaluar_rotacion(sitio, clima, actual, mes_inicio) if actual else None
    todos = evals + ([act] if act else [])
    fmax = max(e["falta_prod"] for e in todos) or 1
    hmax = max(e["helada"] for e in todos) or 1

    def puntuar(e):
        comp = dict(agua=1 - e["falta_prod"] / fmax, suelo=e["suelo"],
                    helada=1 - e["helada"] / hmax, ingreso=e["ingreso"])
        e["comp"] = comp
        e["puntaje"] = round(100 * sum(w[k] * v for k, v in comp.items()) * e["aptitud"])

    for e in todos:
        puntuar(e)
    evals.sort(key=lambda e: -e["puntaje"])
    elegidas, vistos = [], set()
    for e in evals:
        if actual and e["ids"] == actual:
            continue
        clave = tuple(e["ids"])
        if clave in vistos or e["ids"][1] == e["ids"][2] == "descanso":
            continue
        # que las dos opciones no compartan el mismo segundo cultivo
        if elegidas and elegidas[0]["ids"][1] == e["ids"][1]:
            continue
        elegidas.append(e)
        vistos.add(clave)
        if len(elegidas) == (2 if actual else 3):
            break
    res = ([act] if act else []) + elegidas
    nombres = (["Tu rotación", "Opción A", "Opción B"] if actual else ["Opción A", "Opción B", "Opción C"])
    for e, nom in zip(res, nombres):
        e["nombre"] = nom
        e["tarjeta"] = tarjeta(sitio, clima, e)
    return res


def _cap(t: str) -> str:
    return t[:1].upper() + t[1:]


def tarjeta(sitio: Sitio, clima: Clima, e: dict) -> dict:
    """Los cinco campos que pide el reto: por qué, evidencia, beneficios, vacíos y riesgos."""
    nombres = " → ".join(c.nombre for c in e["crops"])
    porque = []
    if e["leguminosas"]:
        porque.append(f"incluye {', '.join(c.nombre.lower() for c in e['leguminosas'])}, que deja nitrógeno en el suelo")
    if e["repetidas"] == 0:
        porque.append("cambia de familia de planta cada vez, así se cortan plagas como el gusano blanco")
    if e["comp"]["agua"] > 0.6:
        porque.append("necesita poco riego en tu zona")
    if e["comp"]["helada"] > 0.7:
        porque.append("evita los meses de helada en las plantas delicadas")
    if not porque:
        porque.append("es lo que ya conoces y siembras")
    beneficios = (f"Riego en año normal: {e['falta']:.0f} litros por m² en {e['meses_total']} meses "
                  f"(unos {e['falta_anual']:.0f} por año). "
                  f"Suelo cubierto {e['cubierto'] * 100:.0f} % del tiempo.")
    vacios = ["no sabemos cuánto riegas hoy ni tus plagas", "los precios son referenciales",
              "el clima viene de una celda de unos 50 km corregida a tu altura"]
    estimados = [c.nombre for c in e["crops"] if "estimado" in c.fuente]
    if estimados:
        vacios.append(f"el consumo de agua de {', '.join(estimados)} es estimado, no medido")
    riesgos = []
    for c, m in e["riesgos"][:3]:
        riesgos.append(f"helada en {m} para {c.nombre.lower()}")
    if e["papa_tras_papa"]:
        riesgos.append("papa tras papa aumenta lancha, gusano blanco y nematodos")
    elif e["repetidas"]:
        riesgos.append("repite la misma familia de planta seguida")
    if e["falta_seco"] > 1.4 * max(e["falta"], 1):
        riesgos.append(f"en año seco el riego sube a {e['falta_seco']:.0f} L por m²")
    if e["aptitud"] < 1:
        riesgos.append("algún cultivo está al límite de altura para tu terreno")
    if not riesgos:
        riesgos.append("revisa con tu técnico la semilla y las plagas locales")
    return {
        "titulo": nombres,
        "porque": _cap("; ".join(porque)) + ".",
        "evidencia": (f"Clima NASA POWER {clima.anios[0]}–{clima.anios[-1]} corregido a tu altura "
                      f"({sitio.elev:.0f} m), suelo {sitio.suelo.get('textura')} "
                      f"({sitio.suelo.get('fuente')}), consumo de agua de los cultivos FAO-56."),
        "beneficios": beneficios,
        "vacios": _cap("; ".join(vacios)) + ".",
        "riesgos": _cap("; ".join(riesgos)) + ".",
    }


def comparar_escenario(sitio, crop: Crop, mes: int, dP: float, dT: float) -> dict:
    base = banco_de_agua(Clima(sitio), crop, mes)
    esc = banco_de_agua(Clima(sitio, dP=dP, dT=dT), crop, mes)
    return {"base": base, "escenario": esc}
