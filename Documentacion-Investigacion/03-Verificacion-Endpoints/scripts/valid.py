import json, urllib.request, urllib.parse, time, csv, collections, statistics as S
st=json.load(open("inamhi_sierra.json",encoding="cp1252"))
rows=list(csv.DictReader(open("inamhi_p2019.csv",encoding="latin1"),delimiter=";"))
f=lambda s: float(s.replace(",",".")) if s.strip() else None
M="ene feb mar abr may jun jul ago sep oct nov dic".split()
obs=collections.defaultdict(dict)
for r in rows: obs[r["Estacion"]][int(r["anio"])]=[f(r[m]) for m in M]
def get(u):
    for i in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"research-probe"}),timeout=180) as r: return json.load(r)
        except Exception as e:
            if "429" in str(e): time.sleep(30*(i+1))
            else: time.sleep(5)
    return None
def monthly(daily):  # dict date->mm => {(y,m):sum}
    out=collections.defaultdict(float); cnt=collections.Counter()
    for d,v in daily:
        if v is None or v==-999: continue
        k=(int(d[:4]),int(d[4:6]) if len(d)==8 else int(d[5:7])); out[k]+=v; cnt[k]+=1
    return {k:v for k,v in out.items() if cnt[k]>=27}
res=[]
for s in st:
    yrs=s["anios"]; o={(y,m+1):obs[s["cod"]][y][m] for y in yrs for m in range(12)}
    row=dict(cod=s["cod"],nombre=s["nombre"],alt=s["alt"],lat=s["lat"],lon=s["lon"],n_anios=len(yrs),obs=s["media"])
    j=get("https://power.larc.nasa.gov/api/temporal/daily/point?"+urllib.parse.urlencode(dict(parameters="PRECTOTCORR,IMERG_PRECTOT",community="AG",latitude=s["lat"],longitude=s["lon"],start="20010101",end="20191231",format="JSON",**{"time-standard":"UTC"})))
    srcs={}
    if j:
        P=j["properties"]["parameter"]
        srcs["MERRA2"]=monthly(P["PRECTOTCORR"].items()); srcs["IMERG"]=monthly(P["IMERG_PRECTOT"].items())
        row["elev_celda_power"]=j["geometry"]["coordinates"][2]
    time.sleep(1)
    k=get("https://archive-api.open-meteo.com/v1/archive?"+urllib.parse.urlencode(dict(latitude=s["lat"],longitude=s["lon"],start_date="2001-01-01",end_date="2019-12-31",daily="precipitation_sum",models="era5",timezone="America/Guayaquil")))
    if k: srcs["ERA5"]=monthly(zip(k["daily"]["time"],k["daily"]["precipitation_sum"]))
    for name,m in srcs.items():
        pares=[(o[x],m[x]) for x in o if x in m]
        if len(pares)<100: continue
        a=[p[0] for p in pares]; b=[p[1] for p in pares]
        row[name+"_anual"]=round(sum(b)/len(b)*12)
        row[name+"_sesgo_pct"]=round((sum(b)-sum(a))/sum(a)*100)
        row[name+"_r_mensual"]=round(S.correlation(a,b),2)
        row[name+"_mae_mensual"]=round(sum(abs(x-y) for x,y in pares)/len(pares),1)
    print(json.dumps(row,ensure_ascii=False),flush=True); res.append(row)
    time.sleep(2)
json.dump(res,open("validacion.json","w",encoding="utf-8"),ensure_ascii=False,indent=1)
print("FIN")
