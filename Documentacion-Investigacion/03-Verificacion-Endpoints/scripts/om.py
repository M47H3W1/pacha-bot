import json, urllib.request, urllib.parse, statistics as s
pts={"Guamote":(-1.93,-78.71),"Riobamba":(-1.67,-78.65),"Cayambe":(0.04,-78.14),"Saraguro":(-3.62,-79.24)}
def get(u):
    with urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"research-probe"}),timeout=120) as r: return json.load(r)
res={}
for n,(la,lo) in pts.items():
    row={}
    for m in ["era5","era5_land","ecmwf_ifs"]:
        try:
            j=get("https://archive-api.open-meteo.com/v1/archive?"+urllib.parse.urlencode(dict(latitude=la,longitude=lo,start_date="2018-01-01",end_date="2024-12-31",daily="precipitation_sum,temperature_2m_min,et0_fao_evapotranspiration",models=m,timezone="America/Guayaquil")))
            d=j["daily"]; yrs={}
            for t,p in zip(d["time"],d["precipitation_sum"]):
                if p is not None: yrs.setdefault(t[:4],[]).append(p)
            row[m]=dict(lluvia=round(s.mean(sum(v) for v in yrs.values())),tmin=round(s.mean(x for x in d["temperature_2m_min"] if x is not None),1),et0=round(s.mean(sum(x for x in d["et0_fao_evapotranspiration"][i:i+365] if x is not None) for i in range(0,len(d['time'])-364,365))),elev=j.get("elevation"))
        except Exception as e: row[m]=str(e)[:80]
    # POWER MERRA2 + IMERG same 2018-2024
    j=get("https://power.larc.nasa.gov/api/temporal/daily/point?"+urllib.parse.urlencode(dict(parameters="PRECTOTCORR,IMERG_PRECTOT,T2M_MIN",community="AG",latitude=la,longitude=lo,start="20180101",end="20241231",format="JSON",**{"time-standard":"UTC"})))
    P=j["properties"]["parameter"]
    for k in ["PRECTOTCORR","IMERG_PRECTOT"]:
        yrs={}
        for t,v in P[k].items():
            if v!=-999: yrs.setdefault(t[:4],[]).append(v)
        row["POWER_"+k]=round(s.mean(sum(v) for v in yrs.values() if len(v)>360))
    row["POWER_T2M_MIN"]=round(s.mean(v for v in P["T2M_MIN"].values() if v!=-999),1)
    row["POWER_elev_celda"]=j["geometry"]["coordinates"][2]
    res[n]=row; print(n,json.dumps(row,ensure_ascii=False))
json.dump(res,open("comparacion_lluvia.json","w"),indent=1,ensure_ascii=False)
