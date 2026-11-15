import json, urllib.request, urllib.parse
BB="-79.2,-2.5,-78.3,-1.3"
SN=["SPL3SMP_E","SPL4SMGP","SPL3FTP","SPL2SMAP_S","GPM_3IMERGDF","GPM_3IMERGM","MOD13Q1","MYD13Q1","VNP13A1","MOD16A2GF","MOD11A2","MOD15A2H","HLSL30","HLSS30","ECO_L2T_LSTE","ECO_L3T_JET","ECO_L4T_ESI","GLDAS_NOAH025_3H","GLDAS_NOAH025_M","GLDAS_CLSM025_DA1_D","FLDAS_NOAH01_C_GL_M","SRTMGL1","NASADEM_HGT","GEDI04_A","GEDI02_B","MCD12Q1","OPERA_L3_DSWX-HLS_V1"]
def get(url):
    req=urllib.request.Request(url,headers={"User-Agent":"research-probe"})
    with urllib.request.urlopen(req,timeout=60) as r: return json.load(r), dict(r.headers)
out=[]
for sn in SN:
    try:
        j,_=get("https://cmr.earthdata.nasa.gov/search/collections.json?"+urllib.parse.urlencode({"short_name":sn,"page_size":20}))
        es=j["feed"]["entry"]
        if not es: print(sn,"| NO ENCONTRADO"); continue
        e=sorted(es,key=lambda e:e.get("version_id",""))[-1]
        _,h=get("https://cmr.earthdata.nasa.gov/search/granules.json?"+urllib.parse.urlencode({"collection_concept_id":e["id"],"bounding_box":BB,"page_size":0}))
        hits=h.get("CMR-Hits") or h.get("cmr-hits")
        row=dict(sn=sn,ver=e.get("version_id"),ini=e.get("time_start","")[:10],fin=(e.get("time_end") or "en curso")[:10],dc=e.get("data_center"),granulos_chimborazo=hits,title=e.get("title"))
        out.append(row); print(row)
    except Exception as ex: print(sn,"ERR",ex)
json.dump(out,open("cmr_result.json","w"),indent=1)
