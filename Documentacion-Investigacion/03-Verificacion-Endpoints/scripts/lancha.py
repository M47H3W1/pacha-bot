"""Riesgo de lancha (Phytophthora infestans) con POWER horario: horas con HR >= 90 % y 7-25 °C.
Regla simple de humedad foliar usada como proxy; no reemplaza un modelo validado (p. ej. SimCast)."""
import json, sys, urllib.request, urllib.parse
from collections import defaultdict
LAT, LON = -1.933, -78.712
q = dict(parameters="T2M,RH2M,PRECTOTCORR", community="AG", longitude=LON, latitude=LAT, start="20190101", end="20231231",
         format="JSON", **{"time-standard": "LST"})
with urllib.request.urlopen(urllib.request.Request("https://power.larc.nasa.gov/api/temporal/hourly/point?" + urllib.parse.urlencode(q),
                            headers={"User-Agent": "research-probe"}), timeout=300) as r:
    p = json.load(r)["properties"]["parameter"]
t, h = p["T2M"], p["RH2M"]
mes_h = defaultdict(list); dias = defaultdict(lambda: defaultdict(int))
for k in t:
    if t[k] < -998 or h[k] < -998: continue
    ok = h[k] >= 90 and 7 <= t[k] <= 25
    dias[k[:6]][k[:8]] += ok
for ym, dd in dias.items():
    mes_h[int(ym[4:6])].append(sum(1 for v in dd.values() if v >= 10))  # días con >= 10 h favorables
res = {"horas_totales": len(t), "rh_max": max(h.values()), "dias_favorables_por_mes_promedio":
       {m: round(sum(v) / len(v), 1) for m, v in sorted(mes_h.items())}}
print(json.dumps(res, ensure_ascii=False)); json.dump(res, open(sys.argv[1], "w"), indent=1)
