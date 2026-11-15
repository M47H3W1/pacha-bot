"""Pruebas del juego Astro Granja: relieve del terreno sin red (elevaciones simuladas)."""
from fastapi.testclient import TestClient

from api.index import app
from app import clients

cliente = TestClient(app)
LUGAR = {"lat": -1.6466, "lon": -78.7437, "radio": 80}


def _rampa(llamadas):
    """Elevaciones falsas: suben hacia el norte (latitud mayor = más alto) y cuentan cuántas consultas se hacen."""
    def falso(puntos):
        llamadas.append(len(puntos))
        return [3000 + (la + 1.6466) * 111320 for la, _ in puntos]
    return falso


def test_terreno_grilla_y_area(monkeypatch):
    llamadas = []
    monkeypatch.setattr(clients, "elevaciones", _rampa(llamadas))
    r = cliente.post("/api/app/terreno", json={"estado": {**LUGAR, "n": 17}})
    assert r.status_code == 200
    t = r.json()
    assert t["n"] == 17 and len(t["alturas"]) == 17 and all(len(f) == 17 for f in t["alturas"])
    assert max(llamadas) <= 100 and sum(llamadas) == 17 * 17   # en lotes que acepta Open-Meteo
    assert abs(t["area_m2"] - 3.14159 * 80 ** 2) < 2
    assert t["lado_m"] == 160 and abs(t["paso_m"] - 10) < 0.01
    assert t["alturas"][0][8] > t["alturas"][16][8]            # fila 0 es el norte
    assert abs(t["desnivel_m"] - 160) < 1 and not t["sin_relieve"]
    assert abs(t["pendiente_pct"] - 100) < 1 and t["pendiente_clase"] == "fuerte"   # rampa de 1 m por metro


def test_terreno_n_impar_y_limitado(monkeypatch):
    monkeypatch.setattr(clients, "elevaciones", _rampa([]))
    assert cliente.post("/api/app/terreno", json={"estado": {**LUGAR, "n": 10}}).json()["n"] == 11
    assert cliente.post("/api/app/terreno", json={"estado": {**LUGAR, "n": 999}}).json()["n"] == 33
    assert cliente.post("/api/app/terreno", json={"estado": LUGAR}).json()["n"] == 17


def test_terreno_sin_red_devuelve_plano(monkeypatch):
    monkeypatch.setattr(clients, "elevaciones", lambda puntos: None)
    monkeypatch.setattr(clients, "elevation", lambda lat, lon: 3087.0)
    t = cliente.post("/api/app/terreno", json={"estado": {**LUGAR, "n": 9}}).json()
    assert t["sin_relieve"] is True and t["desnivel_m"] == 0 and t["centro"] == 3087.0


def test_terreno_fuera_del_ecuador():
    r = cliente.post("/api/app/terreno", json={"estado": {"lat": 40.0, "lon": -3.7, "radio": 80}})
    assert r.status_code == 422
