"""Pruebas de la API JSON de la aplicación (web y móvil)."""
import pytest
from fastapi.testclient import TestClient

from api.index import app
from app.engine import SIERRA
from web import app_api

cliente = TestClient(app)


def test_parroquias_en_la_sierra():
    ps = app_api.parroquias()["parroquias"]
    assert len(ps) >= 40
    assert sum(p["demo"] for p in ps) == 1  # Calpi, el ejemplo del mock
    for p in ps:
        assert SIERRA["lat"][0] <= p["lat"] <= SIERRA["lat"][1], p
        assert SIERRA["lon"][0] <= p["lon"] <= SIERRA["lon"][1], p
        assert 1800 <= p["elev"] <= 3800, p


def test_fuentes_citan_nasa():
    f = app_api.fuentes()
    nasa = [x for x in f["fuentes"] if x["agencia"] == "NASA"]
    assert {"power", "imerg", "modis"} <= {x["id"] for x in nasa}
    assert all(x["url"].startswith("http") for x in f["fuentes"])


def test_validaciones_de_la_api():
    assert cliente.post("/api/app/nada", json={"estado": {}}).status_code == 404
    assert cliente.post("/api/app/parcela", json={"estado": {}}).status_code == 400
    assert cliente.post("/api/app/parcela", json={"estado": {"lat": 40, "lon": 2}}).status_code == 422
    assert cliente.post("/api/app/cultivo", json={"estado": {"lat": -1.6466, "lon": -78.7437}}).status_code == 400
    assert cliente.get("/api/parroquias").status_code == 200


@pytest.mark.red
def test_recomendacion_calpi():
    """Calpi viene con datos guardados en app/semillas; SoilGrids puede necesitar red."""
    r = cliente.post("/api/app/recomendacion", json={"estado": {"lat": -1.6466, "lon": -78.7437, "radio": 28, "mes": 10}})
    assert r.status_code == 200
    d = r.json()
    assert not d["fuera_de_epoca"] and 1 <= len(d["cultivos"]) <= 3
    for c in d["cultivos"]:
        assert 0 <= c["gana_anios"] <= c["gana_de"] == d["anios"]
        assert c["veredicto"] in ("si", "cuidado", "no")
