"""Validación cruzada dejando una estación fuera (LOO): ¿cuánto error queda si calibramos la lluvia NASA
con estaciones INAMHI vecinas? Usa solo resultados/validacion_lluvia_85_estaciones.json (sin red)."""
import json, math, sys
from pathlib import Path
import numpy as np

src = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).parents[1] / "resultados/validacion_lluvia_85_estaciones.json")
est = json.loads(src.read_text(encoding="utf-8"))

def km(a, b):
    dy = (a["lat"] - b["lat"]) * 111.2
    dx = (a["lon"] - b["lon"]) * 111.2 * math.cos(math.radians(a["lat"]))
    return math.hypot(dx, dy)

def loo(fuente, k=5, h_alt=500.0):
    """Factor obs/modelo de las k vecinas, ponderado por distancia y diferencia de altura."""
    out = []
    for i, e in enumerate(est):
        vec = []
        for j, o in enumerate(est):
            if j == i:
                continue
            d = km(e, o)
            w = 1 / (d + 5) ** 2 * math.exp(-abs(e["alt"] - o["alt"]) / h_alt)
            vec.append((w, math.log(o["obs"] / o[f"{fuente}_anual"])))
        vec.sort(reverse=True)
        vec = vec[:k]
        lf = sum(w * f for w, f in vec) / sum(w for w, _ in vec)
        pred = e[f"{fuente}_anual"] * math.exp(lf)
        out.append((e["obs"], e[f"{fuente}_anual"], pred))
    return np.array(out)

res = {}
for f in ("MERRA2", "IMERG"):
    a = loo(f)
    obs, raw, cal = a.T
    lr_raw, lr_cal = np.log(raw / obs), np.log(cal / obs)
    q10, q90 = np.percentile(lr_cal, [10, 90])
    # cobertura del intervalo 80 % construido con los residuos (LOO anidado aproximado)
    res[f] = {
        "sesgo_mediano_crudo_pct": round(100 * (np.exp(np.median(lr_raw)) - 1)),
        "error_abs_mediano_crudo_pct": round(100 * np.median(np.abs(raw / obs - 1))),
        "sesgo_mediano_calibrado_pct": round(100 * (np.exp(np.median(lr_cal)) - 1)),
        "error_abs_mediano_calibrado_pct": round(100 * np.median(np.abs(cal / obs - 1))),
        "dentro_25pct_crudo": int((np.abs(raw / obs - 1) <= 0.25).sum()),
        "dentro_25pct_calibrado": int((np.abs(cal / obs - 1) <= 0.25).sum()),
        "intervalo80_factor": [round(float(np.exp(-q90)), 2), round(float(np.exp(-q10)), 2)],
        "sd_log_residuo": round(float(lr_cal.std()), 3),
    }
print(json.dumps(res, indent=2, ensure_ascii=False))
