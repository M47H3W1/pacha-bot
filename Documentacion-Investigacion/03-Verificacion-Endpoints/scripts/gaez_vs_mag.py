"""Une cada punto GAEZ con el polígono del mapa geopedológico MAG 1:25.000 que lo contiene.
Lee el shapefile directamente desde el zip (sin descomprimir a disco). Solo stdlib + numpy.
Uso: python gaez_vs_mag.py shp_unidad_geopedologica_2019.zip gaez_puntos.json salida.json"""
import json, math, struct, sys, zipfile
import numpy as np
ZIP, PTS, OUT = sys.argv[1:4]
P = "shp_unidad_geopedologica_2019/MINISTERIO_AGRICULTURA_GANADERIA/E_FISIOGRAFIA/EL_GEOPEDOLOGIA/EL000_UNIDAD_GEOPEDOLOGICA_A."

def utm17s(lon, lat):
    a, f, k0 = 6378137.0, 1 / 298.257223563, 0.9996
    e2 = f * (2 - f); ep2 = e2 / (1 - e2)
    phi, lam, lam0 = math.radians(lat), math.radians(lon), math.radians(-81)
    N = a / math.sqrt(1 - e2 * math.sin(phi) ** 2); T = math.tan(phi) ** 2; C = ep2 * math.cos(phi) ** 2
    A = math.cos(phi) * (lam - lam0)
    M = a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * phi - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * math.sin(2 * phi)
             + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * math.sin(4 * phi) - (35 * e2 ** 3 / 3072) * math.sin(6 * phi))
    x = k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T ** 2 + 72 * C - 58 * ep2) * A ** 5 / 120) + 500000
    y = k0 * (M + N * math.tan(phi) * (A ** 2 / 2 + (5 - T + 9 * C + 4 * C ** 2) * A ** 4 / 24 + (61 - 58 * T + T ** 2 + 600 * C - 330 * ep2) * A ** 6 / 720)) + 10000000
    return x, y

pts = json.load(open(PTS))
XY = np.array([utm17s(p["lon"], p["lat"]) for p in pts])
x0, y0, x1, y1 = XY[:, 0].min(), XY[:, 1].min(), XY[:, 0].max(), XY[:, 1].max()
hit = {}  # índice de punto -> índice de registro

def pip(px, py, xs, ys):
    j = np.roll(np.arange(len(xs)), 1)
    c = ((ys > py) != (ys[j] > py)) & (px < (xs[j] - xs) * (py - ys) / (ys[j] - ys + 1e-300) + xs)
    return c.sum() % 2 == 1

z = zipfile.ZipFile(ZIP)
with z.open(P + "shp") as f:
    f.read(100); rec = 0
    while True:
        h = f.read(8)
        if len(h) < 8: break
        n = struct.unpack(">i", h[4:8])[0] * 2
        b = f.read(n)
        if struct.unpack("<i", b[:4])[0] == 5:
            bx = struct.unpack("<4d", b[4:36])
            if not (bx[2] < x0 or bx[0] > x1 or bx[3] < y0 or bx[1] > y1):
                cand = np.where((XY[:, 0] >= bx[0]) & (XY[:, 0] <= bx[2]) & (XY[:, 1] >= bx[1]) & (XY[:, 1] <= bx[3]))[0]
                if len(cand):
                    npart, npt = struct.unpack("<2i", b[36:44])
                    parts = list(struct.unpack(f"<{npart}i", b[44:44 + 4 * npart])) + [npt]
                    xy = np.frombuffer(b, "<f8", 2 * npt, 44 + 4 * npart).reshape(-1, 2)
                    for i in cand:
                        if i in hit: continue
                        inside = False
                        for a_, b_ in zip(parts[:-1], parts[1:]):
                            if pip(XY[i, 0], XY[i, 1], xy[a_:b_, 0], xy[a_:b_, 1]): inside = not inside
                        if inside: hit[int(i)] = rec
        rec += 1
print("registros", rec, "puntos con polígono", len(hit))
need = set(hit.values())
with z.open(P + "dbf") as f:
    h = f.read(32); nrec, hl, rl = struct.unpack("<IHH", h[4:12]); flds = []
    while True:
        d = f.read(32)
        if d[0] == 0x0D: break
        flds.append((d[:11].split(b"\0")[0].decode("latin1"), d[16]))
    f.read(hl - 32 - 32 * len(flds) - 1)
    rows = {}
    for r in range(nrec):
        b = f.read(rl)
        if r in need:
            o, row = 1, {}
            for name, ln in flds:
                row[name] = b[o:o + ln].decode("latin1").strip(); o += ln
            rows[r] = row
# OJO: en este DBF los nombres de columna están corridos respecto al contenido (verificado registro a registro).
# Se renombra según el contenido real:
CAMPOS = {"DPA_DESPRO": "canton", "pen": "pendiente", "nug": "orden", "otx": "suborden", "stx": "textura_sup", "txs": "textura_sub",
          "ttd": "drenaje", "ndr": "profundidad", "pfe": "pedregosidad", "pdr": "toxicidad", "txc": "ph", "phi": "salinidad",
          "rmo": "materia_organica", "cic": "cic", "sdb": "saturacion_bases", "fld": "inundacion", "uge": "relieve"}
for i, p in enumerate(pts):
    r = rows.get(hit.get(i))
    p["mag"] = {v: r[k] for k, v in CAMPOS.items()} if r else None
json.dump(pts, open(OUT, "w", encoding="utf-8"), indent=0, ensure_ascii=False)
