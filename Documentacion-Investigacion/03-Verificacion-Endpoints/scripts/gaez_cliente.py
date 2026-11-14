import json, urllib.request, urllib.parse
UA = {"User-Agent": "Mozilla/5.0 research-probe"}
U = "https://gaez-services.fao.org/server/rest/services/LR/ImageServer/getSamples"
def samples(oid, pts, srv=U):
    out = []
    for i in range(0, len(pts), 400):
        q = dict(geometry=json.dumps({"points": pts[i:i+400], "spatialReference": {"wkid": 4326}}), geometryType="esriGeometryMultipoint",
                 mosaicRule=json.dumps({"mosaicMethod": "esriMosaicLockRaster", "lockRasterIds": [oid]}), returnFirstValueOnly="true", f="json")
        d = json.load(urllib.request.urlopen(urllib.request.Request(srv, headers=UA, data=urllib.parse.urlencode(q).encode()), timeout=300))
        if "error" in d: raise RuntimeError(d)
        out += [s.get("value") for s in sorted(d["samples"], key=lambda s: s["locationId"])]
    return out
