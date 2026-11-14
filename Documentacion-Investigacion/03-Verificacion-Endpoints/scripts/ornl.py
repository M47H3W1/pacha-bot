import json, urllib.request, urllib.parse, sys
def get(u,t=240):
    with urllib.request.urlopen(urllib.request.Request(u,headers={"Accept":"application/json","User-Agent":"research-probe"}),timeout=t) as r: return json.load(r)
la,lo=-1.93,-78.71
for prod in ["MOD13Q1","SPL3SMP_E","ECO4ESIPTJPL","MOD16A2GF"]:
    try:
        d=get(f"https://modis.ornl.gov/rst/api/v1/{prod}/dates?latitude={la}&longitude={lo}")["dates"]
        print(prod,"fechas:",len(d),d[0]["calendar_date"],"->",d[-1]["calendar_date"])
        b=get(f"https://modis.ornl.gov/rst/api/v1/{prod}/bands")["bands"]
        print("  bandas:",[x["band"] for x in b][:25])
    except Exception as e: print(prod,"ERR",e)
# muestra NDVI 2024 (max 10 fechas por pedido)
try:
    s=get(f"https://modis.ornl.gov/rst/api/v1/MOD13Q1/subset?latitude={la}&longitude={lo}&band=250m_16_days_NDVI&startDate=A2024001&endDate=A2024160&kmAboveBelow=0&kmLeftRight=0")
    print("NDVI 2024:",[(x["calendar_date"],x["data"][0]*s.get("scale",0.0001) if False else x["data"][0]) for x in s["subset"]], "scale",s.get("scale"))
except Exception as e: print("NDVI ERR",e)
