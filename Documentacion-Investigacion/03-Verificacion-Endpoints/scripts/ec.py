import json, urllib.request, urllib.parse
def get(u,t=60,raw=False):
    with urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"research-probe","Accept":"application/json"}),timeout=t) as r:
        b=r.read(); return (r.status,len(b),b[:300]) if raw else json.loads(b)
# CKAN datos abiertos
for org in ["instituto-nacional-de-meteorologia-e-hidrologia-inamhi","mag","instituto-nacional-de-estadistica-y-censos-inec"]:
    try:
        j=get("https://www.datosabiertos.gob.ec/api/3/action/package_search?"+urllib.parse.urlencode({"fq":f"organization:{org}","rows":100}))
        r=j["result"]; print(f"\n== {org}: {r['count']} datasets")
        for p in r["results"][:60]: print("  -",p["title"][:110],"|",",".join(sorted({x.get('format','') for x in p['resources']})))
    except Exception as e: print(org,"ERR",e)
for q in ["helada","precipitacion","suelos","aptitud agricola","papa","ESPAC"]:
    try:
        j=get("https://www.datosabiertos.gob.ec/api/3/action/package_search?"+urllib.parse.urlencode({"q":q,"rows":8}))
        print(f"\n== q={q}: {j['result']['count']}")
        for p in j["result"]["results"]: print("  -",p["title"][:100],"|",p.get("organization",{}).get("name"))
    except Exception as e: print(q,"ERR",e)
for u in ["https://servicios.inamhi.gob.ec/","https://www.inamhi.gob.ec/","https://geoportal.agricultura.gob.ec/","https://sipa.agricultura.gob.ec/","https://inamhi.geoglows.org/"]:
    try: print(u,get(u,30,raw=True)[:2])
    except Exception as e: print(u,"ERR",str(e)[:80])
