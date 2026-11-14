"""Pruebas de los textos del modo campo (sin red)."""
import datetime as dt

from app import campo


def test_cuando_rangos():
    assert campo.cuando([0, 1, 2, 3, 4]) == "de enero a mayo"
    assert campo.cuando([6, 7]) == "en julio y agosto"
    assert campo.cuando([11, 0, 1]) == "de diciembre a febrero"
    assert campo.cuando([2, 9]) == "en marzo y en octubre"


def test_baldes():
    assert campo.baldes(0.2) == "medio balde"
    assert campo.baldes(1.0) == "1 balde"
    assert campo.baldes(2.6) == "2 baldes y medio"


def test_plan_riego_dias_secos():
    hoy = dt.date(2026, 11, 16)
    w = {"falta": 18.0, "fechas": [(hoy + dt.timedelta(d)).isoformat() for d in range(7)],
         "lluvia_dia": [10, 0, 0, 8, 0, 0, 12], "heladas": []}
    p = campo.plan_riego(w, 0.85, "franco")
    assert p["veces"] == 2
    assert all(w["lluvia_dia"][(d - hoy).days] == 0 for d in p["dias"])
    assert (p["dias"][1] - p["dias"][0]).days >= 2


def test_sin_riego_si_llueve():
    hoy = dt.date(2026, 11, 16)
    w = {"falta": 0.5, "fechas": [(hoy + dt.timedelta(d)).isoformat() for d in range(7)],
         "lluvia_dia": [5] * 7, "heladas": []}
    assert campo.plan_riego(w, 0.75, "franco")["veces"] == 0
