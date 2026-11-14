import csv, json, urllib.request, urllib.parse, time, statistics as S
f=lambda s: float(s.replace(",",".")) if s.strip() else None
rows=[r for r in csv.DictReader(open("inamhi_tmin2019.csv",encoding="latin1"),delimiter=";") if f(r["altitud"]) and f(r["altitud"])>=2000]
M="ene feb mar abr may jun jul ago sep oct nov dic".split()
def get(u):
    for i in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"research-probe"}),timeout=120) as r: return json.load(r)
        except Exception as e: time.sleep(20 if "429" in str(e) else 3)
out=[]
for r in rows:
    la,lo,alt=f(r["latitud2"]),f(r["longitud2"]),f(r["altitud"])
    obs=[f(r[m]) for m in M]
    j=get("https://power.larc.nasa.gov/api/temporal/daily/point?"+urllib.parse.urlencode(dict(parameters="T2M_MIN",community="AG",latitude=la,longitude=lo,start="20130101",end="20131231",format="JSON")))
    if not j: continue
    P=j["properties"]["parameter"]["T2M_MIN"]; zc=j["geometry"]["coordinates"][2]
    pw=[min(v for d,v in P.items() if int(d[4:6])==m+1) for m in range(12)]
    k=get("https://archive-api.open-meteo.com/v1/archive?"+urllib.parse.urlencode(dict(latitude=la,longitude=lo,start_date="2013-01-01",end_date="2013-12-31",daily="temperature_2m_min",models="era5",timezone="America/Guayaquil")))
    e5=None
    if k:
        t=k["daily"]["time"]; v=k["daily"]["temperature_2m_min"]
        e5=[min(x for d,x in zip(t,v) if int(d[5:7])==m+1 and x is not None) for m in range(12)]
    # POWER corregido por altura (lapse 6.5 C/km) como hace el bot
    pwc=[p-(alt-zc)*0.0065 for p in pw]
    pares=[(o,a,b,c) for o,a,b,c in zip(obs,pw,pwc,e5 or [None]*12) if o is not None]
    if len(pares)<8: continue
    d=lambda i: round(S.mean(p[i]-p[0] for p in pares if p[i] is not None),1)
    row=dict(nombre=r["NombreEstacion"],alt=alt,celda_power=round(zc),obs_min_anual=min(p[0] for p in pares),
             sesgo_power=d(1),sesgo_power_corr_altura=d(2),sesgo_era5=d(3) if e5 else None,
             meses_helada_obs=sum(1 for p in pares if p[0]<=0),meses_helada_power=sum(1 for p in pares if p[1]<=0),meses_helada_era5=sum(1 for p in pares if p[3] is not None and p[3]<=0))
    print(json.dumps(row,ensure_ascii=False),flush=True); out.append(row); time.sleep(1.5)
json.dump(out,open("validacion_tmin.json","w",encoding="utf-8"),ensure_ascii=False,indent=1)
for k in ["sesgo_power","sesgo_power_corr_altura","sesgo_era5"]:
    v=[x[k] for x in out if x[k] is not None]; print(k,"mediana",S.median(v),"n",len(v))
print("meses<=0C obs/power/era5",sum(x['meses_helada_obs'] for x in out),sum(x['meses_helada_power'] for x in out),sum(x['meses_helada_era5'] for x in out))
