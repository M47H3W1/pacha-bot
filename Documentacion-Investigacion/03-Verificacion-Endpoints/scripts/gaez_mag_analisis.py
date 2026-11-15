"""Concordancia entre FAO GAEZ v4 (suelo) y el mapa geopedológico MAG 1:25.000 en los mismos puntos.
Uso: python gaez_mag_analisis.py gaez_mag.json salida.json"""
import json, sys, collections
import numpy as np
d = json.load(open(sys.argv[1], encoding="utf-8"))
SUELO = {"3": "Andosols", "21": "Phaeozems", "16": "Leptosols", "17": "Luvisols", "31": "Agua"}
def orden_mag(sub):
    s = sub.upper()
    for suf, o in (("ANDS", "Andisoles"), ("OLLS", "Mollisoles"), ("EPTS", "Inceptisoles"), ("ENTS", "Entisoles"),
                   ("ALFS", "Alfisoles"), ("ISTS", "Histosoles"), ("ERTS", "Vertisoles")):
        if s.endswith(suf): return o
    return "Sin suelo / misceláneo" if "MISCEL" in s or "NO APLICABLE" in s else s
EQUIV = {"Andosols": {"Andisoles"}, "Phaeozems": {"Mollisoles"}, "Leptosols": {"Entisoles", "Sin suelo / misceláneo", "Inceptisoles"},
         "Luvisols": {"Alfisoles"}}
def spear(a, b):
    a, b = np.asarray(a, float), np.asarray(b, float)
    ra = np.argsort(np.argsort(a)); rb = np.argsort(np.argsort(b))
    # rangos con empates promedio
    def rk(x):
        u, inv = np.unique(x, return_inverse=True); r = np.zeros(len(u))
        o = np.argsort(x); ranks = np.empty(len(x)); ranks[o] = np.arange(len(x))
        for i in range(len(u)): r[i] = ranks[inv == i].mean()
        return r[inv]
    return round(float(np.corrcoef(rk(a), rk(b))[0, 1]), 2)
res = {"n_puntos": len(d)}
v = [p for p in d if p["mag"] and p["mag"]["suborden"] not in ("",)]
# 1. tipo de suelo
tab = collections.Counter((SUELO.get(p["suelo_dom"], p["suelo_dom"]), orden_mag(p["mag"]["suborden"])) for p in v)
res["tipo_suelo_tabla"] = {f"{g} | {m}": n for (g, m), n in tab.most_common()}
ok = sum(n for (g, m), n in tab.items() if m in EQUIV.get(g, set()))
res["tipo_suelo_coincide_pct"] = round(100 * ok / sum(tab.values()))
res["mag_orden"] = dict(collections.Counter(orden_mag(p["mag"]["suborden"]) for p in v).most_common())
res["gaez_suelo"] = dict(collections.Counter(SUELO.get(p["suelo_dom"], p["suelo_dom"]) for p in v).most_common())
# 2. pendiente (punto medio de clase)
G = {"2": 1.25, "3": 3.5, "4": 6.5, "5": 12, "6": 23, "7": 37.5, "8": 55}
def mag_pen(s):
    s = s.replace(">", "").replace("%", "").strip()
    try: a, b = [float(x) for x in s.split("-")]; return (a + b) / 2
    except Exception: return None
pp = [(G[p["pend_clase"]], mag_pen(p["mag"]["pendiente"])) for p in v if p["pend_clase"] in G and mag_pen(p["mag"]["pendiente"]) is not None]
g, m = np.array(pp).T
res["pendiente"] = {"n": len(pp), "spearman": spear(g, m), "gaez_mediana_pct": float(np.median(g)), "mag_mediana_pct": float(np.median(m)),
                    "mag_mayor_40pct": round(100 * float((m > 40).mean())), "gaez_mayor_30pct": round(100 * float((g > 30).mean()))}
# 3. profundidad de raíces: SQ3 vs profundidad MAG
PROF = {"MUY SUPERFICIAL": 1, "SUPERFICIAL": 2, "POCO PROFUNDO": 3, "MODERADAMENTE PROFUNDO": 4, "PROFUNDO": 5}
pr = [(int(p["sq3_raiz_L"]), PROF[p["mag"]["profundidad"]]) for p in v if p["mag"]["profundidad"] in PROF]
a, b = np.array(pr).T
res["raices_SQ3_vs_profundidad"] = {"n": len(pr), "spearman": spear(a, b),
    "gaez_sin_restriccion_pct": round(100 * float((a == 10).mean())),
    "mag_superficial_o_poco_prof_pct": round(100 * float((b <= 3).mean())),
    "mag_superficial_donde_gaez_10_pct": round(100 * float((b[a == 10] <= 2).mean()))}
# 4. nutrientes: SQ1 vs materia orgánica, CIC, saturación de bases, pH
MO = {"MUY BAJO": 1, "BAJO": 2, "MEDIO": 3, "ALTO": 4, "MUY ALTO": 5}; CIC = {"BAJA": 1, "MEDIA": 2, "ALTA": 3}
SB = {"MUY BAJA": 1, "BAJA": 2, "MEDIANA": 3, "ALTA": 4}
PH = {"MUY ACIDO": 1, "ACIDO": 2, "MEDIANAMENTE ACIDO": 3, "LIGERAMENTE ACIDO": 4, "PRACTICAMENTE NEUTRO": 5, "NEUTRO": 5,
      "LIGERAMENTE ALCALINO": 6, "MEDIANAMENTE ALCALINO": 7, "ALCALINO": 8}
nut = {}
for nom, campo, esc in (("materia_organica", "materia_organica", MO), ("cic", "cic", CIC), ("saturacion_bases", "saturacion_bases", SB), ("ph", "ph", PH)):
    q = [(int(p["sq1_nutr_L"]), esc[p["mag"][campo]]) for p in v if p["mag"][campo] in esc]
    a, b = np.array(q).T
    nut[nom] = {"n": len(q), "spearman_con_SQ1": spear(a, b)}
res["nutrientes_SQ1"] = nut
q = [(int(p["sq1_nutr_L"]), p["mag"]["ph"]) for p in v if p["mag"]["ph"] in PH]
res["ph_acido_donde_gaez_sin_restriccion_pct"] = round(100 * np.mean([PH[ph] <= 2 for s, ph in q if s >= 9]))
res["ph_mag"] = dict(collections.Counter(p["mag"]["ph"] for p in v).most_common())
res["toxicidad_mag"] = dict(collections.Counter(p["mag"]["toxicidad"] for p in v).most_common())
# 5. laborabilidad SQ7 vs pedregosidad
PED = {"NULA": 1, "MUY POCAS": 2, "POCAS": 3, "FRECUENTES": 4, "ABUNDANTES": 5, "PEDREGOSO (ROCOSO)": 6}
q = [(int(p["sq7_lab_L"]), PED[p["mag"]["pedregosidad"]]) for p in v if p["mag"]["pedregosidad"] in PED]
a, b = np.array(q).T
res["laboreo_SQ7_vs_pedregosidad"] = {"n": len(q), "spearman": spear(a, b), "mag_frecuentes_o_mas_donde_gaez_10_pct": round(100 * float((b[a == 10] >= 4).mean()))}
# 6. oxígeno y salinidad (GAEZ sin variación)
res["oxigeno_SQ4"] = dict(collections.Counter(p["sq4_oxi_L"] for p in v)); res["drenaje_mag"] = dict(collections.Counter(p["mag"]["drenaje"] for p in v).most_common())
res["salinidad_SQ5"] = dict(collections.Counter(p["sq5_sal_L"] for p in v)); res["salinidad_mag"] = dict(collections.Counter(p["mag"]["salinidad"] for p in v).most_common())
# 7. limitante principal GAEZ
LIM = {"1": "Sin restricción", "3": "Retención de nutrientes", "9": "Pendiente"}
res["gaez_limitante_principal"] = dict(collections.Counter(LIM.get(p["sq0_lim_L"], p["sq0_lim_L"]) for p in v).most_common())
res["mag_no_aplicable_pct"] = round(100 * np.mean([p["mag"]["profundidad"] == "NO APLICABLE" for p in v]))
# 8. aptitud de suelo (GAEZ, maíz de referencia, bajos insumos) vs suelo+terreno
res["gaez_aptitud_suelo"] = dict(collections.Counter(p["apt_suelo_L"] for p in v).most_common())
res["gaez_aptitud_suelo_terreno"] = dict(collections.Counter(p["apt_suelo_terreno_L"] for p in v).most_common())
json.dump(res, open(sys.argv[2], "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print(json.dumps(res, indent=1, ensure_ascii=False))
