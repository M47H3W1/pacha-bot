// Astro Granja: la historia de Pachita. Todo número viene de la API de Pacha; aquí solo se cuenta, se dibuja y se anima.
// Historia: nombre de la granja → Pachita llega en cohete → elegir la parcela → ficha técnica de la tierra →
// semillas por familia → calendario → sembrar → agua que necesita → crecer (riego y estrés) → cosecha →
// rotación (3 combinaciones) → certificado de Granjero Cósmico.
import { consultar, esc, MESES, MESES_CORTOS, num } from "../lib/api";
import { guardar, leer, tieneParcela } from "../lib/estado";
import { cargar, colorSuelo, guardarJuego, MEDALLAS, N_PARCELAS, nuevo, type Juego, type Paso } from "./estado";
import { icono } from "./iconos";
import { crearMapa, RADIO_DEMO } from "./mapa";
import { crearMundo2D } from "./mundo2d";
import { ETAPAS, type Mundo, type Terreno, type VistaParcela } from "./mundo";
import { decir, decirVarias, desbloquearAudio, estaSilenciado, PACHITA_SVG, silenciar, urlPose } from "./pachita";

type Cultivo = { id: string; nombre: string; emoji: string; foto: string | null; familia: string; fija_n: boolean;
  ciclo_dias: number; uso?: string; aporte?: string; riesgo?: string; apto?: boolean; en_epoca?: boolean; se_puede?: boolean;
  razon?: string; epoca_texto?: string; meses?: number[]; alt_min?: number; alt_max?: number };
type Dia = { fecha: string; lluvia: number; tmax: number; calor: boolean; gasto: number; riego: number; humedad: number;
  falta: number; seco: boolean; etapa: string };
type Agua = { gasto_mm: number; lluvia_util_mm: number; riego_mm: number; riego_seco_mm: number; litros_cultivo: number;
  litros_lluvia: number; litros_riego: number; litros_riego_seco: number };
type Ciclo = { cultivo: Cultivo; mes: number; anio: number; dias: Dia[]; taw_mm: number; puntaje: number; estrellas: number;
  en_epoca: boolean; epoca: string | null; veredicto: string; estado_mes: string[]; meses: string[]; litros_por_mm: number;
  tanque_litros: number; dias_secos: number; agua: Agua; m2: number };

const DESCANSO: Cultivo = { id: "descanso", nombre: "Descanso con cobertura", emoji: "🍀", foto: null, familia: "ninguna",
  fija_n: false, ciclo_dias: 120, se_puede: true, apto: true, en_epoca: true };
const VEREDICTO: Record<string, string> = { si: "La lluvia suele alcanzar", cuidado: "Hay que regar a veces", no: "Necesita riego" };

// Familias botánicas: por qué importan para rotar
const FAMILIAS: { id: string[]; nombre: string; icono: string; color: string; porque: string; tambien?: string[] }[] = [
  { id: ["fabacea"], nombre: "Leguminosas (Fabáceas)", icono: "fijadores", color: "#2e7d32",
    porque: "Atrapan nitrógeno del aire con sus raíces y alimentan la tierra. ¡Son las mejores amigas del suelo!",
    tambien: ["vicia", "trebol", "alfalfa"] },
  { id: ["solanacea"], nombre: "Solanáceas", icono: "papa", color: "#8d6e63",
    porque: "Comen mucho del suelo. Si se siembran seguidas, se llenan de plagas como el gusano blanco." },
  { id: ["poacea"], nombre: "Gramíneas (Poáceas)", icono: "trigo", color: "#c99a2e",
    porque: "Sus raíces finas sujetan el suelo y dejan paja que lo protege de la lluvia." },
  { id: ["amarantacea"], nombre: "Amarantáceas", icono: "quinua", color: "#c2185b",
    porque: "La quinua es un grano andino muy nutritivo que aguanta la sequía." },
  { id: ["basellacea", "oxalidacea"], nombre: "Tubérculos andinos", icono: "oca", color: "#d84315",
    porque: "Melloco y oca son de familias distintas a la papa: sirven para rotar sin repetir plagas." },
  { id: ["pasto", "ninguna"], nombre: "Pastos y cobertura", icono: "pasto", color: "#558b2f",
    porque: "Cubren el suelo para que la lluvia no lo lave y le devuelven materia orgánica.", tambien: ["biomasa"] },
];
const familiaDe = (f: string) => FAMILIAS.find((x) => x.id.includes(f));
const NOMBRE_EXTRA: Record<string, string> = { vicia: "Vicia", trebol: "Trébol", alfalfa: "Alfalfa", biomasa: "Biomasa" };

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
let J: Juego = cargar();
let mundo: Mundo | null = null;
let terreno: (Terreno & { pendiente_pct?: number; pendiente_clase?: string }) | null = null;
let parcelaInfo: any = null;
let semillasInfo: { meses_zona: number[]; siembra_por_mes: number[]; cultivos: Cultivo[] } | null = null;
const ciclos = new Map<number, Ciclo>();
const cultivos = new Map<string, Cultivo>([["descanso", DESCANSO]]);
let auto: number | null = null;
const avisos = new Set<string>();

const lugar = () => leer();
const radioActual = () => Math.sqrt((lugar().area_m2 || Math.PI * RADIO_DEMO ** 2) / Math.PI);
const m2Parcela = () => Math.round((lugar().area_m2 || 2500) / N_PARCELAS);
function paso(p: Paso) { J.paso = p; guardarTodo(); }
function guardarTodo() { guardarJuego(J); pintarHud(); }
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const fecha = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return `${d} de ${MESES[m - 1]} · año ${y}`; };
function agua(litros: number) {
  if (litros < 1000) return `${num(Math.max(1, Math.round(litros / 20)))} baldes`;
  if (litros < 20000) return `${num(Math.round(litros / 200))} tanques de 200 L`;
  return `${num(Math.round(litros / 10000))} tanqueros`;
}
const nombreCorto = (id: string) => (cultivos.get(id)?.nombre || id).toLowerCase();
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

// ---------------------------------------------------------------- 0. nombre de la granja y llegada en cohete
function pantallaNombre() {
  const c = $("#intro");
  c.hidden = false;
  document.body.classList.add("en-cohete");
  c.innerHTML = `<div class="estrellas-fondo"></div>
    <div class="cohete-volando">${COHETE}</div>
    <form class="tarjeta-nombre" autocomplete="off">
      <label for="nombre-granja">¿Cómo se llama tu granja?</label>
      <input id="nombre-granja" maxlength="28" placeholder="Ej.: La Chacra Feliz" value="${esc(J.granja)}" required>
      <button class="btn-juego grande" type="submit">🚀 ¡Aterrizar!</button>
    </form>`;
  decir("¡Hola, hola! Soy Pachita y viajo en mi cohete. Antes de aterrizar, ¿cómo se llama tu granja?");
  c.querySelector("form")!.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = c.querySelector<HTMLInputElement>("#nombre-granja")!.value.trim();
    if (!v) return;
    J.granja = v.slice(0, 28);
    document.body.classList.remove("en-cohete");
    paso("mapa");
    aterrizaje();
  });
}

async function aterrizaje() {
  const c = $("#intro");
  c.hidden = false;
  c.innerHTML = `<div class="paisaje-andes">${PAISAJE}</div><div class="cohete-baja">${COHETE}</div><div class="humo"></div>`;
  document.body.classList.add("llegando");
  await espera(2600);
  c.querySelector(".humo")?.classList.add("sale");
  document.body.classList.remove("llegando");
  document.body.classList.add("bajo-cohete");
  await decir(`¡Bienvenida, bienvenido a la granja ${J.granja}! Yo te voy a enseñar a cuidar la tierra con datos de la NASA.`);
  document.body.classList.remove("bajo-cohete");
  c.hidden = true;
  pantallaMapa();
}

// ---------------------------------------------------------------- 1. mapa
function pantallaMapa() {
  $("#escena").hidden = true;
  document.body.classList.add("en-mapa");
  const cont = $("#mapa");
  cont.hidden = false;
  const e = lugar();
  const m = crearMapa(cont, { lat: e.lat ?? -1.6466, lon: e.lon ?? -78.7437, radio: Math.round(radioActual()) }, (l) => {
    guardar({ lat: l.lat, lon: l.lon, area_m2: Math.PI * l.radio * l.radio, nombre: l.nombre, provincia: undefined });
    m.destruir();
    cont.hidden = true;
    document.body.classList.remove("en-mapa");
    paso("tierra");
    entrarMundo();
  });
  decir("Elige tu parcela: mueve el mapa hasta el punto y agranda o achica el círculo.");
}

// ---------------------------------------------------------------- 2. mundo 3D
async function entrarMundo() {
  $("#escena").hidden = false;
  $("#hud").hidden = false;
  const cont = $("#mundo");
  cont.innerHTML = `<div class="cargando-mundo"><div class="girar"></div><p>Dibujando la granja ${esc(J.granja)}…</p></div>`;
  try {
    terreno = await consultar("terreno", { n: 17 });
  } catch (err) {
    cont.innerHTML = `<div class="cargando-mundo"><p>${esc((err as Error).message)}</p><button class="btn-juego" data-r>Intentar otra vez</button></div>`;
    $("[data-r]").addEventListener("click", entrarMundo);
    decir("No pude traer la forma de tu parcela. Revisa la señal y toca de nuevo.", "preocupada");
    return;
  }
  cont.innerHTML = "";
  mundo?.destruir();
  try {
    if (new URLSearchParams(location.search).has("sin3d")) throw new Error("modo 2D pedido");
    const m3d = await import("./mundo3d");
    if (!m3d.hayWebGL()) throw new Error("sin WebGL");
    mundo = m3d.crearMundo3D(cont, terreno!, terreno!.centro);
  } catch {
    mundo = crearMundo2D(cont, terreno!.desnivel_m);
    $("#aviso2d").hidden = false;
  }
  mundo.alTocar(tocarParcela);
  await restaurar();
  pintarMundo();
  pintarControles();
  seguirHistoria();
}

/** Lleva al jugador al momento de la historia donde se quedó. */
function seguirHistoria() {
  switch (J.paso) {
    case "tierra": case "mapa": case "nombre": return fichaTierra();
    case "semillas": return abrirFamilias();
    case "calendario": return abrirCalendario();
    case "sembrar": return pedirSiembra();
    case "agua": return panelAgua();
    case "rotacion": return leccionRotacion();
    case "certificado": return certificado();
    default: return decir("¡Seguimos! Avanza el tiempo y cuida tu siembra.");
  }
}

// ---------------------------------------------------------------- 3. ficha técnica de la tierra
async function fichaTierra() {
  abrirPanel("Así es tu tierra", `<div class="cargando-mundo chico"><div class="girar"></div><p>Leyendo los datos de la NASA…</p></div>`, "cartas-panel");
  try {
    parcelaInfo = await consultar("parcela");
    guardar({ provincia: parcelaInfo.lugar.provincia });
  } catch {
    abrirPanel("Así es tu tierra", `<p>No pude leer tu tierra. Revisa la señal.</p><button class="btn-juego" data-r>Intentar otra vez</button>`);
    $("[data-r]").addEventListener("click", fichaTierra);
    return;
  }
  pintarHud();
  const p = parcelaInfo, c = p.clima, t = p.tendencia, n = p.nasa || {};
  const humedad: number[] = n.suelo_raiz_mes || [];
  const barras = humedad.map((h: number, i: number) =>
    `<span class="barra-h" style="--h:${Math.max(6, h * 100)}%;--c:${h >= 0.75 ? "#2e7d32" : h >= 0.6 ? "#f9a825" : "#c62828"}" title="${MESES[i]}: ${Math.round(h * 100)} %"><i></i><b>${MESES_CORTOS[i][0].toUpperCase()}</b></span>`).join("");
  const carta = (ic: string, titulo: string, valor: string, detalle: string, color: string) =>
    `<article class="carta" style="--color:${color}"><div class="carta-icono">${ic}</div><h3>${titulo}</h3>
      <p class="carta-valor">${valor}</p><p class="carta-detalle">${detalle}</p></article>`;
  const secos = humedad.map((h, i) => (h < 0.7 ? MESES[i] : "")).filter(Boolean);
  abrirPanel("Así es tu tierra", `<p class="ficha-sub">Granja <b>${esc(J.granja)}</b> · ${esc(p.lugar.area_texto)} · datos de la NASA</p>
  <div class="cartas">
    ${carta("🌧️", "Lluvia al año", `${num(c.lluvia_anual)} mm`, `Año seco: ${num(c.lluvia_seca)} mm`, "#1e6fb8")}
    ${carta("☀️", "Evaporación", `${num(c.et0_anual)} mm`, c.et0_anual > c.lluvia_anual ? "Más de lo que llueve" : "Menos de lo que llueve", "#e65100")}
    ${carta("🌡️", "Temperatura", `${num(c.tmin)} a ${num(c.tmax)} °C`, `Días de calor fuerte: ${t.calor_dias}`, "#d84315")}
    ${n.radiacion_kwh ? carta("🔆", "Sol", `${num(n.radiacion_kwh, 1)} kWh/m²`, "Energía del sol por día", "#f2a900") : ""}
    ${n.humedad_aire ? carta("☁️", "Humedad del aire", `${n.humedad_aire} %`, `Viento: ${num(n.viento, 1)} m/s`, "#5c7da8") : ""}
    ${carta("📈", "Última década", `Lluvia ${t.cambio_lluvia_pct > 0 ? "+" : ""}${t.cambio_lluvia_pct} %`, `Temperatura ${t.cambio_temp_c > 0 ? "+" : ""}${num(t.cambio_temp_c, 1)} °C`, "#6a1b9a")}
    ${humedad.length ? `<article class="carta ancha" style="--color:#2e7d32"><div class="carta-icono">💧</div><h3>Humedad del suelo en las raíces, mes a mes</h3>
      <div class="barras-h">${barras}</div><p class="carta-detalle">Satélites de la NASA (GWETROOT): 100 % es suelo empapado.</p></article>` : ""}
  </div>
  <p class="fuente">NASA POWER ${esc(p.periodo)} (MERRA-2, CERES) · FAO-56.</p>
  <button class="btn-juego grande" data-sig>🌱 Conocer las semillas</button>`, "cartas-panel");
  $("[data-sig]").addEventListener("click", () => { paso("semillas"); abrirFamilias(); });
  const frases = [
    `Los satélites de la NASA miraron tu granja durante ${(() => { const [a0, a1] = String(p.periodo).split("–").map(Number); return a1 && a0 ? a1 - a0 + 1 : "muchos"; })()} años.`,
    `Llueve ${num(c.lluvia_anual)} milímetros al año y el sol evapora ${num(c.et0_anual)}.`,
    secos.length ? `El suelo se seca más en ${secos.slice(0, 3).join(", ")}: esos meses hay que regar.` : "El suelo guarda humedad casi todo el año.",
    `La temperatura va de ${num(c.tmin)} a ${num(c.tmax)} grados.`,
  ];
  decirVarias(frases);
}

// ---------------------------------------------------------------- 4. semillas por familia botánica
async function cargarSemillas(mes: number) {
  const s = await consultar<{ meses_zona: number[]; siembra_por_mes: number[]; cultivos: Cultivo[] }>("semillas", { mes });
  semillasInfo = s;
  s.cultivos.forEach((c) => cultivos.set(c.id, { ...cultivos.get(c.id), ...c }));
  return s;
}

async function abrirFamilias() {
  if (J.sembrado) { decir("Ya sembraste. Espera la cosecha."); return; }
  try { if (!semillasInfo) await cargarSemillas(J.mes ?? (new Date().getMonth() + 1) % 12 + 1); }
  catch { decir("No pude traer las semillas. Revisa la señal.", "preocupada"); return; }
  const lista = [...semillasInfo!.cultivos, ...(J.temporada > 1 ? [DESCANSO] : [])];
  const grupos = FAMILIAS.map((f) => ({ f, cs: lista.filter((c) => f.id.includes(c.familia)) })).filter((g) => g.cs.length);
  const p = abrirPanel("Semillas por familia", `
    <div class="leccion"><b>¿Por qué familias?</b> Las plantas de una misma familia se enferman de lo mismo y comen lo mismo del suelo.
      Si cambias de familia cada vez que siembras, la tierra descansa y las plagas se van. ¡Eso es <b>rotar</b>!</div>
    ${grupos.map(({ f, cs }) => `<section class="familia" style="--color:${f.color}">
      <h3>${icono(f.icono, "icono-familia")} ${f.nombre}</h3><p>${f.porque}</p>
      <div class="sobres">${cs.map((c) => `<button type="button" class="sobre ${c.apto === false ? "bloqueado" : ""}" data-crop="${c.id}">
        ${icono(c.id, "icono-sobre")}${c.apto === false ? '<span class="candado">🔒</span>' : ""}
        <span class="sobre-nombre">${esc(c.nombre)}</span>${c.fija_n ? '<span class="sello-n">N+</span>' : ""}</button>`).join("")}
        ${(f.tambien || []).map((k) => `<div class="sobre info">${icono(k, "icono-sobre")}<span class="sobre-nombre">${NOMBRE_EXTRA[k]}</span><span class="mini">también ayuda</span></div>`).join("")}
      </div></section>`).join("")}`, "semillas-panel");
  p.querySelectorAll<HTMLButtonElement>(".sobre[data-crop]").forEach((b) => b.addEventListener("click", () => detalleSemilla(b.dataset.crop!)));
  decir("Mira las semillas por familia. Toca una para conocerla.");
}

function detalleSemilla(id: string) {
  const c = cultivos.get(id)!;
  const f = familiaDe(c.familia);
  abrirPanel(c.nombre, `<div class="detalle-semilla">
      ${icono(id, "icono-grande")}
      <p class="etiqueta" style="--color:${f?.color || "#555"}">${f?.nombre || "Cobertura"}</p>
      ${c.fija_n ? `<p class="bueno">🫘 Alimenta la tierra con nitrógeno</p>` : ""}
      <ul class="datos">
        ${c.ciclo_dias ? `<li>⏱️ Tarda <b>${c.ciclo_dias} días</b> en estar lista</li>` : ""}
        ${c.alt_min ? `<li>🏔️ Crece de <b>${num(c.alt_min)}</b> a <b>${num(c.alt_max!)} m</b></li>` : ""}
        ${c.epoca_texto ? `<li>📅 Aquí se siembra <b>${esc(c.epoca_texto)}</b></li>` : ""}
        ${c.uso ? `<li>🧺 Sirve para: ${esc(c.uso)}</li>` : ""}
      </ul>
      ${c.apto === false ? `<p class="malo">🔒 ${esc(c.razon || "")}</p>` : ""}
    </div>
    <div class="fila-botones"><button class="btn-juego borde" data-volver>⬅ Otras semillas</button>
      ${c.apto === false ? "" : `<button class="btn-juego" data-elegir>🌱 Elegir esta semilla</button>`}</div>`, "centro");
  $("[data-volver]").addEventListener("click", abrirFamilias);
  document.querySelector("[data-elegir]")?.addEventListener("click", () => {
    J.crop = id;
    paso("calendario");
    abrirCalendario();
  });
  if (c.apto === false) decir(`${c.nombre}: ${c.razon}.`, "pensando");
  else decir(c.fija_n ? `${c.nombre} es leguminosa: alimenta la tierra. ¡Buena elección!` : `${c.nombre}, de la familia ${f?.nombre.split(" (")[0].toLowerCase() || "de cobertura"}.`);
}

// ---------------------------------------------------------------- 5. calendario de siembra
function abrirCalendario() {
  if (J.sembrado) { decir("Primero cosecha lo que está sembrado."); return; }
  const c = J.crop ? cultivos.get(J.crop) : null;
  if (!c) { abrirFamilias(); return; }
  const meses = new Set(c.meses || []);
  const actual = J.mes ?? (new Date().getMonth() + 1) % 12 + 1;
  const r = 120, cx = 140, cy = 140;
  const porciones = MESES_CORTOS.map((m, i) => {
    const a0 = ((i - 3) / 12) * Math.PI * 2, a1 = ((i - 2) / 12) * Math.PI * 2, am = (a0 + a1) / 2;
    const p = (a: number, rr: number) => `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`;
    const ok = meses.has(i + 1);
    return `<g class="mes ${actual === i + 1 ? "elegido" : ""}" data-mes="${i + 1}" tabindex="0" role="button" aria-label="${MESES[i]}${ok ? ", época de siembra" : ""}">
      <path style="fill:${ok ? "#5fb35a" : "#e3dccb"}" d="M${p(a0, 46)} L${p(a0, r)} A${r} ${r} 0 0 1 ${p(a1, r)} L${p(a1, 46)} A46 46 0 0 0 ${p(a0, 46)} Z"/>
      <text x="${cx + 86 * Math.cos(am)}" y="${cy + 86 * Math.sin(am) + 6}" text-anchor="middle">${m}</text></g>`;
  }).join("");
  abrirPanel(`¿Cuándo siembras ${c.nombre.toLowerCase()}?`, `<svg class="rueda" viewBox="0 0 280 280">${porciones}
      <foreignObject x="${cx - 42}" y="${cy - 42}" width="84" height="84"><div class="rueda-icono">${icono(c.id, "icono-rueda")}</div></foreignObject></svg>
    <p class="leyenda"><span class="punto epoca"></span> Época de siembra en tu zona (INIAP) <span class="punto"></span> Otros meses</p>`, "centro");
  decir(`Los meses verdes son la época de siembra de ${c.nombre.toLowerCase()} en tu zona. ¡Toca uno!`);
  document.querySelectorAll<SVGGElement>(".rueda .mes").forEach((g) => {
    const mes = Number(g.dataset.mes);
    const elegir = () => elegirMes(mes, meses.has(mes));
    g.addEventListener("click", elegir);
    g.addEventListener("keydown", (e) => { if ((e as KeyboardEvent).key === "Enter") elegir(); });
  });
}

function elegirMes(mes: number, enEpoca: boolean) {
  const c = cultivos.get(J.crop!)!;
  if (!enEpoca) {
    abrirPanel("Fuera de época", `<div class="detalle-semilla">${icono(c.id, "icono-grande")}
      <p class="grande">En <b>${MESES[mes - 1]}</b> no es época de ${c.nombre.toLowerCase()}. Aquí se siembra <b>${esc(c.epoca_texto || "")}</b>.</p></div>
      <div class="fila-botones"><button class="btn-juego" data-otro>📅 Elegir otro mes</button>
      <button class="btn-juego borde" data-igual>Sembrar igual</button></div>`, "centro");
    decir(`En ${MESES[mes - 1]} no es época. Si siembras igual, tu planta puede sufrir.`, "pensando");
    $("[data-otro]").addEventListener("click", abrirCalendario);
    $("[data-igual]").addEventListener("click", () => fijarMes(mes));
    return;
  }
  fijarMes(mes);
}

async function fijarMes(mes: number) {
  J.mes = mes;
  try { await cargarSemillas(mes); } catch { /* el mes ya quedó guardado */ }
  paso("sembrar");
  pedirSiembra();
}

// ---------------------------------------------------------------- 6. sembrar
function pedirSiembra() {
  cerrarPanel();
  const c = cultivos.get(J.crop || "");
  if (!c || !J.mes) { abrirFamilias(); return; }
  pintarControles();
  decir(`Toca las franjas de tu parcela para sembrar ${c.nombre.toLowerCase()} en ${MESES[J.mes - 1]}.`);
}

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
  if (!J.crop || !J.mes) { abrirFamilias(); return; }
  if (pc.crop === J.crop) { decir("Esa franja ya está sembrada. Toca otra o pulsa ¿Cuánta agua?"); return; }
  const antes = pc.crop;
  pc.crop = J.crop;
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
  pintarControles();
  const n = J.parcelas.filter((p) => p.crop).length;
  decir(`¡Sembraste ${nombreCorto(J.crop)} en la franja ${i + 1}!${n < N_PARCELAS ? " Puedes sembrar más franjas." : " Ahora mira cuánta agua necesita."}`);
}

async function sembrarTodas() {
  for (let i = 0; i < N_PARCELAS; i++) if (J.parcelas[i].crop !== J.crop) await sembrar(i);
}

// ---------------------------------------------------------------- 7. agua que necesita (datos NASA)
function panelAgua() {
  const plant = J.parcelas.map((p, i) => [p, i] as const).filter(([p]) => p.crop);
  const c = plant.length ? ciclos.get(plant[0][1]) : null;
  if (!c) { pedirSiembra(); return; }
  paso("agua");
  const k = plant.length; // franjas sembradas (el ciclo trae litros por franja)
  const a = c.agua;
  const L = (x: number) => x * k;
  abrirPanel("¿Cuánta agua necesita?", `<div class="agua-panel">
    ${icono(c.cultivo.id, "icono-grande")}
    <div class="gota-fila"><span class="gota-ic">🌱</span><div><b>${agua(L(a.litros_cultivo))}</b><p>bebe tu ${c.cultivo.nombre.toLowerCase()} en todo su ciclo: <b>${num(a.gasto_mm)} litros en cada metro cuadrado</b></p></div></div>
    <div class="gota-fila"><span class="gota-ic">🌧️</span><div><b>${agua(L(a.litros_lluvia))}</b><p>le da la lluvia en un año normal (${num(a.lluvia_util_mm)} litros por m²)</p></div></div>
    <div class="gota-fila destaca"><span class="gota-ic">💧</span><div><b>${a.riego_mm >= 5 ? agua(L(a.litros_riego)) : "casi nada"}</b><p>hay que regar en un año normal${a.riego_mm >= 5 ? ` (${num(a.riego_mm)} litros por m²)` : ""}</p></div></div>
    <div class="gota-fila"><span class="gota-ic">🏜️</span><div><b>${a.riego_seco_mm >= 5 ? agua(L(a.litros_riego_seco)) : "casi nada"}</b><p>en un año seco${a.riego_seco_mm >= 5 ? ` (${num(a.riego_seco_mm)} litros por m²)` : ""}</p></div></div>
    <h3>Agua mes a mes</h3>
    <div class="semaforo grande">${c.meses.map((m, j) => `<span class="sem ${c.estado_mes[j]}">${m.slice(0, 3)}</span>`).join("")}</div>
    <p class="leyenda">🟢 hay agua · 🟡 justo · 🔴 falta agua · ${VEREDICTO[c.veredicto]}</p>
    <p class="fuente">${num(L(c.m2))} m² sembrados · NASA POWER 2001–2024 · FAO-56 · riego con 75 % de eficiencia</p>
    <button class="btn-juego grande" data-crecer>☀️ ¡A crecer!</button></div>`, "centro");
  $("[data-crecer]").addEventListener("click", empezarTemporada);
  decirVarias([
    `Cada metro cuadrado de tu ${c.cultivo.nombre.toLowerCase()} bebe ${num(a.gasto_mm)} litros en todo su ciclo. ¡En toda tu parcela son ${agua(L(a.litros_cultivo))}!`,
    a.riego_mm >= 5 ? `La lluvia no alcanza: en un año normal hay que regar ${agua(L(a.litros_riego))}.`
      : `¡En un año normal la lluvia casi alcanza! En un año seco habría que regar ${agua(L(a.litros_riego_seco))}.`,
  ]);
}

function empezarTemporada() {
  const plantadas = J.parcelas.map((p, i) => [p, i] as const).filter(([p]) => p.crop);
  if (!plantadas.length) { pedirSiembra(); return; }
  // salud de la tierra: puntos del juego según lo que enseñan los casos de rotación (no es una medición)
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
    cambio -= 5;
    razones.push("hay franjas sin cubrir y los aguaceros lavan la tierra desnuda");
  }
  J.salud = Math.max(0, Math.min(100, J.salud + cambio));
  J.tanque = J.tanqueMax = plantadas.reduce((s, [, i]) => s + (ciclos.get(i)?.tanque_litros || 0), 0);
  J.sembrado = true;
  J.dia = 0;
  paso("crecer");
  if (J.salud >= 85) ganar("sana");
  cerrarPanel();
  pintarMundo();
  pintarControles();
  decir(razones.length ? `Ojo: ${razones[0]}. ¡Ahora avanza el tiempo!`
    : "¡Listo! Avanza el tiempo con los botones y cuida tu siembra del sol, la sed y los aguaceros.");
}

// ---------------------------------------------------------------- 8. crecer: tiempo, riego y estrés climático
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
const todoCosechado = () => J.parcelas.every((p) => !p.crop || p.cosechada);

function avanzar(dias: number) {
  if (!J.sembrado) return;
  for (let k = 0; k < dias; k++) {
    if (J.dia >= diaFinal()) { detenerAuto(); break; }
    const antes = J.parcelas.map((_, i) => vista(i));
    J.dia++;
    if (eventos(antes)) { detenerAuto(); break; }
  }
  guardarTodo();
  pintarMundo();
  pintarControles();
}

function eventos(antes: VistaParcela[]): boolean {
  const hoy = diaActual();
  let parar = false;
  J.parcelas.forEach((p, i) => {
    if (!p.crop || p.cosechada || parar) return;
    const v = vista(i), a = antes[i], nom = nombreCorto(p.crop);
    if (v.lista && !a.lista) { decir(`¡${cap(nom)} lista para cosechar! Toca 🧺.`); parar = true; return; }
    if (v.marchita && !a.marchita) { decir(`¡Estrés por sequía! La ${nom} tiene sed 🥵. Toca 💧 para regar.`, "preocupada"); parar = true; return; }
    if (v.etapa !== a.etapa && v.etapa === 2) decir(`¡La ${nom} ya está creciendo!`);
    if (v.etapa !== a.etapa && v.etapa === 3) decir(`¡La ${nom} está floreciendo! Ahora necesita más agua.`);
  });
  if (hoy && !parar) {
    if (hoy.calor && !avisos.has(`c${hoy.fecha.slice(0, 7)}`)) {
      avisos.add(`c${hoy.fecha.slice(0, 7)}`);
      decir(`¡Estrés por calor! Hoy hizo ${num(hoy.tmax)} °C. El suelo pierde agua más rápido.`, "preocupada");
    } else if (hoy.lluvia >= 15 && !avisos.has(hoy.fecha)) {
      avisos.add(hoy.fecha);
      decir(`¡Aguacero de ${num(hoy.lluvia)} mm! La tierra cubierta con plantas no se lava.`, "lluvia");
    }
  }
  return parar;
}

function iniciarAuto() {
  if (auto) { detenerAuto(); return; }
  $("#btn-auto").textContent = "⏸";
  auto = window.setInterval(() => avanzar(1), 350);
}
function detenerAuto() { if (auto) { clearInterval(auto); auto = null; } const b = document.querySelector("#btn-auto"); if (b) b.textContent = "▶"; }

async function regar() {
  if (!J.sembrado) { decir("Primero siembra y empieza a crecer."); return; }
  const regadas: string[] = [];
  let gastado = 0;
  for (const [i, p] of J.parcelas.entries()) {
    const c = ciclos.get(i);
    if (!p.crop || p.cosechada || !c || p.crop === "descanso") continue;
    const d = Math.min(J.dia, c.dias.length - 1);
    const h = c.dias[d].humedad;
    if (h >= 0.7) continue;
    let mm = Math.round((1 - h) * c.taw_mm * 10) / 10;  // llenar la tierra hasta lo que puede guardar
    let litros = mm * c.litros_por_mm;
    if (litros > J.tanque) { litros = J.tanque; mm = Math.round((litros / c.litros_por_mm) * 10) / 10; }
    if (mm <= 0) continue;
    p.riegos.push([d, mm]);
    mundo?.regar(i);
    J.tanque -= litros;
    gastado += litros;
    regadas.push(nombreCorto(p.crop));
    try { await pedirCiclo(i); } catch { p.riegos.pop(); J.tanque += litros; gastado -= litros; regadas.pop(); }
  }
  guardarTodo();
  pintarMundo();
  if (!regadas.length) decir(J.tanque <= 0 ? "El tanque está vacío. Hay que esperar la lluvia." : "La tierra todavía está húmeda. No hace falta regar.");
  else decir(`Regamos con ${agua(gastado)} de agua. ¡Bien!`);
}

// ---------------------------------------------------------------- 9. cosecha
function tocarParcela(i: number) {
  const p = J.parcelas[i];
  if (vista(i).lista && !p.cosechada) { cosechar(i); return; }
  if (!J.sembrado) { if (J.paso === "sembrar" || J.paso === "agua") sembrar(i); else seguirHistoria(); return; }
  if (!p.crop || p.cosechada) { decir("Esta franja está vacía."); return; }
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
  if (p.crop !== "descanso") { J.cosechas++; J.puntajes.push(c.puntaje); ganar("primera"); if (c.estrellas === 3) ganar("agua"); }
  const fams = p.historial.filter((x) => x !== "descanso").slice(-3).map((x) => cultivos.get(x)?.familia);
  if (fams.length === 3 && new Set(fams).size === 3) ganar("rotacion");
  guardarTodo();
  setTimeout(pintarMundo, 900);
  const msg = c.puntaje >= 85 ? "¡Excelente cosecha! Cuidaste muy bien el agua."
    : c.puntaje >= 60 ? "Buena cosecha. En algunos días le faltó agua."
    : "La planta pasó sed. La próxima vez riega cuando la tierra esté seca.";
  const epoca = c.en_epoca ? "" : ` Sembraste fuera de época: aquí se siembra ${c.epoca}.`;
  abrirPanel("¡Cosecha!", `<div class="cosecha">
    <div class="cosecha-icono">${icono(p.crop!, "icono-grande")}</div>
    <div class="estrellas">${"⭐".repeat(c.estrellas)}${"☆".repeat(3 - c.estrellas)}</div>
    <p class="grande"><b>${c.puntaje}</b> puntos</p>
    <p>${esc(msg + epoca)}</p>
    <p class="veredicto">En los años de la NASA, para este mes: <b>${VEREDICTO[c.veredicto] || ""}</b></p>
    <p class="fuente">Días con sed: ${c.dias_secos} de ${c.dias.length} · días de calor: ${c.dias.filter((x) => x.calor).length} · año ${c.anio} de NASA POWER</p>
    <button class="btn-juego grande" data-ok>👍 Seguir</button></div>`, "centro");
  $("[data-ok]").addEventListener("click", () => {
    cerrarPanel();
    const otra = listas()[0];
    if (otra !== undefined) setTimeout(() => cosechar(otra), 300);
    else if (todoCosechado()) { paso("rotacion"); leccionRotacion(); }
  });
  decir(msg + epoca, c.puntaje >= 60 ? "feliz" : "preocupada");
  pintarControles();
}

// ---------------------------------------------------------------- 10. rotación: 3 combinaciones que nutren la tierra
async function leccionRotacion() {
  const ultimo = J.crop || [...J.parcelas].reverse().find((p) => p.crop)?.crop;
  if (!ultimo || !J.mes) { abrirFamilias(); return; }
  abrirPanel("Rotar para cuidar la tierra", `<div class="cargando-mundo chico"><div class="girar"></div></div>`);
  let rots: any[] = [], casos: any[] = [];
  try {
    const [cu, pr] = await Promise.all([consultar("cultivo", { crop: ultimo, mes: J.mes }), consultar<{ casos: any[] }>("probadas", { mes: J.mes })]);
    rots = cu.rotaciones || [];
    casos = pr.casos.slice(0, 2);
    rots.forEach((r: any) => r.pasos.forEach((s: any) => cultivos.set(s.id, { ...cultivos.get(s.id), ...s })));
  } catch { /* sin señal: queda la lección */ }
  const p = abrirPanel("Rotar para cuidar la tierra", `
    <div class="leccion"><b>¿Por qué rotar?</b> Si siembras siempre lo mismo, la tierra se cansa: pierde nutrientes, se llena de
      plagas y la lluvia se la lleva. Al cambiar de familia y sembrar leguminosas, el suelo se recupera.</div>
    <div class="medidor"><span>Salud de tu tierra</span><div class="barra"><i style="width:${J.salud}%;background:${colorSuelo(J.salud)}"></i></div><b>${J.salud}</b></div>
    <h3>Pachita te recomienda 3 rotaciones</h3>
    <div class="rotaciones">${rots.slice(0, 3).map((r, k) => `<article class="rotacion">
      <p class="rot-titulo">Opción ${k + 1}${r.leguminosa ? ` · 🫘 con ${esc(r.leguminosa.toLowerCase())}` : ""}</p>
      <div class="rot-pasos">${r.pasos.map((s: any, j: number) => `${j ? '<span class="flecha">→</span>' : ""}<span class="rot-paso">${icono(s.id, "icono-mini")}<b>${esc(s.nombre)}</b><small>desde ${esc(s.desde)}</small></span>`).join("")}</div>
      ${r.repite_familia ? '<p class="malo">⚠️ Repite una familia</p>' : '<p class="bueno">✅ Cambia de familia en cada paso</p>'}
      <button class="btn-juego" data-rot="${k}">Elegir esta</button></article>`).join("") || "<p>No pude traer las rotaciones. Revisa la señal.</p>"}</div>
    ${casos.length ? `<h3>Probado en el campo</h3><div class="casos">${casos.map((c) => `<article class="caso"><p class="caso-lugar">📍 ${esc(c.lugar)} (${esc(c.provincia)})</p>
      <div class="rot-pasos">${c.pasos.map((s: any) => icono(s.id, "icono-mini")).join("")}</div><p>${esc(c.resultado)}</p></article>`).join("")}</div>` : ""}
    <p class="fuente">Rotaciones calculadas con los datos de tu parcela (NASA POWER, FAO-56) y casos del INIAP. La salud de la tierra son puntos del juego.</p>`);
  p.querySelectorAll<HTMLButtonElement>("[data-rot]").forEach((b) => b.addEventListener("click", () => {
    J.rotacion = rots[Number(b.dataset.rot)].pasos.map((s: any) => s.id);
    paso("certificado");
    certificado();
  }));
  decirVarias([
    "Si siembras siempre lo mismo, la tierra se cansa y se llena de plagas.",
    "Cambia de familia y siembra leguminosas: así el suelo se alimenta. Elige una de estas tres rotaciones.",
  ]);
}

// ---------------------------------------------------------------- 11. certificado de Granjero Cósmico
let pachitaDatos = "";
async function cargarPachitaDatos() {
  if (pachitaDatos) return;
  try {
    const b = await (await fetch(urlPose("saluda"))).blob();
    pachitaDatos = await new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsDataURL(b); });
  } catch { /* sin imagen */ }
}

function svgCertificado(): string {
  const prom = J.puntajes.length ? Math.round(J.puntajes.reduce((a, b) => a + b, 0) / J.puntajes.length) : 0;
  const hoy = new Date();
  const rot = (J.rotacion || []).map((id) => cultivos.get(id)?.nombre || id);
  const estrellas = Array.from({ length: 26 }, (_, k) => `<circle cx="${(k * 97) % 800}" cy="${(k * 53) % 90 + 30}" r="${1 + (k % 3)}" fill="#fff" opacity=".8"/>`).join("");
  const pachita = pachitaDatos ? `<image href="${pachitaDatos}" width="104" height="224"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 560" class="certificado-svg" font-family="Nunito, Arial, sans-serif">
    <rect width="800" height="560" rx="28" fill="#fffaf0"/>
    <path d="M24 40 Q24 24 40 24 H760 Q776 24 776 40 V124 H24 Z" fill="#1d3b6a"/>${estrellas}
    <rect x="12" y="12" width="776" height="536" rx="22" fill="none" stroke="#e6b33a" stroke-width="6"/>
    <rect x="24" y="24" width="752" height="512" rx="16" fill="none" stroke="#2e7d4f" stroke-width="2" stroke-dasharray="8 6"/>
    <g transform="translate(712 30) scale(.42)">${COHETE.replace('class="cohete-svg"', 'width="120" height="200"')}</g>
    <text x="380" y="80" text-anchor="middle" font-size="31" font-weight="900" fill="#fff">CERTIFICADO DE GRANJERO CÓSMICO</text>
    <text x="380" y="108" text-anchor="middle" font-size="16" fill="#ffd34d">Astro Granja · NASA Space Apps 2026</text>
    <text x="400" y="172" text-anchor="middle" font-size="20" fill="#5b4a3a">Pachita certifica que la granja</text>
    <text x="400" y="222" text-anchor="middle" font-size="44" font-weight="900" fill="#2e7d4f">${esc(J.granja)}</text>
    <text x="400" y="262" text-anchor="middle" font-size="18" fill="#3b2a1a">aprendió a sembrar, regar con datos de la NASA y rotar para cuidar la tierra.</text>
    <text x="400" y="306" text-anchor="middle" font-size="19" fill="#3b2a1a">Cosechas: <tspan font-weight="900">${J.cosechas}</tspan>  ·  Puntaje promedio: <tspan font-weight="900">${prom}</tspan>  ·  Salud de la tierra: <tspan font-weight="900">${J.salud}</tspan></text>
    ${rot.length ? `<text x="400" y="346" text-anchor="middle" font-size="17" fill="#5b4a3a">Rotación elegida: <tspan font-weight="800" fill="#2e7d4f">${esc(rot.join(" → "))}</tspan></text>` : ""}
    <text x="400" y="388" text-anchor="middle" font-size="26">${J.medallas.map((m) => MEDALLAS[m]?.icono || "").join(" ")}</text>
    <g transform="translate(60 316)">${pachita}</g>
    <line x1="520" y1="482" x2="720" y2="482" stroke="#3b2a1a" stroke-width="1.5"/>
    <text x="620" y="474" text-anchor="middle" font-size="26" font-style="italic" fill="#2b4a7a">Pachita</text>
    <text x="620" y="502" text-anchor="middle" font-size="14" fill="#5b4a3a">Granjera de la sierra</text>
    <text x="400" y="528" text-anchor="middle" font-size="13" fill="#8a7a6a">${hoy.getDate()} de ${MESES[hoy.getMonth()]} de ${hoy.getFullYear()} · Datos: NASA POWER, FAO-56, INIAP</text>
  </svg>`;
}

async function certificado() {
  ganar("cosmico");
  await cargarPachitaDatos();
  const p = abrirPanel("¡Eres Granjero Cósmico!", `<div class="certificado">${svgCertificado()}</div>
    <div class="fila-botones"><button class="btn-juego" data-bajar>📥 Descargar</button>
      <button class="btn-juego borde" data-seguir>🌱 Sembrar la rotación</button>
      <button class="btn-juego borde" data-nueva>🚀 Nueva granja</button></div>`, "certificado-panel");
  lanzarConfeti();
  decir(`¡Felicitaciones, granja ${J.granja}! Ganaste el certificado de Granjero Cósmico. ¡La tierra te lo agradece!`);
  p.querySelector("[data-bajar]")!.addEventListener("click", descargarCertificado);
  p.querySelector("[data-seguir]")!.addEventListener("click", nuevaTemporada);
  p.querySelector("[data-nueva]")!.addEventListener("click", reiniciar);
}

function descargarCertificado() {
  const img = new Image();
  img.onload = () => {
    const c = document.createElement("canvas");
    c.width = 1600; c.height = 1120;
    c.getContext("2d")!.drawImage(img, 0, 0, 1600, 1120);
    const a = document.createElement("a");
    a.download = `certificado-${J.granja.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}.png`;
    a.href = c.toDataURL("image/png");
    a.click();
  };
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgCertificado());
}

function lanzarConfeti() {
  const caja = document.createElement("div");
  caja.className = "confeti";
  caja.innerHTML = Array.from({ length: 40 }, (_, k) =>
    `<i style="left:${(k * 37) % 100}%;background:${["#ffd34d", "#5fb35a", "#e85b7a", "#2b8fc4", "#f2994a"][k % 5]};animation-delay:${(k % 10) * 0.12}s"></i>`).join("");
  document.body.appendChild(caja);
  setTimeout(() => caja.remove(), 4000);
}

/** Otra temporada: sigue con el segundo paso de la rotación elegida. */
async function nuevaTemporada() {
  const c = cicloPrincipal();
  const fin = c ? c.dias[c.dias.length - 1].fecha : null;
  const proximo = fin ? (Number(fin.slice(5, 7)) % 12) + 1 : ((J.mes ?? 1) % 12) + 1;
  J.temporada++;
  J.mes = null;
  J.anio = fin ? Number(fin.slice(0, 4)) + (proximo === 1 ? 1 : 0) : J.anio;
  J.dia = 0;
  J.sembrado = false;
  J.parcelas.forEach((p) => { p.crop = null; p.riegos = []; p.cosechada = false; p.puntaje = undefined; });
  const siguiente = J.rotacion && J.rotacion.length > 1 ? J.rotacion[1] : null;
  J.crop = siguiente;
  ciclos.clear();
  try { await cargarSemillas(proximo); } catch { /* se reintenta luego */ }
  pintarMundo();
  pintarControles();
  if (siguiente && cultivos.get(siguiente)?.apto !== false) {
    paso("calendario");
    abrirCalendario();
    decir(`Tu rotación sigue con ${nombreCorto(siguiente)}. ¡Elige el mes!`);
  } else { paso("semillas"); abrirFamilias(); }
}

function reiniciar() {
  J = nuevo();
  guardarJuego(J);
  ciclos.clear();
  semillasInfo = null;
  cerrarPanel();
  mundo?.destruir();
  mundo = null;
  $("#hud").hidden = true;
  $("#escena").hidden = true;
  pantallaNombre();
}

// ---------------------------------------------------------------- logros
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
    <p class="ayuda">Granja ${esc(J.granja)} · cosechas: ${J.cosechas} · temporada ${J.temporada}</p>
    ${J.paso === "certificado" ? `<button class="btn-juego" data-cert>📜 Ver mi certificado</button>` : ""}
    <button class="btn-juego borde" data-reiniciar>🚀 Empezar otra granja</button>`);
  document.querySelector("[data-cert]")?.addEventListener("click", certificado);
  $("[data-reiniciar]").addEventListener("click", reiniciar);
}

// ---------------------------------------------------------------- HUD y controles
function pintarHud() {
  const lugarTxt = document.querySelector<HTMLElement>("#hud-lugar");
  if (!lugarTxt) return;
  lugarTxt.textContent = J.granja || "Mi granja";
  const hoy = diaActual();
  $("#hud-fecha").textContent = hoy ? fecha(hoy.fecha) : J.mes ? `Siembra en ${MESES[J.mes - 1]}` : lugar().nombre || "";
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
    sem.innerHTML = c.meses.map((m, k) => `<span class="sem ${c.estado_mes[k]} ${m.slice(0, 3) === mesHoy ? "hoy" : ""}" title="${m}">${m.slice(0, 3)}</span>`).join("")
      + `<span class="sem-temp" title="Temperatura máxima de hoy">🌡️ ${num(d.tmax)} °C</span>`;
    sem.hidden = false;
  } else sem.hidden = true;
}

function pintarControles() {
  const ctl = $("#tiempo");
  const plantadas = J.parcelas.some((p) => p.crop);
  if (!J.sembrado) {
    if (J.paso === "sembrar" || J.paso === "agua") {
      ctl.innerHTML = `<button class="t ancho" data-todas>🌱 Sembrar todo</button>
        ${plantadas ? `<button class="btn-juego" data-agua>💧 ¿Cuánta agua?</button>` : ""}`;
      ctl.querySelector("[data-todas]")!.addEventListener("click", sembrarTodas);
      ctl.querySelector("[data-agua]")?.addEventListener("click", panelAgua);
    } else ctl.innerHTML = "";
  } else if (todoCosechado()) {
    ctl.innerHTML = `<button class="btn-juego grande" data-rotar>🔄 Rotar la tierra</button>`;
    ctl.querySelector("[data-rotar]")!.addEventListener("click", () => { paso("rotacion"); leccionRotacion(); });
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
  try { await cargarSemillas(J.mes ?? (new Date().getMonth() + 1) % 12 + 1); } catch { /* sin señal */ }
  if (!parcelaInfo) { try { parcelaInfo = await consultar("parcela"); } catch { /* sin señal */ } }
}

// ---------------------------------------------------------------- arranque
export function arrancar() {
  $("#pachita").innerHTML = PACHITA_SVG;
  document.addEventListener("pointerdown", desbloquearAudio, { once: true });
  $("#silencio").addEventListener("click", () => {
    silenciar(!estaSilenciado());
    $("#silencio").textContent = estaSilenciado() ? "🔇" : "🔊";
  });
  $("#btn-tierra").addEventListener("click", fichaTierra);
  $("#btn-semillas").addEventListener("click", abrirFamilias);
  $("#btn-calendario").addEventListener("click", abrirCalendario);
  $("#btn-regar").addEventListener("click", regar);
  $("#btn-logros").addEventListener("click", abrirLogros);
  if (!J.granja) { pantallaNombre(); return; }
  if (!tieneParcela() || J.paso === "mapa" || J.paso === "nombre") { pantallaMapa(); return; }
  abrirPanel(`¡Hola otra vez!`, `<p class="grande">¿Seguimos en la granja <b>${esc(J.granja)}</b>?</p>
    <div class="fila-botones"><button class="btn-juego grande" data-seguir>▶ Seguir jugando</button>
    <button class="btn-juego borde" data-nueva>🚀 Otra granja</button></div>`, "centro");
  $("[data-seguir]").addEventListener("click", () => { cerrarPanel(); entrarMundo(); });
  $("[data-nueva]").addEventListener("click", reiniciar);
  decir(`¡Hola otra vez! ¿Seguimos cuidando la granja ${J.granja}?`);
}

// ---------------------------------------------------------------- dibujos de la historia (SVG propios)
const COHETE = `<svg viewBox="0 0 120 200" class="cohete-svg" aria-hidden="true">
  <path d="M60 6 C86 30 92 70 88 120 L32 120 C28 70 34 30 60 6Z" fill="#f4f1ea" stroke="#3b2a1a" stroke-width="3"/>
  <path d="M60 6 C72 17 80 30 84 46 L36 46 C40 30 48 17 60 6Z" fill="#d94f3d" stroke="#3b2a1a" stroke-width="3"/>
  <circle cx="60" cy="76" r="17" fill="#9fd0ee" stroke="#3b2a1a" stroke-width="3"/>
  <circle cx="60" cy="76" r="8" fill="#c58457"/><path d="M47 72 Q60 58 73 72 Z" fill="#f6f2e8"/><ellipse cx="60" cy="71" rx="15" ry="3" fill="#f1ece0"/>
  <path d="M32 96 L12 132 L34 124 Z M88 96 L108 132 L86 124 Z" fill="#2b6cb0" stroke="#3b2a1a" stroke-width="3"/>
  <rect x="40" y="118" width="40" height="12" rx="3" fill="#7d8a9a" stroke="#3b2a1a" stroke-width="3"/>
  <path class="llama" d="M44 132 Q60 196 76 132 Q60 150 44 132Z" fill="#ffb02e"/><path class="llama" d="M50 132 Q60 172 70 132 Q60 142 50 132Z" fill="#fff36b"/>
  <text x="60" y="108" text-anchor="middle" font-size="9" font-weight="900" fill="#2b6cb0" font-family="sans-serif">PACHA</text>
</svg>`;
const PAISAJE = `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <defs><linearGradient id="cieloA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f86c6"/><stop offset="1" stop-color="#bfe0f2"/></linearGradient></defs>
  <rect width="400" height="300" fill="url(#cieloA)"/>
  <path d="M40 200 L170 70 Q190 56 210 70 L360 200Z" fill="#7d8a9a"/>
  <path d="M150 90 L170 70 Q190 56 210 70 L230 90 Q216 98 204 92 Q192 104 180 94 Q166 102 150 90Z" fill="#f6f8fb"/>
  <path d="M0 210 Q120 175 240 195 T400 185 L400 300 L0 300Z" fill="#6f9a52"/>
  <path d="M0 225 Q100 205 200 215 L196 238 Q100 228 0 252Z" fill="#9fbf5c"/><path d="M200 215 Q320 200 400 208 L400 232 Q320 222 196 238Z" fill="#c9b75a"/>
  <path d="M0 252 Q100 228 196 238 L192 262 Q100 252 0 278Z" fill="#5f8f43"/><path d="M196 238 Q320 222 400 232 L400 256 Q320 248 192 262Z" fill="#a8c46a"/>
  <path d="M0 278 Q240 250 400 270 L400 300 L0 300Z" fill="#8a5a33"/>
</svg>`;
