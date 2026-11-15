"""API del juego Astro Granja (Vercel Python Function, FastAPI).

En Vercel el disco es de solo lectura salvo /tmp: caché y matplotlib van ahí.
En local: uvicorn api.index:app --reload  (sirve también el juego compilado en frontend/dist)
"""
import os
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
if os.getenv("VERCEL"):
    os.environ.setdefault("CACHE_DIR", "/tmp/pacha")
    os.environ.setdefault("MPLCONFIGDIR", "/tmp/mpl")
sys.path.insert(0, str(RAIZ))

import logging  # noqa: E402

from fastapi import FastAPI  # noqa: E402
from fastapi.responses import JSONResponse, Response  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402

from app import voz  # noqa: E402
from app.engine import FueraDeSierra  # noqa: E402
from web import app_api, servicio  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("pacha.api")
app = FastAPI(title="Astro Granja", docs_url=None, redoc_url=None)


class Texto(BaseModel):
    texto: str = Field(max_length=1500)
    estilo: str = Field(default="normal", pattern="^(normal|nina)$")  # "nina": voz de Pachita en el juego


def _limpiar_estado(st: dict) -> dict:
    out = {}
    for k in ("lat", "lon", "radio", "mes", "dias", "i"):
        if k in st and isinstance(st[k], (int, float)):
            out[k] = st[k]
    if isinstance(st.get("crop"), str) and st["crop"] in servicio.CROPS:
        out["crop"] = st["crop"]
    if "radio" in out:
        out["radio"] = min(max(out["radio"], 10), 3000)
    for k in ("n", "anio", "m2"):  # juego Astro Granja
        if isinstance(st.get(k), (int, float)) and not isinstance(st.get(k), bool):
            out[k] = st[k]
    if isinstance(st.get("riegos"), list):
        out["riegos"] = [[int(r[0]), float(r[1])] for r in st["riegos"][:400]
                         if isinstance(r, list) and len(r) == 2 and all(isinstance(x, (int, float)) for x in r)]
    return out


class Consulta(BaseModel):
    estado: dict = {}


@app.post("/api/app/{nombre}")
def consulta(nombre: str, c: Consulta):
    """Datos del juego: parcela, cultivo, terreno, semillas y ciclo. Devuelven JSON."""
    if nombre not in app_api.ACCIONES:
        return JSONResponse({"error": "no existe"}, status_code=404)
    st = _limpiar_estado(c.estado)
    if "lat" not in st or "lon" not in st:
        return JSONResponse({"error": "Falta la ubicación de la parcela."}, status_code=400)
    if not (-5.1 <= st["lat"] <= 1.5 and -81.1 <= st["lon"] <= -75.1):
        return JSONResponse({"error": "La ubicación está fuera del Ecuador continental."}, status_code=422)
    if nombre in ("cultivo", "ciclo") and "crop" not in st:
        return JSONResponse({"error": "Falta el cultivo."}, status_code=400)
    log.info("app %s %s", nombre, {k: st[k] for k in st if k not in ("lat", "lon")})
    try:
        return app_api.ACCIONES[nombre](st)
    except FueraDeSierra:
        return JSONResponse({"error": "Ese lugar no es de la sierra. Elija una parcela sobre los 1.500 metros."},
                            status_code=422)
    except Exception:
        log.exception("app %s", nombre)
        return JSONResponse({"error": "No pudimos traer los datos. Intente otra vez."}, status_code=502)


@app.get("/api/salud")
def salud():
    return {"ok": True}


@app.post("/api/voz")
async def hablar(t: Texto):
    datos = await voz.audio(t.texto, t.estilo)
    if not datos:
        return JSONResponse({"error": "sin voz"}, status_code=503)
    return Response(datos, media_type="audio/mpeg", headers={"Cache-Control": "public, max-age=86400"})


if not os.getenv("VERCEL"):  # en local, la misma app sirve la página ya compilada (cd frontend && npm run build)
    from fastapi.staticfiles import StaticFiles

    _dist = RAIZ / "frontend" / "dist"
    if _dist.exists():
        app.mount("/", StaticFiles(directory=_dist, html=True), name="app")
