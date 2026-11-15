import json, csv, collections, urllib.request, urllib.parse, time, statistics as S
f=lambda s: float(s.replace(",",".")) if s.strip() else None
M="ene feb mar abr may jun jul ago sep oct nov dic".split()
rows=list(csv.DictReader(open("inamhi_p2019.csv",encoding="latin1"),delimiter=";"))
obs=collections.defaultdict(dict); meta={}
for r in rows:
    meta[r["Estacion"]]=(r["NombreEstacion"],f(r["latitud2"]),f(r["longitud2"]),f(r["altitud"]))
    obs[r["Estacion"]][int(r["anio"])]=[f(r[m]) for m in M]
def get(u):
    for i in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"research-probe"}),timeout=120) as r: return json.load(r)
        except Exception as e: time.sleep(30*(i+1) if "429" in str(e) else 3)
cand=[k for k,(n,la,lo,al) in meta.items() if al and al>=2000 and la is not None and -5<la<1.5 and all(obs[k].get(y) and sum(x is not None for x in obs[k][y])>=11 for y in (2018,2019))]
print("estaciones con 2018-2019:",len(cand))
out=[]
for k in cand:
    n,la,lo,al=meta[k]
    o={(y,m+1):obs[k][y][m] for y in (2018,2019) for m in range(12) if obs[k][y][m] is not None}
    def mon(t,v):
        d=collections.defaultdict(float)
        for a,b in zip(t,v):
            if b is not None and b!=-999: d[(int(a[:4]),int(a[5:7]) if '-' in a else int(a[4:6]))]+=b
        return d
    i=get("https://archive-api.open-meteo.com/v1/archive?"+urllib.parse.urlencode(dict(latitude=la,longitude=lo,start_date="2018-01-01",end_date="2019-12-31",daily="precipitation_sum",models="ecmwf_ifs",timezone="America/Guayaquil")))
    p=get("https://power.larc.nasa.gov/api/temporal/daily/point?"+urllib.parse.urlencode(dict(parameters="PRECTOTCORR,IMERG_PRECTOT",community="AG",latitude=la,longitude=lo,start="20180101",end="20191231",format="JSON",**{"time-standard":"UTC"})))
    if not i or not p: continue
    src={"IFS":mon(i["daily"]["time"],i["daily"]["precipitation_sum"])}
    for s,kk in [("MERRA2","PRECTOTCORR"),("IMERG","IMERG_PRECTOT")]:
        P=p["properties"]["parameter"][kk]; src[s]=mon(list(P.keys()),list(P.values()))
    row=dict(nombre=n,alt=al,lat=la,obs=round(sum(o.values())))
    for s,m in src.items():
        pares=[(o[x],m[x]) for x in o if x in m]
        row[s+"_sesgo"]=round((sum(b for a,b in pares)-sum(a for a,b in pares))/sum(a for a,b in pares)*100)
        row[s+"_r"]=round(S.correlation([a for a,b in pares],[b for a,b in pares]),2) if len(pares)>5 else None
    print(json.dumps(row,ensure_ascii=False),flush=True); out.append(row); time.sleep(2)
json.dump(out,open("validacion_ifs.json","w",encoding="utf-8"),ensure_ascii=False,indent=1)
for s in ["MERRA2","IMERG","IFS"]:
    b=[x[s+"_sesgo"] for x in out]; r=[x[s+"_r"] for x in out if x[s+"_r"] is not None]
    print(s,"n",len(b),"sesgo mediano",S.median(b),"|sesgo| mediano",S.median([abs(x) for x in b]),"r mediano",S.median(r),"dentro ±25%",sum(1 for x in b if abs(x)<=25))
