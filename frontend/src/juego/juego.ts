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
import { ic, icG } from "./ui";

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

const DESCANSO: Cultivo = { id: "descanso", nombre: "Descanso con cobertura", emoji: "", foto: null, familia: "ninguna",
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
/** Agua siempre en litros (redondeada para que se lea fácil). */
function agua(litros: number) {
  const l = Math.max(1, litros);
  const r = l < 100 ? Math.round(l) : l < 10000 ? Math.round(l / 10) * 10 : Math.round(l / 100) * 100;
  return `${num(r)} litros`;
}
const nombreCorto = (id: string) => (cultivos.get(id)?.nombre || id).toLowerCase();
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Litros en pocas letras para la barra de arriba: 850 L · 12,5 mil L · 2,9 mill. L */
const litrosCortos = (l: number) => (l < 1000 ? `${num(Math.round(l))} L` : l < 1e6 ? `${num(l / 1000, 1)} mil L` : `${num(l / 1e6, 1)} mill. L`);
const btn = (icono: string, texto: string) => `${ic(icono, "ic-btn")}<span>${texto}</span>`;

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

/** Mide el HUD, el globo y a Pachita y deja el panel en el hueco libre: nada se tapa. */
function medirLayout() {
  const alto = window.innerHeight;
  const hud = document.querySelector<HTMLElement>("#hud");
  const enEscena = !$("#escena").hidden && hud && !hud.hidden;
  const arriba = enEscena ? hud!.getBoundingClientRect().bottom + 8 : 12;
  const globo = $("#globo"), pachita = $("#pachita"), panel = $("#panel");
  // medidas de diseño (sin transformaciones): el globo entra con una animación de escala que engaña a getBoundingClientRect
  const caja = pachita.parentElement!.getBoundingClientRect();
  const topeGlobo = globo.hidden ? alto : caja.bottom - parseFloat(getComputedStyle(globo).marginBottom || "0") - globo.offsetHeight;
  const topePachita = caja.bottom - pachita.offsetHeight + 24;
  // el panel solo se achica si Pachita o su globo quedan debajo de él; si están a un lado, usa todo el alto
  const pr = panel.hidden ? null : panel.getBoundingClientRect();
  const choca = (izq: number, der: number) => !!pr && der > pr.left && izq < pr.right;
  let techo = alto;
  if (!globo.hidden && choca(caja.left, caja.right)) techo = Math.min(techo, topeGlobo);
  if (choca(caja.right - pachita.offsetWidth, caja.right)) techo = Math.min(techo, topePachita);
  const dock = (t: number) => `${Math.round(Math.min(Math.max(16, alto - t + 8), alto * 0.5))}px`;
  document.body.style.setProperty("--hud-alto", `${Math.round(arriba)}px`);
  document.body.style.setProperty("--dock", dock(techo));
  document.body.style.setProperty("--dock-total", dock(Math.min(topeGlobo, topePachita)));
}

// ---------------------------------------------------------------- 0. menú principal, nombre de la granja y llegada en cohete
function fondoMenu(c: HTMLElement, contenido: string) {
  c.hidden = false;
  document.body.classList.add("en-menu");
  c.innerHTML = `<div class="menu-fondo">${PAISAJE}</div><div class="menu-capa">${contenido}</div>`;
}

/** Pantalla de inicio como la de un juego: logo, Pachita y botones grandes sobre el paisaje andino. */
function menuPrincipal() {
  const c = $("#intro");
  const hay = !!J.granja;
  fondoMenu(c, `
    <h1 class="logo" aria-label="Astro Granja"><span class="logo-1">Astro</span><span class="logo-2">Granja</span>
      <small>con Pachita y datos de la NASA</small></h1>
    <div class="menu-tablero">
      ${hay ? `<button class="btn-juego grande" data-seguir>${btn("play", "Seguir jugando")}</button>
               <p class="menu-granja">Granja <b>${esc(J.granja)}</b> · temporada ${J.temporada}</p>` : ""}
      <button class="btn-juego grande ${hay ? "borde" : ""}" data-nueva>${btn("cohete", hay ? "Nueva granja" : "¡Jugar!")}</button>
      <div class="menu-fila">
        <button class="btn-redondo" data-sonido aria-label="Sonido">${ic(estaSilenciado() ? "mudo" : "sonido")}</button>
        <button class="btn-redondo" data-medallas aria-label="Medallas">${ic("medalla")}</button>
      </div>
    </div>
    <p class="menu-creditos">NASA Space Apps 2026 · Datos: NASA POWER, FAO-56, INIAP · Relieve: Open-Meteo<br>Ilustraciones de Pachita y cultivos con asistencia de IA (marcadas «IA»)</p>`);
  c.querySelector("[data-seguir]")?.addEventListener("click", () => {
    salirMenu();
    if (!tieneParcela() || J.paso === "mapa" || J.paso === "nombre") pantallaMapa(); else entrarMundo();
  });
  c.querySelector("[data-nueva]")!.addEventListener("click", () => { if (hay) reiniciar(); else pantallaNombre(); });
  c.querySelector("[data-sonido]")!.addEventListener("click", (e) => {
    silenciar(!estaSilenciado());
    (e.currentTarget as HTMLElement).innerHTML = ic(estaSilenciado() ? "mudo" : "sonido");
    $("#silencio").innerHTML = ic(estaSilenciado() ? "mudo" : "sonido");
  });
  c.querySelector("[data-medallas]")!.addEventListener("click", abrirLogros);
  decir(hay ? `¡Hola otra vez! Soy Pachita. ¿Seguimos cuidando la granja ${J.granja}?`
    : "¡Hola! Soy Pachita, granjera de la sierra. Toca Jugar y te enseño a sembrar con datos de los satélites de la NASA.");
}
function salirMenu() { $("#intro").hidden = true; document.body.classList.remove("en-menu"); }

function pantallaNombre() {
  const c = $("#intro");
  fondoMenu(c, `<form class="tarjeta-nombre" autocomplete="off">
      <label for="nombre-granja">¿Cómo se llama tu granja?</label>
      <input id="nombre-granja" maxlength="28" placeholder="Ej.: La Chacra Feliz" value="${esc(J.granja)}" required>
      <button class="btn-juego grande" type="submit">${btn("cohete", "¡Que llegue Pachita!")}</button>
    </form>`);
  decir("Primero, ponle un nombre a tu granja. Puede ser el de tu familia o uno inventado. ¡Pachita viene en camino en su cohete!");
  c.querySelector<HTMLInputElement>("#nombre-granja")!.focus();
  c.querySelector("form")!.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = c.querySelector<HTMLInputElement>("#nombre-granja")!.value.trim();
    if (!v) return;
    J.granja = v.slice(0, 28);
    paso("mapa");
    aterrizaje();
  });
}

/** El cohete baja frenando con fuego, levanta humo y polvo al tocar tierra, se abren las patas y sale Pachita. */
async function aterrizaje() {
  const c = $("#intro");
  const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
  fondoMenu(c, `<div class="escena-aterrizaje"><div class="sombra-cohete"></div>
      <div class="cohete-baja">${COHETE}</div><div class="humo-caja"></div></div>`);
  document.body.classList.add("llegando");
  const cohete = c.querySelector<HTMLElement>(".cohete-baja")!, humo = c.querySelector<HTMLElement>(".humo-caja")!;
  const sombra = c.querySelector<HTMLElement>(".sombra-cohete")!;
  const bajar = quieto ? 2200 : 2600;
  {
    cohete.classList.add("encendido");
    const chispas = window.setInterval(() => soltarHumo(humo, quieto ? 1 : 2, 0.5, true), quieto ? 160 : 90);
    cohete.animate([
      { transform: "translate(-50%, -115vh) rotate(-8deg)" },
      { transform: "translate(-50%, -30vh) rotate(4deg)", offset: 0.55 },
      { transform: "translate(-50%, -6vh) rotate(-2deg)", offset: 0.85 },
      { transform: "translate(-50%, 0) rotate(0deg)" },
    ], { duration: bajar, easing: "cubic-bezier(.2,.75,.35,1)", fill: "forwards" });
    sombra.animate([{ transform: "translateX(-50%) scale(.2)", opacity: 0 }, { transform: "translateX(-50%) scale(1)", opacity: 0.45 }],
      { duration: bajar, easing: "ease-in", fill: "forwards" });
    await espera(bajar - 450);
    cohete.classList.add("frenando");
    await espera(450);
    clearInterval(chispas);
    soltarHumo(humo, quieto ? 12 : 26, quieto ? 1 : 1.4, false);
    cohete.classList.remove("encendido", "frenando");
    cohete.classList.add("patas");
    if (!quieto) c.querySelector(".escena-aterrizaje")!.animate(
      [{ transform: "translate(0,0)" }, { transform: "translate(-6px,4px)" }, { transform: "translate(5px,-3px)" }, { transform: "translate(-3px,2px)" }, { transform: "translate(0,0)" }],
      { duration: 420, easing: "ease-out" });
    await espera(700);
  }
  document.body.classList.remove("llegando");
  document.body.classList.add("bajo-cohete");
  cohete.classList.add("puerta-abierta");
  await decir(`¡Llegué! Bienvenida, bienvenido a la granja ${J.granja}. Juntos vamos a aprender a cuidar la tierra con los datos que miden los satélites de la NASA.`);
  document.body.classList.remove("bajo-cohete");
  salirMenu();
  pantallaMapa();
}

/** Bocanadas de humo (o chispas de fuego) que salen de la tobera y se abren hacia los lados. */
function soltarHumo(caja: HTMLElement, cuantas: number, fuerza: number, fuego: boolean) {
  const r = caja.getBoundingClientRect();
  const tob = caja.parentElement!.querySelector(".cohete-baja")!.getBoundingClientRect();
  for (let k = 0; k < cuantas; k++) {
    const b = document.createElement("i");
    b.className = fuego ? "chispa" : "bocanada";
    const x0 = tob.left + tob.width / 2 - r.left, y0 = tob.bottom - r.top - (fuego ? 6 : 10);
    b.style.left = `${x0}px`;
    b.style.top = `${y0}px`;
    caja.appendChild(b);
    const lado = (Math.random() - 0.5) * 2;
    const dx = fuego ? lado * 30 : lado * 190 * fuerza, dy = fuego ? 40 + Math.random() * 50 : -10 - Math.random() * 70 * fuerza;
    const tam = fuego ? 0.6 + Math.random() * 0.6 : 0.8 + Math.random() * 1.6 * fuerza;
    const dur = fuego ? 420 : 1400 + Math.random() * 900;
    b.animate([
      { transform: "translate(-50%,-50%) scale(.3)", opacity: fuego ? 1 : 0.95 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${tam * (fuego ? 0.4 : 2.4)})`, opacity: 0 },
    ], { duration: dur, easing: "cubic-bezier(.15,.8,.3,1)", fill: "forwards" }).onfinish = () => b.remove();
  }
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
  decirVarias([
    "Ahora busca tu parcela en el mapa. Mueve el mapa con el dedo hasta que el pin rojo quede sobre tu chacra; los nombres de los pueblos te ayudan a ubicarte.",
    "Con la barra agrandas o achicas el círculo amarillo hasta que cubra tu tierra. Si no tienes una, toca un pueblo de prueba como Calpi.",
  ]);
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
  const carta = (icono: string, titulo: string, valor: string, detalle: string, color: string, clase = "") =>
    `<article class="carta ${clase}" style="--color:${color}"><div class="carta-icono">${ic(icono)}</div><h3>${titulo}</h3>
      <p class="carta-valor">${valor}</p><p class="carta-detalle">${detalle}</p></article>`;
  const secos = humedad.map((h, i) => (h < 0.7 ? MESES[i] : "")).filter(Boolean);
  // lluvia: año normal frente al más seco y al más lluvioso que midió la NASA, y el índice de aridez (UNEP)
  const lmin = c.lluvia_min ?? c.lluvia_seca, lmax = c.lluvia_max ?? Math.round(c.lluvia_anual * 1.3);
  const lhum = c.lluvia_humeda ?? Math.round((c.lluvia_anual + lmax) / 2);
  const ar = c.aridez ?? c.lluvia_anual / Math.max(c.et0_anual, 1);
  const estado = ar < 0.5 ? ["seca", "#c62828", "Llueve mucho menos de lo que el sol evapora: casi siempre hay que regar."]
    : ar < 0.65 ? ["algo seca", "#e0a100", "Llueve un poco menos de lo que se evapora: hay que regar en los meses secos."]
    : ar < 1 ? ["húmeda", "#2e7d32", "La lluvia casi alcanza a lo que se evapora: se riega solo en verano."]
    : ["muy húmeda", "#1e6fb8", "Llueve más de lo que se evapora: cuida que el agua no lave la tierra."];
  const pos = (v: number) => Math.max(0, Math.min(100, ((v - lmin) / Math.max(lmax - lmin, 1)) * 100));
  const tarjetaLluvia = `<article class="carta ancha lluvia-carta" style="--color:#1e6fb8">
      <div class="carta-cabeza"><div class="carta-icono">${ic("lluvia")}</div><div><h3>Lluvia al año</h3>
        <p class="carta-valor">${num(c.lluvia_anual)} mm <small>en un año normal</small></p></div>
        <span class="estado-tierra" style="--c:${estado[1]}">Tu zona es <b>${estado[0]}</b></span></div>
      <div class="regla-lluvia" role="img" aria-label="De ${num(lmin)} a ${num(lmax)} milímetros según el año">
        <div class="regla-zonas" style="--a:${pos(c.lluvia_seca)}%;--b:${pos(lhum)}%"></div>
        <span class="regla-marca" style="left:${pos(c.lluvia_anual)}%"><b>Normal</b></span>
      </div>
      <div class="regla-textos"><span><b>${num(lmin)} mm</b>el año más seco</span><span class="centro">seco · normal · lluvioso</span><span class="fin"><b>${num(lmax)} mm</b>el año más lluvioso</span></div>
      <p class="carta-detalle">${estado[2]} De cada 10 litros que el sol evapora, la lluvia devuelve unos <b>${num(Math.min(20, Math.round(ar * 10)))}</b>.</p>
    </article>`;
  abrirPanel("Así es tu tierra", `<p class="ficha-sub">Granja <b>${esc(J.granja)}</b> · ${esc(p.lugar.area_texto)} · datos de satélites de la NASA</p>
  <div class="cartas">
    ${tarjetaLluvia}
    ${carta("sol", "Evaporación", `${num(c.et0_anual)} mm`, c.et0_anual > c.lluvia_anual ? "Se evapora más de lo que llueve" : "Se evapora menos de lo que llueve", "#e65100")}
    ${carta("termometro", "Temperatura", `${num(c.tmin)} a ${num(c.tmax)} °C`, `Noches frías y días templados · días de calor fuerte: ${t.calor_dias}`, "#d84315")}
    ${n.radiacion_kwh ? carta("dia", "Energía del sol", `${num(n.radiacion_kwh, 1)} kWh/m²`, "Cada día, en cada metro cuadrado", "#f2a900") : ""}
    ${n.humedad_aire ? carta("nube", "Humedad del aire", `${n.humedad_aire} %`, `Viento: ${num(n.viento, 1)} m/s`, "#5c7da8") : ""}
    ${carta("grafico", "Última década", `Lluvia ${t.cambio_lluvia_pct > 0 ? "+" : ""}${t.cambio_lluvia_pct} %`, `Temperatura ${t.cambio_temp_c > 0 ? "+" : ""}${num(t.cambio_temp_c, 1)} °C`, "#6a1b9a")}
    ${humedad.length ? `<article class="carta ancha" style="--color:#2e7d32"><div class="carta-cabeza"><div class="carta-icono">${ic("gota")}</div><h3>Humedad del suelo en las raíces, mes a mes</h3></div>
      <div class="barras-h">${barras}</div>
      <p class="leyenda-mini"><span style="--c:#2e7d32">húmedo</span><span style="--c:#f9a825">justo</span><span style="--c:#c62828">seco: hay que regar</span></p>
      <p class="carta-detalle">Satélites de la NASA (GWETROOT): 100 % es suelo empapado.</p></article>` : ""}
  </div>
  <p class="fuente">NASA POWER ${esc(p.periodo)} (MERRA-2, CERES) · FAO-56.</p>
  <button class="btn-juego grande" data-sig>${btn("semilla", "Conocer las semillas")}</button>`, "cartas-panel");
  $("[data-sig]").addEventListener("click", () => { paso("semillas"); abrirFamilias(); });
  const anios = (() => { const [a0, a1] = String(p.periodo).split("–").map(Number); return a1 && a0 ? a1 - a0 + 1 : "muchos"; })();
  const frases = [
    `Los satélites de la NASA miraron tu granja todos los días durante ${anios} años. Con esos datos sabemos cómo es tu tierra.`,
    `En un año normal llueven ${num(c.lluvia_anual)} milímetros. Un milímetro es un litro de agua en cada metro cuadrado. Pero el año más seco llovió solo ${num(lmin)} y el más lluvioso ${num(lmax)}: por eso hay que estar preparados.`,
    `El sol y el viento evaporan ${num(c.et0_anual)} milímetros al año. Si se evapora más de lo que llueve, la tierra se seca y las plantas piden riego. Tu zona es ${estado[0]}.`,
    secos.length ? `Mira las barras de humedad: el suelo se seca más en ${secos.slice(0, 3).join(", ")}. Esos meses las raíces tienen sed y hay que regar.` : "Mira las barras de humedad: tu suelo guarda agua casi todo el año. ¡Qué suerte!",
    `La temperatura va de ${num(c.tmin)} grados en las noches frías a ${num(c.tmax)} en los días de sol fuerte. Cuando hace mucho calor, la tierra pierde agua más rápido.`,
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
    <div class="leccion">${ic("foco", "ic-leccion")}<div><b>¿Por qué familias?</b> Las plantas de una misma familia se enferman de lo mismo y comen lo mismo del suelo.
      Si cambias de familia cada vez que siembras, la tierra descansa y las plagas se van. ¡Eso es <b>rotar</b>!
      Las <b>N+</b> son leguminosas: fabrican su propio abono con el nitrógeno del aire.</div></div>
    ${grupos.map(({ f, cs }) => `<section class="familia" style="--color:${f.color}">
      <h3>${icono(f.icono, "icono-familia")} ${f.nombre}</h3><p>${f.porque}</p>
      <div class="sobres">${cs.map((c) => `<button type="button" class="sobre ${c.apto === false ? "bloqueado" : ""}" data-crop="${c.id}">
        ${icono(c.id, "icono-sobre")}${c.apto === false ? `<span class="candado">${ic("candado")}</span>` : ""}
        <span class="sobre-nombre">${esc(c.nombre)}</span>${c.fija_n ? '<span class="sello-n">N+</span>' : ""}</button>`).join("")}
        ${(f.tambien || []).map((k) => `<div class="sobre info">${icono(k, "icono-sobre")}<span class="sobre-nombre">${NOMBRE_EXTRA[k]}</span><span class="mini">también ayuda</span></div>`).join("")}
      </div></section>`).join("")}`, "semillas-panel");
  p.querySelectorAll<HTMLButtonElement>(".sobre[data-crop]").forEach((b) => b.addEventListener("click", () => detalleSemilla(b.dataset.crop!)));
  decirVarias([
    "Estas son las semillas de la sierra, ordenadas por familia. Las plantas de la misma familia son como primas: les gustan las mismas comidas y les dan las mismas plagas.",
    "Las semillas con candado no crecen a la altura de tu granja o no es su época. Toca una semilla para conocerla y elegirla.",
  ]);
}

function detalleSemilla(id: string) {
  const c = cultivos.get(id)!;
  const f = familiaDe(c.familia);
  abrirPanel(c.nombre, `<div class="detalle-semilla">
      ${icono(id, "icono-grande")}
      <p class="etiqueta" style="--color:${f?.color || "#555"}">${f?.nombre || "Cobertura"}</p>
      ${c.fija_n ? `<p class="bueno">${ic("nitrogeno", "ic-linea")} Alimenta la tierra con nitrógeno del aire</p>` : ""}
      <ul class="datos">
        ${c.ciclo_dias ? `<li>${ic("reloj", "ic-linea")} Tarda <b>${c.ciclo_dias} días</b> en estar lista</li>` : ""}
        ${c.alt_min ? `<li>${ic("montana", "ic-linea")} Crece de <b>${num(c.alt_min)}</b> a <b>${num(c.alt_max!)} m</b> de altura</li>` : ""}
        ${c.epoca_texto ? `<li>${ic("calendario", "ic-linea")} Aquí se siembra <b>${esc(c.epoca_texto)}</b></li>` : ""}
        ${c.uso ? `<li>${ic("cesta", "ic-linea")} Sirve para: ${esc(c.uso)}</li>` : ""}
      </ul>
      ${c.apto === false ? `<p class="malo">${ic("candado", "ic-linea")} ${esc(c.razon || "")}</p>` : ""}
    </div>
    <div class="fila-botones"><button class="btn-juego borde" data-volver>${btn("atras", "Otras semillas")}</button>
      ${c.apto === false ? "" : `<button class="btn-juego" data-elegir>${btn("semilla", "Elegir esta semilla")}</button>`}</div>`, "centro");
  $("[data-volver]").addEventListener("click", abrirFamilias);
  document.querySelector("[data-elegir]")?.addEventListener("click", () => {
    J.crop = id;
    paso("calendario");
    abrirCalendario();
  });
  if (c.apto === false) decir(`${c.nombre} no se puede sembrar aquí: ${c.razon}. Prueba con otra semilla de la lista.`, "pensando");
  else decir(c.fija_n
    ? `${c.nombre} es una leguminosa. En sus raíces viven bacterias amigas que atrapan el nitrógeno del aire y lo dejan en la tierra como abono. Tarda ${c.ciclo_dias} días en estar lista.`
    : `${c.nombre} es de la familia de las ${f?.nombre.split(" (")[0].toLowerCase() || "plantas de cobertura"}. Tarda ${c.ciclo_dias} días en estar lista${c.epoca_texto ? ` y aquí se siembra ${c.epoca_texto}` : ""}.`);
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
  decir(`Los meses verdes son la época de siembra de ${c.nombre.toLowerCase()} en tu zona, según el INIAP: ahí llega la lluvia justo cuando la semilla la necesita para nacer. Toca un mes.`);
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
      <div class="fila-botones"><button class="btn-juego" data-otro>${btn("calendario", "Elegir otro mes")}</button>
      <button class="btn-juego borde" data-igual>Sembrar igual</button></div>`, "centro");
    decir(`En ${MESES[mes - 1]} no es época: la semilla nacería sin lluvia o la cosecha caería en meses de helada. Si siembras igual, tendrás que regar más y la planta puede sufrir.`, "pensando");
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
  decir(`Tu parcela tiene cuatro franjas de tierra. Toca una franja para sembrar ${c.nombre.toLowerCase()} en ${MESES[J.mes - 1]}, o el botón Sembrar todo para llenar las cuatro.`);
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
  decir(`¡Sembraste ${nombreCorto(J.crop)} en la franja ${i + 1}!${n < N_PARCELAS ? " Puedes sembrar más franjas, o dejar alguna con descanso." : " Ahora veamos cuánta agua va a necesitar."}`);
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
    <div class="gota-fila"><span class="gota-ic">${ic("brote")}</span><div><b>${agua(L(a.litros_cultivo))}</b><p>bebe tu ${c.cultivo.nombre.toLowerCase()} en todo su ciclo: <b>${num(a.gasto_mm)} litros en cada metro cuadrado</b></p></div></div>
    <div class="gota-fila"><span class="gota-ic">${ic("lluvia")}</span><div><b>${agua(L(a.litros_lluvia))}</b><p>le da la lluvia en un año normal (${num(a.lluvia_util_mm)} litros por m²)</p></div></div>
    <div class="gota-fila destaca"><span class="gota-ic">${ic("gota")}</span><div><b>${a.riego_mm >= 5 ? agua(L(a.litros_riego)) : "casi nada"}</b><p>hay que regar en un año normal${a.riego_mm >= 5 ? ` (${num(a.riego_mm)} litros por m²)` : ""}</p></div></div>
    <div class="gota-fila"><span class="gota-ic">${ic("desierto")}</span><div><b>${a.riego_seco_mm >= 5 ? agua(L(a.litros_riego_seco)) : "casi nada"}</b><p>en un año seco${a.riego_seco_mm >= 5 ? ` (${num(a.riego_seco_mm)} litros por m²)` : ""}</p></div></div>
    <h3>Agua mes a mes</h3>
    <div class="semaforo grande">${c.meses.map((m, j) => `<span class="sem ${c.estado_mes[j]}">${m.slice(0, 3)}</span>`).join("")}</div>
    <p class="leyenda-mini"><span style="--c:#2e7d32">hay agua</span><span style="--c:#e0a100">justo</span><span style="--c:#c62828">falta agua</span></p>
    <p class="leyenda">${VEREDICTO[c.veredicto]}</p>
    <p class="fuente">${num(L(c.m2))} m² sembrados · NASA POWER 2001–2024 · FAO-56 · riego con 75 % de eficiencia</p>
    <button class="btn-juego grande" data-crecer>${btn("sol", "¡A crecer!")}</button></div>`, "centro");
  $("[data-crecer]").addEventListener("click", empezarTemporada);
  decirVarias([
    `Las plantas toman agua de la tierra con sus raíces y la sueltan por las hojas, como si sudaran. Cada metro cuadrado de tu ${c.cultivo.nombre.toLowerCase()} bebe ${num(a.gasto_mm)} litros en todo su ciclo: en toda tu parcela son ${agua(L(a.litros_cultivo))}.`,
    a.riego_mm >= 5 ? `La lluvia de un año normal no alcanza: hay que regar unos ${agua(L(a.litros_riego))}. Mira los meses en rojo: ahí la tierra se queda sin agua.`
      : `¡En un año normal la lluvia casi alcanza! Pero en un año seco habría que regar ${agua(L(a.litros_riego_seco))}. Por eso conviene guardar agua.`,
    "Cuando avances el tiempo, mira la barra de agua del tanque. Si una planta se pone café y se dobla, tiene sed: toca Regar.",
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
  decir(razones.length ? `Ojo: ${razones[0]}. Ahora avanza el tiempo con los botones de abajo; el botón de play pasa los días solo.`
    : "¡Listo! Avanza el tiempo con los botones de abajo; el de play pasa los días solo. Mira cómo el sol cruza el cielo y cuida tu siembra de la sed, el calor y los aguaceros.");
}

// ---------------------------------------------------------------- 8. crecer: tiempo, riego y estrés climático
function vista(i: number): VistaParcela {
  const p = J.parcelas[i], c = ciclos.get(i);
  const info = p.crop ? cultivos.get(p.crop) : null;
  if (!p.crop || p.cosechada || !c) return { crop: p.cosechada ? null : p.crop, familia: info?.familia || null, emoji: info?.emoji || "",
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
  mundo?.pasarTiempo(dias);
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
    if (v.lista && !a.lista) { decir(`¡La ${nom} está lista para cosechar! Toca el botón de la canasta para recogerla.`); parar = true; return; }
    if (v.marchita && !a.marchita) { decir(`¡Estrés por sequía! Hace días que no llueve y la tierra de la ${nom} se quedó sin agua. Sus hojas se doblan. Toca Regar para darle de beber.`, "preocupada"); parar = true; return; }
    if (v.etapa !== a.etapa && v.etapa === 2) decir(`¡La ${nom} ya está creciendo! Ahora saca hojas nuevas y sus raíces buscan agua más abajo.`);
    if (v.etapa !== a.etapa && v.etapa === 3) decir(`¡La ${nom} está floreciendo! Es cuando más agua toma: si le falta ahora, la cosecha sale pequeña.`);
  });
  if (hoy && !parar) {
    if (hoy.calor && !avisos.has(`c${hoy.fecha.slice(0, 7)}`)) {
      avisos.add(`c${hoy.fecha.slice(0, 7)}`);
      decir(`¡Estrés por calor! Hoy hizo ${num(hoy.tmax)} grados. Con tanto sol la tierra pierde agua más rápido y las plantas se cansan.`, "preocupada");
    } else if (hoy.lluvia >= 10 && J.dia - ultimoAguacero > 7) {
      ultimoAguacero = J.dia;
      decir(`¡Achachay! Un aguacero. Cayeron ${num(hoy.lluvia)} litros en cada metro cuadrado. La tierra cubierta de plantas no se lava; la tierra desnuda se va con el agua.`, "lluvia");
    }
  }
  return parar;
}

let ultimoAguacero = -99;
/** Play: el cultivo más largo termina en 10 segundos como mucho (un paso cada 100 ms). */
function iniciarAuto() {
  if (auto) { detenerAuto(); return; }
  $("#btn-auto").innerHTML = ic("pausa");
  const largo = Math.max(1, ...J.parcelas.map((p, i) => (p.crop && !p.cosechada && ciclos.has(i) ? ciclos.get(i)!.dias.length : 0)));
  const porPaso = Math.max(1, Math.ceil(largo / 100));
  auto = window.setInterval(() => avanzar(porPaso), 100);
}
function detenerAuto() { if (auto) { clearInterval(auto); auto = null; } const b = document.querySelector("#btn-auto"); if (b) b.innerHTML = ic("play"); }

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
  else decir(`Regamos la ${regadas[0]} con ${agua(gastado)} de agua. Ahora la tierra está húmeda y las raíces pueden beber.`);
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
  decir(`${cap(nombreCorto(p.crop))}: ${d.etapa}. La tierra tiene ${h} de cada 100 partes del agua que puede guardar${h < 30 ? ": está muy seca, ¡riégala!" : h < 60 ? ": todavía aguanta." : ": está bien húmeda."}`);
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
    <div class="estrellas">${ic("estrella").repeat(c.estrellas)}${ic("estrellaVacia").repeat(3 - c.estrellas)}</div>
    <p class="grande"><b>${c.puntaje}</b> puntos</p>
    <p>${esc(msg + epoca)}</p>
    <p class="veredicto">En los años de la NASA, para este mes: <b>${VEREDICTO[c.veredicto] || ""}</b></p>
    <p class="fuente">Días con sed: ${c.dias_secos} de ${c.dias.length} · días de calor: ${c.dias.filter((x) => x.calor).length} · año ${c.anio} de NASA POWER</p>
    <button class="btn-juego grande" data-ok>${btn("pulgar", "Seguir")}</button></div>`, "centro");
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
  let rots: any[] = [];
  try {
    const cu = await consultar("cultivo", { crop: ultimo, mes: J.mes });
    rots = cu.rotaciones || [];
    rots.forEach((r: any) => r.pasos.forEach((s: any) => cultivos.set(s.id, { ...cultivos.get(s.id), ...s })));
  } catch { /* sin señal: queda la lección */ }
  const p = abrirPanel("Rotar para cuidar la tierra", `
    <div class="leccion">${ic("foco", "ic-leccion")}<div><b>¿Por qué rotar?</b> Si siembras siempre lo mismo, la tierra se cansa: pierde nitrógeno, se llena de
      plagas y la lluvia se la lleva. Al cambiar de familia y sembrar leguminosas, el suelo se recupera.</div></div>
    <section class="nitro">
      <h3>${ic("nitrogeno", "ic-linea")} El secreto de las leguminosas</h3>
      <ol class="nitro-pasos">
        <li><div class="nitro-dibujo aire"><span>N</span><span>N</span><span>N</span></div><b>1. El aire</b><p>tiene mucho nitrógeno, pero las plantas no lo pueden comer directo.</p></li>
        <li><div class="nitro-dibujo">${icono("fijadores", "icono-nitro")}</div><b>2. Las raíces</b><p>de haba, chocho, fréjol o vicia tienen bolitas (nódulos) con bacterias que lo atrapan.</p></li>
        <li><div class="nitro-dibujo">${icono("papa", "icono-nitro")}</div><b>3. El abono queda</b><p>en la tierra: la papa o el maíz que siembras después crecen más verdes.</p></li>
      </ol>
    </section>
    <div class="medidor"><span>Salud de tu tierra</span><div class="barra"><i style="width:${J.salud}%;background:${colorSuelo(J.salud)}"></i></div><b>${J.salud}</b></div>
    <h3>Pachita te recomienda 3 rotaciones</h3>
    <div class="rotaciones">${rots.slice(0, 3).map((r, k) => `<article class="rotacion">
      <p class="rot-titulo">Opción ${k + 1}${r.leguminosa ? ` · ${ic("nitrogeno", "ic-linea")} con ${esc(r.leguminosa.toLowerCase())}` : ""}</p>
      <div class="rot-pasos">${r.pasos.map((s: any, j: number) => `${j ? '<span class="flecha">→</span>' : ""}<span class="rot-paso">${icono(s.id, "icono-mini")}<b>${esc(s.nombre)}</b><small>desde ${esc(s.desde)}</small></span>`).join("")}</div>
      ${r.repite_familia ? `<p class="malo">${ic("alerta", "ic-linea")} Repite una familia</p>` : `<p class="bueno">${ic("check", "ic-linea")} Cambia de familia en cada paso</p>`}
      <button class="btn-juego" data-rot="${k}">Elegir esta</button></article>`).join("") || "<p>No pude traer las rotaciones. Revisa la señal.</p>"}</div>
    <p class="fuente">Rotaciones calculadas con los datos de tu parcela (NASA POWER, FAO-56) y el calendario del INIAP. La salud de la tierra son puntos del juego.</p>`);
  p.querySelectorAll<HTMLButtonElement>("[data-rot]").forEach((b) => b.addEventListener("click", () => {
    J.rotacion = rots[Number(b.dataset.rot)].pasos.map((s: any) => s.id);
    paso("certificado");
    certificado();
  }));
  decirVarias([
    "Las plantas necesitan nitrógeno para crecer verdes y fuertes, como nosotros necesitamos comida. Si siembras papa tras papa, la tierra se queda sin nitrógeno y se llena de plagas.",
    "El aire está lleno de nitrógeno, pero las plantas no lo pueden comer. Las leguminosas, como el haba, el chocho y el fréjol, tienen en sus raíces bolitas con bacterias amigas que lo atrapan.",
    "Cuando cosechas, esas raíces se quedan en la tierra como abono natural. Por eso, después de una leguminosa, la papa o el maíz crecen mejor. ¡Eso es rotar! Elige una de estas tres rotaciones.",
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
    ${J.medallas.map((m, k, todas) => icG(MEDALLAS[m]?.icono || "medalla", 400 - todas.length * 20 + k * 40, 360, 34)).join("")}
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
    <div class="fila-botones"><button class="btn-juego" data-bajar>${btn("descargar", "Descargar")}</button>
      <button class="btn-juego borde" data-seguir>${btn("semilla", "Sembrar la rotación")}</button>
      <button class="btn-juego borde" data-nueva>${btn("cohete", "Nueva granja")}</button></div>`, "certificado-panel");
  lanzarConfeti();
  decir(`¡Felicitaciones, granja ${J.granja}! Aprendiste a leer los datos de la NASA, a regar cuando la tierra tiene sed y a rotar con leguminosas. Ganaste el certificado de Granjero Cósmico. ¡La tierra te lo agradece!`);
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
  t.innerHTML = `<span>${ic(m.icono, "ic-medalla")}</span><div><b>${m.nombre}</b><p>${m.texto}</p></div>`;
  t.hidden = false;
  t.classList.remove("aparece"); void t.offsetWidth; t.classList.add("aparece");
  setTimeout(() => (t.hidden = true), 3500);
}

function abrirLogros() {
  abrirPanel("Mis medallas", `<div class="medallas">${Object.entries(MEDALLAS).map(([id, m]) =>
    `<div class="medalla-carta ${J.medallas.includes(id) ? "ganada" : ""}"><span>${ic(m.icono, "ic-medalla")}</span><b>${m.nombre}</b><p>${m.texto}</p></div>`).join("")}</div>
    <p class="ayuda">Granja ${esc(J.granja)} · cosechas: ${J.cosechas} · temporada ${J.temporada}</p>
    ${J.paso === "certificado" ? `<button class="btn-juego" data-cert>${btn("medalla", "Ver mi certificado")}</button>` : ""}
    <button class="btn-juego borde" data-reiniciar>${btn("cohete", "Empezar otra granja")}</button>`);
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
  $("#hud-tanque-txt").textContent = J.tanqueMax ? litrosCortos(J.tanque) : "—";
  $("#hud-tanque-txt").title = J.tanqueMax ? agua(J.tanque) : "";
  $("#hud-salud").style.width = `${J.salud}%`;
  $("#hud-salud").style.background = colorSuelo(J.salud);
  $("#hud-salud-txt").textContent = String(J.salud);
  const c = cicloPrincipal();
  const sem = $("#semaforo");
  if (c && J.sembrado) {
    const d = c.dias[Math.min(J.dia, c.dias.length - 1)];
    const mesHoy = MESES_CORTOS[Number(d.fecha.slice(5, 7)) - 1];
    sem.innerHTML = c.meses.map((m, k) => `<span class="sem ${c.estado_mes[k]} ${m.slice(0, 3) === mesHoy ? "hoy" : ""}" title="${m}">${m.slice(0, 3)}</span>`).join("")
      + `<span class="sem-temp" title="Temperatura máxima de hoy">${ic("termometro", "ic-mini")} ${num(d.tmax)} °C</span>`;
    sem.innerHTML = `<span class="sem-titulo">Agua por mes</span>` + sem.innerHTML;
    sem.hidden = false;
  } else sem.hidden = true;
}

function pintarControles() {
  const ctl = $("#tiempo");
  const plantadas = J.parcelas.some((p) => p.crop);
  if (!J.sembrado) {
    if (J.paso === "sembrar" || J.paso === "agua") {
      ctl.innerHTML = `<button class="t ancho" data-todas>${btn("semilla", "Sembrar todo")}</button>
        ${plantadas ? `<button class="btn-juego" data-agua>${btn("gota", "¿Cuánta agua?")}</button>` : ""}`;
      ctl.querySelector("[data-todas]")!.addEventListener("click", sembrarTodas);
      ctl.querySelector("[data-agua]")?.addEventListener("click", panelAgua);
    } else ctl.innerHTML = "";
  } else if (todoCosechado()) {
    ctl.innerHTML = `<button class="btn-juego grande" data-rotar>${btn("rotar", "Rotar la tierra")}</button>`;
    ctl.querySelector("[data-rotar]")!.addEventListener("click", () => { paso("rotacion"); leccionRotacion(); });
  } else if (listas().length && J.dia >= diaFinal()) {
    ctl.innerHTML = `<button class="btn-juego grande" data-cosechar>${btn("cesta", "¡A cosechar!")}</button>`;
    ctl.querySelector("[data-cosechar]")!.addEventListener("click", () => cosechar(listas()[0]));
  } else {
    ctl.innerHTML = `${listas().length ? `<button class="t cosechar" data-cosechar aria-label="Cosechar">${ic("cesta")}</button>` : ""}
      <button class="t" data-d="1" aria-label="Avanzar un día">+1 día</button>
      <button class="t" data-d="7" aria-label="Avanzar una semana">+1 sem</button>
      <button class="t" data-d="30" aria-label="Avanzar un mes">+1 mes</button>
      <button class="t redondo" id="btn-auto" aria-label="Avance automático">${ic(auto ? "pausa" : "play")}</button>`;
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
    $("#silencio").innerHTML = ic(estaSilenciado() ? "mudo" : "sonido");
  });
  $("#btn-tierra").addEventListener("click", fichaTierra);
  $("#btn-semillas").addEventListener("click", abrirFamilias);
  $("#btn-calendario").addEventListener("click", abrirCalendario);
  $("#btn-regar").addEventListener("click", regar);
  $("#btn-logros").addEventListener("click", abrirLogros);
  const ro = new ResizeObserver(medirLayout);
  ["#globo", "#pachita", "#hud"].forEach((sel) => ro.observe($(sel)));
  window.addEventListener("resize", medirLayout);
  new MutationObserver(medirLayout).observe($("#escena"), { attributes: true, attributeFilter: ["hidden"] });
  new MutationObserver(medirLayout).observe($("#panel"), { attributes: true, attributeFilter: ["hidden", "class"] });
  medirLayout();
  menuPrincipal();
}

// ---------------------------------------------------------------- dibujos de la historia (SVG propios)
const COHETE = `<svg viewBox="0 0 160 260" class="cohete-svg" aria-hidden="true">
  <defs>
    <linearGradient id="cuerpoC" x1="0" x2="1"><stop offset="0" stop-color="#c9ccd6"/><stop offset=".35" stop-color="#ffffff"/><stop offset=".7" stop-color="#e9ebf1"/><stop offset="1" stop-color="#a9adbb"/></linearGradient>
    <linearGradient id="narizC" x1="0" x2="1"><stop offset="0" stop-color="#a8261b"/><stop offset=".4" stop-color="#ef5a43"/><stop offset="1" stop-color="#9c2218"/></linearGradient>
    <linearGradient id="aletaC" x1="0" x2="1"><stop offset="0" stop-color="#1d4f8f"/><stop offset=".5" stop-color="#3b82d0"/><stop offset="1" stop-color="#173f73"/></linearGradient>
    <radialGradient id="vidrioC" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#e8f7ff"/><stop offset=".5" stop-color="#7cc4ec"/><stop offset="1" stop-color="#2a6f9e"/></radialGradient>
    <linearGradient id="toberaC" x1="0" x2="1"><stop offset="0" stop-color="#4b525f"/><stop offset=".5" stop-color="#9aa3b2"/><stop offset="1" stop-color="#3d434e"/></linearGradient>
    <radialGradient id="fuegoC" cx=".5" cy=".1" r=".9"><stop offset="0" stop-color="#fffbe0"/><stop offset=".3" stop-color="#ffe066"/><stop offset=".65" stop-color="#ff9a1f"/><stop offset="1" stop-color="#e2401c" stop-opacity="0"/></radialGradient>
  </defs>
  <g class="fuego"><path class="llama l1" d="M58 186 Q80 262 102 186 Q80 204 58 186Z" fill="url(#fuegoC)"/>
    <path class="llama l2" d="M66 186 Q80 236 94 186 Q80 196 66 186Z" fill="#fff6b8"/></g>
  <g class="patas-g"><path d="M52 150 L34 196 L46 196 L60 160Z M108 150 L126 196 L114 196 L100 160Z" fill="#6c7380" stroke="#2c241c" stroke-width="3" stroke-linejoin="round"/>
    <rect x="28" y="194" width="22" height="6" rx="3" fill="#3d434e"/><rect x="110" y="194" width="22" height="6" rx="3" fill="#3d434e"/></g>
  <path d="M46 120 L18 170 Q16 178 24 176 L50 164Z" fill="url(#aletaC)" stroke="#2c241c" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M114 120 L142 170 Q144 178 136 176 L110 164Z" fill="url(#aletaC)" stroke="#2c241c" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M80 8 C112 36 120 92 114 168 L46 168 C40 92 48 36 80 8Z" fill="url(#cuerpoC)" stroke="#2c241c" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M80 8 C96 22 106 40 111 60 L49 60 C54 40 64 22 80 8Z" fill="url(#narizC)" stroke="#2c241c" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M70 22 Q76 16 82 14" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".6"/>
  <rect x="47" y="132" width="66" height="13" fill="#c8372d"/>
  <path d="M47 132 h66 v13 h-66z" fill="none" stroke="#2c241c" stroke-width="2"/>
  <g fill="#ffc93c">${[0, 1, 2, 3, 4].map((k) => `<path d="M${52 + k * 13} 138.5 l5 -4 l5 4 l-5 4z"/>`).join("")}</g>
  <circle cx="80" cy="96" r="22" fill="#d7dbe4" stroke="#2c241c" stroke-width="3.5"/>
  <circle cx="80" cy="96" r="15.5" fill="url(#vidrioC)" stroke="#2c241c" stroke-width="2.5"/>
  <path d="M71 90 Q75 84 82 83" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".85"/>
  ${[0, 60, 120, 180, 240, 300].map((a) => `<circle cx="${(80 + 19 * Math.cos((a * Math.PI) / 180)).toFixed(1)}" cy="${(96 + 19 * Math.sin((a * Math.PI) / 180)).toFixed(1)}" r="1.6" fill="#6c7380"/>`).join("")}
  <path class="puerta" d="M66 150 h28 v16 h-28z" fill="#9aa3b2" stroke="#2c241c" stroke-width="2.5"/>
  <text x="80" y="126" text-anchor="middle" font-size="11" font-weight="900" fill="#1d4f8f" font-family="Fredoka, sans-serif" letter-spacing="1">PACHA</text>
  <path d="M54 168 h52 l-6 18 h-40z" fill="url(#toberaC)" stroke="#2c241c" stroke-width="3.5" stroke-linejoin="round"/>
</svg>`;
const PAISAJE = `<svg viewBox="0 0 800 600" preserveAspectRatio="xMidYMax slice" aria-hidden="true" class="paisaje-svg">
  <defs>
    <linearGradient id="cieloM" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffcf8a"/><stop offset=".45" stop-color="#ffe6b5"/><stop offset="1" stop-color="#fff4dc"/></linearGradient>
    <radialGradient id="solM" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff8d6"/><stop offset=".6" stop-color="#ffd25a"/><stop offset="1" stop-color="#ffb03a" stop-opacity="0"/></radialGradient>
    <linearGradient id="volcanM" x1="0" x2="1"><stop offset="0" stop-color="#7f8ea3"/><stop offset=".55" stop-color="#9eacbf"/><stop offset="1" stop-color="#6f7d92"/></linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#cieloM)"/>
  <g class="sol-menu"><circle cx="490" cy="150" r="110" fill="url(#solM)"/><circle cx="490" cy="150" r="44" fill="#ffd84d"/></g>
  <g class="nube-m n1" fill="#fff"><ellipse cx="140" cy="120" rx="60" ry="22"/><ellipse cx="180" cy="104" rx="40" ry="26"/><ellipse cx="110" cy="108" rx="30" ry="18"/></g>
  <g class="nube-m n2" fill="#fff" opacity=".9"><ellipse cx="470" cy="80" rx="50" ry="18"/><ellipse cx="500" cy="68" rx="32" ry="20"/></g>
  <path d="M190 400 L336 186 Q352 166 368 186 L520 400Z" fill="url(#volcanM)"/>
  <path d="M312 222 L336 186 Q352 166 368 186 L392 222 Q380 230 370 224 Q360 236 348 226 Q336 234 326 226 Q318 230 312 222Z" fill="#fbfdff"/>
  <path d="M520 410 L650 250 Q662 238 676 250 L800 380 L800 420Z" fill="#8597ad"/>
  <path d="M630 274 L650 250 Q662 238 676 250 L696 274 Q684 282 672 276 Q660 286 648 278 Q640 284 630 274Z" fill="#fbfdff"/>
  <path d="M0 420 Q140 360 300 392 T600 380 T800 372 L800 600 L0 600Z" fill="#7fb24f"/>
  <path d="M0 440 Q120 410 240 424 L232 456 Q120 446 0 474Z" fill="#a8cf62"/><path d="M240 424 Q400 404 560 418 L552 448 Q400 440 232 456Z" fill="#e2c35c"/>
  <path d="M560 418 Q690 404 800 410 L800 442 Q690 438 552 448Z" fill="#8bc34a"/>
  <path d="M0 474 Q120 446 232 456 L222 492 Q120 488 0 512Z" fill="#5f9a3e"/><path d="M232 456 Q400 440 552 448 L542 484 Q400 478 222 492Z" fill="#b5d36b"/>
  <path d="M552 448 Q690 438 800 442 L800 478 Q690 476 542 484Z" fill="#d4a373"/>
  <g transform="translate(600 392)"><rect x="0" y="0" width="58" height="34" rx="5" fill="#f1d9b5" stroke="#6e3f17" stroke-width="3"/>
    <path d="M-8 2 L29 -24 L66 2Z" fill="#c0533a" stroke="#6e3f17" stroke-width="3" stroke-linejoin="round"/><rect x="22" y="12" width="13" height="22" rx="2" fill="#8a5a33"/></g>
  <path d="M0 512 Q240 480 420 500 T800 492 L800 600 L0 600Z" fill="#8a5a33"/>
  <path d="M0 540 Q260 512 460 530 T800 524 L800 600 L0 600Z" fill="#6e4426"/>
</svg>`;
