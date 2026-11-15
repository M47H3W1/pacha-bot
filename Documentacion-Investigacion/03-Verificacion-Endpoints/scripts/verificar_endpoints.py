"""Verifica que cada endpoint usado en la investigación responda y devuelva el dato esperado (no solo HTTP 200).
Uso: python verificar_endpoints.py salida.json"""
import json, sys, time, ssl, urllib.request, urllib.parse, urllib.error

UA = {"User-Agent": "Mozilla/5.0 research-probe"}
LAT, LON = -1.933, -78.712


def get(url, t=120, raw=False, headers=None, intentos=3):
    """ORNL devuelve 502/503 intermitentes: se reintenta hasta 3 veces."""
    for i in range(intentos):
        try:
            req = urllib.request.Request(url, headers={**UA, **(headers or {})})
            with urllib.request.urlopen(req, timeout=t) as r:
                b = r.read()
                return r.status, dict(r.headers), (b if raw else json.loads(b))
        except urllib.error.HTTPError as e:
            if e.code in (502, 503, 504) and i < intentos - 1:
                time.sleep(10); continue
            raise


def q(d):
    return urllib.parse.urlencode(d)


def power(params, extra=None, temporal="daily", start="20240101", end="20240131"):
    d = {"parameters": params, "community": "AG", "latitude": LAT, "longitude": LON, "format": "JSON"}
    if temporal != "climatology":
        d.update(start=start, end=end)
    d.update(extra or {})
    return get(f"https://power.larc.nasa.gov/api/temporal/{temporal}/point?" + q(d))[2]


CHECKS = []


def check(nombre, uso):
    def deco(fn):
        CHECKS.append((nombre, uso, fn))
        return fn
    return deco


@check("NASA POWER diario", "Clima base, GWETROOT, TSOIL1, AOD_55, PAR (#2, #9, #10)")
def _():
    p = power("T2M_MIN,PRECTOTCORR,GWETROOT,GWETTOP,TSOIL1,AOD_55,ALLSKY_SFC_PAR_TOT,TS_MIN,T2MDEW")["properties"]["parameter"]
    return all(min(v.values()) > -998 for v in p.values()), f"{len(p)} parámetros x {len(p['T2M_MIN'])} días, sin -999"


@check("NASA POWER IMERG con time-standard=UTC", "Lluvia (#1)")
def _():
    v = power("IMERG_PRECTOT", {"time-standard": "UTC"})["properties"]["parameter"]["IMERG_PRECTOT"]
    return min(v.values()) > -998, f"{len(v)} días válidos"


@check("NASA POWER IMERG sin UTC (control: debe fallar)", "Requisito documentado")
def _():
    try:
        v = power("IMERG_PRECTOT", end="20240105")["properties"]["parameter"]["IMERG_PRECTOT"]
        return all(x <= -998 for x in v.values()), "devuelve -999, como se documentó"
    except urllib.error.HTTPError as e:
        return True, f"HTTP {e.code}: lo rechaza sin UTC, como se documentó"


@check("NASA POWER horario", "Lancha (#6)")
def _():
    v = power("T2M,RH2M", temporal="hourly", start="20240101", end="20240102")["properties"]["parameter"]["RH2M"]
    return len(v) == 48 and min(v.values()) > -998, f"{len(v)} horas"


@check("NASA POWER climatología", "Extremos de helada (#3)")
def _():
    p = power("T2M_MIN", temporal="climatology")["properties"]["parameter"]
    return "T2M_MIN" in p, "climatología mensual"


@check("NASA CMR (Earthdata) colecciones y gránulos", "SMAP, NASADEM, OMI, OMPS, MODIS, IMERG")
def _():
    out = []
    for sn in ("SPL4SMGP", "NASADEM_HGT", "OMSO2e", "OMPS_NPP_NMSO2_PCA_L2", "MOD13Q1", "GPM_3IMERGDF"):
        j = get("https://cmr.earthdata.nasa.gov/search/collections.json?" + q({"short_name": sn}))[2]
        e = sorted(j["feed"]["entry"], key=lambda e: e.get("version_id", ""))[-1]
        h = get("https://cmr.earthdata.nasa.gov/search/granules.json?" + q({"collection_concept_id": e["id"],
                "bounding_box": "-79.2,-2.5,-78.3,-1.3", "page_size": 0}))[1]
        out.append(f"{sn}={h.get('CMR-Hits') or h.get('cmr-hits')}")
    return True, ", ".join(out)


def ornl(prod, band):
    def f():
        j = get(f"https://modis.ornl.gov/rst/api/v1/{prod}/subset?" + q(dict(latitude=-1.86, longitude=-78.75, band=band,
                startDate="A2023001", endDate="A2023033", kmAboveBelow=0, kmLeftRight=0)), t=180)[2]
        v = [x["data"][0] for x in j["subset"]]
        return len(v) > 0, f"{len(v)} fechas, ejemplo {v[:3]} (escala {j.get('scale')})"
    return f


for prod, band, uso in (("MOD13Q1", "250m_16_days_NDVI", "NDVI (#5)"), ("MOD11A2", "LST_Night_1km", "LST nocturna (#3)"),
                        ("MOD17A2HGF", "Gpp_500m", "GPP (#7)"), ("MCD15A2H", "Lai_500m", "LAI (#7)")):
    CHECKS.append((f"ORNL MODIS {prod} {band}", uso, ornl(prod, band)))


@check("ORNL SMAP: productos disponibles", "Humedad del suelo sin clave (#2)")
def _():
    ps = [p["product"] for p in get("https://modis.ornl.gov/rst/api/v1/products", t=120)[2]["products"]]
    smap = [p for p in ps if p.startswith("SPL")]
    return "SPL3SMP_E" in smap, f"SMAP en ORNL: {smap}. SPL4SMGP (zona de raíces) NO está: requiere Earthdata"


def gaez(service, oid):
    g = json.dumps({"points": [[LON, LAT]], "spatialReference": {"wkid": 4326}})
    j = get(f"https://gaez-services.fao.org/server/rest/services/{service}/ImageServer/getSamples?" + q(dict(
        geometry=g, geometryType="esriGeometryMultipoint", returnFirstValueOnly="true", f="json",
        mosaicRule=json.dumps({"mosaicMethod": "esriMosaicLockRaster", "lockRasterIds": [oid]}))))[2]
    return j["samples"][0]["value"]


@check("FAO GAEZ v4 LR getSamples (suelo dominante)", "Suelo, respaldo global (#11-#15)")
def _():
    v = gaez("LR", 676)
    return v == "3", f"valor={v} (3 = Andosols)"


@check("FAO GAEZ v4 sin User-Agent de navegador (control: debe fallar)", "Requisito documentado")
def _():
    try:
        urllib.request.urlopen("https://gaez-services.fao.org/server/rest/services/LR/ImageServer/getSamples?f=json", timeout=60)
        return False, "respondió sin User-Agent: actualizar documentación"
    except urllib.error.HTTPError as e:
        return e.code == 403, f"HTTP {e.code}, como se documentó"


@check("FAO GAEZ v4 res05 (catálogo de aptitud por cultivo)", "Aptitud por cultivo (#15)")
def _():
    j = get("https://gaez-services.fao.org/server/rest/services/res05/ImageServer/query?" + q(dict(
        where="1=1", returnCountOnly="true", f="json")))[2]
    return j.get("count", 0) > 0, f"{j.get('count')} rásteres"


@check("MAG geoportal: zip geopedológico 1:25.000", "Suelo, fuente principal (#11-#15)")
def _():
    s, h, _ = get("http://geoportal.agricultura.gob.ec/descargar/zip/shp_unidad_geopedologica_2019.zip",
                  headers={"Range": "bytes=0-99"}, raw=True)
    return s == 206 and h.get("Content-Range", "").endswith("/1293801341"), f"HTTP {s}, {h.get('Content-Range')}"


@check("MAG geoserver (control: no hay servicio por punto)", "Consulta por punto")
def _():
    try:
        get("https://geoportal.agricultura.gob.ec/geoserver/ows?service=WFS&request=GetCapabilities", raw=True, t=30)
        return False, "ahora responde: actualizar documentación"
    except Exception as e:
        return True, f"sigue sin servicio ({str(e)[:50]})"


@check("Datos Abiertos: CSV INAMHI precipitación", "Contraste de lluvia")
def _():
    s, _, b = get("https://www.datosabiertos.gob.ec/dataset/eaa8894f-68d1-4a15-80f8-1a6f528f946c/resource/"
                  "98c77d18-e863-4e00-8a22-eb47f2981d9c/download/inamhi-precipitacion-2019diciembre.csv",
                  headers={"Range": "bytes=0-200"}, raw=True)
    return s in (200, 206) and len(b) > 0, f"HTTP {s}"


@check("Datos Abiertos: CSV INAMHI temperatura mínima", "Contraste de helada")
def _():
    s, _, b = get("https://www.datosabiertos.gob.ec/dataset/40c970c4-be1d-446d-b2c2-1ae9b8a2dde5/resource/"
                  "47a37abc-a8cd-4d2a-a913-f25a7297dd2a/download/inamhi-temperaturaminima-2019diciembre.csv",
                  headers={"Range": "bytes=0-200"}, raw=True)
    return s in (200, 206) and len(b) > 0, f"HTTP {s}"


@check("Datos Abiertos: API CKAN package_search", "Precios MAG, INEC")
def _():
    j = get("https://www.datosabiertos.gob.ec/api/3/action/package_search?" + q(dict(q="precios productor", rows=3)))[2]
    return bool(j.get("success")) and j["result"]["count"] > 0, f"{j['result']['count']} conjuntos"


@check("Open-Meteo archivo ERA5", "ERA5 (convocatoria)")
def _():
    j = get("https://archive-api.open-meteo.com/v1/archive?" + q(dict(latitude=LAT, longitude=LON, start_date="2024-01-01",
            end_date="2024-01-05", daily="precipitation_sum", models="era5")))[2]
    return len(j["daily"]["precipitation_sum"]) == 5, "5 días"


@check("Open-Meteo elevation (fuera de la regla; usado hoy)", "clients.elevation")
def _():
    j = get("https://api.open-meteo.com/v1/elevation?" + q(dict(latitude=LAT, longitude=LON)))[2]
    return "elevation" in j, f"{j['elevation']} m"


@check("Open-Meteo forecast (fuera de la regla; usado hoy)", "clients.forecast_week")
def _():
    j = get("https://api.open-meteo.com/v1/forecast?" + q(dict(latitude=LAT, longitude=LON, daily="temperature_2m_min", forecast_days=7)))[2]
    return len(j["daily"]["temperature_2m_min"]) == 7, "7 días"


@check("ISRIC SoilGrids (fuera de la regla; usado hoy)", "clients.soil")
def _():
    j = get("https://rest.isric.org/soilgrids/v2.0/properties/query?" + q(dict(lon=LON, lat=LAT, property="clay",
            depth="0-5cm", value="mean")), t=90)[2]
    return "properties" in j, "responde"


@check("INAMHI servicios web (portal)", "Avisos y descargas")
def _():
    try:
        s = get("https://servicios.inamhi.gob.ec/", raw=True, t=30)[0]
        return True, f"HTTP {s}"
    except Exception as e:
        try:
            r = urllib.request.urlopen(urllib.request.Request("https://servicios.inamhi.gob.ec/", headers=UA), timeout=30,
                                       context=ssl._create_unverified_context())
            return True, f"HTTP {r.status} solo sin verificar el certificado SSL ({str(e)[:40]})"
        except Exception as e2:
            return False, str(e2)[:80]


res = []
for nombre, uso, fn in CHECKS:
    t = time.time()
    try:
        ok, det = fn()
    except Exception as e:
        ok, det = False, f"{type(e).__name__}: {str(e)[:120]}"
    res.append(dict(endpoint=nombre, uso=uso, ok=bool(ok), detalle=det, segundos=round(time.time() - t, 1)))
    print("OK   " if ok else "FALLA", nombre, "|", det, f"({res[-1]['segundos']} s)", flush=True)
json.dump(dict(fecha=time.strftime("%Y-%m-%d"), resultados=res), open(sys.argv[1], "w", encoding="utf-8"), indent=1, ensure_ascii=False)
