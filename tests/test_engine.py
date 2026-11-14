"""Pruebas del motor con datos reales de NASA POWER (requiere internet)."""
import numpy as np
import pytest

from app import engine as E
from app.catalog import CROPS


@pytest.fixture(scope="module")
def chimborazo():
    s = E.crear_sitio(-1.60, -78.70, "Chimborazo")
    return s, E.Clima(s)


def test_et0_fao56_ejemplo():
    # FAO-56 ejemplo 18 (Uccle, 6 julio): ET0 ≈ 3.9 mm/día
    v = E.et0_penman_monteith(np.array(21.5), np.array(12.3), np.array(68.0), np.array(2.078),
                              np.array(22.07), np.array(187), 50.8, 100)
    assert 3.6 < float(v) < 4.2


def test_lluvia_util_scs():
    assert abs(float(E.lluvia_util_mensual(100)) - 84) < 0.5
    assert abs(float(E.lluvia_util_mensual(300)) - 155) < 0.5


def test_kc_extremos():
    kc = E.curva_kc(CROPS["papa"])
    assert kc[0] == pytest.approx(0.5) and max(kc) == pytest.approx(1.15) and kc[-1] < 0.8


@pytest.mark.red
def test_clima_sierra(chimborazo):
    s, c = chimborazo
    r = c.resumen()
    assert 2500 < s.elev < 3500
    assert 2.0 < c.et0.mean() < 4.5
    assert 300 < r["lluvia_anual"] < 1500
    assert max(r["prob_helada"][5:9]) > 0  # jun-sep con algún riesgo


@pytest.mark.red
def test_banco_y_rotaciones(chimborazo):
    s, c = chimborazo
    b = E.banco_de_agua(c, CROPS["papa"], 6)
    assert b["total_falta_seco"] >= b["total_falta"] >= 0
    res = E.comparar_rotaciones(s, c, "papa", 10, actual=["papa", "papa", "descanso"])
    assert len(res) == 3 and res[0]["nombre"] == "Tu rotación"
    for e in res:
        assert set(e["tarjeta"]) >= {"porque", "evidencia", "beneficios", "vacios", "riesgos"}
    assert res[1]["puntaje"] > res[0]["puntaje"]


@pytest.mark.red
def test_fuera_de_sierra():
    with pytest.raises(E.FueraDeSierra):
        E.crear_sitio(-2.19, -79.89)  # Guayaquil, costa
