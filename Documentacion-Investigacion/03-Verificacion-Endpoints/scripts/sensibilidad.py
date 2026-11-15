"""¿Cambia la recomendación del motor actual si la lluvia/temperatura tienen el error medido?
1) Escenarios dP/dT (rango del sesgo medido) y 2) un año a la vez (variabilidad interanual).
Ejecutar desde la raíz del repo: CACHE_DIR=<tmp> python Documentacion-.../sensibilidad.py"""
import json, sys, copy
from collections import Counter
sys.path.insert(0, ".")
from app import engine as E

SITIOS = {"Guamote": (-1.933, -78.712), "San Juan (Chimborazo)": (-1.636, -78.783), "Patate": (-1.310, -78.510)}
MESES = [10, 11, 1]  # siembras típicas de la sierra centro
ESC = [(-0.5, 0), (-0.33, 0), (0, 0), (0.25, 0), (0, -1.5), (0, 1.0), (-0.33, -1.5)]

def top(sitio, clima, mes, n=3):
    return [f["crop"].id for f in E.recomendar_para_empezar(sitio, clima, mes, n=n)]

out = {}
for nom, (lat, lon) in SITIOS.items():
    s = E.crear_sitio(lat, lon)
    base = E.Clima(s)
    r = {"altura": round(s.elev), "metodo": base.metodo, "meses": {}}
    for mes in MESES:
        t0 = top(s, base, mes)
        esc = {f"dP={dp:+.0%} dT={dt:+.1f}": top(s, E.Clima(s, dp, dt), mes) for dp, dt in ESC}
        # año a año
        prim = Counter()
        for i, y in enumerate(base.anios[:-1]):
            c = copy.copy(base)
            c.anios = [y]
            c.prob_helada = base.helada_m[i].astype(float)
            c.clave = base.clave + f"|{y}"
            try:
                prim[top(s, c, mes, 1)[0]] += 1
            except Exception:
                pass
        tot = sum(prim.values())
        r["meses"][E.MESES[mes - 1]] = {
            "top3_base": t0,
            "escenarios": esc,
            "top1_igual_en_escenarios": sum(v[0] == t0[0] for v in esc.values()), "n_escenarios": len(esc),
            "frecuencia_top1_por_anio": {k: round(v / tot, 2) for k, v in prim.most_common()}, "anios": tot,
        }
    out[nom] = r
print(json.dumps(out, indent=1, ensure_ascii=False))
