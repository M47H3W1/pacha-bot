import csv, collections, json
rows=list(csv.DictReader(open("inamhi_p2019.csv",encoding="latin1"),delimiter=";"))
f=lambda s: float(s.replace(",",".")) if s.strip() else None
M="ene feb mar abr may jun jul ago sep oct nov dic".split()
st=collections.defaultdict(dict); meta={}
for r in rows:
    meta[r["Estacion"]]=(r["NombreEstacion"],f(r["latitud2"]),f(r["longitud2"]),f(r["altitud"]))
    st[r["Estacion"]][int(r["anio"])]=[f(r[m]) for m in M]
yrs=[y for s in st.values() for y in s]
print("estaciones",len(st),"filas",len(rows),"años",min(yrs),"-",max(yrs))
sierra={k:v for k,v in meta.items() if v[3] and v[3]>=2000 and v[1] is not None and -5<v[1]<1.5}
print("estaciones >=2000 m:",len(sierra))
# estaciones sierra con >=10 años completos en 2001-2019
good=[]
for k in sierra:
    comp={y:sum(v) for y,v in st[k].items() if 2001<=y<=2019 and all(x is not None for x in v)}
    if len(comp)>=10: good.append((k,meta[k],len(comp),round(sum(comp.values())/len(comp)),sorted(comp)))
print("sierra con >=10 años completos 2001-2019:",len(good))
for g in sorted(good,key=lambda g:-g[2])[:40]: print(g[0],g[1],"años",g[2],"media",g[3])
json.dump([dict(cod=g[0],nombre=g[1][0],lat=g[1][1],lon=g[1][2],alt=g[1][3],n=g[2],media=g[3],anios=g[4]) for g in good],open("inamhi_sierra.json","w"),ensure_ascii=False)
# Tmin
t=list(csv.DictReader(open("inamhi_tmin2019.csv",encoding="latin1"),delimiter=";"))
print("Tmin abs filas",len(t),"años",sorted({r['anio'] for r in t}))
