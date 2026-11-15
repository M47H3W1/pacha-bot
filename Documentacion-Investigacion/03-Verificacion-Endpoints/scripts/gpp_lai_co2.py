import json, urllib.request, urllib.parse
UA={"User-Agent":"research-probe"}
def get(u,t=180):
    with urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=t) as r: return r.status, r.read()
res={}
# ORNL en puntos rurales
for lat,lon in ((-1.90,-78.68),(-1.97,-78.74),(-1.86,-78.75)):
    for prod,band in (("MOD17A2HGF","Gpp_500m"),("MCD15A2H","Lai_500m")):
        try:
            s,b=get(f"https://modis.ornl.gov/rst/api/v1/{prod}/subset?latitude={lat}&longitude={lon}&band={band}&startDate=A2023001&endDate=A2023073&kmAboveBelow=0&kmLeftRight=0")
            j=json.loads(b); v=[(x["calendar_date"],x["data"][0]) for x in j["subset"]]
            res[f"{lat},{lon},{prod}"]=dict(escala=j.get("scale"),valores=v); print(lat,lon,prod,j.get("scale"),v)
        except Exception as e: print(lat,lon,prod,"ERR",e)
# GEOS-CF API
for u in ["https://fluid.nccs.nasa.gov/cfapi/fcast/chm/v1/-1.9x-78.7/latest/",
          "https://fluid.nccs.nasa.gov/cfapi/fcast/chm/v1/-1.9x-78.7/latest/O3,NO2,SO2,CO/",
          "https://fluid.nccs.nasa.gov/cfapi/"]:
    try:
        s,b=get(u,60); print("GEOSCF",u,s,b[:400]); res[u]=b[:3000].decode("utf-8","replace")
    except Exception as e: print("GEOSCF",u,"ERR",e); res[u]=str(e)
# NOAA CO2 global
try:
    s,b=get("https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_annmean_gl.txt",60)
    l=[x for x in b.decode().splitlines() if x and not x.startswith("#")][-5:]; print("NOAA",l); res["noaa_co2_gl"]=l
except Exception as e: print("NOAA ERR",e)
# SoilGrids nutrientes
q="lon=-78.712&lat=-1.933&"+"&".join("property="+p for p in ("nitrogen","phh2o","cec","soc","bdod","clay"))+"&depth=0-5cm&depth=5-15cm&depth=15-30cm&value=mean"
try:
    s,b=get("https://rest.isric.org/soilgrids/v2.0/properties/query?"+q,90); j=json.loads(b)
    sg={l["name"]:{"unidad":l["unit_measure"]["mapped_units"],"factor":l["unit_measure"]["d_factor"],**{d["label"]:d["values"]["mean"] for d in l["depths"]}} for l in j["properties"]["layers"]}
    print("SG",sg); res["soilgrids_guamote"]=sg
except Exception as e: print("SG ERR",e)
json.dump(res,open("p2.json","w",encoding="utf-8"),indent=1,ensure_ascii=False)
