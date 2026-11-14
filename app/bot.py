"""Pacha_EC_Bot: menú interactivo para agricultores de la sierra ecuatoriana."""
import asyncio
import datetime as dt
import html
import logging
import os
import re
from pathlib import Path

from telegram import (BotCommand, InlineKeyboardButton, InlineKeyboardMarkup, KeyboardButton,
                      ReplyKeyboardMarkup, ReplyKeyboardRemove, Update)
from telegram.constants import ChatAction, ParseMode
from telegram.error import BadRequest
from telegram.ext import (Application, CallbackQueryHandler, CommandHandler, ContextTypes,
                          MessageHandler, filters)

from . import charts, clients
from . import engine as E
from .catalog import AVISO, CROPS, GLOSARIO, MESES, MESES_LARGO, PROVINCIAS, RIEGO
from .llm import Gemini
from .storage import crear_storage

log = logging.getLogger("pacha")
STORE = None
LLM = None
_SITIOS: dict = {}
_CLIMAS: dict = {}
HTML = ParseMode.HTML
MENU = ("🏠 Menú", "m")
PRIORIDADES = {"agua": "💧 Ahorrar agua", "suelo": "🟫 Cuidar el suelo", "helada": "❄️ Evitar heladas",
               "ingreso": "💰 Ganar más"}
DIAS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"]


# ---------------------------------------------------------------- utilidades
def KB(rows):
    return InlineKeyboardMarkup([[InlineKeyboardButton(t, callback_data=d) for t, d in row] for row in rows])


def esc(x) -> str:
    return html.escape(str(x))


def num(x: float, d: int = 0) -> str:
    s = f"{x:,.{d}f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


def filas(items, n=2):
    return [items[i:i + n] for i in range(0, len(items), n)]


async def estado(update: Update, ctx) -> dict:
    if "st" not in ctx.user_data:
        st = await asyncio.to_thread(STORE.get_state, update.effective_user.id)
        ctx.user_data["st"] = st or {}
    return ctx.user_data["st"]


async def guardar(update: Update, ctx):
    u = update.effective_user
    try:
        await asyncio.to_thread(STORE.upsert_farmer, u.id, u.first_name, ctx.user_data.get("st", {}))
    except Exception as e:
        log.warning("No se pudo guardar el estado: %s", e)


async def historial(update: Update, kind: str, resumen: str, payload=None):
    try:
        await asyncio.to_thread(STORE.add_history, update.effective_user.id, kind, resumen, payload)
    except Exception as e:
        log.warning("No se pudo guardar historial: %s", e)


def sitio_de(st) -> E.Sitio | None:
    p = st.get("parcel")
    if not p:
        return None
    clave = (p["lat"], p["lon"])
    if clave not in _SITIOS:
        _SITIOS[clave] = E.Sitio(p["lat"], p["lon"], p["elev"], p["grid_elev"], p["provincia"], p.get("suelo", {}))
    return _SITIOS[clave]


def clima_de(sitio: E.Sitio, dP=0.0, dT=0.0) -> E.Clima:
    clave = (sitio.lat, sitio.lon, dP, dT)
    if clave not in _CLIMAS:
        _CLIMAS[clave] = E.Clima(sitio, dP, dT)
    return _CLIMAS[clave]


async def mostrar(update: Update, texto: str, kb=None, foto: bytes | None = None):
    """Edita el mensaje del botón si se puede; si no, envía uno nuevo. Las fotos van como mensaje nuevo."""
    chat, q = update.effective_chat, update.callback_query
    if foto:
        if len(texto) <= 1000:
            await chat.send_photo(photo=foto, caption=texto, parse_mode=HTML, reply_markup=kb)
        else:
            await chat.send_photo(photo=foto)
            await chat.send_message(texto, parse_mode=HTML, reply_markup=kb)
        return
    if q and q.message and q.message.text is not None:
        try:
            await q.edit_message_text(texto, parse_mode=HTML, reply_markup=kb, disable_web_page_preview=True)
            return
        except BadRequest as e:
            if "not modified" in str(e).lower():
                return
    await chat.send_message(texto, parse_mode=HTML, reply_markup=kb, disable_web_page_preview=True)


async def espera(update: Update, texto="⏳ Un momento, estoy calculando…"):
    await update.effective_chat.send_action(ChatAction.TYPING)
    return await update.effective_chat.send_message(texto)


async def borrar(msg):
    try:
        await msg.delete()
    except Exception:
        pass


def contexto_llm(st) -> dict:
    ctx = {"region": "sierra del Ecuador"}
    p = st.get("parcel")
    if p:
        ctx["terreno"] = {"provincia": p["provincia"], "altura_m": round(p["elev"]),
                          "suelo": (p.get("suelo") or {}).get("textura")}
        ctx["clima"] = st.get("clima_resumen")
    if st.get("crop"):
        ctx["cultivo_actual"] = CROPS[st["crop"]].nombre
        ctx["mes_siembra"] = MESES_LARGO[st["mes"] - 1]
    if st.get("elegida"):
        ctx["rotacion_elegida"] = [CROPS[i].nombre for i in st["elegida"]]
    if st.get("comp_resumen"):
        ctx["comparacion_rotaciones"] = st["comp_resumen"]
    if st.get("banco_resumen"):
        ctx["banco_de_agua"] = st["banco_resumen"]
    if st.get("area"):
        ctx["area_m2"] = st["area"]
    if st.get("riego"):
        ctx["tipo_riego"] = RIEGO[st["riego"]][0]
    return ctx


# ---------------------------------------------------------------- inicio y menú
async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await estado(update, ctx)
    await guardar(update, ctx)
    nombre = esc(update.effective_user.first_name or "vecino")
    texto = (f"🌄 <b>¡Imanalla, {nombre}!</b> Soy <b>Pacha</b>.\n\n"
             "Le ayudo a saber qué sembrar y cuánto regar, con los satélites de la NASA.\n"
             "Todo es con botones. También puede escuchar 🔊.\n\n"
             "¿En qué idioma prefiere los botones?")
    img = await asyncio.to_thread(charts.banner)
    await update.effective_chat.send_photo(img, caption=texto, parse_mode=HTML, reply_markup=KB(
        [[("Español", "id:es")], [("Kichwa · Español", "id:ki")]]))


def texto_menu(st, nombre) -> str:
    p, c = st.get("parcel"), st.get("crop")
    l1 = f"✅ <b>Mi terreno</b>: {esc(p['provincia'])}, {num(p['elev'])} m" if p else "1️⃣ <b>Mi terreno</b>: dime dónde está"
    l2 = (f"✅ <b>Mi cultivo</b>: {CROPS[c].etiqueta}, desde {MESES_LARGO[st['mes'] - 1]}" if c
          else "2️⃣ <b>Mi cultivo y rotación</b>: elige qué siembras")
    l3 = ("3️⃣ <b>Banco de agua</b>: listo para calcular" if p and c
          else "3️⃣ <b>Banco de agua</b>: se abre después del paso 2")
    return (f"🌄 <b>{esc(nombre)}, ¿qué hacemos hoy?</b>\n\nSigue los pasos en orden:\n{l1}\n{l2}\n{l3}\n\n"
            "También puedes preguntarme lo que quieras 🗣️")


def kb_menu(st):
    t = "✅ Mi terreno" if st.get("parcel") else "1️⃣ Mi terreno"
    c = "✅ Mi cultivo y rotación" if st.get("crop") else "2️⃣ Mi cultivo y rotación"
    return KB([[(t, "t")], [(c, "c")], [("3️⃣ Banco de agua 💧", "b")],
               [("🌦️ ¿Y si cambia el clima?", "s"), ("❄️ Helada esta semana", "a")],
               [("🗣️ Pregúntale a Pacha", "q"), ("📜 Mi historial", "h")],
               [("📖 Palabras del campo", "g"), ("ℹ️ Sobre los datos", "i")]])


async def menu(update: Update, ctx):
    st = await estado(update, ctx)
    ctx.user_data.pop("esperando", None)
    await mostrar(update, texto_menu(st, update.effective_user.first_name or "Vecino"), kb_menu(st))


# ---------------------------------------------------------------- 1. terreno
async def terreno(update: Update, ctx, arg: str):
    st = await estado(update, ctx)
    if arg == "loc":
        kb = ReplyKeyboardMarkup([[KeyboardButton("📍 Enviar mi ubicación", request_location=True)],
                                  ["↩️ Cancelar"]], resize_keyboard=True, one_time_keyboard=True)
        await update.effective_chat.send_message(
            "📍 Párese en su terreno y toca el botón de abajo 👇\n\n"
            "Si estás en una computadora, ese botón no funciona: mejor elige tu provincia.", reply_markup=kb)
        return
    if arg == "prov":
        botones = [(nombre, f"t:p:{k}") for k, (nombre, _, _) in PROVINCIAS.items()]
        await mostrar(update, "🗺️ <b>¿En qué provincia está tu terreno?</b>\n"
                      "Usaré un punto agrícola típico de la provincia.",
                      KB(filas(botones) + [[("⬅️ Volver", "t"), MENU]]))
        return
    if arg.startswith("p:"):
        nombre, lat, lon = PROVINCIAS[arg[2:]]
        await fijar_terreno(update, ctx, lat, lon, nombre)
        return
    if arg == "info" and st.get("parcel"):
        await fijar_terreno(update, ctx, st["parcel"]["lat"], st["parcel"]["lon"], st["parcel"]["provincia"],
                            solo_ver=True)
        return
    filas_kb = [[("📍 Enviar mi ubicación", "t:loc")], [("🗺️ Elegir mi provincia", "t:prov")]]
    if st.get("parcel"):
        filas_kb.insert(0, [("📋 Ver mi terreno", "t:info")])
    await mostrar(update, "🗺️ <b>¿Dónde está tu terreno?</b>\n\n"
                  "Con la ubicación veo la altura, el suelo, la lluvia y las heladas de tu zona.",
                  KB(filas_kb + [[MENU]]))


def texto_ficha(sitio: E.Sitio, r: dict) -> str:
    s = sitio.suelo or {}
    mo = f", materia orgánica {num(s['mo'], 1)} %" if s.get("mo") else ""
    heladas = ", ".join(r["meses_helada"]) if r["meses_helada"] else "pocas veces"
    return (f"📋 <b>Tu terreno</b> (zona de {esc(sitio.provincia)})\n\n"
            f"⛰️ Altura: <b>{num(sitio.elev)} m</b>\n"
            f"🟫 Suelo: {esc(s.get('textura', 'sin dato'))}{mo}\n"
            f"🌧️ Lluvia al año: <b>{num(r['lluvia_anual'])} mm</b> (año seco: {num(r['lluvia_seca'])} mm)\n"
            f"☀️ Agua que se evapora al año: {num(r['et0_anual'])} mm\n"
            f"🌡️ Temperatura: de {num(r['tmin'])} a {num(r['tmax'])} °C\n"
            f"❄️ Meses con riesgo de helada: {heladas}\n\n"
            f"<i>Datos {esc(r['anios'])}: {esc(r['metodo'])}.</i>")


async def fijar_terreno(update: Update, ctx, lat, lon, provincia=None, solo_ver=False):
    st = await estado(update, ctx)
    msg = await update.effective_chat.send_message(
        "🛰️ Estoy consultando los satélites de la NASA para tu terreno.\n"
        "La primera vez puede tardar hasta un minuto…", reply_markup=ReplyKeyboardRemove())
    await update.effective_chat.send_action(ChatAction.UPLOAD_PHOTO)
    try:
        sitio = await asyncio.to_thread(E.crear_sitio, lat, lon, provincia)
        clima = await asyncio.to_thread(clima_de, sitio)
        res = clima.resumen()
        img = await asyncio.to_thread(charts.climograma, res, f"El clima de tu terreno · {sitio.provincia}")
    except E.FueraDeSierra:
        await borrar(msg)
        await mostrar(update, "🙏 Por ahora Pacha solo trabaja en la <b>sierra del Ecuador</b>, "
                      "sobre los 1.500 m de altura. Ese punto queda fuera.\n\nPrueba eligiendo tu provincia.",
                      KB([[("🗺️ Elegir mi provincia", "t:prov")], [MENU]]))
        return
    except Exception:
        log.exception("Error consultando datos")
        await borrar(msg)
        await mostrar(update, "😔 No pude conectar con los satélites. Intenta otra vez en un rato.",
                      KB([[("🔄 Reintentar", "t")], [MENU]]))
        return
    await borrar(msg)
    if not solo_ver:
        st["parcel"] = dict(lat=sitio.lat, lon=sitio.lon, elev=sitio.elev, grid_elev=sitio.grid_elev,
                            provincia=sitio.provincia, suelo=sitio.suelo)
        st["clima_resumen"] = {"lluvia_anual_mm": round(res["lluvia_anual"]), "evaporacion_anual_mm":
                               round(res["et0_anual"]), "meses_helada": res["meses_helada"]}
        for k in ("crop", "mes", "fecha", "rot", "elegida", "comp_resumen", "banco_resumen"):
            st.pop(k, None)
        await guardar(update, ctx)
        try:
            await asyncio.to_thread(STORE.add_parcel, update.effective_user.id, st["parcel"])
        except Exception as e:
            log.warning("No se pudo guardar el terreno: %s", e)
        await historial(update, "terreno", f"Terreno en {sitio.provincia}, {num(sitio.elev)} m")
        from . import campo
        await campo.mostrar_chakra(update, ctx, sitio, res)
        return
    await mostrar(update, texto_ficha(sitio, res), KB([[("2️⃣ Seguir: mi cultivo", "c")], [MENU]]), foto=img)


async def ubicacion(update: Update, ctx):
    loc = update.message.location
    log.info("usuario %s → ubicación %.2f, %.2f", update.effective_user.id, loc.latitude, loc.longitude)
    await fijar_terreno(update, ctx, loc.latitude, loc.longitude)


# ---------------------------------------------------------------- 2. cultivo y rotación
def kb_cultivos(z, prefijo, descanso=False, extra=None):
    botones = [(c.etiqueta, f"{prefijo}{c.id}") for c in E.cultivos_aptos(z, incluir_descanso=descanso)]
    rows = filas(botones)
    if extra:
        rows.append(extra)
    return KB(rows + [[("⬅️ Volver", "qs"), MENU]])


def kb_meses(prefijo, desde=None):
    orden = list(range(1, 13)) if desde is None else [((desde - 1 + i) % 12) + 1 for i in range(12)]
    return [[(MESES[m - 1].capitalize(), f"{prefijo}{m}") for m in orden[i:i + 4]] for i in range(0, 12, 4)]


async def cultivo(update: Update, ctx, arg: str):
    st = await estado(update, ctx)
    sitio = sitio_de(st)
    if not sitio:
        await mostrar(update, "🗺️ Primero necesito saber <b>dónde está tu terreno</b>.",
                      KB([[("1️⃣ Mi terreno", "t")], [MENU]]))
        return
    if arg == "ya":
        await mostrar(update, "🌱 <b>¿Qué tiene sembrado ahora?</b>\n"
                      f"Estos cultivos se dan a {num(sitio.elev)} metros.", kb_cultivos(sitio.elev, "c:s:"))
    elif arg.startswith("s:"):
        ctx.user_data["nuevo_cultivo"] = arg[2:]
        await mostrar(update, f"📅 <b>¿En qué mes sembró su {CROPS[arg[2:]].nombre.lower()}?</b>",
                      KB(kb_meses("c:m:") + [[("⬅️ Volver", "c:ya"), MENU]]))
    elif arg.startswith("m:"):
        m, hoy = int(arg[2:]), dt.date.today()
        st["crop"] = ctx.user_data.pop("nuevo_cultivo", st.get("crop"))
        if not st.get("crop"):
            await cultivo(update, ctx, "ya")
            return
        st["mes"] = m
        st["fecha"] = dt.date(hoy.year if m <= hoy.month else hoy.year - 1, m, 15).isoformat()
        st["camino"] = "ya"
        for k in ("rot", "elegida", "comp_resumen", "banco_resumen", "sig1"):
            st.pop(k, None)
        await guardar(update, ctx)
        await historial(update, "cultivo", f"Tiene {CROPS[st['crop']].nombre} sembrado en {MESES_LARGO[m - 1]}")
        from . import campo
        await campo.rotacion_simple(update, ctx, "")
    elif arg == "new":
        hoy = dt.date.today()
        await mostrar(update, "🆕 <b>¿En qué mes quiere sembrar?</b>\n"
                      "Le diré qué cultivos le convienen.",
                      KB(kb_meses("n:m:", desde=hoy.month) + [[("⬅️ Volver", "c"), MENU]]))
    else:
        texto = ("🌱 <b>¿Cómo está tu terreno ahora?</b>\n\n"
                 "• Si ya tienes algo sembrado, comparo tu plan de rotación con otras opciones.\n"
                 "• Si está libre, te digo qué conviene sembrar y en qué orden.")
        rows = [[("🌱 Ya tengo un cultivo sembrado", "c:ya")], [("🆕 Quiero empezar un cultivo", "c:new")]]
        if st.get("crop"):
            texto += f"\n\nAhora tiene: <b>{CROPS[st['crop']].etiqueta}</b>"
            rows.append([("🔁 Ver comparación de rotaciones", "r:cmp")])
        await mostrar(update, texto, KB(rows + [[MENU]]))


async def empezar(update: Update, ctx, arg: str):
    st = await estado(update, ctx)
    sitio = sitio_de(st)
    if not sitio:
        await cultivo(update, ctx, "")
        return
    if arg.startswith("m:"):
        mes = int(arg[2:])
        ctx.user_data["mes_nuevo"] = mes
        msg = await espera(update)
        clima = await asyncio.to_thread(clima_de, sitio)
        recs = await asyncio.to_thread(E.recomendar_para_empezar, sitio, clima, mes, st.get("prio"))
        img = await asyncio.to_thread(charts.recomendados, recs, MESES_LARGO[mes - 1])
        await borrar(msg)
        lineas = []
        for i, f in enumerate(recs):
            c = f["crop"]
            extra = ", deja nitrógeno" if c.fija_n else ""
            hel = f", ojo helada en {', '.join(f['riesgo'])}" if f["riesgo"] else ""
            lineas.append(f"{['🥇', '🥈', '🥉'][i]} <b>{c.nombre}</b>: riego {num(f['falta'])} L/m²{extra}{hel}")
        texto = (f"🆕 <b>Para sembrar en {MESES_LARGO[mes - 1]}</b> te recomiendo:\n\n" + "\n".join(lineas)
                 + "\n\nToca el cultivo que quieres sembrar.")
        rows = [[(f["crop"].etiqueta, f"n:p:{f['crop'].id}")] for f in recs]
        await mostrar(update, texto, KB(rows + [[("📋 Ver todos los cultivos", "n:all")], [MENU]]), foto=img)
    elif arg == "all":
        await mostrar(update, "🌱 <b>Elija el cultivo que quiere sembrar</b>", kb_cultivos(sitio.elev, "n:p:"))
    elif arg.startswith("p:"):
        hoy = dt.date.today()
        mes = ctx.user_data.get("mes_nuevo", hoy.month % 12 + 1)
        st["crop"], st["mes"], st["camino"] = arg[2:], mes, "new"
        st["fecha"] = dt.date(hoy.year if mes >= hoy.month else hoy.year + 1, mes, 1).isoformat()
        for k in ("rot", "elegida", "comp_resumen", "banco_resumen"):
            st.pop(k, None)
        await guardar(update, ctx)
        await historial(update, "cultivo", f"Quiere sembrar {CROPS[st['crop']].nombre} en {MESES_LARGO[mes - 1]}")
        from . import campo
        await campo.rotacion_simple(update, ctx, "")


async def rotacion(update: Update, ctx, arg: str):
    st = await estado(update, ctx)
    sitio = sitio_de(st)
    if not sitio or not st.get("crop"):
        await cultivo(update, ctx, "")
        return
    crop = CROPS[st["crop"]]
    if arg.startswith("1:"):
        st["sig1"] = arg[2:]
        if arg[2:] == "-":
            st["rot"] = None
            await guardar(update, ctx)
            from . import campo
            await campo.rotacion_simple(update, ctx, "")
            return
        await mostrar(update, f"🔁 <b>¿Y después de {CROPS[arg[2:]].nombre.lower()}?</b>",
                      kb_cultivos(sitio.elev, "r:2:", descanso=True, extra=[("🤷 Todavía no sé", "r:2:-")]))
        return
    if arg.startswith("2:"):
        sig2 = arg[2:]
        st["rot"] = None if sig2 == "-" else [st["crop"], st.get("sig1"), sig2]
        await guardar(update, ctx)
        ctx.user_data.pop("comp", None)
        from . import campo
        await campo.rotacion_simple(update, ctx, "")
        return
    if arg == "plan":
        await mostrar(update, f"📝 <b>¿Qué pensaba sembrar después de la {crop.nombre.lower()}?</b>",
                      kb_cultivos(sitio.elev, "r:1:", descanso=True, extra=[("🤷 Todavía no sé", "r:1:-")]))
        return
    if arg == "pr":
        rows = [[(v, f"r:pp:{k}")] for k, v in PRIORIDADES.items()] + [[("⚖️ Todo por igual", "r:pp:-")]]
        await mostrar(update, "🎯 <b>¿Qué es lo más importante para ti?</b>\nOrdeno las opciones según eso.",
                      KB(rows + [[("⬅️ Volver", "r:cmp")]]))
        return
    if arg.startswith("pp:"):
        st["prio"] = None if arg[3:] == "-" else arg[3:]
        await guardar(update, ctx)
        arg = "cmp"
    res = ctx.user_data.get("comp")
    if arg == "cmp" or res is None:
        msg = await espera(update, "⏳ Comparando rotaciones con 24 años de clima de la NASA…")
        clima = await asyncio.to_thread(clima_de, sitio)
        res = await asyncio.to_thread(E.comparar_rotaciones, sitio, clima, st["crop"], st["mes"],
                                      st.get("rot"), st.get("prio"))
        ctx.user_data["comp"] = res
        st["comp_resumen"] = [{"nombre": e["nombre"], "cultivos": [c.nombre for c in e["crops"]],
                               "puntaje": e["puntaje"], "riego_L_m2_anual": round(e["falta_anual"]),
                               "riesgos": e["tarjeta"]["riesgos"]} for e in res]
        await guardar(update, ctx)
        await historial(update, "rotacion", "Comparó rotaciones: " +
                        " | ".join(f"{e['nombre']} {e['puntaje']}" for e in res))
        img = await asyncio.to_thread(charts.rotaciones, res)
        await borrar(msg)
        mejor = max(res, key=lambda e: e["puntaje"])
        lineas = [f"{'⭐' if e is mejor else '•'} <b>{e['nombre']}</b>: "
                  f"{' → '.join(c.nombre for c in e['crops'])} · <b>{e['puntaje']}</b> puntos" for e in res]
        prio = PRIORIDADES.get(st.get("prio"), "⚖️ Todo por igual")
        texto = (f"🔁 <b>Rotaciones empezando con {crop.nombre.lower()} en {MESES_LARGO[st['mes'] - 1]}</b>\n\n"
                 + "\n".join(lineas) + f"\n\nPrioridad: {prio}\nToca una opción para ver el porqué.")
        rows = [[(f"🔎 {e['nombre']}", f"r:k:{i}")] for i, e in enumerate(res)]
        rows += [[("🎯 Cambiar mi prioridad", "r:pr")], [("🗣️ Explícame con palabras", "x:rot")], [MENU]]
        await mostrar(update, texto, KB(rows), foto=img)
        return
    if arg.startswith("k:"):
        i = int(arg[2:])
        e = res[i]
        t = e["tarjeta"]
        texto = (f"🔎 <b>{e['nombre']}</b> · {e['puntaje']} puntos\n{esc(t['titulo'])}\n\n"
                 f"❓ <b>¿Por qué?</b> {esc(t['porque'])}\n\n"
                 f"📡 <b>Evidencia:</b> {esc(t['evidencia'])}\n\n"
                 f"✅ <b>Beneficios:</b> {esc(t['beneficios'])}\n\n"
                 f"🕳️ <b>Lo que no sabemos:</b> {esc(t['vacios'])}\n\n"
                 f"⚠️ <b>Riesgos para revisar en tu campo:</b> {esc(t['riesgos'])}\n\n<i>{AVISO}</i>")
        await mostrar(update, texto, KB([[("✅ Elegir esta rotación", f"r:ok:{i}")],
                                         [("⬅️ Volver a la comparación", "r:ver")], [MENU]]))
        return
    if arg == "ver":
        rows = [[(f"🔎 {e['nombre']} · {e['puntaje']} pts", f"r:k:{i}")] for i, e in enumerate(res)]
        await mostrar(update, "🔁 <b>Elige una opción para ver el detalle</b>",
                      KB(rows + [[("🎯 Cambiar mi prioridad", "r:pr")], [MENU]]))
        return
    if arg.startswith("ok:"):
        e = res[int(arg[3:])]
        st["elegida"] = e["ids"]
        await guardar(update, ctx)
        await historial(update, "rotacion_elegida", "Eligió: " + " → ".join(c.nombre for c in e["crops"]))
        await mostrar(update, f"✅ <b>Guardé tu rotación:</b>\n{' → '.join(c.etiqueta for c in e['crops'])}\n\n"
                      f"Ahora el paso 3️⃣: calculemos cuánta agua necesita tu <b>{crop.nombre.lower()}</b>.",
                      KB([[("💧 Ir al banco de agua", "b")], [MENU]]))


# ---------------------------------------------------------------- 3. banco de agua
AREAS = [("100 m² (10 × 10 pasos)", 100), ("500 m²", 500), ("1.000 m²", 1000),
         ("¼ de hectárea", 2500), ("½ hectárea", 5000), ("1 hectárea", 10000)]


def leer_area(t: str) -> float | None:
    t = t.lower().replace(",", ".")
    if "media" in t and "hect" in t:
        return 5000
    if "cuarto" in t and "hect" in t:
        return 2500
    m = re.search(r"\d+(?:\.\d+)?", t)
    if not m:
        return None
    v = float(m.group())
    if re.search(r"\bha\b|hect", t):
        v *= 10000
    return v if 10 <= v <= 500000 else None


async def banco(update: Update, ctx, arg: str):
    st = await estado(update, ctx)
    sitio = sitio_de(st)
    if not sitio:
        await mostrar(update, "💧 El banco de agua calcula cuánta agua darle a tu cultivo.\n\n"
                      "Primero necesito saber <b>dónde está tu terreno</b>.", KB([[("1️⃣ Mi terreno", "t")], [MENU]]))
        return
    if not st.get("crop"):
        await mostrar(update, "💧 <b>El banco de agua</b> compara la lluvia que entra con el agua que gasta tu "
                      "cultivo. La diferencia es lo que debes poner con riego.\n\n"
                      "Para eso primero necesito saber <b>qué cultivo tienes o vas a sembrar</b>.",
                      KB([[("2️⃣ Elegir mi cultivo", "c")], [MENU]]))
        return
    if arg.startswith("a:"):
        st["area"] = float(arg[2:])
        await guardar(update, ctx)
        arg = ""
    elif arg == "aw":
        ctx.user_data["esperando"] = "area"
        await mostrar(update, "✍️ Escríbeme el tamaño de tu terreno.\n\nEjemplos: <code>300</code> (metros "
                      "cuadrados), <code>2 ha</code>, <code>media hectárea</code>.")
        return
    elif arg.startswith("e:"):
        st["riego"] = arg[2:]
        await guardar(update, ctx)
        arg = ""
    elif arg == "reset":
        st.pop("area", None)
        st.pop("riego", None)
        arg = ""
    if arg == "w":
        await riego_semana(update, ctx)
        return
    if not st.get("area"):
        rows = [[(t, f"b:a:{v}")] for t, v in AREAS] + [[("✍️ Escribir el tamaño", "b:aw")], [MENU]]
        await mostrar(update, "📐 <b>¿Qué tamaño tiene tu terreno?</b>\nCon eso te digo cuántos litros necesitas.",
                      KB(rows))
        return
    if not st.get("riego"):
        rows = [[(f"{e} {RIEGO[k][0]}", f"b:e:{k}")] for k, e in (("g", "🚿"), ("a", "💦"), ("d", "💧"), ("n", "🌧️"))]
        await mostrar(update, "🚿 <b>¿Cómo riegas tu terreno?</b>\n"
                      "Cada forma desperdicia distinta cantidad de agua.", KB(rows + [[MENU]]))
        return
    crop = CROPS[st["crop"]]
    msg = await espera(update, "⏳ Haciendo las cuentas del agua…")
    clima = await asyncio.to_thread(clima_de, sitio)
    b, _, _ = await asyncio.to_thread(E.analisis_cultivo, clima, crop, st["mes"])
    nombre_riego, ef = RIEGO[st["riego"]]
    titulo = f"Banco de agua · {crop.nombre} desde {MESES_LARGO[st['mes'] - 1]}"
    img = await asyncio.to_thread(charts.banco, b, titulo, ef)
    await borrar(msg)
    area = st["area"]
    L, Ls = E.litros(b["total_falta"], area, ef), E.litros(b["total_falta_seco"], area, ef)
    saldo = b["total_lluvia_util"] - b["total_gasto"]
    if crop.id == "descanso":
        cuerpo = "🟫 En descanso el terreno no se riega. Aprovecha para abonar o sembrar una cobertura."
    elif b["total_falta"] < 5:
        cuerpo = (f"🎉 <b>En un año normal la lluvia alcanza.</b>\n"
                  f"🌵 En un año seco faltarían unos {num(Ls['por_m2'])} L por m².")
    elif st["riego"] == "n":
        cuerpo = (f"⚠️ <b>A tu cultivo le faltarían {num(b['total_falta'])} L por m²</b> en un año normal.\n"
                  f"El mes más difícil es <b>{b['mes_critico']}</b>. Piensa en guardar agua de lluvia "
                  f"o en un cultivo que pida menos agua.")
    else:
        sem = b["falta_semana_critica"] / ef
        cuerpo = (f"🚰 <b>Debes poner con riego: {num(L['por_m2'])} L por m²</b>\n"
                  f"   En todo tu terreno: {num(L['total'])} litros ≈ {num(L['baldes'])} baldes de 20 L "
                  f"({num(L['m3'], 1)} m³)\n"
                  f"📅 Mes más exigente: <b>{b['mes_critico']}</b>, unos {num(sem)} L por m² cada semana\n"
                  f"🌵 En un año seco: {num(Ls['por_m2'])} L por m²")
    texto = (f"💧 <b>Banco de agua</b> · {crop.etiqueta} desde {MESES_LARGO[st['mes'] - 1]}\n"
             f"📐 {num(area)} m² · {nombre_riego}\n\n"
             f"🟢 Entra (lluvia útil): {num(b['total_lluvia_util'])} L por m²\n"
             f"🟤 Sale (gasto del cultivo): {num(b['total_gasto'])} L por m²\n"
             f"⚖️ Saldo: {'+' if saldo >= 0 else '−'}{num(abs(saldo))} L por m²\n\n{cuerpo}\n\n"
             f"<i>1 mm = 1 litro por m². Año normal = mitad de los {b['anios']} años; año seco = 8 de cada 10 "
             f"años necesitan menos. Clima: {esc(clima.metodo)}.</i>")
    st["banco_resumen"] = {"cultivo": crop.nombre, "mes_siembra": MESES_LARGO[st["mes"] - 1],
                           "lluvia_util_L_m2": round(b["total_lluvia_util"]), "gasto_L_m2": round(b["total_gasto"]),
                           "riego_L_m2": round(L["por_m2"]), "riego_total_L": round(L["total"]),
                           "riego_seco_L_m2": round(Ls["por_m2"]), "mes_critico": b["mes_critico"],
                           "meses": dict(zip(b["meses"], [round(f / ef) for f in b["falta"]]))}
    await guardar(update, ctx)
    await historial(update, "banco", f"Banco de agua {crop.nombre}: riego {num(L['por_m2'])} L/m² "
                    f"({num(L['total'])} L en {num(area)} m²)", st["banco_resumen"])
    kb = KB([[("📅 ¿Cuánto riego esta semana?", "b:w")], [("🌦️ ¿Y si cambia el clima?", "s")],
             [("🗣️ Explícame con palabras", "x:bank")], [("✏️ Cambiar tamaño o riego", "b:reset")], [MENU]])
    await mostrar(update, texto, kb, foto=img)


async def riego_semana(update: Update, ctx):
    st = await estado(update, ctx)
    sitio, crop = sitio_de(st), CROPS[st["crop"]]
    msg = await espera(update, "⏳ Revisando el pronóstico de esta semana…")
    try:
        w = await asyncio.to_thread(E.riego_semana, sitio, crop, dt.date.fromisoformat(st["fecha"]))
    except Exception:
        log.exception("pronóstico")
        await borrar(msg)
        await mostrar(update, "😔 No pude obtener el pronóstico. Intenta más tarde.", KB([[MENU]]))
        return
    await borrar(msg)
    ef = RIEGO[st.get("riego", "g")][1]
    area = st.get("area", 1000)
    if w["dia"] > crop.ciclo_dias + 15:
        await mostrar(update, f"🌾 Tu {crop.nombre.lower()} ya debería estar cosechado. "
                      "¿Elegimos el siguiente cultivo?", KB([[("2️⃣ Mi cultivo y rotación", "c")], [MENU]]))
        return
    cuando = (f"faltan {-w['dia']} días para sembrar" if w["dia"] < 0 else f"día {w['dia']}, {w['etapa']}")
    r_m2 = w["falta"] / ef
    lineas = [f"📅 <b>Esta semana</b> · {crop.etiqueta} ({cuando})\n",
              f"🟤 Tu cultivo gastará: {num(w['gasto'])} L por m²",
              f"🌧️ Lloverá: {num(w['lluvia'])} L por m² (útil: {num(w['lluvia_util'])})"]
    if r_m2 < 1:
        lineas.append("✅ <b>No necesitas regar esta semana.</b>")
    else:
        lineas.append(f"🚰 <b>Riega {num(r_m2)} L por m²</b> → {num(r_m2 * area)} litros en tu terreno, "
                      "repartidos en 2 o 3 riegos.")
    if w["heladas"]:
        dias = ", ".join(f"{DIAS[d.weekday()]} {d.day} ({num(t, 1)} °C)" for d, t in w["heladas"])
        lineas.append(f"\n❄️ <b>Posible helada:</b> {dias}.\nUn riego ligero la tarde anterior ayuda: "
                      "el suelo húmedo guarda calor. Conversa con tu comunidad sobre cómo proteger las plantas.")
    lineas.append("\n<i>Pronóstico de Open-Meteo (modelos del tiempo). El plan de la temporada usa NASA POWER.</i>")
    await historial(update, "semana", f"Riego semana {crop.nombre}: {num(r_m2)} L/m²")
    await mostrar(update, "\n".join(lineas), KB([[("⬅️ Volver al banco de agua", "b")], [MENU]]))


# ---------------------------------------------------------------- escenarios, helada y extras
async def escenario(update: Update, ctx, arg: str):
    st = await estado(update, ctx)
    sitio = sitio_de(st)
    if not sitio or not st.get("crop"):
        await banco(update, ctx, "")
        return
    esc_st = st.setdefault("escenario", {"dP": -0.2, "dT": 1.0})
    if arg.startswith("p:"):
        esc_st["dP"] = float(arg[2:])
    elif arg.startswith("t:"):
        esc_st["dT"] = float(arg[2:])
    if arg == "go":
        crop = CROPS[st["crop"]]
        msg = await espera(update, "⏳ Simulando el clima nuevo con 24 años de datos…")
        base_c = await asyncio.to_thread(clima_de, sitio)
        esc_c = await asyncio.to_thread(clima_de, sitio, esc_st["dP"], esc_st["dT"])
        base = await asyncio.to_thread(E.banco_de_agua, base_c, crop, st["mes"])
        nuevo = await asyncio.to_thread(E.banco_de_agua, esc_c, crop, st["mes"])
        rots = await asyncio.to_thread(E.comparar_rotaciones, sitio, esc_c, st["crop"], st["mes"],
                                       st.get("rot"), st.get("prio"))
        await borrar(msg)
        ef = RIEGO[st.get("riego", "g")][1]
        b0, b1 = base["total_falta"] / ef, nuevo["total_falta"] / ef
        cambio = (b1 - b0) / b0 * 100 if b0 > 1 else 0
        mejor = max(rots, key=lambda e: e["puntaje"])
        dP, dT = esc_st["dP"], esc_st["dT"]
        lluvia_t = "llueve igual" if dP == 0 else f"llueve {num(abs(dP) * 100)} % {'menos' if dP < 0 else 'más'}"
        calor_t = "hace el mismo calor" if dT == 0 else f"hace {num(dT)} °C más"
        texto = (f"🌦️ <b>Si {lluvia_t} y {calor_t}</b>\n\n"
                 f"Tu {crop.nombre.lower()} necesitaría <b>{num(b1)} L por m²</b> de riego "
                 f"en vez de {num(b0)} L ({'+' if cambio >= 0 else ''}{num(cambio)} %).\n\n"
                 f"🔁 La rotación que mejor resiste ese clima:\n<b>{' → '.join(c.etiqueta for c in mejor['crops'])}</b> "
                 f"({mejor['puntaje']} puntos)\n\n<i>Es una prueba de \"qué pasaría si\", no un pronóstico.</i>")
        await historial(update, "escenario", f"Escenario lluvia {esc_st['dP']:+.0%}, +{esc_st['dT']} °C: "
                        f"riego {num(b0)} → {num(b1)} L/m²")
        await mostrar(update, texto, KB([[("🔄 Probar otro", "s")], [("💧 Banco de agua", "b")], [MENU]]))
        return

    def marca(ok, t):
        return f"• {t} •" if ok else t
    lluvia = [(marca(esc_st["dP"] == v, t), f"s:p:{v}") for t, v in
              (("−20 %", -0.2), ("−10 %", -0.1), ("Igual", 0.0), ("+10 %", 0.1))]
    temp = [(marca(esc_st["dT"] == v, t), f"s:t:{v}") for t, v in (("Igual", 0.0), ("+1 °C", 1.0), ("+2 °C", 2.0))]
    await mostrar(update, "🌦️ <b>¿Y si cambia el clima?</b>\n\nElige cuánta lluvia y cuánto calor quieres probar. "
                  "Pacha recalcula el agua de tu cultivo y la mejor rotación.\n\n🌧️ Lluvia:   ☀️ Temperatura:",
                  KB([lluvia, temp, [("▶️ Calcular", "s:go")], [MENU]]))


async def helada(update: Update, ctx):
    st = await estado(update, ctx)
    sitio = sitio_de(st)
    if not sitio:
        await mostrar(update, "❄️ Para avisarte de heladas necesito saber dónde está tu terreno.",
                      KB([[("1️⃣ Mi terreno", "t")], [MENU]]))
        return
    try:
        f = await asyncio.to_thread(clients.forecast_week, sitio.lat, sitio.lon)
    except Exception:
        await mostrar(update, "😔 No pude obtener el pronóstico. Intenta más tarde.", KB([[MENU]]))
        return
    lineas, hay = [], False
    for d, t in zip(f["fecha"], f["tmin"]):
        dia = dt.date.fromisoformat(d)
        if t is None:
            continue
        if t <= 2:
            icono, hay = "❄️❄️ helada probable", True
        elif t <= E.FROST_T:
            icono, hay = "❄️ posible helada", True
        else:
            icono = "✅"
        lineas.append(f"{DIAS[dia.weekday()]} {dia.day}: mínima {num(t, 1)} °C {icono}")
    consejo = ("\n\n🌱 Si hay helada: un riego ligero la tarde anterior ayuda, porque el suelo húmedo guarda "
               "calor. Las plantas pequeñas se pueden cubrir. Conversa con tu comunidad." if hay
               else "\n\n🙂 No se esperan heladas esta semana.")
    if hay and st.get("crop") and CROPS[st["crop"]].helada == "alta":
        consejo += f"\n⚠️ Tu {CROPS[st['crop']].nombre.lower()} es delicado con la helada."
    await mostrar(update, "❄️ <b>Heladas esta semana</b>\n\n" + "\n".join(lineas) + consejo +
                  "\n\n<i>El aire a 2 m suele estar 3 a 5 °C más caliente que las hojas en noches despejadas.</i>",
                  KB([[MENU]]))


async def ver_historial(update: Update, ctx):
    try:
        items = await asyncio.to_thread(STORE.list_history, update.effective_user.id, 12)
    except Exception:
        items = []
    if not items:
        await mostrar(update, "📜 Todavía no tienes historial. ¡Empieza por tu terreno!", KB([[MENU]]))
        return
    lineas = []
    for it in items:
        try:
            t = dt.datetime.fromisoformat(it["created_at"].replace("Z", "+00:00")) - dt.timedelta(hours=5)
            fecha = t.strftime("%d/%m %H:%M")
        except Exception:
            fecha = ""
        lineas.append(f"• <b>{fecha}</b> {esc(it['summary'])}")
    await mostrar(update, "📜 <b>Tu historial</b>\n\n" + "\n".join(lineas) +
                  f"\n\n<i>Guardado en {STORE.nombre}. Usa /borrar para eliminar tus datos.</i>", KB([[MENU]]))


async def glosario(update: Update, ctx, arg: str):
    if arg in GLOSARIO:
        t, d = GLOSARIO[arg]
        await mostrar(update, f"📖 <b>{t}</b>\n\n{d}", KB([[("⬅️ Más palabras", "g")], [MENU]]))
        return
    botones = [(t, f"g:{k}") for k, (t, _) in GLOSARIO.items()]
    await mostrar(update, "📖 <b>Palabras del campo</b>\nToca una palabra para entenderla.", KB(filas(botones) + [[MENU]]))


async def sobre_datos(update: Update, ctx):
    texto = ("ℹ️ <b>¿De dónde salen los datos?</b>\n\n"
             "🛰️ <b>NASA POWER</b>: 24 años de temperatura, lluvia, humedad, viento y sol (celda de unos 50 km).\n"
             "🗺️ <b>ECMWF 9 km</b>: corrige mes a mes la lluvia y la temperatura de NASA a la altura real de tu terreno. "
             "En los Andes las celdas grandes exageran la lluvia.\n"
             "🟫 <b>SoilGrids</b>: arcilla, arena y materia orgánica del suelo.\n"
             "🌱 <b>FAO-56</b>: cuánta agua toma cada cultivo en cada etapa. Para chocho, melloco y oca el valor es estimado.\n"
             "📅 <b>Open-Meteo</b>: pronóstico de los próximos 7 días.\n\n"
             "🧮 <b>Cómo calcula Pacha</b>\n"
             "• Agua que se evapora: fórmula Penman-Monteith de la FAO.\n"
             "• Lluvia útil: método USDA-SCS, el de CROPWAT.\n"
             "• Riego = (gasto del cultivo − lluvia útil) ÷ eficiencia del riego.\n"
             "• Helada: se avisa desde 4 °C en el aire, porque las hojas se enfrían más en noches despejadas.\n\n"
             "🚦 <b>Confianza</b>: buena para comparar opciones; media para cantidades exactas. "
             "Confirma con tu pluviómetro y tu experiencia.\n\n"
             f"<i>{AVISO}</i>")
    await mostrar(update, texto, KB([[MENU]]))


async def explicar(update: Update, ctx, que: str):
    st = await estado(update, ctx)
    pregunta = {"bank": "Explícame con palabras sencillas mi banco de agua: cuánto debo regar, cuándo y por qué.",
                "rot": "Explícame con palabras sencillas la comparación de rotaciones y cuál me conviene y por qué."}[que]
    await responder(update, ctx, pregunta, st, registrar=False)


async def preguntar(update: Update, ctx):
    ctx.user_data["esperando"] = "q"
    extra = "" if LLM.activo else "\n\n<i>(Las respuestas libres se activan cuando se configure Gemini.)</i>"
    await mostrar(update, "🗣️ <b>Escríbeme tu pregunta con tus palabras.</b>\n\nPor ejemplo:\n"
                  "• ¿Cuándo es mejor sembrar haba?\n• ¿Por qué no conviene papa tras papa?\n"
                  "• ¿Cuánta agua necesita la quinua?" + extra, KB([[MENU]]))


async def responder(update: Update, ctx, pregunta: str, st: dict, registrar=True):
    tid = update.effective_user.id
    await update.effective_chat.send_action(ChatAction.TYPING)
    try:
        hist = await asyncio.to_thread(STORE.recent_messages, tid, 8)
    except Exception:
        hist = []
    texto = await asyncio.to_thread(LLM.responder, pregunta, contexto_llm(st), hist) if LLM.activo else None
    if not texto:
        if "banco" in pregunta:
            b = st.get("banco_resumen")
            texto = ("💧 Tu banco de agua es como una cuenta: la lluvia útil entra y lo que bebe tu cultivo sale. "
                     + (f"Para tu {b['cultivo'].lower()} faltan unos {b['riego_L_m2']} litros por metro cuadrado en la "
                        f"temporada, sobre todo en {b['mes_critico']}." if b else "Calcula primero tu banco de agua.")
                     + f"\n\n{AVISO}")
        elif "rotaciones" in pregunta:
            texto = ("🔁 Rotar significa cambiar de cultivo cada vez. Las leguminosas como haba, chocho o arveja dejan "
                     "nitrógeno; cambiar de familia corta plagas como el gusano blanco; y así el suelo se cansa menos. "
                     f"La opción con más puntos cuida mejor el agua y el suelo de tu terreno.\n\n{AVISO}")
        else:
            texto = "🙏 Por ahora no puedo responder preguntas libres. Usa los botones del menú 👇"
    if registrar:
        try:
            await asyncio.to_thread(STORE.add_message, tid, "user", pregunta)
            await asyncio.to_thread(STORE.add_message, tid, "model", texto)
        except Exception as e:
            log.warning("No se pudo guardar la conversación: %s", e)
        await historial(update, "pregunta", pregunta[:90])
    ctx.user_data["voz"] = texto
    await update.effective_chat.send_message(texto, reply_markup=KB([[("🔊 Escuchar", "v"), ("🗣️ Otra pregunta", "q")],
                                                                     [MENU]]))


async def nota_de_voz(update: Update, ctx):
    st = await estado(update, ctx)
    log.info("usuario %s → nota de voz (%s s)", update.effective_user.id, update.message.voice.duration)
    if not LLM.activo:
        await update.effective_chat.send_message("🎙️ Todavía no entiendo audios. Use los botones, por favor 👇",
                                                 reply_markup=KB([[MENU]]))
        return
    f = await update.message.voice.get_file()
    datos = bytes(await f.download_as_bytearray())
    await update.effective_chat.send_action(ChatAction.TYPING)
    texto = await asyncio.to_thread(LLM.responder, "El agricultor envió esta nota de voz. Escúchala y respóndele.",
                                    contexto_llm(st), None, datos)
    texto = texto or "🙏 No entendí bien el audio. ¿Puede repetirlo o usar los botones?"
    ctx.user_data["voz"] = texto
    await historial(update, "pregunta", "Nota de voz")
    await update.effective_chat.send_message(texto, reply_markup=KB([[("🔊 Escuchar", "v")], [MENU]]))


async def texto_libre(update: Update, ctx):
    st = await estado(update, ctx)
    t = (update.message.text or "").strip()
    log.info("usuario %s → escribió %d letras (esperando: %s)", update.effective_user.id, len(t),
             ctx.user_data.get("esperando"))
    if t == "↩️ Cancelar":
        await update.message.reply_text("Listo 👍", reply_markup=ReplyKeyboardRemove())
        await menu(update, ctx)
        return
    esperando = ctx.user_data.pop("esperando", None)
    if esperando == "area":
        v = leer_area(t)
        if v is None:
            ctx.user_data["esperando"] = "area"
            await update.message.reply_text("🤔 No entendí el tamaño. Escribe por ejemplo 300 o 2 ha.")
            return
        st["area"] = v
        await guardar(update, ctx)
        await banco(update, ctx, "")
        return
    await responder(update, ctx, t, st)


# ---------------------------------------------------------------- comandos y enrutador
async def cmd_menu(update: Update, ctx):
    await menu(update, ctx)


async def cmd_ayuda(update: Update, ctx):
    await update.effective_chat.send_message(
        "🙋 <b>Cómo usar Pacha</b>\n\n1️⃣ Dime dónde está tu terreno.\n2️⃣ Elige tu cultivo y mira las rotaciones.\n"
        "3️⃣ Abre el banco de agua para saber cuánto regar.\n\nEscribe /menu cuando quieras volver.",
        parse_mode=HTML, reply_markup=KB([[MENU]]))


async def cmd_borrar(update: Update, ctx):
    await update.effective_chat.send_message("🗑️ ¿Quieres borrar todos tus datos de Pacha? No se puede deshacer.",
                                             reply_markup=KB([[("Sí, borrar todo", "del:si")], [("No", "m")]]))


async def boton(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    from . import campo
    q = update.callback_query
    await q.answer()
    d = q.data or "m"
    log.info("usuario %s → botón %s", update.effective_user.id, d)
    sec, _, arg = d.partition(":")
    if sec == "m":
        await campo.menu(update, ctx)
    elif sec == "mt":
        await menu(update, ctx)
    elif sec == "id":
        await campo.elegir_idioma(update, ctx, arg)
    elif sec == "ch":
        await campo.chakra(update, ctx)
    elif sec == "qs":
        await campo.que_sembrar(update, ctx)
    elif sec == "cr":
        if arg == "cambiar":
            (await estado(update, ctx)).pop("riego", None)
            arg = ""
        await campo.regar(update, ctx, arg)
    elif sec == "vh":
        await campo.helada(update, ctx)
    elif sec == "mas":
        await campo.mas(update, ctx, arg)
    elif sec == "v":
        await campo.escuchar(update, ctx)
    elif sec == "rs":
        if arg == "ok":
            await campo.rotacion_ok(update, ctx)
        elif arg == "plan":
            await rotacion(update, ctx, "plan")
        else:
            await campo.rotacion_simple(update, ctx, arg)
    elif sec == "n" and arg.startswith("m:"):
        await campo.recomendar(update, ctx, int(arg[2:]))
    elif sec == "n" and arg.startswith("t:"):
        await empezar(update, ctx, "m:" + arg[2:])
    elif sec == "t":
        await terreno(update, ctx, arg)
    elif sec == "c":
        await cultivo(update, ctx, arg)
    elif sec == "n":
        await empezar(update, ctx, arg)
    elif sec == "r":
        await rotacion(update, ctx, arg)
    elif sec == "b":
        await banco(update, ctx, arg)
    elif sec == "s":
        await escenario(update, ctx, arg)
    elif sec == "a":
        await helada(update, ctx)
    elif sec == "q":
        await preguntar(update, ctx)
    elif sec == "x":
        await explicar(update, ctx, arg)
    elif sec == "h":
        await ver_historial(update, ctx)
    elif sec == "g":
        await glosario(update, ctx, arg)
    elif sec == "i":
        await sobre_datos(update, ctx)
    elif sec == "del" and arg == "si":
        await asyncio.to_thread(STORE.delete_farmer, update.effective_user.id)
        ctx.user_data.clear()
        await mostrar(update, "🗑️ Borré tus datos. Escribe /start para empezar de nuevo.")


async def error(update: object, ctx: ContextTypes.DEFAULT_TYPE):
    log.error("Error atendiendo un mensaje", exc_info=ctx.error)
    if isinstance(update, Update) and update.effective_chat:
        try:
            await update.effective_chat.send_message("😔 Algo falló. Intenta de nuevo.", reply_markup=KB([[MENU]]))
        except Exception:
            pass


async def precalentar():
    """Descarga en segundo plano los datos de las provincias para que la demo sea rápida."""
    for nombre, lat, lon in PROVINCIAS.values():
        try:
            sitio = await asyncio.to_thread(E.crear_sitio, lat, lon, nombre)
            await asyncio.to_thread(clima_de, sitio)
            log.info("Datos listos: %s", nombre)
        except Exception as e:
            log.warning("No se pudo precalentar %s: %s", nombre, e)


async def post_init(app: Application):
    await app.bot.set_my_commands([BotCommand("start", "Empezar"), BotCommand("menu", "Ver el menú"),
                                   BotCommand("ayuda", "Cómo usar Pacha"), BotCommand("borrar", "Borrar mis datos")])
    await app.bot.set_my_short_description("Tu chacra con datos de la NASA. Sierra del Ecuador 🌄")
    await app.bot.set_my_description("Pacha te ayuda a elegir qué sembrar, comparar rotaciones y calcular "
                                     "cuánta agua darle a tu cultivo, con datos satelitales de la NASA.")
    me = await app.bot.get_me()
    log.info("Bot @%s iniciado. Persistencia: %s. Gemini: %s", me.username, STORE.nombre,
             "activo" if LLM.activo else "no configurado")
    asyncio.get_running_loop().create_task(precalentar())


def _cargar_env():
    env = Path(__file__).resolve().parent.parent / ".env"
    if env.exists():
        for linea in env.read_text(encoding="utf-8").splitlines():
            if "=" in linea and not linea.strip().startswith("#"):
                k, v = linea.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


def main():
    _cargar_env()
    logging.basicConfig(format="%(asctime)s %(levelname)s %(name)s: %(message)s", level=logging.INFO)
    logging.getLogger("httpx").setLevel(logging.WARNING)  # evita imprimir URLs con el token
    global STORE, LLM
    STORE, LLM = crear_storage(), Gemini()
    app = (Application.builder().token(os.environ["TELEGRAM_BOT_TOKEN"]).post_init(post_init)
           .concurrent_updates(True).build())
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("menu", cmd_menu))
    app.add_handler(CommandHandler("ayuda", cmd_ayuda))
    app.add_handler(CommandHandler("borrar", cmd_borrar))
    app.add_handler(CallbackQueryHandler(boton))
    app.add_handler(MessageHandler(filters.LOCATION, ubicacion))
    app.add_handler(MessageHandler(filters.VOICE, nota_de_voz))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, texto_libre))
    app.add_error_handler(error)
    app.run_polling(allowed_updates=Update.ALL_TYPES, drop_pending_updates=True)


if __name__ == "__main__":
    main()
