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

import numpy as np
from concurrent.futures import ThreadPoolExecutor

from app import charts, clients
from app import engine as E
from app.catalog import CASOS, CROPS, MESES, MESES_LARGO, ventana
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


MENU = [_boton("📋 Ver mi tierra", "tierra"), _boton("🌱 Qué sembrar", "sembrar"),
        _boton("💧 Cuánto regar", "regar_cultivo"), _boton("📚 Rotaciones probadas", "probadas")]
CALOR = 25        # °C: sobre esto los cultivos andinos sufren (papa, haba, quinua)
AGUACERO = 10     # mm en un día: lluvia fuerte para la malla de NASA POWER (que suaviza los picos)
RAIZ_M = 0.5      # profundidad de suelo que se cuenta para la humedad
KC_COBERTURA = 0.8  # tierra con pasto o rastrojo


def caracteristicas(sitio: E.Sitio, clima: E.Clima) -> dict:
    """Rasgos de la parcela con los 24 años de NASA POWER: calor, aguaceros, humedad del suelo y tendencias."""
    anios = [y for y in clima.anios if (clima.anio == y).sum() >= 360]   # solo años completos
    por_anio = lambda arr: np.array([arr[clima.anio == y].sum() for y in anios], dtype=float)  # noqa: E731
    calor = por_anio(clima.tmax >= CALOR)
    aguaceros = por_anio(clima.p >= AGUACERO)
    lluvia = por_anio(clima.p)
    tmedia = np.array([((clima.tmax + clima.tmin) / 2)[clima.anio == y].mean() for y in anios])
    mitad = len(anios) // 2   # década reciente contra la anterior: más fácil de explicar que una recta
    cambio_lluvia = (lluvia[-mitad:].mean() / lluvia[:mitad].mean() - 1) * 100
    cambio_temp = tmedia[-mitad:].mean() - tmedia[:mitad].mean()
    # Humedad del suelo: cubeta diaria (FAO-56) con pasto o rastrojo, sin riego; seco el suelo, evapora menos
    taw = clima.agua_util * RAIZ_M
    reserva, frac = 0.5 * taw, np.empty(len(clima.p))
    for d in range(len(clima.p)):
        ks = min(1.0, reserva / (0.5 * taw))
        reserva = min(taw, max(0.0, reserva + E.LLUVIA_EFECTIVA * clima.p[d] - KC_COBERTURA * ks * clima.et0[d]))
        frac[d] = reserva / taw
    humedad = [float(np.median(frac[clima.mes == m])) for m in range(1, 13)]
    return {"tmedia": float(tmedia.mean()), "calor": float(np.median(calor)), "aguaceros": float(np.median(aguaceros)),
            "cambio_lluvia": float(cambio_lluvia), "cambio_temp": float(cambio_temp), "humedad": humedad,
            "taw": taw, "periodo": f"{anios[0]}–{anios[-1]}",
            "decadas": f"{anios[-mitad]}–{anios[-1]} contra {anios[0]}–{anios[mitad - 1]}"}


# ---------------------------------------------------------------- pantallas
def inicio(st: dict) -> dict:
    return _respuesta([_png(charts.banner()),
                       *_decir("🌱 ¡Hola! Soy Pacha, su ayudante del campo en la sierra.\n"
                               "Le ayudo a conocer su tierra, a decidir qué sembrar después de la cosecha "
                               "y a saber cuánta agua necesita.\n"
                               "📍 Para empezar, mándeme dónde está su tierra.")],
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


def _signo(x: float, d: int = 0) -> str:
    return ("+" if x > 0 else "−" if x < 0 else "") + num(abs(x), d)


def tierra(st: dict) -> dict:
    """Ficha de la parcela: lo que dicen los satélites de su suelo, su clima y cómo ha cambiado."""
    lat, lon, radio = st["lat"], st["lon"], st.get("radio", 100)
    sitio, clima = sitio_y_clima(lat, lon)
    res, c = clima.resumen(), caracteristicas(sitio, clima)
    tipos, _ = clasificar_meses(res)
    area = decir_area(area_m2(radio))
    dz = desnivel(lat, lon, radio)
    pendiente = "sin dato de pendiente" if dz is None else (
        "terreno plano" if dz < 5 else "pendiente suave" if dz < 15 else "pendiente fuerte")
    suelo = sitio.suelo or {}
    textura = E.nombre_suelo(suelo.get("textura", "franco"))
    guarda = "guarda poca agua" if c["taw"] < 45 else "guarda bien el agua" if c["taw"] >= 70 else "guarda agua media"
    mo = f"Materia orgánica {num(suelo['mo'], 1)} %" if suelo.get("mo") else guarda.capitalize()
    falta = res["et0_anual"] - res["lluvia_anual"]
    secos = [i for i, h in enumerate(c["humedad"]) if h < 0.3]
    lluviosos = [i for i, t in enumerate(tipos) if t == "lluvia"]
    calor = f"{num(c['calor'])} días al año" if c["calor"] >= 1 else "casi nunca"
    tarjetas = [
        ("Altura y tamaño", f"{num(round(sitio.elev, -1))} m", f"{area} · {pendiente}", "#5d4037"),
        ("Suelo", textura.split(" (")[0].split(",")[0].capitalize(), mo, "#8d6e63"),
        ("Temperatura", f"{res['tmin']:.0f} a {res['tmax']:.0f} °C", f"Calor fuerte (>{CALOR} °C): {calor}",
         "#e65100"),
        ("Lluvia", f"{num(round(res['lluvia_anual'], -1))} mm", f"Año seco: {num(round(res['lluvia_seca'], -1))} mm · "
                                                                 f"{num(c['aguaceros'])} aguaceros al año", "#2b6cb0"),
        ("Se evapora", f"{num(round(res['et0_anual'], -1))} mm",
         "Más de lo que llueve" if falta > 0 else "Menos de lo que llueve", "#c62828" if falta > 0 else "#2e7d32"),
        ("Última década", f"Lluvia {_signo(c['cambio_lluvia'])} %",
         "Temperatura igual" if abs(c["cambio_temp"]) < 0.1 else f"Temperatura {_signo(c['cambio_temp'], 1)} °C",
         "#6a1b9a"),
    ]
    img = charts.ficha_tierra(tarjetas, c["humedad"], "Así es su tierra",
                              f"Datos de la NASA {c['periodo']} · suelo de SoilGrids")
    lineas = [f"📍 Su tierra: {area}, a {num(round(sitio.elev, -1))} m, {textura.split(' (')[0]}, que {guarda}.",
              f"🌡️ Entre {res['tmin']:.0f} y {res['tmax']:.0f} °C. 🌧️ {num(round(res['lluvia_anual'], -1))} mm de lluvia al año."]
    if secos:
        lineas.append(f"🏜️ Suelo seco {cuando(secos)}: ahí se riega.")
    if lluviosos and c["aguaceros"] >= 3:
        lineas.append(f"🌿 Téngala cubierta {cuando(lluviosos)}: los aguaceros lavan la tierra desnuda.")
    if abs(c["cambio_lluvia"]) >= 5:
        lineas.append(f"{'📉' if c['cambio_lluvia'] < 0 else '📈'} La última década llovió "
                      f"{num(abs(c['cambio_lluvia']))} % {'menos' if c['cambio_lluvia'] < 0 else 'más'} que la anterior.")
    return _respuesta([_png(img), *_decir("\n".join(lineas))],
                      [b for b in MENU if b["accion"] != "tierra"], {**st, "elev": sitio.elev})


def sembrar(st: dict) -> dict:
    sitio, clima = sitio_y_clima(st["lat"], st["lon"])
    mes = st.get("mes") or _mes_siguiente()
    todos_recs = E.recomendar_para_empezar(sitio, clima, mes, None, n=99)
    recs = [f for f in todos_recs if f["crop"].id != "descanso"
            and mes in (ventana(f["crop"].id, sitio.provincia) or {"meses": {mes}})["meses"]][:3]
    if not recs:
        conteo = {m: sum(1 for c in E.cultivos_aptos(sitio.elev)
                         if m in (ventana(c.id, sitio.provincia) or {}).get("meses", ())) for m in range(1, 13)}
        mejores = sorted(conteo, key=lambda m: -conteo[m])[:2]
        return _respuesta(_decir(f"📅 {MESES_LARGO[mes - 1].capitalize()} no es época de siembra aquí.\n"
                                 f"Mejor en {MESES_LARGO[mejores[0] - 1]} o {MESES_LARGO[mejores[1] - 1]}."),
                          [_boton(MESES_LARGO[m - 1].capitalize(), "sembrar", mes=m) for m in mejores]
                          + [_boton("📅 Otro mes", "meses")], {**st, "mes": mes})
    notas = []
    for f in recs:
        _, txt, color = VEREDICTO[f["banco"]["veredicto"]]
        notas.append([(txt, color), (f"Cosecha: {MESES_LARGO[f['banco']['mes_ids'][-1] - 1]}", "#555")])
    img = charts.tarjeta_cultivos([f["crop"] for f in recs], f"Para sembrar en {MESES_LARGO[mes - 1]}", False, notas)
    nombres = [f["crop"].nombre.lower() for f in recs]
    lista = nombres[0] if len(nombres) == 1 else f"{', '.join(nombres[:-1])} y {nombres[-1]}"
    texto = (f"🌱 Para {MESES_LARGO[mes - 1]}: {lista}.\n"
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
    v = ventana(crop.id, sitio.provincia)
    if v and mes not in v["meses"]:
        lineas.append(f"📅 Ojo: la época de siembra aquí es {v['texto']}.")
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
    """Casos de rotación medidos en el campo (hoja Rotaciones del Excel), empezando por la provincia del agricultor."""
    sitio, clima = sitio_y_clima(st["lat"], st["lon"])
    mes = int(st.get("mes") or _mes_siguiente())
    orden = sorted(CASOS, key=lambda c: c["provincia"] != sitio.provincia)
    i = int(st.get("i", 0)) % len(orden)
    caso = orden[i]
    ids = [c for c in caso["secuencia"] if c in CROPS]
    e = E.evaluar_rotacion(sitio, clima, ids, mes)
    agua = ("casi no hay que regar" if e["falta_anual"] < 30 else
            "hay que regar a veces" if e["falta_anual"] < 100 else "necesita riego")
    lineas = [f"📚 Probado en {caso['lugar']} ({caso['provincia']}):",
              " → ".join(CROPS[c].nombre.lower() for c in ids),
              f"✅ {caso['resultado']}",
              f"💧 En su tierra: {agua}."]
    vistos = [CROPS[c] for c in ids[:5]]
    img = charts.tarjeta_cultivos(vistos, f"{caso['lugar']} · {caso['periodo']}", True, _notas_rotacion(vistos, mes))
    botones = [_boton("➡️ Otro caso probado", "probadas", i=i + 1), _boton("🌱 Qué sembrar", "sembrar"),
               _boton("💧 Cuánto regar", "regar_cultivo")]
    return _respuesta([_png(img), *_decir("\n".join(lineas))], botones)


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
              "Cultivos aptos para su altura: " + ", ".join(c.nombre for c in E.cultivos_aptos(sitio.elev)) + ".",
              "Época de siembra en su zona (INIAP): " + "; ".join(
                  f"{c.nombre} {ventana(c.id, sitio.provincia)['texto']}" for c in E.cultivos_aptos(sitio.elev)
                  if ventana(c.id, sitio.provincia)) + ".",
              "Solo hablar de estos cultivos (los investigados por el equipo): "
              + ", ".join(c.nombre for c in CROPS.values() if c.id != "descanso") + "."]
    if st.get("crop"):
        crop, mes = CROPS[st["crop"]], int(st.get("mes") or _mes_siguiente())
        b, _, _ = E.analisis_cultivo(clima, crop, mes)
        hechos.append(f"Cultivo elegido {crop.nombre} sembrado en {MESES_LARGO[mes - 1]}: veredicto '{b['veredicto']}', "
                      f"bien en {b['n_bien']} de {b['anios']} años, riego del ciclo {b['total_falta']:.0f} mm, "
                      f"mes más crítico {b['mes_critico']}.")
    c = caracteristicas(sitio, clima)
    hechos.append(f"Días al año sobre {CALOR} °C: {c['calor']:.0f}; aguaceros (>{AGUACERO} mm/día) al año: "
                  f"{c['aguaceros']:.0f}; cambio {c['decadas']}: lluvia {c['cambio_lluvia']:+.0f} %, "
                  f"temperatura {c['cambio_temp']:+.1f} °C; suelo seco "
                  + (cuando([i for i, h in enumerate(c['humedad']) if h < 0.3]) or "ningún mes") + ".")
    hechos.append(f"Fuente: {clima.metodo}, años {res['anios']}.")
    return "\n".join(hechos)


ACCIONES = {"inicio": inicio, "chakra": chakra, "tierra": tierra, "sembrar": sembrar, "meses": meses, "todos": todos,
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
