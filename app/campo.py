"""Modo campo (por defecto): respuestas cortas, con dibujos y audio, para agricultores con poca lectura.

Reglas: una pregunta por pantalla, máximo 3 o 4 líneas cortas, "usted", números solo como cosas que se
pueden contar (veces, baldes, días, meses). Los números técnicos quedan detrás de "📊 Ver los números".
"""
import asyncio
import datetime as dt
import logging

from . import bot as B
from . import charts, clients, voz
from . import engine as E
from .catalog import CROPS, MESES, MESES_LARGO, RIEGO, ROTACIONES_REF
from .kichwa import boton as kb_k
from .kichwa import cultivo as nombre_k
from .kichwa import PALABRAS

log = logging.getLogger("pacha.campo")
DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
NUMEROS = {1: "una vez", 2: "dos veces", 3: "tres veces"}


# ---------------------------------------------------------------- textos sencillos
def cuando(meses: list[int]) -> str:
    """[0,1,2,3,4] -> 'de enero a mayo'; [6,7] -> 'en julio y agosto'. Une meses seguidos, incluso dic-ene."""
    if not meses:
        return ""
    grupos = []
    for m in sorted(meses):
        if grupos and m == grupos[-1][-1] + 1:
            grupos[-1].append(m)
        else:
            grupos.append([m])
    if len(grupos) > 1 and grupos[0][0] == 0 and grupos[-1][-1] == 11:
        grupos[0] = grupos.pop() + grupos[0]
    partes = []
    for g in grupos:
        if len(g) == 1:
            partes.append(f"en {MESES_LARGO[g[0]]}")
        elif len(g) == 2:
            partes.append(f"en {MESES_LARGO[g[0]]} y {MESES_LARGO[g[1]]}")
        else:
            partes.append(f"de {MESES_LARGO[g[0]]} a {MESES_LARGO[g[-1]]}")
    return partes[0] if len(partes) == 1 else ", ".join(partes[:-1]) + " y " + partes[-1]


def clasificar_meses(res: dict):
    tipos = ["lluvia" if p >= 0.8 * e else "seco" if p < 0.5 * e else "medio"
             for p, e in zip(res["lluvia_mes"], res["et0_mes"])]
    heladas = [i for i, p in enumerate(res["prob_helada"]) if p >= 0.2]
    return tipos, heladas


def texto_chakra(sitio, res) -> str:
    tipos, heladas = clasificar_meses(res)
    lluvia = [i for i, t in enumerate(tipos) if t == "lluvia"]
    seco = [i for i, t in enumerate(tipos) if t == "seco"]
    lineas = [f"📍 Su chakra está a {B.num(sitio.elev)} metros de altura."]
    if lluvia:
        lineas.append(f"🌧️ Llueve más {cuando(lluvia)}.")
    if seco:
        lineas.append(f"☀️ Es seco {cuando(seco)}. Esos meses hay que regar.")
    lineas.append(f"❄️ Cuidado con las heladas {cuando(heladas)}." if heladas else "🙂 Casi no caen heladas.")
    tex = (sitio.suelo or {}).get("textura", "")
    if "supuesto" not in tex:
        if "arenoso" in tex:
            lineas.append("🟫 Su tierra es suelta: el agua se va rápido.")
        elif "arcill" in tex:
            lineas.append("🟫 Su tierra es pesada: guarda el agua, no riegue de más.")
        else:
            lineas.append("🟫 Su tierra guarda bien el agua.")
    return "\n".join(lineas)


def razones(e: dict, st: dict) -> list[str]:
    r = []
    if e["leguminosas"]:
        r.append(f"✅ {nombre_k(e['leguminosas'][0], st)} alimenta la tierra.")
    if e["repetidas"] == 0:
        r.append("✅ Cambiar de planta corta las plagas.")
    if e["comp"]["agua"] > 0.6:
        r.append("✅ Pide poca agua.")
    if e["papa_tras_papa"]:
        r.append("❌ Papa tras papa cansa la tierra y trae plagas.")
    for c, m in e["riesgos"][:1]:
        r.append(f"⚠️ Cuidado: helada en {MESES_LARGO[MESES.index(m)]} para {c.nombre.lower()}.")
    return r


def plan_linea(e: dict, st: dict) -> str:
    return " → ".join(f"{c.emoji} {nombre_k(c, st)}" for c in e["crops"])


def baldes(n: float) -> str:
    n = max(round(n * 2) / 2, 0.5)
    if n == 0.5:
        return "medio balde"
    entero, medio = int(n), n % 1 == 0.5
    base = f"{entero} balde" + ("s" if entero > 1 else "")
    return base + (" y medio" if medio else "")


def plan_riego(w: dict, ef: float, textura: str) -> dict:
    """Cuántas veces, qué días y cuánto por vez. Cuadro de 3 por 3 pasos ≈ 5 m², balde = 20 L."""
    necesidad = w["falta"] / ef
    if necesidad < 2:
        n = 0
    elif necesidad <= 10:
        n = 1
    elif necesidad <= 25:
        n = 2
    else:
        n = 3
    if n and "arenoso" in textura and n < 3:
        n += 1
    fechas = [dt.date.fromisoformat(f) for f in w["fechas"]]
    lluvia = w["lluvia_dia"]
    elegidos = []
    for i in sorted(range(len(fechas)), key=lambda i: (lluvia[i], i)):
        if len(elegidos) == n:
            break
        if all(abs(i - j) >= 2 for j in elegidos):
            elegidos.append(i)
    for i in sorted(range(len(fechas)), key=lambda i: lluvia[i]):  # si no hubo días separados
        if len(elegidos) < n and i not in elegidos:
            elegidos.append(i)
    elegidos.sort()
    por_vez_mm = necesidad / n if n else 0
    heladas = {d for d, _ in w["heladas"]}
    dias = [{"fecha": f, "regar": i in elegidos, "helada": f in heladas, "lluvia": lluvia[i]}
            for i, f in enumerate(fechas)]
    return {"veces": n, "dias": [fechas[i] for i in elegidos], "baldes_cuadro": por_vez_mm * 5 / 20,
            "heladas": sorted(heladas), "tira": dias}


# ---------------------------------------------------------------- envío con audio
def _nueva_voz(ctx, texto: str, clave: str | None):
    """Registra el texto de la pantalla actual. El número de turno invalida audios de pantallas anteriores."""
    ctx.user_data["voz"] = texto
    ctx.user_data["voz_clave"] = clave
    ctx.user_data["voz_turno"] = ctx.user_data.get("voz_turno", 0) + 1


async def decir(update, ctx, texto: str, filas_kb: list, foto: bytes | None = None, tecnico: str | None = None,
                clave: str | None = None):
    """Muestra una pantalla sencilla con 🔊 Escuchar y, si existe, 📊 Ver los números.
    clave: nombre de la grabación en kichwa para esta pantalla (app/audios/kichwa/<clave>.ogg)."""
    st = await B.estado(update, ctx)
    _nueva_voz(ctx, texto, clave)
    extra = [("🔊 Escuchar", "v")]
    if tecnico:
        extra.append(("📊 Ver los números", tecnico))
    kb = B.KB(filas_kb + [extra, [B.MENU]])
    await B.mostrar(update, texto, kb, foto=foto)
    if st.get("audio_auto"):
        tarea = escuchar(update, ctx)
        app = getattr(ctx, "application", None)
        app.create_task(tarea) if app else await tarea


async def escuchar(update, ctx):
    """Envía una sola nota de voz: borra la anterior y descarta el audio si el usuario ya cambió de pantalla."""
    texto = ctx.user_data.get("voz")
    if not texto:
        return
    turno = ctx.user_data.get("voz_turno")
    st = await B.estado(update, ctx)
    chat = update.effective_chat
    await chat.send_action("record_voice")
    datos = voz.grabacion_kichwa(ctx.user_data.get("voz_clave")) if st.get("idioma") == "ki" else None
    datos = datos or await voz.audio(texto)
    if ctx.user_data.get("voz_turno") != turno:
        return  # el usuario ya está en otra pantalla: este audio sobra
    anterior = ctx.user_data.pop("audio_msg", None)
    if anterior:
        try:
            await chat.delete_message(anterior)
        except Exception:
            pass
    if datos:
        m = await chat.send_voice(voice=datos)
        ctx.user_data["audio_msg"] = m.message_id
    else:
        await chat.send_message("🔇 No pude preparar el audio ahora. Intente más tarde.")


# ---------------------------------------------------------------- pantallas
async def menu(update, ctx):
    st = await B.estado(update, ctx)
    ctx.user_data.pop("esperando", None)
    nombre = B.esc(update.effective_user.first_name or "vecino")
    saludo = PALABRAS["saludo"] if st.get("idioma") == "ki" else "Hola"
    texto = f"🌄 <b>{saludo}, {nombre}.</b>\n¿Qué necesita hoy?"
    filas = [[(kb_k("📍 Mi chakra", "chakra", st), "ch")],
             [(kb_k("🌱 Qué sembrar", "tarpuy", st), "qs")],
             [(kb_k("💧 Cuánto regar", "yaku", st), "cr")],
             [(kb_k("❄️ ¿Viene helada?", "kasa", st), "vh")],
             [(kb_k("🗣️ Preguntar", "tapuy", st), "q")],
             [(kb_k("➕ Más", "ashtawan", st), "mas")]]
    _nueva_voz(ctx, "Hola. ¿Qué necesita hoy? Mi chakra. Qué sembrar. Cuánto regar. ¿Viene helada? Preguntar.", "menu")
    await B.mostrar(update, texto, B.KB(filas + [[("🔊 Escuchar", "v")]]))
    if st.get("audio_auto"):
        tarea = escuchar(update, ctx)
        app = getattr(ctx, "application", None)
        app.create_task(tarea) if app else await tarea


async def chakra(update, ctx):
    st = await B.estado(update, ctx)
    sitio = B.sitio_de(st)
    if not sitio:
        await decir(update, ctx, "📍 <b>¿Dónde está su chakra?</b>\nPárese en su terreno y toque «Enviar ubicación». "
                    "O elija su provincia.", [[("📍 Enviar ubicación", "t:loc")], [("🗺️ Elegir provincia", "t:prov")]],
                    clave="chakra_pedir")
        return
    clima = await asyncio.to_thread(B.clima_de, sitio)
    await mostrar_chakra(update, ctx, sitio, clima.resumen())


async def mostrar_chakra(update, ctx, sitio, res):
    tipos, heladas = clasificar_meses(res)
    img = await asyncio.to_thread(charts.tira_meses, tipos, heladas, "Su año en la chakra")
    await decir(update, ctx, texto_chakra(sitio, res),
                [[("🌱 Qué sembrar", "qs")], [("📍 Cambiar de lugar", "t")]], foto=img, tecnico="t:info")


async def que_sembrar(update, ctx):
    st = await B.estado(update, ctx)
    if not B.sitio_de(st):
        await chakra(update, ctx)
        return
    texto = "🌱 <b>¿Ya tiene algo sembrado?</b>"
    filas = [[("🌱 Sí, ya sembré", "c:ya")], [("🆕 No, la tierra está libre", "c:new")]]
    if st.get("crop"):
        texto += f"\nAhora tiene: {CROPS[st['crop']].etiqueta}"
        filas.insert(0, [(f"🔁 Ver qué sembrar después", "rs")])
    await decir(update, ctx, texto, filas, clave=None if st.get("crop") else "sembrar_pregunta")


async def recomendar(update, ctx, mes: int):
    st = await B.estado(update, ctx)
    sitio = B.sitio_de(st)
    ctx.user_data["mes_nuevo"] = mes
    msg = await B.espera(update, "⏳ Un momento…")
    clima = await asyncio.to_thread(B.clima_de, sitio)
    recs = await asyncio.to_thread(E.recomendar_para_empezar, sitio, clima, mes, st.get("prio"))
    img = await asyncio.to_thread(charts.tarjeta_cultivos, [f["crop"] for f in recs],
                                  f"Para sembrar en {MESES_LARGO[mes - 1]}", False)
    await B.borrar(msg)
    lineas = [f"🌱 <b>Para sembrar en {MESES_LARGO[mes - 1]} le conviene:</b>"]
    for i, f in enumerate(recs):
        c = f["crop"]
        porque = ("alimenta la tierra" if c.fija_n else "pide poca agua" if f["comp"]["agua"] > 0.6
                  else "se da bien en su altura")
        agua = {"si": "✅ la lluvia alcanza", "cuidado": "⚠️ a veces hay que regar",
                "no": "❌ necesita riego"}[f["banco"]["veredicto"]]
        lineas.append(f"{i + 1}. {c.emoji} {nombre_k(c, st)}: {agua}, {porque}.")
    lineas.append("Toque el que quiere sembrar.")
    filas = [[(f["crop"].etiqueta, f"n:p:{f['crop'].id}")] for f in recs] + [[("📋 Otros cultivos", "n:all")]]
    await decir(update, ctx, "\n".join(lineas), filas, foto=img, tecnico=f"n:t:{mes}")


async def rotacion_simple(update, ctx, arg: str = ""):
    st = await B.estado(update, ctx)
    sitio = B.sitio_de(st)
    if not sitio or not st.get("crop"):
        await que_sembrar(update, ctx)
        return
    res = ctx.user_data.get("comp")
    if arg == "" or res is None:
        msg = await B.espera(update, "⏳ Un momento, estoy pensando…")
        clima = await asyncio.to_thread(B.clima_de, sitio)
        res = await asyncio.to_thread(E.comparar_rotaciones, sitio, clima, st["crop"], st["mes"],
                                      st.get("rot"), st.get("prio"))
        await B.borrar(msg)
        ctx.user_data["comp"] = res
        ctx.user_data["ver_i"] = 0
        st["comp_resumen"] = [{"nombre": e["nombre"], "cultivos": [c.nombre for c in e["crops"]],
                               "puntaje": e["puntaje"], "riesgos": e["tarjeta"]["riesgos"]} for e in res]
        await B.guardar(update, ctx)
    opciones = [e for e in res if e["nombre"] != "Tu rotación"]
    opciones.sort(key=lambda e: -e["puntaje"])
    if arg == "sig":
        ctx.user_data["ver_i"] = (ctx.user_data.get("ver_i", 0) + 1) % len(opciones)
    e = opciones[ctx.user_data.get("ver_i", 0)]
    actual = next((x for x in res if x["nombre"] == "Tu rotación"), None)
    lineas = []
    if actual:
        if actual["puntaje"] >= e["puntaje"] - 5:
            lineas.append(f"👍 <b>Su plan está bien:</b>\n{plan_linea(actual, st)}")
            e = actual
        else:
            lineas.append(f"🤔 Su plan: {plan_linea(actual, st)}")
            problema = [r for r in razones(actual, st) if r.startswith(("❌", "⚠️"))]
            if problema:
                lineas.append(problema[0])
            lineas.append("")
    if e is not actual:
        titulo = "🌱 <b>Mejor siembre así:</b>" if actual else "🌱 <b>Le conviene sembrar así:</b>"
        lineas.append(f"{titulo}\n{plan_linea(e, st)}")
    lineas += razones(e, st)[:3]
    ctx.user_data["elegible"] = e["ids"]
    img = await asyncio.to_thread(charts.tarjeta_cultivos, e["crops"], "Así le conviene sembrar")
    await B.historial(update, "rotacion", "Consejo de siembra: " + " → ".join(c.nombre for c in e["crops"]))
    filas = [[("✅ Sembraré así", "rs:ok")], [("🔄 Otra opción", "rs:sig")],
             [("📝 Yo pensaba sembrar otra cosa", "rs:plan")]]
    await decir(update, ctx, "\n".join(lineas), filas, foto=img, tecnico="r:cmp")


async def rotacion_ok(update, ctx):
    st = await B.estado(update, ctx)
    ids = ctx.user_data.get("elegible")
    if not ids:
        await rotacion_simple(update, ctx)
        return
    st["elegida"] = ids
    await B.guardar(update, ctx)
    await B.historial(update, "rotacion_elegida", "Eligió: " + " → ".join(CROPS[i].nombre for i in ids))
    await decir(update, ctx, f"✅ <b>Listo, lo guardé.</b>\nAhora veamos cuánta agua necesita su "
                f"{CROPS[st['crop']].nombre.lower()}.", [[("💧 Cuánto regar", "cr")]], clave="rotacion_ok")


async def regar(update, ctx, arg: str = ""):
    st = await B.estado(update, ctx)
    sitio = B.sitio_de(st)
    if not sitio:
        await chakra(update, ctx)
        return
    if not st.get("crop"):
        await decir(update, ctx, "💧 Para decirle cuánto regar, primero dígame <b>qué tiene sembrado</b>.",
                    [[("🌱 Qué sembrar", "qs")]])
        return
    if arg.startswith("r:"):
        st["riego"] = arg[2:]
        await B.guardar(update, ctx)
    if not st.get("riego"):
        filas = [[("🪣 Con balde o regadera", "cr:r:b")], [("🌊 Por surcos", "cr:r:g")],
                 [("🚿 Con aspersor", "cr:r:a")], [("💧 Con goteo", "cr:r:d")], [("🌧️ No riego, solo lluvia", "cr:r:n")]]
        await decir(update, ctx, "💧 <b>¿Cómo riega su chakra?</b>", filas, clave="regar_pregunta")
        return
    crop = CROPS[st["crop"]]
    msg = await B.espera(update, "⏳ Mirando el tiempo de esta semana…")
    try:
        w = await asyncio.to_thread(E.riego_semana, sitio, crop, dt.date.fromisoformat(st["fecha"]))
        clima = await asyncio.to_thread(B.clima_de, sitio)
        b, _, _ = await asyncio.to_thread(E.analisis_cultivo, clima, crop, st["mes"])
    except Exception:
        log.exception("riego")
        await B.borrar(msg)
        await decir(update, ctx, "😔 No pude ver el tiempo ahora. Intente más tarde.", [])
        return
    await B.borrar(msg)
    nombre = nombre_k(crop, st).lower()
    if w["dia"] > crop.ciclo_dias + 15:
        await decir(update, ctx, f"🌾 Su {nombre} ya debería estar cosechado. ¿Qué siembra ahora?",
                    [[("🌱 Qué sembrar", "qs")]])
        return
    ef = RIEGO[st["riego"]][1]
    p = plan_riego(w, ef, (sitio.suelo or {}).get("textura", ""))
    lineas = []
    if w["dia"] < 0:
        lineas.append(f"🌱 Todavía no siembra su {nombre}. Antes de sembrar, moje bien la tierra.")
    if p["veces"] == 0:
        lineas.append("🌧️ <b>Esta semana no necesita regar.</b> La lluvia alcanza.")
    elif st["riego"] == "n":
        lineas.append(f"⚠️ <b>Esta semana a su {nombre} le falta agua.</b>\nSi puede, guarde agua de lluvia en tanques.")
    else:
        dias = " y el ".join(DIAS[d.weekday()] for d in p["dias"])
        lineas.append(f"💧 <b>Esta semana riegue {NUMEROS[p['veces']]}: el {dias}.</b>")
        cuanto = baldes(p["baldes_cuadro"])
        if st["riego"] in ("b", "d"):
            lineas.append(f"🪣 Cada vez: {cuanto} por cada cuadro de 3 por 3 pasos.")
        elif st["riego"] == "g":
            lineas.append("🌊 Deje correr el agua por los surcos hasta que la tierra se moje un palmo de hondo.")
        else:
            lineas.append(f"🚿 Riegue hasta que la tierra se moje un palmo de hondo (como {cuanto} por cada "
                          "cuadro de 3 por 3 pasos).")
        lineas.append("👆 Antes de regar, meta el dedo en la tierra. Si está húmeda, espere un día.")
    if p["heladas"]:
        d = p["heladas"][0]
        lineas.append(f"❄️ El {DIAS[d.weekday()]} puede caer helada: riegue un poco la tarde anterior.")
    if b["total_falta"] >= 5 and crop.id != "descanso":
        lineas.append(f"📅 Su {nombre} pedirá más agua en {b['mes_critico']}.")
    img = await asyncio.to_thread(charts.tira_semana, p["tira"], "Su semana")
    await B.historial(update, "semana", f"Riego {crop.nombre}: {p['veces']} veces esta semana")
    await decir(update, ctx, "\n".join(lineas), [[("🔁 Cambiar forma de riego", "cr:cambiar")]], foto=img,
                tecnico="b")


async def helada(update, ctx):
    st = await B.estado(update, ctx)
    sitio = B.sitio_de(st)
    if not sitio:
        await chakra(update, ctx)
        return
    try:
        f = await asyncio.to_thread(clients.forecast_week, sitio.lat, sitio.lon)
    except Exception:
        await decir(update, ctx, "😔 No pude ver el tiempo ahora. Intente más tarde.", [])
        return
    tira, dias_helada = [], []
    for d, t, ll in zip(f["fecha"], f["tmin"], f["lluvia"]):
        fecha = dt.date.fromisoformat(d)
        h = t is not None and t <= E.FROST_T
        if h:
            dias_helada.append(fecha)
        tira.append({"fecha": fecha, "regar": False, "helada": h, "lluvia": ll or 0})
    if dias_helada:
        nombres = " y el ".join(DIAS[d.weekday()] for d in dias_helada[:3])
        texto = (f"❄️ <b>Puede caer helada el {nombres}</b>, en la madrugada.\n"
                 "👉 Riegue un poco la tarde anterior: la tierra húmeda guarda calor.\n"
                 "👉 Tape las plantas pequeñas.")
    else:
        texto = "🙂 <b>Esta semana no viene helada.</b>"
    img = await asyncio.to_thread(charts.tira_semana, tira, "Heladas esta semana")
    await decir(update, ctx, texto, [], foto=img, tecnico="a", clave=None if dias_helada else "helada_no")


async def mas(update, ctx, arg: str = ""):
    st = await B.estado(update, ctx)
    if arg == "audio":
        st["audio_auto"] = not st.get("audio_auto")
        await B.guardar(update, ctx)
    elif arg.startswith("id:"):
        st["idioma"] = arg[3:]
        await B.guardar(update, ctx)
    audio = "🔊 Audio automático: sí" if st.get("audio_auto") else "🔈 Audio automático: no"
    idioma = "🗣️ Idioma: Kichwa · Español" if st.get("idioma") == "ki" else "🗣️ Idioma: Español"
    otro = "mas:id:es" if st.get("idioma") == "ki" else "mas:id:ki"
    filas = [[(audio, "mas:audio")], [(idioma, otro)], [("📜 Mi historial", "h")],
             [("🌦️ ¿Y si cambia el clima?", "s")], [("📖 Palabras del campo", "g")],
             [("ℹ️ Sobre los datos", "i")], [("🧑‍🔬 Modo técnico", "mt")]]
    await B.mostrar(update, "➕ <b>Más opciones</b>", B.KB(filas + [[B.MENU]]))


async def elegir_idioma(update, ctx, idioma: str):
    st = await B.estado(update, ctx)
    st["idioma"] = idioma
    await B.guardar(update, ctx)
    await menu(update, ctx)


def de_cada_10(n, total) -> str:
    return f"{round(10 * n / total)} de cada 10"


async def decision(update, ctx):
    """¿Conviene sembrar este cultivo en este mes? Veredicto, semáforo mes a mes y confianza de los datos."""
    st = await B.estado(update, ctx)
    sitio = B.sitio_de(st)
    if not sitio or not st.get("crop"):
        await que_sembrar(update, ctx)
        return
    crop = CROPS[st["crop"]]
    msg = await B.espera(update, "⏳ Revisando 24 años de lluvia…")
    clima = await asyncio.to_thread(B.clima_de, sitio)
    b, _, _ = await asyncio.to_thread(E.analisis_cultivo, clima, crop, st["mes"])
    fuentes = await asyncio.to_thread(E.comparar_fuentes, sitio, clima)
    nombre, mes = nombre_k(crop, st).lower(), MESES_LARGO[st["mes"] - 1]
    img = await asyncio.to_thread(charts.semaforo, crop, b["meses"], b["estado_mes"], f"Su {nombre} mes a mes")
    await B.borrar(msg)
    veces = de_cada_10(b["n_bien"], b["anios"])
    if b["veredicto"] == "si":
        lineas = [f"✅ <b>Sí, es buen momento para sembrar {nombre} en {mes}.</b>",
                  f"En {veces} años la lluvia alcanzó."]
    elif b["veredicto"] == "cuidado":
        lineas = [f"⚠️ <b>Sí, pero tenga agua para regar en {b['mes_critico']}.</b>",
                  f"En {veces} años la lluvia alcanzó."]
    else:
        lineas = [f"❌ <b>Mejor no siembre {nombre} en {mes} sin riego.</b>",
                  f"Solo en {veces} años la lluvia alcanzó."]
    lineas.append(f"🌾 Cosecha más o menos en {MESES_LARGO[b['mes_ids'][-1] - 1]}.")
    if fuentes:
        lineas.append({"alta": "🔎 Dos fuentes de datos dicen lo mismo.",
                       "media": "🔎 Las fuentes de datos se parecen. Confirme con su experiencia.",
                       "baja": "🔎 Las fuentes de datos no coinciden. Pregunte a su técnico."}[fuentes["confianza"]])
    await B.historial(update, "decision", f"{crop.nombre} en {mes}: {b['veredicto']} ({veces} años bien)")
    filas = [[("🔁 Qué sembrar después", "rs")], [("💧 Cuánto regar", "cr")], [("📚 Rotaciones probadas", "rs:ref")]]
    await decir(update, ctx, "\n".join(lineas), filas, foto=img, tecnico="b")


def _agua_rotacion(e) -> str:
    return "🟢 el agua alcanza" if e["falta_anual"] < 30 else "🟡 hay que regar a veces" if e["falta_anual"] < 100 \
        else "🔴 necesita riego"


async def rotaciones_probadas(update, ctx, arg: str = ""):
    """Rotaciones de referencia del equipo (ensayo Illangama, INIAP) evaluadas con el clima de su chakra."""
    st = await B.estado(update, ctx)
    sitio = B.sitio_de(st)
    if not sitio:
        await chakra(update, ctx)
        return
    if arg.startswith("usa:"):
        ref = ROTACIONES_REF[arg[4:]]
        ctx.user_data["elegible"] = ref["secuencia"]
        if not st.get("crop"):
            st["crop"], st["mes"] = ref["secuencia"][0], dt.date.today().month % 12 + 1
            st["fecha"] = dt.date(dt.date.today().year + (st["mes"] == 1), st["mes"], 1).isoformat()
        await rotacion_ok(update, ctx)
        return
    clima = await asyncio.to_thread(B.clima_de, sitio)
    mes = st.get("mes") or dt.date.today().month % 12 + 1
    evals = {}
    for rid, ref in ROTACIONES_REF.items():
        ids = [i for i in ref["secuencia"] if i in CROPS]
        evals[rid] = await asyncio.to_thread(E.evaluar_rotacion, sitio, clima, ids, mes)
    if arg == "tec":
        lineas = [f"📚 <b>Rotaciones de referencia</b> (desde {MESES_LARGO[mes - 1]})"]
        for rid, ref in ROTACIONES_REF.items():
            e = evals[rid]
            lineas.append(f"\n<b>{rid} · {ref['titulo']}</b>: {' → '.join(c.nombre for c in e['crops'])}\n"
                          f"Riego: {B.num(e['falta_anual'])} L/m² por año · suelo cubierto {B.num(e['cubierto'] * 100)} %\n"
                          f"✅ {B.esc(ref['beneficio'])}\n🕳️ {B.esc(ref['por_confirmar'])}")
        await B.mostrar(update, "\n".join(lineas), B.KB([[("⬅️ Volver", "rs:ref")], [B.MENU]]))
        return
    lineas = ["📚 <b>Rotaciones probadas en la sierra</b>"]
    for rid in ("R1", "R2"):
        ref, e = ROTACIONES_REF[rid], evals[rid]
        lineas.append(f"\n<b>{ref['titulo']}</b>: {plan_linea(e, st)}\n💧 {_agua_rotacion(e)}")
    lineas.append(f"\n❌ Papa → Papa → Descanso cansa la tierra.")
    mejor = min(("R1", "R2"), key=lambda r: evals[r]["falta_anual"])
    img = await asyncio.to_thread(charts.tarjeta_cultivos, evals[mejor]["crops"], ROTACIONES_REF[mejor]["titulo"])
    filas = [[(f"✅ Usar {ROTACIONES_REF[r]['titulo']}", f"rs:usa:{r}")] for r in ("R1", "R2")]
    await decir(update, ctx, "\n".join(lineas), filas, foto=img, tecnico="rs:tec")
