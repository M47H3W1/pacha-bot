from app.engine import nombre_suelo


def test_nombres_locales_de_suelo():
    assert nombre_suelo("franco") == "tierra negra de chacra, ni suelta ni pegajosa (franco)"
    assert nombre_suelo("franco (supuesto)").startswith("tierra negra de chacra")
    assert nombre_suelo("arcilloso").startswith("chocoto")
    assert nombre_suelo("").endswith("(franco)")
    assert nombre_suelo("limoso") == "limoso"  # sin nombre local conocido: se deja el técnico
