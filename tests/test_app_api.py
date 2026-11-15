"""Pruebas de la API JSON del juego Astro Granja."""
from fastapi.testclient import TestClient

from api.index import app
from web import app_api

cliente = TestClient(app)


def test_solo_endpoints_del_juego():
    assert set(app_api.ACCIONES) == {"parcela", "cultivo", "terreno", "semillas", "ciclo"}
    for viejo in ("/api/parroquias", "/api/fuentes"):
        assert cliente.get(viejo).status_code == 404
    for viejo in ("/api/accion", "/api/pregunta", "/api/transcribir"):
        assert cliente.post(viejo, json={}).status_code in (404, 405)


def test_validaciones_de_la_api():
    assert cliente.post("/api/app/nada", json={"estado": {}}).status_code == 404
    assert cliente.post("/api/app/recomendacion", json={"estado": {"lat": -1.6466, "lon": -78.7437}}).status_code == 404
    assert cliente.post("/api/app/parcela", json={"estado": {}}).status_code == 400
    assert cliente.post("/api/app/parcela", json={"estado": {"lat": 40, "lon": 2}}).status_code == 422
    assert cliente.post("/api/app/cultivo", json={"estado": {"lat": -1.6466, "lon": -78.7437}}).status_code == 400
    assert cliente.post("/api/app/ciclo", json={"estado": {"lat": -1.6466, "lon": -78.7437}}).status_code == 400
