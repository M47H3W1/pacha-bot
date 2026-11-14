"""Respuestas del chat web: cada acción devuelve imágenes y guiones de audio, nunca texto para leer.

El cliente guarda el estado (lugar, radio, cultivo, mes) y lo envía en cada llamada; el servidor no guarda nada.
Los números salen del motor de Pacha (NASA POWER corregido, FAO-56, balance de suelo del equipo).
"""
from __future__ import annotations

import base64
import datetime as dt
import logging
import math
from concurrent.futures import ThreadPoolExecutor

from app import charts, clients
from app import engine as E
from app.catalog import CROPS, MESES_LARGO, ROTACIONES_REF
from app.textos import DIAS, NUMEROS, clasificar_meses, cuando, num, plan_riego

log = logging.getLogger("pacha.web")
EFICIENCIA = 0.75          # manguera o aspersor: de cada 4 litros, 3 llegan a la raíz
CANCHA_M2 = 7000           # una cancha de fútbol ≈ 7.000 m²
_SITIOS: dict[str, E.Sitio] = {}
_CLIMAS: dict[str, E.Clima] = {}


# ---------------------------------------------------------------- utilidades
def _png(datos: bytes | None) -> dict | None:
    if not datos:
        return None
    return {"tipo": "imagen", "src": "data:image/png;base64," + base64.b64encode(datos).decode()}


def _audio(texto: str) -> dict:
    return {"tipo": "audio", "texto": texto}


def _boton(t: str, accion: str, **extra) -> dict:
    return {"t": t, "accion": accion, **extra}


def _respuesta(mensajes: list, botones: list | None = None, estado: dict | None = None) -> dict:
    return {"mensajes": [m for m in mensajes if m], "botones": botones or [], "estado": estado or {}}


def _clave(lat, lon) -> str:
    return f"{lat:.4f},{lon:.4f}"


def sitio_y_clima(lat: float, lon: float) -> tuple[E.Sitio, E.Clima]:
    """Pide en paralelo NASA POWER, ECMWF, SoilGrids y altura; luego arma sitio y clima (con memoria)."""
    k = _clave(lat, lon)
    if k not in _SITIOS:
        with ThreadPoolExecutor(4) as ex:
            tareas = [ex.submit(f, lat, lon) for f in
                      (clients.power_daily, clients.ifs_diario, clients.soil, clients.elevation)]
            for t in tareas:
                try:
                    t.result()
                except Exception as e:  # crear_sitio volverá a intentar y dará el error real
                    log.warning("descarga previa falló: %s", e)
        _SITIOS[k] = E.crear_sitio(lat, lon)
    if k not in _CLIMAS:
        _CLIMAS[k] = E.Clima(_SITIOS[k])
    return _SITIOS[k], _CLIMAS[k]


def area_m2(radio: float) -> float:
    return math.pi * radio ** 2


def decir_area(m2: float) -> str:
    ha = m2 / 10000
    if ha < 0.35:
        return f"unos {num(round(m2, -1 if m2 < 1000 else -2))} metros cuadrados"
    if ha < 0.75:
        return "media hectárea, como media cancha de fútbol"
    if ha < 1.25:
        return "una hectárea, como una cancha de fútbol y media"
    canchas = m2 / CANCHA_M2
    extra = f", como {num(canchas)} canchas de fútbol" if canchas >= 1.5 else ", como una cancha de fútbol"
    return f"unas {num(ha, 1) if ha < 10 else num(ha)} hectáreas{extra}"


def decir_litros(litros: float) -> str:
    """Litros contados como cosas: baldes de 20 L, tanques de 200 L o tanqueros de 10.000 L."""
    if litros < 30:
        return "menos de dos baldes"
    if litros < 1000:
        return f"unos {num(round(litros / 20))} baldes"
    if litros < 20000:
        return f"unos {num(round(litros / 200))} tanques de doscientos litros"
    return f"unos {num(round(litros / 10000))} tanqueros de diez mil litros"


def desnivel(lat: float, lon: float, radio: float) -> float | None:
    """Diferencia de altura dentro del círculo: centro y 8 puntos del borde."""
    pts = [(lat, lon)]
    for i in range(8):
        a = i * math.pi / 4
        pts.append((lat + radio * math.cos(a) / 111320, lon + radio * math.sin(a) / (111320 * math.cos(math.radians(lat)))))
    z = clients.elevaciones(pts)
    return (max(z) - min(z)) if z else None


def _mes_siguiente() -> int:
    return dt.date.today().month % 12 + 1


# ---------------------------------------------------------------- pantallas
def inicio(st: dict) -> dict:
    texto = ("Hola, soy Pacha. Le ayudo a cuidar su chakra con datos de satélites de la NASA. "
             "Para empezar, mándeme su terreno: toque el clip y elija ubicación. "
             "Puede marcarlo desde cualquier lugar, no hace falta estar en la parcela.")
    return _respuesta([_png(charts.banner()), _audio(texto)], [_boton("📍 Enviar mi terreno", "mapa")])


def chakra(st: dict) -> dict:
    lat, lon, radio = st["lat"], st["lon"], st.get("radio", 100)
    try:
        sitio, clima = sitio_y_clima(lat, lon)
    except E.FueraDeSierra:
        return _respuesta([_audio("Ese lugar no está en la sierra del Ecuador o está muy bajo. Por ahora solo "
                                  "conozco la sierra, sobre los mil quinientos metros. Mándeme otro terreno, por favor.")],
                          [_boton("📍 Enviar otro terreno", "mapa")])
    res = clima.resumen()
    tipos, heladas = clasificar_meses(res)
    lluvia = [i for i, t in enumerate(tipos) if t == "lluvia"]
    seco = [i for i, t in enumerate(tipos) if t == "seco"]
    m2 = area_m2(radio)
    partes = [f"Recibí su terreno de {decir_area(m2)}, a {num(round(sitio.elev, -1))} metros de altura."]
    dz = desnivel(lat, lon, radio)
    if dz is not None and dz >= 15:
        partes.append(f"De un lado a otro sube unos {num(round(dz))} metros: siembre en curvas de nivel "
                      "para que el agua no se lleve la tierra.")
    if lluvia:
        partes.append(f"Llueve más {cuando(lluvia)}.")
    if seco:
        partes.append(f"Es seco {cuando(seco)}; esos meses hay que regar.")
    partes.append(f"Cuidado con las heladas {cuando(heladas)}." if heladas else "Casi no caen heladas.")
    tex = (sitio.suelo or {}).get("textura", "")
    if "supuesto" not in tex:
        partes.append("Su tierra es suelta, el agua se va rápido." if "arenoso" in tex else
                      "Su tierra es pesada, guarda el agua." if "arcill" in tex else "Su tierra guarda bien el agua.")
    partes.append("¿Qué quiere saber?")
    img = charts.tira_meses(tipos, heladas, "Su año en la chakra")
    st = {**st, "elev": sitio.elev}
    return _respuesta([_png(img), _audio(" ".join(partes))], MENU, st)


MENU = [_boton("🌱 Qué sembrar", "sembrar"), _boton("💧 Cuánto regar", "regar_cultivo"),
        _boton("❄️ ¿Viene helada?", "helada"), _boton("📚 Rotaciones probadas", "probadas")]


def sembrar(st: dict) -> dict:
    sitio, clima = sitio_y_clima(st["lat"], st["lon"])
    mes = st.get("mes") or _mes_siguiente()
    recs = E.recomendar_para_empezar(sitio, clima, mes, None)
    img = charts.tarjeta_cultivos([f["crop"] for f in recs], f"Para sembrar en {MESES_LARGO[mes - 1]}", False)
    frases = []
    for i, f in enumerate(recs):
        c = f["crop"]
        agua = {"si": "la lluvia alcanza", "cuidado": "a veces hay que regar", "no": "necesita riego"}[f["banco"]["veredicto"]]
        porque = "y alimenta la tierra" if c.fija_n else "y pide poca agua" if f["comp"]["agua"] > 0.6 else ""
        frases.append(f"{['Primero', 'Segundo', 'Tercero'][i]}, {c.nombre.lower()}: {agua} {porque}".strip())
    texto = (f"Para sembrar en {MESES_LARGO[mes - 1]} le conviene: " + ". ".join(frases) +
             ". Toque el que quiere sembrar y le digo si es buen momento.")
    botones = [_boton(f"{f['crop'].emoji} {f['crop'].nombre}", "decision", crop=f["crop"].id, mes=mes) for f in recs]
    botones += [_boton("📅 Otro mes", "meses"), _boton("📋 Otros cultivos", "todos", mes=mes)]
    return _respuesta([_png(img), _audio(texto)], botones, {**st, "mes": mes})


def meses(st: dict) -> dict:
    hoy = dt.date.today().month
    botones = [_boton(MESES_LARGO[(hoy - 1 + i) % 12].capitalize(), "sembrar", mes=(hoy - 1 + i) % 12 + 1)
               for i in range(12)]
    return _respuesta([_audio("¿En qué mes quiere sembrar? Elija en la lista.")], botones)


def todos(st: dict) -> dict:
    sitio, _ = sitio_y_clima(st["lat"], st["lon"])
    aptos = E.cultivos_aptos(sitio.elev)
    mes = st.get("mes") or _mes_siguiente()
    img = charts.galeria(aptos, "Cultivos para su altura")
    botones = [_boton(f"{c.emoji} {c.nombre}", "decision", crop=c.id, mes=mes) for c in aptos]
    return _respuesta([_png(img), _audio("Estos cultivos se dan a su altura. Elija uno en la lista.")], botones)


def decision(st: dict) -> dict:
    sitio, clima = sitio_y_clima(st["lat"], st["lon"])
    crop, mes = CROPS[st["crop"]], int(st.get("mes") or _mes_siguiente())
    b, _, riesgo = E.analisis_cultivo(clima, crop, mes)
    nombre, mes_l = crop.nombre.lower(), MESES_LARGO[mes - 1]
    veces = round(10 * b["n_bien"] / b["anios"])
    if b["veredicto"] == "si":
        partes = [f"Sí, es buen momento para sembrar {nombre} en {mes_l}. En {veces} de cada 10 años la lluvia alcanzó."]
    elif b["veredicto"] == "cuidado":
        partes = [f"Sí puede sembrar {nombre} en {mes_l}, pero tenga agua para regar en {b['mes_critico']}. "
                  f"En {veces} de cada 10 años la lluvia alcanzó."]
    else:
        partes = [f"Mejor no siembre {nombre} en {mes_l} sin riego. Solo en {veces} de cada 10 años la lluvia alcanzó."]
    m2 = area_m2(st.get("radio", 100))
    if b["total_falta"] >= 5 and crop.id != "descanso":
        litros = b["total_falta"] / EFICIENCIA * m2
        partes.append(f"Para todo su terreno, en el ciclo necesitará regar {decir_litros(litros)}.")
    if riesgo:
        partes.append(f"Ojo con las heladas en {', '.join(MESES_LARGO[E.MESES.index(m)] for m in riesgo[:2])}.")
    partes.append(f"Cosecha más o menos en {MESES_LARGO[b['mes_ids'][-1] - 1]}.")
    img = charts.semaforo(crop, b["meses"], b["estado_mes"], f"Su {nombre} mes a mes")
    botones = [_boton("🔁 Qué sembrar después", "rotacion", crop=crop.id, mes=mes, i=0),
               _boton("💧 Cuánto regar", "regar_hace", crop=crop.id), _boton("🌱 Otro cultivo", "sembrar")]
    return _respuesta([_png(img), _audio(" ".join(partes))], botones, {**st, "crop": crop.id, "mes": mes})


def rotacion(st: dict) -> dict:
    sitio, clima = sitio_y_clima(st["lat"], st["lon"])
    res = E.comparar_rotaciones(sitio, clima, st["crop"], int(st["mes"]))
    res.sort(key=lambda e: -e["puntaje"])
    i = int(st.get("i", 0)) % len(res)
    e = res[i]
    partes = ["Le conviene sembrar así: " + ", después, ".join(c.nombre.lower() for c in e["crops"]) + "."]
    if e["leguminosas"]:
        partes.append(f"Sembrar {e['leguminosas'][0].nombre.lower()} alimenta la tierra.")
    if e["repetidas"] == 0:
        partes.append("Cambiar de planta corta las plagas.")
    if e["comp"]["agua"] > 0.6:
        partes.append("Pide poca agua.")
    for c, m in e["riesgos"][:1]:
        partes.append(f"Cuidado con la helada en {MESES_LARGO[E.MESES.index(m)]} para {c.nombre.lower()}.")
    img = charts.tarjeta_cultivos(e["crops"], "Así le conviene sembrar")
    botones = [_boton("🔄 Otra opción", "rotacion", crop=st["crop"], mes=st["mes"], i=i + 1),
               _boton("📚 Rotaciones probadas", "probadas"), _boton("💧 Cuánto regar", "regar_hace", crop=st["crop"])]
    return _respuesta([_png(img), _audio(" ".join(partes))], botones)


def probadas(st: dict) -> dict:
    sitio, clima = sitio_y_clima(st["lat"], st["lon"])
    mes = int(st.get("mes") or _mes_siguiente())
    evals = {rid: E.evaluar_rotacion(sitio, clima, [i for i in ref["secuencia"] if i in CROPS], mes)
             for rid, ref in ROTACIONES_REF.items()}

    def agua(e):
        return "el agua de lluvia casi alcanza" if e["falta_anual"] < 30 else \
            "hay que regar a veces" if e["falta_anual"] < 100 else "necesita riego"

    partes = ["Estas rotaciones se probaron en la sierra con el INIAP."]
    for rid in ("R1", "R2"):
        ref, e = ROTACIONES_REF[rid], evals[rid]
        partes.append(f"{ref['titulo']}: " + ", ".join(c.nombre.lower() for c in e["crops"]) + f". En su terreno {agua(e)}.")
    partes.append("Sembrar papa tras papa con descanso cansa la tierra.")
    mejor = min(("R1", "R2"), key=lambda r: evals[r]["falta_anual"])
    img = charts.tarjeta_cultivos(evals[mejor]["crops"], ROTACIONES_REF[mejor]["titulo"])
    return _respuesta([_png(img), _audio(" ".join(partes))], MENU)


def regar_cultivo(st: dict) -> dict:
    sitio, _ = sitio_y_clima(st["lat"], st["lon"])
    aptos = E.cultivos_aptos(sitio.elev)
    img = charts.galeria(aptos, "¿Qué tiene sembrado?")
    return _respuesta([_png(img), _audio("¿Qué tiene sembrado? Elija en la lista.")],
                      [_boton(f"{c.emoji} {c.nombre}", "regar_hace", crop=c.id) for c in aptos])


def regar_hace(st: dict) -> dict:
    crop = CROPS[st["crop"]]
    opciones = [("🌱 Recién", 7), ("1 mes", 30), ("2 meses", 60), ("3 meses", 90), ("5 meses", 150)]
    return _respuesta([_audio(f"¿Hace cuánto sembró su {crop.nombre.lower()}?")],
                      [_boton(t, "regar", crop=crop.id, dias=d) for t, d in opciones])


def regar(st: dict) -> dict:
    sitio, _ = sitio_y_clima(st["lat"], st["lon"])
    crop = CROPS[st["crop"]]
    siembra = dt.date.today() - dt.timedelta(days=int(st.get("dias", 30)))
    w = E.riego_semana(sitio, crop, siembra)
    p = plan_riego(w, EFICIENCIA, (sitio.suelo or {}).get("textura", ""))
    nombre = crop.nombre.lower()
    m2 = area_m2(st.get("radio", 100))
    if p["veces"] == 0:
        partes = [f"Esta semana su {nombre} no necesita riego. La lluvia alcanza."]
    else:
        dias = " y el ".join(DIAS[d.weekday()] for d in p["dias"])
        litros_vez = w["falta"] / EFICIENCIA / p["veces"] * m2
        partes = [f"Esta semana riegue su {nombre} {NUMEROS[p['veces']]}: el {dias}.",
                  f"Cada vez, para todo el terreno, son {decir_litros(litros_vez)}.",
                  "Antes de regar, meta el dedo en la tierra. Si está húmeda, espere un día."]
    if p["heladas"]:
        partes.append(f"El {DIAS[p['heladas'][0].weekday()]} puede caer helada: riegue un poco la tarde anterior.")
    img = charts.tira_semana(p["tira"], "Su semana")
    return _respuesta([_png(img), _audio(" ".join(partes))], MENU)


def helada(st: dict) -> dict:
    f = clients.forecast_week(st["lat"], st["lon"])
    tira, dias_helada = [], []
    for d, t, ll in zip(f["fecha"], f["tmin"], f["lluvia"]):
        fecha = dt.date.fromisoformat(d)
        h = t is not None and t <= E.FROST_T
        if h:
            dias_helada.append(fecha)
        tira.append({"fecha": fecha, "regar": False, "helada": h, "lluvia": ll or 0})
    if dias_helada:
        nombres = " y el ".join(DIAS[d.weekday()] for d in dias_helada[:3])
        texto = (f"Puede caer helada el {nombres}, en la madrugada. Riegue un poco la tarde anterior, "
                 "la tierra húmeda guarda calor. Y tape las plantas pequeñas.")
    else:
        texto = "Esta semana no viene helada. Puede estar tranquilo."
    return _respuesta([_png(charts.tira_semana(tira, "Heladas esta semana")), _audio(texto)], MENU)


def contexto(st: dict) -> str:
    """Hechos del terreno para que el modelo de lenguaje responda sin inventar números."""
    if "lat" not in st:
        return "El agricultor todavía no envió su terreno."
    try:
        sitio, clima = sitio_y_clima(st["lat"], st["lon"])
    except E.FueraDeSierra:
        return "El terreno enviado no está en la sierra del Ecuador."
    res = clima.resumen()
    tipos, heladas = clasificar_meses(res)
    hechos = [f"Altura {sitio.elev:.0f} m, provincia cercana {sitio.provincia}, suelo {sitio.suelo.get('textura')}.",
              f"Área del terreno {area_m2(st.get('radio', 100)):.0f} m².",
              f"Lluvia anual típica {res['lluvia_anual']:.0f} mm; año seco {res['lluvia_seca']:.0f} mm; "
              f"evapotranspiración anual {res['et0_anual']:.0f} mm.",
              "Meses lluviosos: " + (cuando([i for i, t in enumerate(tipos) if t == 'lluvia']) or "ninguno") + ".",
              "Meses secos: " + (cuando([i for i, t in enumerate(tipos) if t == 'seco']) or "ninguno") + ".",
              "Heladas probables " + (cuando(heladas) or "casi nunca") + ".",
              "Cultivos aptos para su altura: " + ", ".join(c.nombre for c in E.cultivos_aptos(sitio.elev)) + "."]
    if st.get("crop"):
        crop, mes = CROPS[st["crop"]], int(st.get("mes") or _mes_siguiente())
        b, _, _ = E.analisis_cultivo(clima, crop, mes)
        hechos.append(f"Cultivo elegido {crop.nombre} sembrado en {MESES_LARGO[mes - 1]}: veredicto '{b['veredicto']}', "
                      f"bien en {b['n_bien']} de {b['anios']} años, riego del ciclo {b['total_falta']:.0f} mm, "
                      f"mes más crítico {b['mes_critico']}.")
    hechos.append(f"Fuente: {clima.metodo}, años {res['anios']}.")
    return "\n".join(hechos)


ACCIONES = {"inicio": inicio, "chakra": chakra, "sembrar": sembrar, "meses": meses, "todos": todos,
            "decision": decision, "rotacion": rotacion, "probadas": probadas, "regar_cultivo": regar_cultivo,
            "regar_hace": regar_hace, "regar": regar, "helada": helada}
NECESITAN_LUGAR = set(ACCIONES) - {"inicio", "meses", "regar_hace"}


def ejecutar(accion: str, st: dict) -> dict:
    if accion not in ACCIONES:
        return _respuesta([_audio("No entendí. Use los botones, por favor.")], MENU)
    if accion in NECESITAN_LUGAR and "lat" not in st:
        return _respuesta([_audio("Primero mándeme su terreno: toque el clip y elija ubicación.")],
                          [_boton("📍 Enviar mi terreno", "mapa")])
    try:
        return ACCIONES[accion](st)
    except Exception:
        log.exception("acción %s", accion)
        return _respuesta([_audio("Perdón, no pude traer los datos ahora. Intente otra vez en un momento.")], MENU)
