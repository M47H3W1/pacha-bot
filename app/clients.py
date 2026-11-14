"""Clientes de datos: NASA POWER, ISRIC SoilGrids y Open-Meteo, con caché en disco."""
import gzip
import json
import logging
import os
from pathlib import Path

import httpx

log = logging.getLogger(__name__)
CACHE = Path(os.getenv("CACHE_DIR", Path(__file__).resolve().parent.parent / "cache"))
CACHE.mkdir(parents=True, exist_ok=True)
SEMILLAS = Path(__file__).with_name("semillas")

POWER_PARAMS = "T2M_MAX,T2M_MIN,PRECTOTCORR,RH2M,WS2M,ALLSKY_SFC_SW_DWN"
POWER_START, POWER_END = 2001, 2024
UA = {"User-Agent": "PachaBot/1.0 (NASA Space Apps 2026 demo; https://github.com/M47H3W1)"}


def _key(*parts) -> str:
    return "_".join(str(p) for p in parts).replace("-", "m").replace(".", "p")


def _cached(name: str, fetch):
    """Guarda en disco solo respuestas válidas (las que no traen ok=False)."""
    semilla = SEMILLAS / f"{name}.json.gz"
    if semilla.exists():  # datos de sitios de demostración que vienen con el código (solo lectura)
        with gzip.open(semilla, "rt", encoding="utf-8") as f:
            return json.load(f)
    path = CACHE / f"{name}.json.gz"
    if path.exists():
        with gzip.open(path, "rt", encoding="utf-8") as f:
            return json.load(f)
    data = fetch()
    if not (isinstance(data, dict) and data.get("ok") is False):
        with gzip.open(path, "wt", encoding="utf-8") as f:
            json.dump(data, f)
    return data


def power_daily(lat: float, lon: float) -> dict:
    """Serie diaria 2001-2024 de NASA POWER (comunidad AG). Devuelve parámetros y elevación de la celda."""
    lat, lon = round(lat, 2), round(lon, 2)

    def fetch():
        url = "https://power.larc.nasa.gov/api/temporal/daily/point"
        params = dict(parameters=POWER_PARAMS, community="AG", latitude=lat, longitude=lon,
                      start=f"{POWER_START}0101", end=f"{POWER_END}1231", format="JSON")
        r = httpx.get(url, params=params, headers=UA, timeout=120)
        r.raise_for_status()
        j = r.json()
        return {"grid_elev": j["geometry"]["coordinates"][2],
                "param": j["properties"]["parameter"]}

    return _cached(_key("power", lat, lon), fetch)


def elevation(lat: float, lon: float) -> float:
    lat, lon = round(lat, 3), round(lon, 3)

    def fetch():
        r = httpx.get("https://api.open-meteo.com/v1/elevation",
                      params={"latitude": lat, "longitude": lon}, headers=UA, timeout=20)
        r.raise_for_status()
        return {"elev": r.json()["elevation"][0]}

    return float(_cached(_key("elev", lat, lon), fetch)["elev"])


def soil(lat: float, lon: float) -> dict | None:
    """Arcilla, arena (%) y carbono orgánico (g/kg) promedio 0-30 cm. None si no hay dato."""
    lat, lon = round(lat, 3), round(lon, 3)

    def fetch():
        params = [("lon", lon), ("lat", lat), ("value", "mean")]
        params += [("property", p) for p in ("clay", "sand", "soc")]
        params += [("depth", d) for d in ("0-5cm", "5-15cm", "15-30cm")]
        try:
            r = httpx.get("https://rest.isric.org/soilgrids/v2.0/properties/query",
                          params=params, headers=UA, timeout=10)
            r.raise_for_status()
        except Exception as e:  # servicio intermitente
            log.warning("SoilGrids no disponible: %s", e)
            return {"ok": False}
        out = {"ok": True}
        for layer in r.json()["properties"]["layers"]:
            vals = [d["values"]["mean"] for d in layer["depths"] if d["values"]["mean"] is not None]
            if not vals:
                return {"ok": False}
            factor = layer["unit_measure"]["d_factor"]
            out[layer["name"]] = sum(vals) / len(vals) / factor
        return out

    data = _cached(_key("soil", lat, lon), fetch)
    return data if data.get("ok") else None


def forecast_week(lat: float, lon: float) -> dict:
    """Pronóstico de 7 días (Open-Meteo): ET0 FAO, lluvia y temperatura mínima. Sin caché."""
    r = httpx.get("https://api.open-meteo.com/v1/forecast", headers=UA, timeout=20, params={
        "latitude": lat, "longitude": lon, "timezone": "America/Guayaquil", "forecast_days": 7,
        "daily": "et0_fao_evapotranspiration,precipitation_sum,temperature_2m_min",
    })
    r.raise_for_status()
    d = r.json()["daily"]
    return {"fecha": d["time"], "et0": d["et0_fao_evapotranspiration"],
            "lluvia": d["precipitation_sum"], "tmin": d["temperature_2m_min"]}


def ifs_diario(lat: float, lon: float) -> dict:
    """Modelo ECMWF IFS de 9 km (Open-Meteo, 2018-2024), ya llevado a la altura real del punto.
    Se usa solo para corregir la magnitud de la serie NASA POWER mes a mes."""
    lat, lon = round(lat, 2), round(lon, 2)

    def fetch():
        try:
            r = httpx.get("https://archive-api.open-meteo.com/v1/archive", headers=UA, timeout=60, params={
                "latitude": lat, "longitude": lon, "start_date": "2018-01-01", "end_date": "2024-12-31",
                "models": "ecmwf_ifs", "timezone": "America/Guayaquil",
                "daily": "precipitation_sum", "hourly": "temperature_2m"})
            r.raise_for_status()
            j = r.json()
        except Exception as e:
            log.warning("ECMWF IFS no disponible: %s", e)
            return {"ok": False}
        d, h = j["daily"], j["hourly"]["temperature_2m"]
        tmax, tmin = [], []
        for i in range(len(d["time"])):  # máximos y mínimos diarios desde datos horarios
            dia = [t for t in h[i * 24:(i + 1) * 24] if t is not None]
            tmax.append(max(dia) if len(dia) >= 18 else None)
            tmin.append(min(dia) if len(dia) >= 18 else None)
        return {"ok": True, "fecha": d["time"], "p": d["precipitation_sum"], "tmax": tmax, "tmin": tmin}

    data = _cached(_key("ifs", lat, lon), fetch)
    return data if data.get("ok") else None


def era5_anual(lat: float, lon: float) -> dict | None:
    """Lluvia y ET0 anuales (mediana 2015-2024) de Open-Meteo Archive, modelo por defecto (ERA5).
    Es la fuente del notebook del equipo; Pacha la usa solo para validar, no para calcular."""
    lat, lon = round(lat, 2), round(lon, 2)

    def fetch():
        try:
            r = httpx.get("https://archive-api.open-meteo.com/v1/archive", headers=UA, timeout=60, params={
                "latitude": lat, "longitude": lon, "start_date": "2015-01-01", "end_date": "2024-12-31",
                "daily": "precipitation_sum,et0_fao_evapotranspiration", "timezone": "America/Guayaquil"})
            r.raise_for_status()
            d = r.json()["daily"]
        except Exception as e:
            log.warning("ERA5 no disponible: %s", e)
            return {"ok": False}
        por_anio = {}
        for t, p, e in zip(d["time"], d["precipitation_sum"], d["et0_fao_evapotranspiration"]):
            a = por_anio.setdefault(t[:4], [0.0, 0.0, 0])
            a[0] += p or 0
            a[1] += e or 0
            a[2] += 1
        completos = [v for v in por_anio.values() if v[2] >= 360]
        if not completos:
            return {"ok": False}
        lluvias = sorted(v[0] for v in completos)
        et0s = sorted(v[1] for v in completos)
        return {"ok": True, "lluvia": lluvias[len(lluvias) // 2], "et0": et0s[len(et0s) // 2], "anios": len(completos)}

    data = _cached(_key("era5", lat, lon), fetch)
    return data if data.get("ok") else None


def elevaciones(puntos: list[tuple[float, float]]) -> list[float] | None:
    """Altura de varios puntos en una sola consulta (Open-Meteo, modelo de 90 m). None si falla."""
    lats = ",".join(f"{la:.5f}" for la, _ in puntos)
    lons = ",".join(f"{lo:.5f}" for _, lo in puntos)

    def fetch():
        try:
            r = httpx.get("https://api.open-meteo.com/v1/elevation", headers=UA, timeout=15,
                          params={"latitude": lats, "longitude": lons})
            r.raise_for_status()
            return {"ok": True, "elev": r.json()["elevation"]}
        except Exception as e:
            log.warning("Elevación múltiple no disponible: %s", e)
            return {"ok": False}

    import hashlib
    data = _cached("elevs_" + hashlib.sha1((lats + lons).encode()).hexdigest()[:16], fetch)
    return data["elev"] if data.get("ok") else None
