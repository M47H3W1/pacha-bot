"""Sondeo de gases, aerosoles y parámetros de crecimiento sobre la sierra centro (Chimborazo).
1) NASA POWER (diario, Guamote) 2) CMR: cobertura de colecciones de composición atmosférica 3) ORNL: GPP/LAI/FPAR."""
import json, urllib.request, urllib.parse, statistics as st, sys, time
LAT, LON = -1.933, -78.712
BB = "-79.2,-2.5,-78.3,-1.3"
UA = {"User-Agent": "research-probe"}
def get(url, t=120):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=t) as r:
        return json.load(r), dict(r.headers)
out = {}
# 1) POWER
P = "ALLSKY_SFC_PAR_TOT,CLRSKY_SFC_PAR_TOT,ALLSKY_SFC_UV_INDEX,ALLSKY_SFC_UVB,AOD_55,TO3,TSOIL1,TSOIL2,GWETTOP,CLOUD_AMT,FROST_DAYS,QV2M,EVPTRNS,PW,T2M,RH2M"
q = dict(parameters=P, community="AG", longitude=LON, latitude=LAT, start="20050101", end="20241231", format="JSON")
t = time.time(); j, _ = get("https://power.larc.nasa.gov/api/temporal/daily/point?" + urllib.parse.urlencode(q)); dt = time.time() - t
par = j["properties"]["parameter"]; pw = {}
for k, v in par.items():
    vals = {d: x for d, x in v.items() if x is not None and x > -998}
    mens = {m: round(st.mean([x for d, x in vals.items() if int(d[4:6]) == m]), 3) if any(int(d[4:6]) == m for d in vals) else None for m in range(1, 13)}
    top = sorted(vals.items(), key=lambda kv: -kv[1])[:5]
    pw[k] = dict(dias_validos=len(vals), de=len(v), primero=min(vals) if vals else None, ultimo=max(vals) if vals else None,
                 media=round(st.mean(vals.values()), 3) if vals else None, mensual=mens, max5=top,
                 unidad=j["parameters"][k]["units"])
out["power_guamote_2005_2024"] = dict(segundos=round(dt, 1), parametros=pw)
print("POWER ok", round(dt, 1), "s")
# 2) CMR
SN = ["OCO2_L2_Lite_FP", "OCO3_L2_Lite_FP", "OCO2_L2_Lite_SIF", "AIRS3STD", "AIRS3C2M", "OMNO2d", "OMSO2e", "OMTO3e", "OMPS_NPP_NMSO2_PCA_L2",
      "S5P_L2__NO2____HiR", "S5P_L2__SO2____HiR", "S5P_L2__CH4____HiR", "S5P_L2__CO_____HiR", "S5P_L2__O3_TOT_HiR", "S5P_L2__AER_AI_HiR",
      "M2T1NXAER", "M2T1NXSLV", "M2I3NVCHM", "MCD19A2", "MOD17A2H", "MOD17A2HGF", "MCD15A2H", "MCD64A1", "MOD14A1", "TEMPO_NO2_L2", "GEOSCF_CHM"]
cmr = []
for sn in SN:
    try:
        jj, _ = get("https://cmr.earthdata.nasa.gov/search/collections.json?" + urllib.parse.urlencode({"short_name": sn, "page_size": 20}))
        es = jj["feed"]["entry"]
        if not es:
            cmr.append(dict(sn=sn, encontrado=False)); print(sn, "NO"); continue
        e = sorted(es, key=lambda e: e.get("version_id", ""))[-1]
        _, h = get("https://cmr.earthdata.nasa.gov/search/granules.json?" + urllib.parse.urlencode({"collection_concept_id": e["id"], "bounding_box": BB, "page_size": 0}))
        row = dict(sn=sn, ver=e.get("version_id"), ini=e.get("time_start", "")[:10], fin=(e.get("time_end") or "en curso")[:10],
                   dc=e.get("data_center"), granulos_chimborazo=int(h.get("CMR-Hits") or h.get("cmr-hits") or 0), titulo=e.get("title"))
        cmr.append(row); print(row["sn"], row["granulos_chimborazo"], row["ini"], row["fin"])
    except Exception as ex:
        cmr.append(dict(sn=sn, error=str(ex))); print(sn, "ERR", ex)
out["cmr_chimborazo"] = cmr
# 3) ORNL
orn = {}
for prod, band in (("MOD17A2H", "Gpp_500m"), ("MCD15A2H", "Lai_500m"), ("MCD15A2H", "Fpar_500m")):
    try:
        d, _ = get(f"https://modis.ornl.gov/rst/api/v1/{prod}/dates?latitude={LAT}&longitude={LON}", 90)
        fechas = [x["modis_date"] for x in d["dates"]]
        sel = [f for f in fechas if f.startswith("A2023")][:10]
        s, _ = get(f"https://modis.ornl.gov/rst/api/v1/{prod}/subset?latitude={LAT}&longitude={LON}&band={band}&startDate={sel[0]}&endDate={sel[-1]}&kmAboveBelow=0&kmLeftRight=0", 180)
        vals = [(x["calendar_date"], x["data"][0], s.get("scale")) for x in s["subset"]]
        orn[f"{prod}/{band}"] = dict(n_fechas=len(fechas), primera=fechas[0], ultima=fechas[-1], muestra_2023=vals)
        print(prod, band, len(fechas), vals[:3])
    except Exception as ex:
        orn[f"{prod}/{band}"] = dict(error=str(ex)); print(prod, band, "ERR", ex)
out["ornl_guamote"] = orn
json.dump(out, open(sys.argv[1] if len(sys.argv) > 1 else "gases_crecimiento.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
