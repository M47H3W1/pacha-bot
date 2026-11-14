"""Respuestas del chat web: cada acción devuelve una imagen, un texto corto y el mismo texto en audio.

El cliente guarda el estado (lugar, radio, cultivo, mes) y lo envía en cada llamada; el servidor no guarda nada.
Los números salen del motor de Pacha (NASA POWER corregido, FAO-56, balance de suelo del equipo).
Regla de estilo: mensajes de 1 a 3 líneas cortas, "usted", cantidades que se pueden contar.
"""
from __future__ import annotations

import base64
import datetime as dt
import logging
import math
from concurrent.futures import ThreadPoolExecutor

from app import charts, clients
from app import engine as E
from app.catalog import CROPS, MESES, MESES_LARGO, ROTACIONES_REF
from app.textos import DIAS, NUMEROS, clasificar_meses, cuando, num, plan_riego

log = logging.getLogger("pacha.web")
EFICIENCIA = 0.75          # manguera o aspersor: de cada 4 litros, 3 llegan a la raíz
_SITIOS: dict[str, E.Sitio] = {}
_CLIMAS: dict[str, E.Clima] = {}
VEREDICTO = {"si": ("✅", "Lluvia alcanza", "#2e7d32"), "cuidado": ("⚠️", "Regar a veces", "#e65100"),
             "no": ("❌", "Necesita riego", "#c62828")}


# ---------------------------------------------------------------- utilidades
def _png(datos: bytes | None) -> dict | None:
    if not datos:
        return None
    return {"tipo": "imagen", "src": "data:image/png;base64," + base64.b64encode(datos).decode()}


def _decir(texto: str) -> list[dict]:
    """El mismo mensaje como texto y como nota de voz."""
    return [{"tipo": "texto", "texto": texto}, {"tipo": "audio", "texto": texto}]


def _boton(t: str, accion: str, **extra) -> dict:
    return {"t": t, "accion": accion, **extra}


def _respuesta(mensajes: list, botones: list | None = None, estado: dict | None = None) -> dict:
    return {"mensajes": [m for m in mensajes if m], "botones": botones or [], "estado": estado or {}}


def sitio_y_clima(lat: float, lon: float) -> tuple[E.Sitio, E.Clima]:
    """Pide en paralelo NASA POWER, ECMWF, SoilGrids y altura; luego arma sitio y clima (con memoria)."""
    k = f"{lat:.4f},{lon:.4f}"
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
    if ha < 1:
        return f"{num(round(m2, -1 if m2 < 1000 else -2))} m²"
    return f"{num(ha, 1)} hectáreas" if ha < 10 else f"{num(ha)} hectáreas"


def agua_corta(litros: float) -> str:
    """Litros contados como cosas: baldes de 20 L, tanques de 200 L o tanqueros de 10.000 L. "" si casi nada."""
    if litros < 30:
        return ""
    if litros < 1000:
        return f"{num(round(litros / 20))} baldes"
    if litros < 20000:
        return f"{num(round(litros / 200))} tanques"
    return f"{num(round(litros / 10000))} tanqueros"


def agua_larga(litros: float) -> str:
    corta = agua_corta(litros)
    if not corta:
        return "menos de dos baldes"
    unidad = corta.split()[-1]
    return corta + {"baldes": " de 20 litros", "tanques": " de 200 litros"}.get(unidad, " de 10.000 litros")


def desnivel(lat: float, lon: float, radio: float) -> float | None:
    """Diferencia de altura dentro del círculo: centro y 8 puntos del borde."""
    pts = [(lat, lon)]
    for i in range(8):
        a = i * math.pi / 4
        pts.append((lat + radio * math.cos(a) / 111320,
                    lon + radio * math.sin(a) / (111320 * math.cos(math.radians(lat)))))
    z = clients.elevaciones(pts)
    return (max(z) - min(z)) if z else None


def _mes_siguiente() -> int:
    return dt.date.today().month % 12 + 1


def _meses_cultivo(c, mes: int) -> str:
    fin = (mes - 1 + E._meses_ciclo(c) - 1) % 12 + 1
    return f"{MESES[mes - 1].capitalize()} a {MESES[fin - 1]}"


def _notas_rotacion(crops: list, mes: int) -> list:
    notas = []
    for c in crops:
        notas.append([(_meses_cultivo(c, mes), "#3d2b1f")])
        mes = (mes - 1 + E._meses_ciclo(c)) % 12 + 1
    return notas


MENU = [_boton("🌱 Qué sembrar", "sembrar"), _boton("💧 Cuánto regar", "regar_cultivo"),
        _boton("📚 Rotaciones probadas", "probadas")]


# ---------------------------------------------------------------- pantallas
def inicio(st: dict) -> dict:
    return _respuesta([_png(charts.banner()),
                       *_decir("Hola, soy Pacha 🌱\nMándeme su tierra: toque 📎 y luego Ubicación.")],
                      [_boton("📍 Enviar mi tierra", "mapa")])


def chakra(st: dict) -> dict:
    lat, lon, radio = st["lat"], st["lon"], st.get("radio", 100)
    try:
        sitio, clima = sitio_y_clima(lat, lon)
    except E.FueraDeSierra:
        return _respuesta(_decir("Ese lugar no es de la sierra. Mándeme una tierra sobre los 1.500 metros."),
                          [_boton("📍 Enviar otra tierra", "mapa")])
    res = clima.resumen()
    tipos, _ = clasificar_meses(res)
    lluvia = [i for i, t in enumerate(tipos) if t == "lluvia"]
    seco = [i for i, t in enumerate(tipos) if t == "seco"]
    area = decir_area(area_m2(radio))
    lineas = [f"📍 Su tierra: {area}, a {num(round(sitio.elev, -1))} metros."]
    if lluvia:
        lineas.append(f"🌧️ Llueve {cuando(lluvia)}.")
    if seco:
        lineas.append(f"☀️ Seco {cuando(seco)}: hay que regar.")
    dz = desnivel(lat, lon, radio)
    if dz is not None and dz >= 15:
        lineas.append("⛰️ Tiene pendiente: siembre en curvas.")
    img = charts.anio_tierra(tipos, res["lluvia_mes"], "Su tierra en el año",
                             f"{area} · {num(round(sitio.elev, -1))} m · lluvia de un año normal")
    return _respuesta([_png(img), *_decir("\n".join(lineas))], MENU, {**st, "elev": sitio.elev})


def sembrar(st: dict) -> dict:
    sitio, clima = sitio_y_clima(st["lat"], st["lon"])
    mes = st.get("mes") or _mes_siguiente()
    recs = E.recomendar_para_empezar(sitio, clima, mes, None)
    notas = []
    for f in recs:
        _, txt, color = VEREDICTO[f["banco"]["veredicto"]]
        notas.append([(txt, color), (f"Cosecha: {MESES_LARGO[f['banco']['mes_ids'][-1] - 1]}", "#555")])
    img = charts.tarjeta_cultivos([f["crop"] for f in recs], f"Para sembrar en {MESES_LARGO[mes - 1]}", False, notas)
    nombres = [f["crop"].nombre.lower() for f in recs]
    texto = (f"🌱 Para {MESES_LARGO[mes - 1]}: {', '.join(nombres[:-1])} y {nombres[-1]}.\n"
             "Toque uno para saber si es buen momento.")
    botones = [_boton(f"{f['crop'].emoji} {f['crop'].nombre}", "decision", crop=f["crop"].id, mes=mes) for f in recs]
    botones += [_boton("📅 Otro mes", "meses"), _boton("📋 Otros cultivos", "todos", mes=mes)]
    return _respuesta([_png(img), *_decir(texto)], botones, {**st, "mes": mes})


def meses(st: dict) -> dict:
    hoy = dt.date.today().month
    botones = [_boton(MESES_LARGO[(hoy - 1 + i) % 12].capitalize(), "sembrar", mes=(hoy - 1 + i) % 12 + 1)
               for i in range(12)]
    return _respuesta(_decir("📅 ¿En qué mes quiere sembrar?"), botones)


def todos(st: dict) -> dict:
    sitio, _ = sitio_y_clima(st["lat"], st["lon"])
    aptos = E.cultivos_aptos(sitio.elev)
    mes = st.get("mes") or _mes_siguiente()
    img = charts.galeria(aptos, "Cultivos para su altura")
    botones = [_boton(f"{c.emoji} {c.nombre}", "decision", crop=c.id, mes=mes) for c in aptos]
    return _respuesta([_png(img), *_decir("Estos se dan a su altura. Toque uno.")], botones)


def decision(st: dict) -> dict:
    sitio, clima = sitio_y_clima(st["lat"], st["lon"])
    crop, mes = CROPS[st["crop"]], int(st.get("mes") or _mes_siguiente())
    b, _, _ = E.analisis_cultivo(clima, crop, mes)
    nombre, mes_l = crop.nombre.lower(), MESES_LARGO[mes - 1]
    cosecha = MESES_LARGO[b["mes_ids"][-1] - 1]
    if b["veredicto"] == "si":
        lineas = [f"✅ Buen momento para sembrar {nombre} en {mes_l}."]
    elif b["veredicto"] == "cuidado":
        lineas = [f"⚠️ Puede sembrar {nombre} en {mes_l}, pero riegue en {b['mes_critico']}."]
    else:
        lineas = [f"❌ Sin riego, mejor no siembre {nombre} en {mes_l}."]
    lineas.append(f"🌾 Cosecha en {cosecha}.")
    m2 = area_m2(st.get("radio", 100))
    if b["total_falta"] >= 5:
        lineas.append(f"💧 Agua para todo el ciclo: {agua_larga(b['total_falta'] / EFICIENCIA * m2)}.")
    riego = [agua_corta(f / EFICIENCIA * m2) for f in b["falta"]]
    img = charts.semaforo(crop, b["meses"], b["estado_mes"], f"Su {nombre} mes a mes", riego)
    botones = [_boton("🔁 Qué sembrar después", "rotacion", crop=crop.id, mes=mes, i=0),
               _boton("💧 Cuánto regar", "regar_hace", crop=crop.id), _boton("🌱 Otro cultivo", "sembrar")]
    return _respuesta([_png(img), *_decir("\n".join(lineas))], botones, {**st, "crop": crop.id, "mes": mes})


def rotacion(st: dict) -> dict:
    sitio, clima = sitio_y_clima(st["lat"], st["lon"])
    mes = int(st["mes"])
    res = E.comparar_rotaciones(sitio, clima, st["crop"], mes)
    res.sort(key=lambda e: -e["puntaje"])
    i = int(st.get("i", 0)) % len(res)
    e = res[i]
    lineas = ["🔁 Siembre así: " + " → ".join(c.nombre.lower() for c in e["crops"]) + "."]
    if e["leguminosas"]:
        lineas.append(f"✅ {e['leguminosas'][0].nombre} alimenta la tierra.")
    elif e["repetidas"] == 0:
        lineas.append("✅ Cambiar de planta corta las plagas.")
    img = charts.tarjeta_cultivos(e["crops"], "Así le conviene sembrar", True, _notas_rotacion(e["crops"], mes))
    botones = [_boton("🔄 Otra opción", "rotacion", crop=st["crop"], mes=mes, i=i + 1),
               _boton("📚 Rotaciones probadas", "probadas"), _boton("💧 Cuánto regar", "regar_hace", crop=st["crop"])]
    return _respuesta([_png(img), *_decir("\n".join(lineas))], botones)


def probadas(st: dict) -> dict:
    sitio, clima = sitio_y_clima(st["lat"], st["lon"])
    mes = int(st.get("mes") or _mes_siguiente())
    evals = {rid: E.evaluar_rotacion(sitio, clima, [i for i in ref["secuencia"] if i in CROPS], mes)
             for rid, ref in ROTACIONES_REF.items()}
    lineas = ["📚 Probadas en la sierra (INIAP):"]
    for rid in ("R1", "R2"):
        ref, e = ROTACIONES_REF[rid], evals[rid]
        lineas.append(f"• {ref['titulo']}: " + " → ".join(c.nombre.lower() for c in e["crops"]))
    mejor = min(("R1", "R2"), key=lambda r: evals[r]["falta_anual"])
    lineas.append(f"💧 En su tierra pide menos agua: {ROTACIONES_REF[mejor]['titulo']}.")
    crops = evals[mejor]["crops"]
    img = charts.tarjeta_cultivos(crops, ROTACIONES_REF[mejor]["titulo"], True, _notas_rotacion(crops, mes))
    return _respuesta([_png(img), *_decir("\n".join(lineas))], MENU)


def regar_cultivo(st: dict) -> dict:
    sitio, _ = sitio_y_clima(st["lat"], st["lon"])
    aptos = E.cultivos_aptos(sitio.elev)
    img = charts.galeria(aptos, "¿Qué tiene sembrado?")
    return _respuesta([_png(img), *_decir("💧 ¿Qué tiene sembrado?")],
                      [_boton(f"{c.emoji} {c.nombre}", "regar_hace", crop=c.id) for c in aptos])


def regar_hace(st: dict) -> dict:
    crop = CROPS[st["crop"]]
    opciones = [("🌱 Recién", 7), ("1 mes", 30), ("2 meses", 60), ("3 meses", 90), ("5 meses", 150)]
    return _respuesta(_decir(f"¿Hace cuánto sembró su {crop.nombre.lower()}?"),
                      [_boton(t, "regar", crop=crop.id, dias=d) for t, d in opciones])


def regar(st: dict) -> dict:
    sitio, _ = sitio_y_clima(st["lat"], st["lon"])
    crop = CROPS[st["crop"]]
    siembra = dt.date.today() - dt.timedelta(days=int(st.get("dias", 30)))
    w = E.riego_semana(sitio, crop, siembra)
    p = plan_riego(w, EFICIENCIA, (sitio.suelo or {}).get("textura", ""))
    m2 = area_m2(st.get("radio", 100))
    nota = ""
    if p["veces"] == 0:
        texto = "🌧️ Esta semana no riegue: la lluvia alcanza."
    else:
        dias = " y ".join(DIAS[d.weekday()] for d in p["dias"])
        litros = w["falta"] / EFICIENCIA / p["veces"] * m2
        nota = agua_corta(litros)
        texto = f"💧 Esta semana riegue {NUMEROS[p['veces']]}: {dias}.\nCada vez: {agua_larga(litros)}."
    img = charts.tira_semana(p["tira"], f"Su {crop.nombre.lower()} esta semana", nota)
    return _respuesta([_png(img), *_decir(texto)], MENU)


def contexto(st: dict) -> str:
    """Hechos del terreno para que el modelo de lenguaje responda sin inventar números."""
    if "lat" not in st:
        return "El agricultor todavía no envió su tierra."
    try:
        sitio, clima = sitio_y_clima(st["lat"], st["lon"])
    except E.FueraDeSierra:
        return "La tierra enviada no está en la sierra del Ecuador."
    res = clima.resumen()
    tipos, _ = clasificar_meses(res)
    hechos = [f"Altura {sitio.elev:.0f} m, provincia cercana {sitio.provincia}, suelo {sitio.suelo.get('textura')}.",
              f"Área de la tierra {area_m2(st.get('radio', 100)):.0f} m².",
              f"Lluvia anual típica {res['lluvia_anual']:.0f} mm; año seco {res['lluvia_seca']:.0f} mm; "
              f"evapotranspiración anual {res['et0_anual']:.0f} mm.",
              "Meses lluviosos: " + (cuando([i for i, t in enumerate(tipos) if t == 'lluvia']) or "ninguno") + ".",
              "Meses secos: " + (cuando([i for i, t in enumerate(tipos) if t == 'seco']) or "ninguno") + ".",
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
            "regar_hace": regar_hace, "regar": regar}
NECESITAN_LUGAR = set(ACCIONES) - {"inicio", "meses", "regar_hace"}


def ejecutar(accion: str, st: dict) -> dict:
    if accion not in ACCIONES:
        return _respuesta(_decir("No entendí. Use los botones."), MENU)
    if accion in NECESITAN_LUGAR and "lat" not in st:
        return _respuesta(_decir("Primero mándeme su tierra: toque 📎 y luego Ubicación."),
                          [_boton("📍 Enviar mi tierra", "mapa")])
    try:
        return ACCIONES[accion](st)
    except Exception:
        log.exception("acción %s", accion)
        return _respuesta(_decir("Perdón, no pude traer los datos. Intente otra vez."), MENU)
