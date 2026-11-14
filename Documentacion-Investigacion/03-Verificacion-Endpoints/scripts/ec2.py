import json, urllib.request, urllib.parse, ssl, csv, io
def get(u,t=90):
    with urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"research-probe"}),timeout=t) as r: return r.read()
def search(q,n=3):
    return json.loads(get("https://www.datosabiertos.gob.ec/api/3/action/package_search?"+urllib.parse.urlencode({"q":q,"rows":n})))["result"]["results"]
for q in ["riesgos agroclimaticos helada","Geopedologico","zonificacion papa","Precios promedio mensuales productor provincial","fertilidad quimica suelos","capacidad de uso tierras","Precipitacion Total Mensual","Temperatura Minima Absoluta","Registro de las Estaciones Metereologicas"]:
    for p in search(q,1):
        print("\n##",p["title"][:120]); print("  notas:",(p.get("notes") or "")[:300].replace("\n"," "))
        for r in p["resources"]: print("  *",r.get("format"),r.get("name","")[:60],"->",r.get("url"))
