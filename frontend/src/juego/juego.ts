// Astro Granja: controlador del juego. Todo número viene de la API de Pacha; aquí solo se dibuja y se anima.
import { consultar, esc, MESES, MESES_CORTOS, num } from "../lib/api";
import { guardar, leer, tieneParcela } from "../lib/estado";
import { cargar, colorSuelo, guardarJuego, MEDALLAS, N_PARCELAS, nuevo, type Juego } from "./estado";
import { crearMapa, RADIO_DEMO } from "./mapa";
import { crearMundo2D } from "./mundo2d";
import { ETAPAS, type Mundo, type Terreno, type VistaParcela } from "./mundo";
import { decir, desbloquearAudio, estaSilenciado, PACHITA_SVG, silenciar } from "./pachita";

type Cultivo = { id: string; nombre: string; emoji: string; foto: string | null; familia: string; fija_n: boolean;
  ciclo_dias: number; apto?: boolean; en_epoca?: boolean; se_puede?: boolean; razon?: string; epoca_texto?: string };
type Dia = { fecha: string; lluvia: number; gasto: number; riego: number; humedad: number; falta: number; seco: boolean; etapa: string };
type Ciclo = { cultivo: Cultivo; mes: number; anio: number; dias: Dia[]; taw_mm: number; puntaje: number; estrellas: number;
  en_epoca: boolean; epoca: string | null; veredicto: string; estado_mes: string[]; meses: string[]; litros_por_mm: number;
  tanque_litros: number; dias_secos: number };

const DESCANSO: Cultivo = { id: "descanso", nombre: "Descanso con cobertura", emoji: "🍀", foto: null, familia: "ninguna",
  fija_n: false, ciclo_dias: 120, se_puede: true, apto: true, en_epoca: true };
const VEREDICTO: Record<string, string> = { si: "La lluvia suele alcanzar", cuidado: "Hay que regar a veces", no: "Necesita riego" };

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
let J: Juego = cargar();
let mundo: Mundo | null = null;
let terreno: Terreno | null = null;
let parcelaInfo: any = null;
let semillasInfo: { meses_zona: number[]; siembra_por_mes: number[]; cultivos: Cultivo[] } | null = null;
const ciclos = new Map<number, Ciclo>();
const cultivos = new Map<string, Cultivo>([["descanso", DESCANSO]]);
let semillaElegida: string | null = null;
let auto: number | null = null;
const avisos = new Set<string>();

function lugar() { return leer(); }
function radioActual() { return Math.sqrt((lugar().area_m2 || Math.PI * RADIO_DEMO ** 2) / Math.PI); }
function m2Parcela() { return Math.round((lugar().area_m2 || 2500) / N_PARCELAS); }
function guardarTodo() { guardarJuego(J); pintarHud(); }

// ---------------------------------------------------------------- utilidades de texto
const fecha = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return `${d} de ${MESES[m - 1]} · año ${y}`; };
function agua(litros: number) {
  if (litros < 1000) return `${num(Math.max(1, Math.round(litros / 20)))} baldes`;
  if (litros < 20000) return `${num(Math.round(litros / 200))} tanques de 200 L`;
  return `${num(Math.round(litros / 10000))} tanqueros`;
}
const nombreCorto = (id: string) => (cultivos.get(id)?.nombre || id).toLowerCase();

// ---------------------------------------------------------------- paneles
function abrirPanel(titulo: string, html: string, clase = "") {
  const p = $("#panel");
  p.className = `panel ${clase}`;
  p.innerHTML = `<div class="panel-cabeza"><h2>${esc(titulo)}</h2><button class="cerrar" type="button" aria-label="Cerrar">✕</button></div>
    <div class="panel-cuerpo">${html}</div>`;
  p.hidden = false;
  p.querySelector(".cerrar")!.addEventListener("click", cerrarPanel);
  return p;
}
function cerrarPanel() { $("#panel").hidden = true; }

// ---------------------------------------------------------------- 1. inicio y mapa
function inicio() {
  $("#pachita").innerHTML = PACHITA_SVG;
  document.addEventListener("pointerdown", desbloquearAudio, { once: true });
  $("#silencio").addEventListener("click", () => {
    silenciar(!estaSilenciado());
    $("#silencio").textContent = estaSilenciado() ? "🔇" : "🔊";
  });
  const guardado = tieneParcela();
  if (guardado) {
    abrirPanel("¡Hola otra vez!", `<p class="grande">¿Seguimos en tu chacra de <b>${esc(lugar().nombre || "la sierra")}</b>?</p>
      <div class="fila-botones"><button class="btn-juego grande" data-seguir>▶ Seguir jugando</button>
      <button class="btn-juego borde" data-nueva>🗺️ Otra chacra</button></div>`, "centro");
    $("[data-seguir]").addEventListener("click", () => { cerrarPanel(); entrarMundo(); });
    $("[data-nueva]").addEventListener("click", () => { J = nuevo(); guardarJuego(J); cerrarPanel(); pantallaMapa(); });
    decir("¡Hola otra vez! ¿Seguimos cuidando tu chacra?");
  } else {
    pantallaMapa();
  }
}

function pantallaMapa() {
  $("#escena").hidden = true;
  document.body.classList.add("en-mapa");
  const cont = $("#mapa");
  cont.hidden = false;
  const e = lugar();
  const m = crearMapa(cont, { lat: e.lat ?? -1.6466, lon: e.lon ?? -78.7437, radio: Math.round(radioActual()) }, (l) => {
    guardar({ lat: l.lat, lon: l.lon, area_m2: Math.PI * l.radio * l.radio, nombre: l.nombre, provincia: undefined });
    J = nuevo();
    guardarJuego(J);
    m.destruir();
    cont.hidden = true;
    document.body.classList.remove("en-mapa");
    entrarMundo();
  });
  decir("¡Hola! Soy Pachita. Mueve el mapa hasta tu chacra y ajusta el círculo a su tamaño.");
}

// ---------------------------------------------------------------- 2. mundo 3D
async function entrarMundo() {
  $("#escena").hidden = false;
  $("#hud").hidden = false;
  const cont = $("#mundo");
  cont.innerHTML = `<div class="cargando-mundo"><div class="girar"></div><p>Dibujando tu chacra…</p></div>`;
  decir("Estoy dibujando tu chacra con su forma real. ¡Un momento!", "pensando");
  try {
    terreno = await consultar<Terreno>("terreno", { n: 17 });
  } catch (err) {
    cont.innerHTML = `<div class="cargando-mundo"><p>${esc((err as Error).message)}</p><button class="btn-juego" data-r>Intentar otra vez</button></div>`;
    $("[data-r]").addEventListener("click", entrarMundo);
    decir("No pude traer la forma de tu chacra. Revisa la señal y toca de nuevo.", "preocupada");
    return;
  }
  cont.innerHTML = "";
  mundo?.destruir();
  try {
    if (new URLSearchParams(location.search).has("sin3d")) throw new Error("modo 2D pedido");
    const m3d = await import("./mundo3d");
    if (!m3d.hayWebGL()) throw new Error("sin WebGL");
    mundo = m3d.crearMundo3D(cont, terreno, terreno.centro);
  } catch {
    mundo = crearMundo2D(cont, terreno.desnivel_m);
    $("#aviso2d").hidden = false;
  }
  mundo.alTocar(tocarParcela);
  if (terreno.sin_relieve) avisoBreve("Sin datos de relieve: tu chacra se ve plana.");
  pintarMundo();
  pintarControles();
  await leerTierra(J.mes === null);
}

function avisoBreve(t: string) {
  const a = $("#aviso");
  a.textContent = t;
  a.hidden = false;
  setTimeout(() => (a.hidden = true), 4000);
}

// ---------------------------------------------------------------- 3. mi tierra: cartas
async function leerTierra(abrir = true) {
  try {
    const [p, accion] = await Promise.all([
      consultar("parcela"),
      fetch("/api/accion", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "tierra", estado: { lat: lugar().lat, lon: lugar().lon, radio: radioActual() } }) })
        .then((r) => r.json()).catch(() => null),
    ]);
    parcelaInfo = p;
    guardar({ provincia: p.lugar.provincia });
    pintarHud();
    const texto = accion?.mensajes?.find((m: any) => m.tipo === "texto")?.texto as string | undefined;
    if (abrir) mostrarCartas();
    if (J.mes === null) {
      await decir(texto ? texto.split("\n").slice(0, 2).join(" ") : `Tu tierra está a ${num(p.lugar.elev)} metros.`);
    }
  } catch (err) {
    decir("No pude leer tu tierra. Revisa la señal y toca 📋.", "preocupada");
  }
}

function mostrarCartas() {
  const p = parcelaInfo;
  if (!p) return;
  const c = p.clima, t = p.tendencia, s = p.suelo;
  const barras = c.humedad_mes.map((h: number, i: number) =>
    `<span class="barra-h" style="--h:${Math.max(6, h * 100)}%;--c:${h >= 0.6 ? "#2e7d32" : h >= 0.3 ? "#f9a825" : "#c62828"}" title="${MESES[i]}"><i></i><b>${MESES_CORTOS[i][0].toUpperCase()}</b></span>`).join("");
  const carta = (icono: string, titulo: string, valor: string, detalle: string, color: string) =>
    `<article class="carta" style="--color:${color}"><div class="carta-icono">${icono}</div><h3>${titulo}</h3>
      <p class="carta-valor">${valor}</p><p class="carta-detalle">${detalle}</p></article>`;
  abrirPanel("Mi tierra", `<div class="cartas">
    ${carta("🏔️", "Altura", `${num(p.lugar.elev)} m`, `${esc(p.lugar.area_texto)}${p.pendiente ? ` · terreno ${p.pendiente.clase}` : ""}`, "#6d4c41")}
    ${carta("🟫", "Suelo", esc(cap(s.textura)), s.mo ? `Materia orgánica ${num(s.mo, 1)} % · guarda agua ${s.guarda}` : `Guarda agua ${s.guarda}`, "#8d6e63")}
    ${carta("🌧️", "Lluvia al año", `${num(c.lluvia_anual)} mm`, `Año seco: ${num(c.lluvia_seca)} mm`, "#1e6fb8")}
    ${carta("☀️", "Se evapora", `${num(c.et0_anual)} mm`, c.et0_anual > c.lluvia_anual ? "Más de lo que llueve" : "Menos de lo que llueve", "#e65100")}
    ${carta("🌡️", "Temperatura", `${num(c.tmin)} a ${num(c.tmax)} °C`, `Días de calor fuerte: ${t.calor_dias}`, "#d84315")}
    ${carta("📈", "Última década", `Lluvia ${t.cambio_lluvia_pct > 0 ? "+" : ""}${t.cambio_lluvia_pct} %`, `Temperatura ${t.cambio_temp_c > 0 ? "+" : ""}${num(t.cambio_temp_c, 1)} °C`, "#6a1b9a")}
    <article class="carta ancha" style="--color:#2e7d32"><div class="carta-icono">💧</div><h3>Humedad del suelo mes a mes</h3>
      <div class="barras-h">${barras}</div></article>
  </div>
  <p class="fuente">Datos de NASA POWER ${esc(p.periodo)}, FAO-56 y SoilGrids. Relieve: Open-Meteo.</p>
  ${J.mes === null ? `<button class="btn-juego grande" data-sig>📅 Elegir el mes de siembra</button>` : ""}`, "cartas-panel");
  document.querySelector("[data-sig]")?.addEventListener("click", () => abrirCalendario());
}

// ---------------------------------------------------------------- 4. calendario
async function cargarSemillas(mes: number) {
  const s = await consultar<{ meses_zona: number[]; siembra_por_mes: number[]; cultivos: Cultivo[] }>("semillas", { mes });
  semillasInfo = s;
  s.cultivos.forEach((c) => cultivos.set(c.id, c));
  return s;
}

async function abrirCalendario() {
  if (J.sembrado) { decir("Primero cosecha lo que está sembrado. Luego elegimos otro mes."); return; }
  const actual = J.mes ?? (new Date().getMonth() + 1) % 12 + 1;
  let s = semillasInfo;
  try { s = s ?? (await cargarSemillas(actual)); } catch { decir("No pude traer el calendario. Revisa la señal.", "preocupada"); return; }
  const cuenta = s!.siembra_por_mes;
  const maximo = Math.max(...cuenta, 1);
  const zona = new Set(cuenta.map((c, i) => (c >= Math.max(1, maximo * 0.6) ? i + 1 : 0)).filter(Boolean));
  const tono = (c: number) => (c === 0 ? "#e3dccb" : `hsl(110 ${35 + 30 * (c / maximo)}% ${78 - 38 * (c / maximo)}%)`);
  const r = 120, cx = 140, cy = 140;
  const porciones = MESES_CORTOS.map((m, i) => {
    const a0 = ((i - 3) / 12) * Math.PI * 2, a1 = ((i - 2) / 12) * Math.PI * 2;
    const p = (a: number, rr: number) => `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`;
    const am = (a0 + a1) / 2;
    return `<g class="mes ${actual === i + 1 ? "elegido" : ""}" data-mes="${i + 1}" tabindex="0" role="button" aria-label="${MESES[i]}: ${cuenta[i]} cultivos en época">
      <path style="fill:${actual === i + 1 ? "var(--sol)" : tono(cuenta[i])}" d="M${p(a0, 46)} L${p(a0, r)} A${r} ${r} 0 0 1 ${p(a1, r)} L${p(a1, 46)} A46 46 0 0 0 ${p(a0, 46)} Z"/>
      <text x="${cx + 92 * Math.cos(am)}" y="${cy + 92 * Math.sin(am) + 2}" text-anchor="middle">${m}</text>
      <text class="cuenta" x="${cx + 66 * Math.cos(am)}" y="${cy + 66 * Math.sin(am) + 5}" text-anchor="middle">${cuenta[i]}</text></g>`;
  }).join("");
  abrirPanel("¿Cuándo siembras?", `<svg class="rueda" viewBox="0 0 280 280">${porciones}<circle cx="${cx}" cy="${cy}" r="40" fill="#fff8ec"/>
      <text x="${cx}" y="${cy + 8}" text-anchor="middle" class="rueda-centro">📅</text></svg>
    <p class="leyenda">El número dice cuántas semillas se siembran ese mes en tu zona. Más verde = mejor época.</p>`, "centro");
  decir("Los meses más verdes son la mejor época de siembra en tu zona. ¡Toca uno!");
  document.querySelectorAll<SVGGElement>(".rueda .mes").forEach((g) => {
    const elegir = async () => {
      const mes = Number(g.dataset.mes);
      J.mes = mes;
      guardarTodo();
      try { await cargarSemillas(mes); } catch { decir("No pude traer las semillas. Revisa la señal.", "preocupada"); return; }
      decir(zona.has(mes) ? `¡${MESES[mes - 1][0].toUpperCase() + MESES[mes - 1].slice(1)} es buena época! Elige tus semillas.`
        : `En ${MESES[mes - 1]} casi nada se siembra aquí. Mira qué semillas quedan.`, zona.has(mes) ? "feliz" : "pensando");
      abrirSemillas();
    };
    g.addEventListener("click", elegir);
    g.addEventListener("keydown", (e) => { if ((e as KeyboardEvent).key === "Enter") elegir(); });
  });
}

// ---------------------------------------------------------------- 5. banco de semillas
function sobre(c: Cultivo) {
  const img = c.foto ? `<img src="${c.foto}" alt="" loading="lazy">` : `<span class="sobre-emoji">${c.emoji}</span>`;
  return `<button type="button" class="sobre ${c.se_puede ? "" : "bloqueado"} ${semillaElegida === c.id ? "elegido" : ""}" data-crop="${c.id}">
    <span class="sobre-foto">${img}${c.se_puede ? "" : '<span class="candado">🔒</span>'}</span>
    <span class="sobre-nombre">${c.emoji} ${esc(c.nombre)}</span>
    ${c.fija_n ? '<span class="sello-n" title="Alimenta la tierra">N+</span>' : ""}</button>`;
}

function abrirSemillas() {
  if (!semillasInfo || J.mes === null) { abrirCalendario(); return; }
  const lista = [...semillasInfo.cultivos];
  if (J.temporada > 1) lista.unshift(DESCANSO);
  const p = abrirPanel(`Semillas para ${MESES[J.mes - 1]}`, `<p class="ayuda">Toca una semilla y luego una franja de tu chacra (o arrástrala).</p>
    <div class="sobres">${lista.map(sobre).join("")}</div>
    <div class="fila-botones"><button class="btn-juego borde" data-mes>📅 Cambiar mes</button>
    <button class="btn-juego" data-guia>🧑‍🌾 Cómo sembrar</button></div>`, "semillas-panel");
  p.querySelector("[data-mes]")!.addEventListener("click", abrirCalendario);
  p.querySelector("[data-guia]")!.addEventListener("click", guiaSembrar);
  p.querySelectorAll<HTMLButtonElement>(".sobre").forEach((b) => arrastrable(b));
}

function elegirSemilla(id: string) {
  const c = cultivos.get(id)!;
  if (!c.se_puede) { decir(`${c.nombre}: ${c.razon}.`, "pensando"); return false; }
  semillaElegida = id;
  document.querySelectorAll(".sobre").forEach((s) => s.classList.toggle("elegido", (s as HTMLElement).dataset.crop === id));
  decir(id === "descanso" ? "Dejar descansar la tierra con hierbas y trébol la cura. Toca una franja."
    : `${c.nombre}. ¡Toca una franja de tu chacra para sembrar!`);
  return true;
}

function arrastrable(b: HTMLButtonElement) {
  let fantasma: HTMLElement | null = null, x0 = 0, y0 = 0, movio = false;
  b.addEventListener("pointerdown", (e) => {
    x0 = e.clientX; y0 = e.clientY; movio = false;
    b.setPointerCapture(e.pointerId);
  });
  b.addEventListener("pointermove", (e) => {
    if (!b.hasPointerCapture(e.pointerId)) return;
    if (!movio && Math.hypot(e.clientX - x0, e.clientY - y0) > 12) {
      if (!elegirSemilla(b.dataset.crop!)) { b.releasePointerCapture(e.pointerId); return; }
      movio = true;
      fantasma = document.createElement("div");
      fantasma.className = "fantasma";
      fantasma.textContent = cultivos.get(b.dataset.crop!)!.emoji;
      document.body.appendChild(fantasma);
      $("#panel").classList.add("transparente");
    }
    if (fantasma) { fantasma.style.left = `${e.clientX}px`; fantasma.style.top = `${e.clientY}px`; mundo?.resaltar(mundo.parcelaEn(e.clientX, e.clientY)); }
  });
  b.addEventListener("pointerup", (e) => {
    $("#panel").classList.remove("transparente");
    if (fantasma) {
      fantasma.remove(); fantasma = null;
      const i = mundo?.parcelaEn(e.clientX, e.clientY) ?? null;
      mundo?.resaltar(null);
      if (i !== null) { cerrarPanel(); sembrar(i); }
    } else if (!movio) {
      if (elegirSemilla(b.dataset.crop!)) cerrarPanel();
    }
  });
}

function guiaSembrar() {
  const pend = parcelaInfo?.pendiente?.clase;
  const pasos = [
    ["🪓", "Prepara la tierra", "Afloja el suelo y saca las piedras grandes."],
    pend === "fuerte" || pend === "suave"
      ? ["〰️", "Surcos en curva", "Tu chacra tiene pendiente: haz los surcos atravesados, siguiendo la curva del cerro, para que el agua no se lleve la tierra."]
      : ["📏", "Surcos rectos", "Tu chacra es casi plana: los surcos pueden ir rectos."],
    ["↔️", "Deja espacio", "Cada planta necesita su lugar para crecer y recibir sol."],
    ["💩", "Abono", "Pon abono de animales bien descompuesto o compost en el surco."],
    ["🌱", "Siembra y tapa", "Siembra no muy hondo y tapa con tierra suelta."],
  ];
  abrirPanel("Cómo sembrar", `<ol class="guia">${pasos.map(([i, t, d]) => `<li><span>${i}</span><div><b>${t}</b><p>${d}</p></div></li>`).join("")}</ol>
    <button class="btn-juego grande" data-v>🌱 Volver a las semillas</button>`);
  $("[data-v]").addEventListener("click", abrirSemillas);
  decir(pend === "fuerte" || pend === "suave" ? "Tu chacra tiene pendiente: haz los surcos en curva para cuidar la tierra." : "Afloja la tierra, pon abono y siembra no muy hondo.");
}

// ---------------------------------------------------------------- 6. sembrar
async function pedirCiclo(i: number) {
  const pc = J.parcelas[i];
  const c = await consultar<Ciclo>("ciclo", { crop: pc.crop!, mes: J.mes!, m2: m2Parcela(), riegos: pc.riegos,
    ...(J.anio ? { anio: J.anio } : {}) });
  ciclos.set(i, c);
  cultivos.set(c.cultivo.id, { ...cultivos.get(c.cultivo.id), ...c.cultivo } as Cultivo);
  return c;
}

async function sembrar(i: number) {
  const pc = J.parcelas[i];
  if (J.sembrado) { decir("La temporada ya empezó. Espera la cosecha para sembrar de nuevo."); return; }
  if (!semillaElegida) { abrirSemillas(); return; }
  const id = semillaElegida;
  const antes = pc.crop;
  pc.crop = id;
  pc.riegos = [];
  try {
    const c = await pedirCiclo(i);
    if (!J.anio) J.anio = c.anio;
  } catch {
    pc.crop = antes;
    decir("No pude sembrar: revisa la señal y toca otra vez.", "preocupada");
    return;
  }
  guardarTodo();
  pintarMundo();
  const c = cultivos.get(id)!;
  const n = J.parcelas.filter((p) => p.crop).length;
  decir(id === "descanso" ? `La franja ${i + 1} descansará con cobertura.` :
    `¡Sembraste ${c.nombre.toLowerCase()} en la franja ${i + 1}!${n < N_PARCELAS ? " Puedes sembrar otra franja." : ""}`);
  pintarControles();
}

function empezarTemporada() {
  const plantadas = J.parcelas.map((p, i) => [p, i] as const).filter(([p]) => p.crop);
  if (!plantadas.length) { decir("Primero siembra al menos una franja."); abrirSemillas(); return; }
  // salud de la tierra: puntos del juego según lo que enseñan los casos de rotación
  let cambio = 0, desnuda = false;
  const razones: string[] = [];
  J.parcelas.forEach((p) => {
    const prev = p.historial[p.historial.length - 1];
    if (!p.crop) { desnuda = true; return; }
    const c = cultivos.get(p.crop)!;
    if (p.crop === "descanso") { cambio += 10; return; }
    if (c.fija_n) { cambio += 12; ganar("leguminosa"); }
    if (prev && prev !== "descanso") {
      if (cultivos.get(prev)?.familia === c.familia) { cambio -= 15; razones.push(`la ${c.nombre.toLowerCase()} repite la familia de antes y eso trae plagas`); }
      else cambio += 5;
    }
  });
  if (desnuda && (parcelaInfo?.clima?.meses_lluvia?.length || 0) > 0) {
    cambio -= 5;  // tierra desnuda en meses de aguacero se lava
    razones.push("hay franjas sin cubrir y los aguaceros lavan la tierra desnuda");
  }
  J.salud = Math.max(0, Math.min(100, J.salud + cambio));
  J.tanque = J.tanqueMax = plantadas.reduce((s, [, i]) => s + (ciclos.get(i)?.tanque_litros || 0), 0);
  J.sembrado = true;
  J.dia = 0;
  guardarTodo();
  if (J.salud >= 85) ganar("sana");
  cerrarPanel();
  pintarMundo();
  pintarControles();
  decir(razones.length ? `Ojo: ${razones[0]}. ¡Ahora avanza el tiempo!`
    : "¡Listo! Avanza el tiempo con los botones y mira crecer tu chacra.");
}

// ---------------------------------------------------------------- 7. el tiempo pasa
function vista(i: number): VistaParcela {
  const p = J.parcelas[i], c = ciclos.get(i);
  const info = p.crop ? cultivos.get(p.crop) : null;
  if (!p.crop || p.cosechada || !c) return { crop: p.cosechada ? null : p.crop, familia: info?.familia || null, emoji: info?.emoji || "🌱",
    etapa: p.crop && !p.cosechada ? 1 : 0, marchita: false, lista: false };
  const n = c.dias.length;
  if (!J.sembrado) return { crop: p.crop, familia: info!.familia, emoji: info!.emoji, etapa: 1, marchita: false, lista: false };
  const d = Math.min(J.dia, n - 1);
  const ultimos = c.dias.slice(Math.max(0, d - 4), d + 1);
  return { crop: p.crop, familia: info!.familia, emoji: info!.emoji, etapa: J.dia >= n - 1 ? 4 : ETAPAS[c.dias[d].etapa] ?? 1,
    marchita: ultimos.length >= 3 && ultimos.every((x) => x.seco) && c.dias[d].humedad < 0.25, lista: J.dia >= n - 1 };
}

function pintarMundo() {
  if (!mundo) return;
  const hoy = diaActual();
  mundo.actualizar(J.parcelas.map((_, i) => vista(i)), colorSuelo(J.salud), !!hoy && hoy.lluvia >= 3);
}

function cicloPrincipal(): Ciclo | null {
  const i = J.parcelas.findIndex((p, k) => p.crop && !p.cosechada && ciclos.has(k));
  if (i >= 0) return ciclos.get(i)!;
  const k = J.parcelas.findIndex((p, k2) => p.crop && ciclos.has(k2));
  return k >= 0 ? ciclos.get(k)! : null;
}
function diaActual(): Dia | null {
  const c = cicloPrincipal();
  if (!c || !J.sembrado) return null;
  return c.dias[Math.min(J.dia, c.dias.length - 1)];
}

function diaFinal() {
  return Math.max(0, ...J.parcelas.map((p, i) => (p.crop && !p.cosechada && ciclos.has(i) ? ciclos.get(i)!.dias.length - 1 : 0)));
}
const listas = () => J.parcelas.map((p, i) => (p.crop && !p.cosechada && vista(i).lista ? i : -1)).filter((i) => i >= 0);

function avanzar(dias: number) {
  if (!J.sembrado) return;
  for (let k = 0; k < dias; k++) {
    if (J.dia >= diaFinal()) { detenerAuto(); break; }
    const antes = J.parcelas.map((_, i) => vista(i));
    J.dia++;
    const parar = eventos(antes);
    if (parar) { detenerAuto(); break; }
  }
  guardarTodo();
  pintarMundo();
  pintarControles();
}

function eventos(antes: VistaParcela[]): boolean {
  const hoy = diaActual();
  let parar = false;
  J.parcelas.forEach((p, i) => {
    if (!p.crop || p.cosechada) return;
    const v = vista(i), a = antes[i], nom = nombreCorto(p.crop);
    if (v.lista && !a.lista) { decir(`¡${cap(nom)} lista para cosechar! Toca la franja ${i + 1}.`); parar = true; return; }
    if (v.marchita && !a.marchita) { decir(`¡La ${nom} tiene sed! 🥵 Toca 💧 para regar con el agua del tanque.`, "preocupada"); parar = true; return; }
    if (v.etapa !== a.etapa && v.etapa === 2) decir(`¡La ${nom} ya está creciendo!`);
    if (v.etapa !== a.etapa && v.etapa === 3) decir(`¡La ${nom} está en plena producción! Ahora necesita más agua.`);
  });
  if (hoy && hoy.lluvia >= 15 && !avisos.has(hoy.fecha)) {
    avisos.add(hoy.fecha);
    decir(`¡Aguacero de ${num(hoy.lluvia)} mm! La tierra cubierta con plantas no se lava.`);
  }
  return parar;
}
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

function iniciarAuto() {
  if (auto) { detenerAuto(); return; }
  $("#btn-auto").textContent = "⏸";
  auto = window.setInterval(() => avanzar(1), 350);
}
function detenerAuto() { if (auto) { clearInterval(auto); auto = null; } const b = document.querySelector("#btn-auto"); if (b) b.textContent = "▶"; }

async function regar() {
  if (!J.sembrado) { decir("Primero siembra y empieza la temporada."); return; }
  const hoy = J.dia;
  const regadas: string[] = [];
  let gastado = 0;
  for (const [i, p] of J.parcelas.entries()) {
    const c = ciclos.get(i);
    if (!p.crop || p.cosechada || !c || p.crop === "descanso") continue;
    const d = Math.min(hoy, c.dias.length - 1);
    const h = c.dias[d].humedad;
    if (h >= 0.7) continue;
    let mm = Math.round((1 - h) * c.taw_mm * 10) / 10;  // llenar la tierra hasta su capacidad
    let litros = mm * c.litros_por_mm;
    if (litros > J.tanque) { litros = J.tanque; mm = Math.round((litros / c.litros_por_mm) * 10) / 10; }
    if (mm <= 0) continue;
    p.riegos.push([d, mm]);
    J.tanque -= litros;
    gastado += litros;
    regadas.push(nombreCorto(p.crop));
    try { await pedirCiclo(i); } catch { p.riegos.pop(); J.tanque += litros; gastado -= litros; regadas.pop(); }
  }
  guardarTodo();
  pintarMundo();
  if (!regadas.length) decir(J.tanque <= 0 ? "El tanque está vacío. Hay que esperar la lluvia." : "La tierra todavía está húmeda. No hace falta regar.");
  else decir(`Regamos la ${regadas.join(" y la ")} con ${agua(gastado)}. ¡Bien!`);
}

function abonar() {
  const sin = J.parcelas.filter((p) => p.crop && p.crop !== "descanso" && !p.abono && !p.cosechada);
  if (!sin.length) { decir("Ya pusiste abono en esta temporada. ¡Gracias por cuidar la tierra!"); return; }
  sin.forEach((p) => (p.abono = true));
  J.salud = Math.min(100, J.salud + 5);
  if (J.salud >= 85) ganar("sana");
  guardarTodo();
  pintarMundo();
  decir("Pusiste abono orgánico: la tierra se pone más oscura y sana. 🌿");
}

// ---------------------------------------------------------------- 8. cosecha
function tocarParcela(i: number) {
  const p = J.parcelas[i];
  const v = vista(i);
  if (v.lista && !p.cosechada) { cosechar(i); return; }
  if (!J.sembrado) { if (semillaElegida) sembrar(i); else abrirSemillas(); return; }
  if (!p.crop || p.cosechada) { decir("Esta franja está vacía. Espera a la próxima temporada."); return; }
  const c = ciclos.get(i)!;
  const d = c.dias[Math.min(J.dia, c.dias.length - 1)];
  const h = Math.round(d.humedad * 100);
  decir(`${cap(nombreCorto(p.crop))}: ${d.etapa}. La tierra tiene ${h} % de agua${h < 30 ? ", ¡riégala!" : "."}`);
}

function cosechar(i: number) {
  const p = J.parcelas[i], c = ciclos.get(i)!;
  mundo?.cosechar(i);
  p.cosechada = true;
  p.puntaje = c.puntaje;
  p.historial.push(p.crop!);
  if (p.crop !== "descanso") { J.cosechas++; ganar("primera"); if (c.estrellas === 3) ganar("agua"); }
  const fams = p.historial.filter((x) => x !== "descanso").slice(-3).map((x) => cultivos.get(x)?.familia);
  if (fams.length === 3 && new Set(fams).size === 3) ganar("rotacion");
  guardarTodo();
  setTimeout(pintarMundo, 900);
  const msg = p.crop === "descanso" ? "La franja descansó y la tierra está más fuerte."
    : c.puntaje >= 85 ? "¡Excelente cosecha! Cuidaste muy bien el agua."
    : c.puntaje >= 60 ? "Buena cosecha. En algunos días le faltó agua."
    : "La planta pasó sed. La próxima vez riega cuando la tierra esté seca.";
  const epoca = c.en_epoca ? "" : ` Sembraste fuera de época: aquí se siembra ${c.epoca}.`;
  abrirPanel("¡Cosecha!", `<div class="cosecha">
    <div class="cosecha-emoji">${cultivos.get(p.crop!)!.emoji}</div>
    <div class="estrellas">${"⭐".repeat(c.estrellas)}${"☆".repeat(3 - c.estrellas)}</div>
    <p class="grande"><b>${c.puntaje}</b> puntos</p>
    <p>${esc(msg + epoca)}</p>
    <p class="veredicto">En los años de la NASA, para este mes: <b>${VEREDICTO[c.veredicto] || ""}</b></p>
    <p class="fuente">Días con sed: ${c.dias_secos} de ${c.dias.length} · año ${c.anio} de NASA POWER</p>
    <button class="btn-juego grande" data-ok>👍 Seguir</button></div>`, "centro");
  $("[data-ok]").addEventListener("click", () => {
    cerrarPanel();
    const otra = listas()[0];
    if (otra !== undefined) setTimeout(() => cosechar(otra), 300);
    else if (todoCosechado()) rotar();
  });
  decir(msg + epoca, c.puntaje >= 60 ? "feliz" : "preocupada");
  pintarControles();
}
const todoCosechado = () => J.parcelas.every((p) => !p.crop || p.cosechada);

// ---------------------------------------------------------------- 9. rotar y curar la tierra
async function rotar() {
  const ultimo = [...J.parcelas].reverse().find((p) => p.crop && p.crop !== "descanso")?.crop;
  const c = cicloPrincipal();
  const fin = c ? c.dias[c.dias.length - 1].fecha : null;
  const proximo = fin ? (Number(fin.slice(5, 7)) % 12) + 1 : (J.mes! % 12) + 1;
  const anio = fin ? Number(fin.slice(0, 4)) + (proximo === 1 ? 1 : 0) : J.anio;
  abrirPanel("Rotar y curar la tierra", `<div class="cargando-mundo"><div class="girar"></div></div>`);
  let texto = "", casos: any[] = [];
  try {
    const [acc, prob] = await Promise.all([
      ultimo ? fetch("/api/accion", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "rotacion", estado: { lat: lugar().lat, lon: lugar().lon, radio: radioActual(), crop: ultimo, mes: proximo, i: 0 } }) })
        .then((r) => r.json()) : Promise.resolve(null),
      consultar<{ casos: any[] }>("probadas", { mes: proximo }),
    ]);
    texto = acc?.mensajes?.find((m: any) => m.tipo === "texto")?.texto || "";
    const pasos = texto.split("\n")[0].replace(/^.*?:\s*/, "").replace(/\.$/, "").split(" → ");
    if (ultimo && pasos.length >= 2) {  // la API empieza con el cultivo recién cosechado: decir solo lo que sigue
      const resto = pasos.slice(1);
      texto = `🔁 Después de la ${nombreCorto(ultimo)}, siembra ${resto[0]}${resto.length > 1 ? ` y luego ${resto.slice(1).join(" y ")}` : ""}.`;
    }
    casos = prob.casos.slice(0, 3);
  } catch { /* se muestran solo los consejos */ }
  const consejos = [
    ["🔄", "Cambia de familia", "No siembres la misma familia seguida: las plagas se quedan en la tierra."],
    ["🫘", "Leguminosas", "Haba, chocho y arveja alimentan la tierra con nitrógeno."],
    ["🍀", "Descanso", "Dejar una franja descansar con hierbas y trébol la cura."],
    ["☔", "Cobertura", "En meses de aguacero, la tierra cubierta no se lava."],
    ["💩", "Abono orgánico", "El abono de animales y el compost oscurecen y enriquecen el suelo."],
  ];
  abrirPanel("Rotar y curar la tierra", `
    ${texto ? `<div class="globo-panel">${esc(texto.split("\n")[0])}</div>` : ""}
    <div class="medidor"><span>Salud de tu tierra</span><div class="barra"><i style="width:${J.salud}%;background:${colorSuelo(J.salud)}"></i></div><b>${J.salud}</b></div>
    <ol class="guia">${consejos.map(([i, t, d]) => `<li><span>${i}</span><div><b>${t}</b><p>${d}</p></div></li>`).join("")}</ol>
    ${casos.length ? `<h3>Probado en el campo</h3><div class="casos">${casos.map((k) => `<article class="caso">
      <p class="caso-lugar">📍 ${esc(k.lugar)} (${esc(k.provincia)})</p>
      <p class="caso-pasos">${k.pasos.map((s: any) => s.emoji).join(" → ")}</p>
      <p>${esc(k.resultado)}</p></article>`).join("")}</div>` : ""}
    <p class="fuente">La salud de la tierra son puntos del juego, no una medición.</p>
    <button class="btn-juego grande" data-nueva>🌱 Nueva temporada en ${MESES[proximo - 1]}</button>`);
  if (texto) decir(texto.split("\n")[0]);
  $("[data-nueva]").addEventListener("click", async () => {
    J.temporada++;
    J.mes = proximo;
    J.anio = anio;
    J.dia = 0;
    J.sembrado = false;
    J.parcelas.forEach((p) => { p.crop = null; p.riegos = []; p.abono = false; p.cosechada = false; p.puntaje = undefined; });
    ciclos.clear();
    semillaElegida = null;
    guardarTodo();
    pintarMundo();
    pintarControles();
    try { await cargarSemillas(proximo); } catch { /* se reintenta al abrir */ }
    abrirSemillas();
    decir("Elige qué sembrar en cada franja. ¡Recuerda rotar las familias!");
  });
}

// ---------------------------------------------------------------- 10. logros
function ganar(id: string) {
  if (J.medallas.includes(id)) return;
  J.medallas.push(id);
  guardarJuego(J);
  const m = MEDALLAS[id];
  const t = $("#medalla");
  t.innerHTML = `<span>${m.icono}</span><div><b>${m.nombre}</b><p>${m.texto}</p></div>`;
  t.hidden = false;
  t.classList.remove("aparece"); void t.offsetWidth; t.classList.add("aparece");
  setTimeout(() => (t.hidden = true), 3500);
}

function abrirLogros() {
  abrirPanel("Mis medallas", `<div class="medallas">${Object.entries(MEDALLAS).map(([id, m]) =>
    `<div class="medalla-carta ${J.medallas.includes(id) ? "ganada" : ""}"><span>${m.icono}</span><b>${m.nombre}</b><p>${m.texto}</p></div>`).join("")}</div>
    <p class="ayuda">Cosechas: ${J.cosechas} · Temporada ${J.temporada}</p>
    <button class="btn-juego borde" data-reiniciar>🗺️ Jugar en otra chacra</button>`);
  $("[data-reiniciar]").addEventListener("click", () => { J = nuevo(); guardarJuego(J); ciclos.clear(); cerrarPanel(); mundo?.destruir(); mundo = null; $("#hud").hidden = true; pantallaMapa(); });
}

// ---------------------------------------------------------------- HUD y controles
function pintarHud() {
  const e = lugar();
  $("#hud-lugar").textContent = `${e.nombre || "Mi chacra"}${parcelaInfo ? ` · ${num(parcelaInfo.lugar.elev)} m` : ""}`;
  const hoy = diaActual();
  $("#hud-fecha").textContent = hoy ? fecha(hoy.fecha) : J.mes ? `Siembra en ${MESES[J.mes - 1]}` : "Elige el mes de siembra";
  $("#hud-tanque").style.width = `${J.tanqueMax ? (J.tanque / J.tanqueMax) * 100 : 0}%`;
  $("#hud-tanque-txt").textContent = J.tanqueMax ? agua(J.tanque) : "—";
  $("#hud-salud").style.width = `${J.salud}%`;
  $("#hud-salud").style.background = colorSuelo(J.salud);
  $("#hud-salud-txt").textContent = String(J.salud);
  const c = cicloPrincipal();
  const sem = $("#semaforo");
  if (c && J.sembrado) {
    const d = c.dias[Math.min(J.dia, c.dias.length - 1)];
    const mesHoy = MESES_CORTOS[Number(d.fecha.slice(5, 7)) - 1];
    sem.innerHTML = c.meses.map((m, k) => `<span class="sem ${c.estado_mes[k]} ${m.slice(0, 3) === mesHoy ? "hoy" : ""}" title="${m}">${m.slice(0, 3)}</span>`).join("");
    sem.hidden = false;
  } else sem.hidden = true;
}

function pintarControles() {
  const ctl = $("#tiempo");
  const plantadas = J.parcelas.some((p) => p.crop);
  if (!J.sembrado) {
    ctl.innerHTML = plantadas ? `<button class="btn-juego grande" data-empezar>☀️ ¡A crecer!</button>` : "";
    ctl.querySelector("[data-empezar]")?.addEventListener("click", empezarTemporada);
  } else if (todoCosechado()) {
    ctl.innerHTML = `<button class="btn-juego grande" data-rotar>🔄 Rotar la tierra</button>`;
    ctl.querySelector("[data-rotar]")!.addEventListener("click", rotar);
  } else if (listas().length && J.dia >= diaFinal()) {
    ctl.innerHTML = `<button class="btn-juego grande" data-cosechar>🧺 ¡A cosechar!</button>`;
    ctl.querySelector("[data-cosechar]")!.addEventListener("click", () => cosechar(listas()[0]));
  } else {
    ctl.innerHTML = `${listas().length ? `<button class="t cosechar" data-cosechar aria-label="Cosechar">🧺</button>` : ""}
      <button class="t" data-d="1" aria-label="Avanzar un día">+1 día</button>
      <button class="t" data-d="7" aria-label="Avanzar una semana">+1 sem</button>
      <button class="t" data-d="30" aria-label="Avanzar un mes">+1 mes</button>
      <button class="t redondo" id="btn-auto" aria-label="Avance automático">${auto ? "⏸" : "▶"}</button>`;
    ctl.querySelector("[data-cosechar]")?.addEventListener("click", () => cosechar(listas()[0]));
    ctl.querySelectorAll<HTMLButtonElement>("[data-d]").forEach((b) => b.addEventListener("click", () => avanzar(Number(b.dataset.d))));
    $("#btn-auto").addEventListener("click", iniciarAuto);
  }
  pintarHud();
}

async function restaurar() {
  // al volver a la página: recupera los ciclos sembrados (la API los guarda en sessionStorage)
  await Promise.all(J.parcelas.map(async (p, i) => { if (p.crop) { try { await pedirCiclo(i); } catch { /* sin señal */ } } }));
  if (J.mes) { try { await cargarSemillas(J.mes); } catch { /* sin señal */ } }
}

export async function arrancar() {
  $("#btn-tierra").addEventListener("click", () => (parcelaInfo ? mostrarCartas() : leerTierra()));
  $("#btn-calendario").addEventListener("click", abrirCalendario);
  $("#btn-semillas").addEventListener("click", () => (J.sembrado ? decir("Ya sembraste. Espera la cosecha.") : abrirSemillas()));
  $("#btn-regar").addEventListener("click", regar);
  $("#btn-abono").addEventListener("click", abonar);
  $("#btn-logros").addEventListener("click", abrirLogros);
  inicio();
  if (tieneParcela() && J.mes !== null) { await restaurar(); pintarControles(); pintarMundo(); }
}
