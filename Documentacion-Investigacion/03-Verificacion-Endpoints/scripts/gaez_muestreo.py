"""Muestrea capas de suelo de FAO GAEZ v4 (ImageServer LR) en una grilla de la sierra centro (2.400–4.000 m).
Uso: python gaez_muestreo.py salida.json   (requiere gaez_cliente.py en la misma carpeta)"""
import json, sys
import numpy as np
from gaez_cliente import samples
pts = [[round(x, 3), round(y, 3)] for y in np.arange(-2.35, -0.74, 0.02) for x in np.arange(-79.15, -78.34, 0.02)]
alt = samples(700, pts)  # altitud mediana 30"
sel = [(p, float(a)) for p, a in zip(pts, alt) if a not in (None, "NoData") and 2400 <= float(a) <= 4000]
LAY = {"suelo_dom": 676, "sq0_lim_L": 678, "sq1_nutr_L": 682, "sq2_ret_H": 683, "sq3_raiz_L": 686, "sq4_oxi_L": 688,
       "sq5_sal_L": 690, "sq7_lab_L": 694, "apt_suelo_L": 697, "apt_suelo_terreno_L": 698, "pend_clase": 718}
out = [dict(lon=p[0], lat=p[1], alt=a) for p, a in sel]
for k, oid in LAY.items():
    for o, v in zip(out, samples(oid, [p for p, _ in sel])):
        o[k] = v
json.dump(out, open(sys.argv[1], "w"), indent=0)
