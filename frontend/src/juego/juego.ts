// Astro Granja: la historia de Pachita. Todo número viene de la API de Pacha; aquí solo se cuenta, se dibuja y se anima.
// Historia: nombre de la granja → Pachita llega en cohete → elegir la parcela → ficha técnica de la tierra →
// semillas por familia → calendario → sembrar → agua que necesita → crecer (riego y estrés) → cosecha →
// rotación (3 combinaciones) → certificado de Granjero Cósmico.
import { consultar, esc, MESES_CORTOS, num } from "../lib/api";
import { guardar, leer, tieneParcela } from "../lib/estado";
import { cargar, colorSuelo, guardarJuego, MEDALLAS, N_PARCELAS, nuevo, type Juego, type Paso } from "./estado";
import { icono } from "./iconos";
import { areaTexto, crearMapa, RADIO_DEMO } from "./mapa";
import { fijarIdioma, idioma, t } from "./i18n";
import { epocaTexto, mesCorto, mesDeApi, nombreDe, nombreMes, razonAltura, usoDe } from "./textos";
import * as sonido from "./sonido";
import { crearMundo2D } from "./mundo2d";
import { ETAPAS, type Mundo, type Terreno, type VistaParcela } from "./mundo";
import { callar, decir, decirVarias, precargar, turnoActual, desbloquearAudio, estaSilenciado, PACHITA_SVG, silenciar, urlPose, type Animo } from "./pachita";
import { ic, icG } from "./ui";
import { urlIcono } from "./iconos";

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
  fija_n: false, ciclo_dias: 120, se_puede: true, apto: true, en_epoca: true, meses: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], epoca_texto: "todo el año" };
const veredicto = (v: string) => ({ si: t("La lluvia suele alcanzar", "Rain is usually enough"), cuidado: t("Hay que regar a veces", "You need to water sometimes"),
  no: t("Necesita riego", "It needs irrigation") } as Record<string, string>)[v] || "";

// Familias botánicas: por qué importan para rotar
const FAMILIAS: { id: string[]; es: string; en: string; icono: string; color: string; pq: [string, string]; tambien?: string[] }[] = [
  { id: ["fabacea"], es: "Leguminosas (Fabáceas)", en: "Legumes (Fabaceae)", icono: "fijadores", color: "#2e7d32",
    pq: ["Atrapan nitrógeno del aire con sus raíces y alimentan la tierra. ¡Son las mejores amigas del suelo!", "Their roots trap nitrogen from the air and feed the soil. They are the soil's best friends!"],
    tambien: ["vicia", "trebol", "alfalfa"] },
  { id: ["solanacea"], es: "Solanáceas", en: "Nightshades (Solanaceae)", icono: "papa", color: "#8d6e63",
    pq: ["Comen mucho del suelo. Si se siembran seguidas, se llenan de plagas como el gusano blanco.", "They take a lot from the soil. If planted back to back, they fill up with pests like the white grub."] },
  { id: ["poacea"], es: "Gramíneas (Poáceas)", en: "Grasses (Poaceae)", icono: "trigo", color: "#c99a2e",
    pq: ["Sus raíces finas sujetan el suelo y dejan paja que lo protege de la lluvia.", "Their fine roots hold the soil and leave straw that protects it from the rain."] },
  { id: ["amarantacea"], es: "Amarantáceas", en: "Amaranths (Amaranthaceae)", icono: "quinua", color: "#c2185b",
    pq: ["La quinua es un grano andino muy nutritivo que aguanta la sequía.", "Quinoa is a very nutritious Andean grain that withstands drought."] },
  { id: ["basellacea", "oxalidacea"], es: "Tubérculos andinos", en: "Andean tubers", icono: "oca", color: "#d84315",
    pq: ["Melloco y oca son de familias distintas a la papa: sirven para rotar sin repetir plagas.", "Ulluco and oca are from different families than potato: they help rotate without repeating pests."] },
  { id: ["pasto", "ninguna"], es: "Pastos y cobertura", en: "Pastures and cover", icono: "pasto", color: "#558b2f",
    pq: ["Cubren el suelo para que la lluvia no lo lave y le devuelven materia orgánica.", "They cover the soil so rain doesn't wash it away and give organic matter back to it."], tambien: ["biomasa"] },
];
const familiaDe = (f: string) => FAMILIAS.find((x) => x.id.includes(f));
const famNombre = (f: { es: string; en: string }) => t(f.es, f.en);
const NOMBRE_EXTRA: Record<string, string> = { vicia: "Vicia", trebol: "Trébol", alfalfa: "Alfalfa", biomasa: "Biomasa" };

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
let J: Juego = cargar();
let mundo: Mundo | null = null;
let terreno: (Terreno & { pendiente_pct?: number; pendiente_clase?: string }) | null = null;
let parcelaInfo: any = null;
let semillasInfo: { meses_zona: number[]; siembra_por_mes: number[]; cultivos: Cultivo[]; lugar?: { elev: number } } | null = null;
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
const fecha = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return t(`${d} de ${nombreMes(m - 1)} · año ${y}`, `${nombreMes(m - 1)} ${d} · year ${y}`); };
/** Agua siempre en litros (redondeada para que se lea fácil). */
function agua(litros: number) {
  const l = Math.max(1, litros);
  const r = l < 100 ? Math.round(l) : l < 10000 ? Math.round(l / 10) * 10 : Math.round(l / 100) * 100;
  return t(`${num(r)} litros`, `${num(r)} liters`);
}
const nombreCorto = (id: string) => nombreCultivo(id).toLowerCase();
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Litros en pocas letras para la barra de arriba: 850 L · 12,5 mil L · 2,9 mill. L */
const litrosCortos = (l: number) => (l < 1000 ? `${num(Math.round(l))} L` : l < 1e6 ? t(`${num(l / 1000, 1)} mil L`, `${num(l / 1000, 1)}k L`) : t(`${num(l / 1e6, 1)} mill. L`, `${num(l / 1e6, 1)}M L`));
const btn = (icono: string, texto: string) => `${ic(icono, "ic-btn")}<span>${texto}</span>`;

// ---------------------------------------------------------------- pantalla de carga
const CONSEJOS: [string, string][] = [
  ["Un milímetro de lluvia es un litro de agua en cada metro cuadrado.", "One millimeter of rain is one liter of water on each square meter."],
  ["Las leguminosas atrapan nitrógeno del aire y abonan la tierra.", "Legumes trap nitrogen from the air and fertilize the soil."],
  ["Rotar los cultivos corta las plagas y deja descansar el suelo.", "Rotating crops breaks pest cycles and lets the soil rest."],
  ["Los satélites de la NASA miden la lluvia y el sol todos los días.", "NASA satellites measure rain and sunshine every day."],
  ["La papa nació en los Andes: hay miles de variedades.", "The potato was born in the Andes: there are thousands of varieties."],
  ["Una tierra cubierta de plantas no se lava con los aguaceros.", "Soil covered with plants isn't washed away by downpours."],
];
let cargaCuenta = 0, cargaConsejo: number | undefined;
function abrirCarga(mensaje: string) {
  const el = $("#carga");
  let k = Math.floor(Math.random() * CONSEJOS.length);
  const pintarConsejo = () => { const c = CONSEJOS[k++ % CONSEJOS.length]; el.querySelector<HTMLElement>(".carga-consejo")!.textContent = t(c[0], c[1]); };
  el.innerHTML = `<div class="carga-caja"><div class="carga-planta" aria-hidden="true">${ic("brote")}<i></i></div>
    <p class="carga-msg" role="status">${esc(mensaje)}</p><div class="carga-barra" aria-hidden="true"><i></i></div>
    <p class="carga-sabias">${t("¿Sabías que…?", "Did you know…?")}</p><p class="carga-consejo"></p></div>`;
  pintarConsejo();
  el.hidden = false;
  clearInterval(cargaConsejo);
  cargaConsejo = window.setInterval(pintarConsejo, 4200);
}
/** Si el trabajo tarda más de un instante, muestra una pantalla de carga con consejos; si es rápido, no se ve. */
async function conCarga<T>(mensaje: string, trabajo: () => Promise<T>): Promise<T> {
  const id = window.setTimeout(() => { cargaCuenta++; abrirCarga(mensaje); }, 350);
  try { return await trabajo(); }
  finally {
    clearTimeout(id);
    if (cargaCuenta > 0 && !--cargaCuenta) { $("#carga").hidden = true; clearInterval(cargaConsejo); }
  }
}

// ---------------------------------------------------------------- paneles
function abrirPanel(titulo: string, html: string, clase = "") {
  const p = $("#panel");
  p.className = `panel ${clase}`;
  p.innerHTML = `<div class="panel-cabeza"><h2>${esc(titulo)}</h2><button class="cerrar" type="button" aria-label="${t("Cerrar", "Close")}">✕</button></div>
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
  const topeGlobo = globo.hidden ? alto : caja.bottom - parseFloat(getComputedStyle(globo).marginBottom || "0") - globo.offsetHeight - 24;   // 24: la cinta con el nombre sobresale del globo
  const topePachita = caja.bottom - pachita.offsetHeight + 24;
  // el panel solo se achica si Pachita o su globo quedan debajo de él; si están a un lado, usa todo el alto
  const pr = panel.hidden ? null : panel.getBoundingClientRect();
  const choca = (izq: number, der: number) => !!pr && der > pr.left && izq < pr.right;
  let techo = alto;
  // en pantallas anchas el panel se angosta para no pisar a Pachita y su globo: así usa todo el alto y no se encoge cuando el globo crece
  const libre = caja.left - 16 - 104;
  const ancho = window.innerWidth >= 900 && libre >= 420;
  document.body.style.setProperty("--panel-w", ancho ? `${Math.round(Math.min(760, libre))}px` : "");
  if (!ancho) {
    if (!globo.hidden && choca(caja.left, caja.right)) techo = Math.min(techo, topeGlobo);
    if (choca(caja.right - pachita.offsetWidth, caja.right)) techo = Math.min(techo, topePachita);
  }
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

/** Qué pantalla se ve (para volver a dibujarla al cambiar de idioma). */
let pantalla: "menu" | "nombre" | "aterrizaje" | "mapa" | "mundo" = "menu";
const botonIdioma = (clase = "btn-redondo") => `<button type="button" class="${clase} btn-idioma" data-idioma aria-label="${t("Cambiar a inglés", "Switch to Spanish")}"><b>${idioma() === "es" ? "EN" : "ES"}</b></button>`;
const alternarIdioma = (host: ParentNode) => host.querySelector("[data-idioma]")?.addEventListener("click", cambiarIdioma);

/** Pantalla de inicio como la de un juego: logo, Pachita y botones grandes sobre el paisaje andino. */
function menuPrincipal() {
  pantalla = "menu";
  const c = $("#intro");
  const hay = !!J.granja;
  fondoMenu(c, `
    <h1 class="logo" aria-label="Astro Granja"><span class="logo-1">Astro</span><span class="logo-2">Granja</span>
      <small>${t("con Pachita y datos de la NASA", "with Pachita and NASA data")}</small></h1>
    <div class="menu-tablero">
      ${hay ? `<button class="btn-juego grande" data-seguir>${btn("play", t("Seguir jugando", "Keep playing"))}</button>
               <p class="menu-granja">${t("Granja", "Farm")} <b>${esc(J.granja)}</b> · ${t("temporada", "season")} ${J.temporada}</p>` : ""}
      <button class="btn-juego grande ${hay ? "borde" : ""}" data-nueva>${btn("cohete", hay ? t("Nueva granja", "New farm") : t("¡Jugar!", "Play!"))}</button>
      <div class="menu-fila">
        <button class="btn-redondo" data-sonido aria-label="${t("Sonido", "Sound")}">${ic(estaSilenciado() ? "mudo" : "sonido")}</button>
        <button class="btn-redondo" data-medallas aria-label="${t("Medallas", "Medals")}">${ic("medalla")}</button>
        ${botonIdioma()}
      </div>
    </div>
    <p class="menu-creditos">NASA Space Apps 2026 · ${t("Datos", "Data")}: NASA POWER, FAO-56, INIAP · ${t("Relieve", "Relief")}: Open-Meteo<br>${t("Ilustraciones de Pachita y cultivos con asistencia de IA (marcadas «IA»)", "Illustrations of Pachita and crops made with AI assistance (marked “IA”)")}</p>`);
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
  alternarIdioma(c);
  decir(hay ? t(`¡Hola otra vez! Soy Pachita. ¿Seguimos cuidando la granja ${J.granja}?`, `Hello again! I'm Pachita. Shall we keep taking care of farm ${J.granja}?`)
    : t("¡Hola! Soy Pachita, granjera de la sierra. Toca Jugar y te enseño a sembrar con datos de los satélites de la NASA.",
      "Hi! I'm Pachita, a farmer from the Andes. Tap Play and I'll teach you to plant using data from NASA satellites."));
}
function salirMenu() { $("#intro").hidden = true; document.body.classList.remove("en-menu"); }

function pantallaNombre() {
  pantalla = "nombre";
  const c = $("#intro");
  fondoMenu(c, `<div class="idioma-flota">${botonIdioma()}</div><form class="tarjeta-nombre" autocomplete="off">
      <label for="nombre-granja">${t("¿Cómo se llama tu granja?", "What is your farm called?")}</label>
      <input id="nombre-granja" maxlength="28" placeholder="${t("Ej.: La Chacra Feliz", "E.g.: Happy Farm")}" value="${esc(J.granja)}" required>
      <button class="btn-juego grande" type="submit">${btn("cohete", t("¡Que llegue Pachita!", "Let Pachita land!"))}</button>
    </form>`);
  alternarIdioma(c);
  decir(t("Primero, ponle un nombre a tu granja. Puede ser el de tu familia o uno inventado. ¡Pachita viene en camino en su cohete!",
    "First, give your farm a name. It can be your family's or a made-up one. Pachita is on her way in her rocket!"));
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
  pantalla = "aterrizaje";
  const c = $("#intro");
  const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
  sonido.preparar();  // se llama dentro del toque del jugador: así el celular deja sonar
  fondoMenu(c, `<div class="escena-aterrizaje"><div class="sombra-cohete"></div>
      <div class="cohete-baja">${COHETE}</div><div class="humo-caja"></div></div>`);
  document.body.classList.add("llegando");
  const escena = c.querySelector<HTMLElement>(".escena-aterrizaje")!;
  const cohete = c.querySelector<HTMLElement>(".cohete-baja")!, humo = c.querySelector<HTMLElement>(".humo-caja")!;
  const sombra = c.querySelector<HTMLElement>(".sombra-cohete")!;
  // el cohete aterriza sobre la tierra del paisaje: se busca ese punto del dibujo en la pantalla (sirve en cualquier tamaño)
  const dibujo = c.querySelector<SVGSVGElement>(".paisaje-svg")!;
  const m = dibujo.getScreenCTM();
  const suelo = m ? new DOMPoint(SUELO_X, SUELO_Y).matrixTransform(m) : new DOMPoint(innerWidth * 0.55, innerHeight * 0.72);
  escena.style.setProperty("--suelo-x", `${suelo.x}px`);
  escena.style.setProperty("--suelo-y", `${suelo.y}px`);
  const bajar = quieto ? 2200 : 2600;
  {
    cohete.classList.add("encendido");
    sonido.cohete(bajar / 1000);
    const chispas = window.setInterval(() => soltarHumo(humo, quieto ? 1 : 2, 0.5, true, suelo), quieto ? 160 : 90);
    const estela = window.setInterval(() => soltarHumo(humo, 1, 0.5, false, undefined, true), quieto ? 220 : 65);   // la estela de humo que deja al bajar
    // baja frenando y balanceándose un poco, como un cohete que corrige su rumbo con los propulsores
    cohete.animate([
      { transform: "translate(-50%, -115vh) rotate(-7deg)" },
      { transform: "translate(-50%, -72vh) rotate(4deg)", offset: 0.22 },
      { transform: "translate(-50%, -42vh) rotate(-3deg)", offset: 0.45 },
      { transform: "translate(-50%, -20vh) rotate(2deg)", offset: 0.66 },
      { transform: "translate(-50%, -6vh) rotate(-1deg)", offset: 0.85 },
      { transform: "translate(-50%, 0) rotate(0deg)" },
    ], { duration: bajar, easing: "cubic-bezier(.22,.7,.3,1)", fill: "forwards" });
    sombra.animate([{ transform: "translateX(-50%) scale(.2)", opacity: 0 }, { transform: "translateX(-50%) scale(1)", opacity: 0.45 }],
      { duration: bajar, easing: "ease-in", fill: "forwards" });
    await espera(bajar - 450);
    cohete.classList.add("frenando");
    await espera(450);
    clearInterval(chispas);
    clearInterval(estela);
    sonido.aterrizaje();
    // al tocar tierra: onda de polvo en el suelo, el cohete rebota sobre sus patas y se aplasta un instante
    const onda = document.createElement("i");
    onda.className = "onda-polvo";
    onda.style.left = `${suelo.x}px`;
    onda.style.top = `${suelo.y - 4}px`;
    escena.appendChild(onda);
    setTimeout(() => onda.remove(), 1400);
    if (!quieto) {
      cohete.animate([{ transform: "translate(-50%, 0)" }, { transform: "translate(-50%, -12px)", offset: 0.3 }, { transform: "translate(-50%, 0)", offset: 0.55 },
        { transform: "translate(-50%, -3px)", offset: 0.75 }, { transform: "translate(-50%, 0)" }], { duration: 650, easing: "ease-out" });
      cohete.querySelector<SVGElement>(".cohete-svg")!.animate([{ transform: "scale(1.05, .93)" }, { transform: "scale(.98, 1.03)", offset: 0.5 }, { transform: "scale(1)" }],
        { duration: 450, easing: "ease-out", transformOrigin: "50% 77%" } as KeyframeAnimationOptions);
    }
    soltarHumo(humo, quieto ? 12 : 26, quieto ? 1 : 1.4, false, suelo);
    cohete.classList.remove("encendido", "frenando");
    cohete.classList.add("patas");
    if (!quieto) escena.animate(
      [{ transform: "translate(0,0)" }, { transform: "translate(-6px,4px)" }, { transform: "translate(5px,-3px)" }, { transform: "translate(-3px,2px)" }, { transform: "translate(0,0)" }],
      { duration: 420, easing: "ease-out" });
    await espera(700);
  }
  document.body.classList.remove("llegando");
  document.body.classList.add("bajo-cohete");
  cohete.classList.add("puerta-abierta");
  await decir(t(`¡Llegué! Bienvenida, bienvenido a la granja ${J.granja}. Juntos vamos a aprender a cuidar la tierra con los datos que miden los satélites de la NASA.`,
    `I've landed! Welcome to farm ${J.granja}. Together we'll learn to take care of the land with the data that NASA satellites measure.`));
  document.body.classList.remove("bajo-cohete");
  salirMenu();
  pantallaMapa();
}

/** Bocanadas de humo (o chispas de fuego) que salen de la tobera y se abren hacia los lados. */
function soltarHumo(caja: HTMLElement, cuantas: number, fuerza: number, fuego: boolean, suelo?: DOMPoint, estela = false) {
  const r = caja.getBoundingClientRect();
  const tob = caja.parentElement!.querySelector(".cohete-baja")!.getBoundingClientRect();
  for (let k = 0; k < cuantas; k++) {
    const b = document.createElement("i");
    b.className = fuego ? "chispa" : "bocanada";
    // el fuego sale de la tobera; el polvo del aterrizaje, del suelo donde se apoyan las patas
    const x0 = (!fuego && suelo ? suelo.x : tob.left + tob.width / 2) - r.left;
    const y0 = (!fuego && suelo ? suelo.y - 6 : tob.bottom - (fuego ? 6 : 10)) - r.top;
    b.style.left = `${x0}px`;
    b.style.top = `${y0}px`;
    caja.appendChild(b);
    const lado = (Math.random() - 0.5) * 2;
    const dx = fuego ? lado * 30 : estela ? lado * 22 : lado * 190 * fuerza, dy = fuego ? 40 + Math.random() * 50 : estela ? -16 - Math.random() * 26 : -10 - Math.random() * 70 * fuerza;
    const tam = fuego ? 0.6 + Math.random() * 0.6 : estela ? 0.5 + Math.random() * 0.5 : 0.8 + Math.random() * 1.6 * fuerza;
    const dur = fuego ? 420 : estela ? 1500 + Math.random() * 700 : 1400 + Math.random() * 900;
    b.animate([
      { transform: "translate(-50%,-50%) scale(.3)", opacity: fuego ? 1 : estela ? 0.55 : 0.95 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${tam * (fuego ? 0.4 : 2.4)})`, opacity: 0 },
    ], { duration: dur, easing: "cubic-bezier(.15,.8,.3,1)", fill: "forwards" }).onfinish = () => b.remove();
  }
}

// ---------------------------------------------------------------- 1. mapa
let mapaCtl: ReturnType<typeof crearMapa> | null = null;
function pantallaMapa(ini?: { lat: number; lon: number; radio: number }) {
  pantalla = "mapa";
  $("#escena").hidden = true;
  document.body.classList.add("en-mapa");
  const cont = $("#mapa");
  cont.hidden = false;
  const e = lugar();
  const m = crearMapa(cont, ini ?? { lat: e.lat ?? -1.6466, lon: e.lon ?? -78.7437, radio: Math.round(radioActual()) }, (l) => {
    guardar({ lat: l.lat, lon: l.lon, area_m2: Math.PI * l.radio * l.radio, nombre: l.nombre, provincia: undefined });
    m.destruir();
    mapaCtl = null;
    cont.hidden = true;
    document.body.classList.remove("en-mapa");
    paso("tierra");
    entrarMundo();
  });
  mapaCtl = m;
  cont.querySelector(".mapa-caja")!.insertAdjacentHTML("beforeend", botonIdioma("mapa-idioma"));
  alternarIdioma(cont);
  decirVarias([
    t("Ahora busca tu chacra en el mapa. Te ubico donde estás: mueve el mapa con el dedo hasta que el pin rojo quede sobre tu tierra; los nombres de los pueblos te ayudan.",
      "Now find your farm on the map. I'll start where you are: drag the map until the red pin is over your land; the town names will help you."),
    t("Con la barra agrandas o achicas el círculo amarillo hasta que cubra tu tierra: llega a 10 hectáreas, y si tu chacra es más grande escribe el tamaño arriba.",
      "Use the bar to make the yellow circle bigger or smaller until it covers your land: it goes up to 10 hectares, and if your farm is bigger, type the size above."),
  ]);
}

// ---------------------------------------------------------------- 2. mundo 3D
async function entrarMundo() {
  pantalla = "mundo";
  $("#escena").hidden = false;
  $("#hud").hidden = false;
  const cont = $("#mundo");
  cont.innerHTML = "";
  let ok = false;
  await conCarga(t(`Dibujando la granja ${J.granja}…`, `Drawing farm ${J.granja}…`), async () => {
    // todo lo que se va a necesitar se pide a la vez: el relieve, el clima de la ficha, las semillas y el motor 3D
    const mes = J.mes ?? (new Date().getMonth() + 1) % 12 + 1;
    parcelaInfo = null; semillasInfo = null;   // se pide de nuevo: puede ser otro lugar
    const pTerreno = consultar("terreno", { n: 17 });
    const pParcela = consultar("parcela").then((x) => { parcelaInfo = x; return x; }).catch(() => null);
    const pSemillas = cargarSemillas(mes).catch(() => null);
    const pMotor = new URLSearchParams(location.search).has("sin3d") ? Promise.reject(new Error("modo 2D pedido")) : import("./mundo3d");
    pMotor.catch(() => null);
    try {
      terreno = await pTerreno;
    } catch (err) {
      cont.innerHTML = `<div class="cargando-mundo"><p>${esc((err as Error).message)}</p>
        <div class="fila-botones"><button class="btn-juego" data-r>${btn("rotar", t("Intentar otra vez", "Try again"))}</button>
        <button class="btn-juego borde" data-otro>${btn("pin", t("Elegir otro lugar", "Choose another place"))}</button></div></div>`;
      $("[data-r]").addEventListener("click", entrarMundo);
      $("[data-otro]").addEventListener("click", () => { $("#hud").hidden = true; $("#escena").hidden = true; pantallaMapa(); });
      decir(t("No pude traer la forma de tu parcela. Revisa la señal y toca de nuevo, o elige otro lugar.", "I couldn't get the shape of your plot. Check your signal and try again, or choose another place."), "preocupada");
      return;
    }
    mundo?.destruir();
    try {
      const m3d = await pMotor;
      if (!m3d.hayWebGL()) throw new Error("sin WebGL");
      mundo = m3d.crearMundo3D(cont, terreno!, terreno!.centro);
    } catch {
      mundo = crearMundo2D(cont, terreno!.desnivel_m);
      $("#aviso2d").hidden = false;
    }
    mundo.alTocar(tocarParcela);
    await Promise.all([pParcela, pSemillas]);
    await restaurar();
    ok = true;
  });
  if (!ok) return;
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
    case "rotacion": return rotarTierra();
    case "certificado": return certificado();
    default: return decir(t("¡Seguimos! Avanza el tiempo y cuida tu siembra.", "Let's go on! Move time forward and take care of your crops."));
  }
}

// ---------------------------------------------------------------- 3. ficha técnica de la tierra
async function fichaTierra() {
  const titulo = t("Así es tu tierra", "This is your land");
  abrirPanel(titulo, `<div class="cargando-mundo chico"><div class="girar"></div><p>${t("Leyendo los datos de la NASA…", "Reading NASA data…")}</p></div>`, "cartas-panel");
  try {
    parcelaInfo = parcelaInfo || await conCarga(t("Leyendo los datos de la NASA…", "Reading NASA data…"), () => consultar("parcela"));
    guardar({ provincia: parcelaInfo.lugar.provincia });
  } catch {
    abrirPanel(titulo, `<p>${t("No pude leer tu tierra. Revisa la señal.", "I couldn't read your land. Check your signal.")}</p><button class="btn-juego" data-r>${t("Intentar otra vez", "Try again")}</button>`);
    $("[data-r]").addEventListener("click", fichaTierra);
    return;
  }
  pintarHud();
  const p = parcelaInfo, c = p.clima, tend = p.tendencia, n = p.nasa || {};
  const humedad: number[] = n.suelo_raiz_mes || [];
  const barras = humedad.map((h: number, i: number) =>
    `<span class="barra-h" style="--h:${Math.max(6, h * 100)}%;--c:${h >= 0.75 ? "#2e7d32" : h >= 0.6 ? "#f9a825" : "#c62828"}" title="${nombreMes(i)}: ${Math.round(h * 100)} %"><i></i><b>${mesCorto(i)[0].toUpperCase()}</b></span>`).join("");
  const carta = (icono: string, titulo: string, valor: string, detalle: string, color: string, clase = "") =>
    `<article class="carta ${clase}" style="--color:${color}"><div class="carta-icono">${ic(icono)}</div><h3>${titulo}</h3>
      <p class="carta-valor">${valor}</p><p class="carta-detalle">${detalle}</p></article>`;
  const secos = humedad.map((h, i) => (h < 0.7 ? nombreMes(i) : "")).filter(Boolean);
  // lluvia: año normal frente al más seco y al más lluvioso que midió la NASA, y el índice de aridez (UNEP)
  const lmin = c.lluvia_min ?? c.lluvia_seca, lmax = c.lluvia_max ?? Math.round(c.lluvia_anual * 1.3);
  const lhum = c.lluvia_humeda ?? Math.round((c.lluvia_anual + lmax) / 2);
  const ar = c.aridez ?? c.lluvia_anual / Math.max(c.et0_anual, 1);
  const estado = ar < 0.5 ? [t("seca", "dry"), "#c62828", t("Llueve mucho menos de lo que el sol evapora: casi siempre hay que regar.", "It rains much less than the sun evaporates: you almost always need to water.")]
    : ar < 0.65 ? [t("algo seca", "somewhat dry"), "#e0a100", t("Llueve un poco menos de lo que se evapora: hay que regar en los meses secos.", "It rains a bit less than what evaporates: you need to water in the dry months.")]
    : ar < 1 ? [t("húmeda", "humid"), "#2e7d32", t("La lluvia casi alcanza a lo que se evapora: se riega solo en verano.", "Rain almost matches what evaporates: you only water in the dry season.")]
    : [t("muy húmeda", "very humid"), "#1e6fb8", t("Llueve más de lo que se evapora: cuida que el agua no lave la tierra.", "It rains more than what evaporates: make sure the water doesn't wash the soil away.")];
  const pos = (v: number) => Math.max(0, Math.min(100, ((v - lmin) / Math.max(lmax - lmin, 1)) * 100));
  const tarjetaLluvia = `<article class="carta ancha lluvia-carta" style="--color:#1e6fb8">
      <div class="carta-cabeza"><div class="carta-icono">${ic("lluvia")}</div><div><h3>${t("Lluvia al año", "Rain per year")}</h3>
        <p class="carta-valor">${num(c.lluvia_anual)} mm <small>${t("en un año normal", "in a normal year")}</small></p></div>
        <span class="estado-tierra" style="--c:${estado[1]}">${t("Tu zona es", "Your area is")} <b>${estado[0]}</b></span></div>
      <div class="regla-lluvia" role="img" aria-label="${t(`De ${num(lmin)} a ${num(lmax)} milímetros según el año`, `From ${num(lmin)} to ${num(lmax)} millimeters depending on the year`)}">
        <div class="regla-zonas" style="--a:${pos(c.lluvia_seca)}%;--b:${pos(lhum)}%"></div>
        <span class="regla-marca" style="left:${pos(c.lluvia_anual)}%"><b>${t("Normal", "Normal")}</b></span>
      </div>
      <div class="regla-textos"><span><b>${num(lmin)} mm</b>${t("el año más seco", "driest year")}</span><span class="centro">${t("seco · normal · lluvioso", "dry · normal · rainy")}</span><span class="fin"><b>${num(lmax)} mm</b>${t("el año más lluvioso", "rainiest year")}</span></div>
      <p class="carta-detalle">${estado[2]} ${t(`De cada 10 litros que el sol evapora, la lluvia devuelve unos <b>${num(Math.min(20, Math.round(ar * 10)))}</b>.`, `Of every 10 liters the sun evaporates, rain gives back about <b>${num(Math.min(20, Math.round(ar * 10)))}</b>.`)}</p>
    </article>`;
  const areaTxt = areaTexto(lugar().area_m2 ?? p.lugar.area_m2);
  abrirPanel(titulo, `<p class="ficha-sub">${t("Granja", "Farm")} <b>${esc(J.granja)}</b> · ${esc(areaTxt)} · ${t("datos de satélites de la NASA", "NASA satellite data")}</p>
  <div class="cartas">
    ${tarjetaLluvia}
    ${carta("sol", t("Evaporación", "Evaporation"), `${num(c.et0_anual)} mm`, c.et0_anual > c.lluvia_anual ? t("Se evapora más de lo que llueve", "More evaporates than rains") : t("Se evapora menos de lo que llueve", "Less evaporates than rains"), "#e65100")}
    ${carta("termometro", t("Temperatura", "Temperature"), `${num(c.tmin)} ${t("a", "to")} ${num(c.tmax)} °C`, t(`Noches frías y días templados · días de calor fuerte: ${tend.calor_dias}`, `Cold nights and mild days · days of strong heat: ${tend.calor_dias}`), "#d84315")}
    ${n.radiacion_kwh ? carta("dia", t("Energía del sol", "Sun energy"), `${num(n.radiacion_kwh, 1)} kWh/m²`, t("Cada día, en cada metro cuadrado", "Every day, on each square meter"), "#f2a900") : ""}
    ${n.humedad_aire ? carta("nube", t("Humedad del aire", "Air humidity"), `${n.humedad_aire} %`, `${t("Viento", "Wind")}: ${num(n.viento, 1)} m/s`, "#5c7da8") : ""}
    ${carta("grafico", t("Última década", "Last decade"), `${t("Lluvia", "Rain")} ${tend.cambio_lluvia_pct > 0 ? "+" : ""}${tend.cambio_lluvia_pct} %`, `${t("Temperatura", "Temperature")} ${tend.cambio_temp_c > 0 ? "+" : ""}${num(tend.cambio_temp_c, 1)} °C`, "#6a1b9a")}
    ${tarjetaPendiente()}
    ${humedad.length ? `<article class="carta ancha" style="--color:#2e7d32"><div class="carta-cabeza"><div class="carta-icono">${ic("gota")}</div><h3>${t("Humedad del suelo en las raíces, mes a mes", "Soil moisture at the roots, month by month")}</h3></div>
      <div class="barras-h">${barras}</div>
      <p class="leyenda-mini"><span style="--c:#2e7d32">${t("húmedo", "moist")}</span><span style="--c:#f9a825">${t("justo", "just enough")}</span><span style="--c:#c62828">${t("seco: hay que regar", "dry: water it")}</span></p>
      <p class="carta-detalle">${t("Satélites de la NASA (GWETROOT): 100 % es suelo empapado.", "NASA satellites (GWETROOT): 100 % is soaked soil.")}</p></article>` : ""}
  </div>
  <p class="fuente">${t("Clima: NASA POWER", "Climate: NASA POWER")} ${esc(p.periodo)} (MERRA-2, CERES) · FAO-56.${terreno?.pendiente_pct !== undefined ? t(" Pendiente: relieve Copernicus DEM (vía Open-Meteo, 90 m).", " Slope: Copernicus DEM relief (via Open-Meteo, 90 m).") : ""}</p>
  <button class="btn-juego grande" data-sig>${btn("semilla", t("Conocer las semillas", "Meet the seeds"))}</button>`, "cartas-panel");
  $("[data-sig]").addEventListener("click", () => { paso("semillas"); abrirFamilias(); });
  const anios = (() => { const [a0, a1] = String(p.periodo).split("–").map(Number); return a1 && a0 ? a1 - a0 + 1 : t("muchos", "many"); })();
  const frases = [
    t(`Los satélites de la NASA miraron tu granja todos los días durante ${anios} años. Con esos datos sabemos cómo es tu tierra.`,
      `NASA satellites watched your farm every day for ${anios} years. With that data we know what your land is like.`),
    t(`En un año normal llueven ${num(c.lluvia_anual)} milímetros. Un milímetro es un litro de agua en cada metro cuadrado. Pero el año más seco llovió solo ${num(lmin)} y el más lluvioso ${num(lmax)}: por eso hay que estar preparados.`,
      `In a normal year it rains ${num(c.lluvia_anual)} millimeters. One millimeter is one liter of water on each square meter. But the driest year only had ${num(lmin)} and the rainiest ${num(lmax)}: that's why we must be prepared.`),
    t(`El sol y el viento evaporan ${num(c.et0_anual)} milímetros al año. Si se evapora más de lo que llueve, la tierra se seca y las plantas piden riego. Tu zona es ${estado[0]}.`,
      `The sun and wind evaporate ${num(c.et0_anual)} millimeters a year. If more evaporates than rains, the soil dries out and plants ask for water. Your area is ${estado[0]}.`),
    secos.length ? t(`Mira las barras de humedad: el suelo se seca más en ${secos.slice(0, 3).join(", ")}. Esos meses las raíces tienen sed y hay que regar.`,
      `Look at the moisture bars: the soil dries out most in ${secos.slice(0, 3).join(", ")}. In those months the roots are thirsty and you need to water.`)
      : t("Mira las barras de humedad: tu suelo guarda agua casi todo el año. ¡Qué suerte!", "Look at the moisture bars: your soil holds water almost all year. How lucky!"),
    t(`La temperatura va de ${num(c.tmin)} grados en las noches frías a ${num(c.tmax)} en los días de sol fuerte. Cuando hace mucho calor, la tierra pierde agua más rápido.`,
      `The temperature goes from ${num(c.tmin)} degrees on cold nights to ${num(c.tmax)} on strong-sun days. When it is very hot, the soil loses water faster.`),
    ...(pendienteFrase() ? [pendienteFrase()] : []),
  ];
  decirVarias(frases);
}

/** Pendiente del terreno (del relieve de la parcela): porcentaje, clase y un dibujo del perfil de oeste a este. */
const PENDIENTES: Record<string, { es: string; en: string; color: string; consejo: [string, string] }> = {
  plano: { es: "plana", en: "flat", color: "#2e7d32", consejo: ["El agua se queda quieta: cuida que no se encharque.", "Water stays put: make sure it doesn't pool."] },
  suave: { es: "suave", en: "gentle", color: "#7cb342", consejo: ["Es ideal para sembrar y regar con calma.", "It is great for planting and watering calmly."] },
  moderada: { es: "inclinada", en: "sloped", color: "#e0a100", consejo: ["Siembra en curvas de nivel, como si dibujaras líneas de un mismo alto.", "Plant along the contour lines, as if drawing lines at the same height."] },
  fuerte: { es: "muy inclinada", en: "very steep", color: "#c62828", consejo: ["La lluvia puede llevarse la tierra: cúbrela con plantas y siembra en curvas de nivel.", "Rain can wash the soil away: cover it with plants and plant along the contour lines."] },
};
function perfilTerreno(): string {
  if (!terreno || terreno.sin_relieve) return "";
  const fila = terreno.alturas[Math.floor(terreno.n / 2)];
  const lo = Math.min(...fila), hi = Math.max(...fila), rango = Math.max(hi - lo, 1);
  const pts = fila.map((z, k) => `${((k / (fila.length - 1)) * 200).toFixed(1)},${(50 - ((z - lo) / rango) * 36).toFixed(1)}`).join(" ");
  return `<svg class="perfil" viewBox="0 0 200 60" preserveAspectRatio="none" role="img" aria-label="${t("Perfil del terreno de oeste a este", "Ground profile from west to east")}">
    <polygon points="0,60 ${pts} 200,60" fill="#a5682a"/><polyline points="${pts}" fill="none" stroke="#3b2a1a" stroke-width="3" stroke-linejoin="round"/></svg>
    <div class="perfil-ejes"><span>${t("oeste", "west")}</span><span>${t("este", "east")}</span></div>`;
}
function tarjetaPendiente(): string {
  const pct = terreno?.pendiente_pct;
  if (pct === undefined || terreno?.sin_relieve) return "";
  const k = PENDIENTES[terreno?.pendiente_clase || "suave"] || PENDIENTES.suave;
  return `<article class="carta ancha" style="--color:${k.color}">
    <div class="carta-cabeza"><div class="carta-icono">${ic("montana")}</div><div><h3>${t("Pendiente del terreno", "Slope of the land")}</h3>
      <p class="carta-valor">${num(pct, 1)} % <small>${t("terreno", "land")} ${t(k.es, k.en)}</small></p></div>
      <span class="estado-tierra" style="--c:${k.color}">${t("Desnivel", "Height difference")} <b>${num(terreno!.desnivel_m, 0)} m</b></span></div>
    ${perfilTerreno()}
    <p class="carta-detalle">${t(k.consejo[0], k.consejo[1])}</p></article>`;
}
function pendienteFrase(): string {
  const pct = terreno?.pendiente_pct;
  if (pct === undefined || terreno?.sin_relieve) return "";
  const k = PENDIENTES[terreno?.pendiente_clase || "suave"] || PENDIENTES.suave;
  return t(`Tu terreno es ${k.es}: baja ${num(pct, 1)} metros por cada 100 que avanzas. ${k.consejo[0]}`,
    `Your land is ${k.en}: it drops ${num(pct, 1)} meters for every 100 you move. ${k.consejo[1]}`);
}

// ---------------------------------------------------------------- 4. semillas por familia botánica
async function cargarSemillas(mes: number) {
  const s = await consultar<{ meses_zona: number[]; siembra_por_mes: number[]; cultivos: Cultivo[]; lugar?: { elev: number } }>("semillas", { mes });
  semillasInfo = s;
  s.cultivos.forEach((c) => cultivos.set(c.id, { ...cultivos.get(c.id), ...c }));
  return s;
}

/** Semillas que Pachita explica pero que no se siembran solas en el juego: qué son y por qué no se pueden elegir. */
const INFO_SEMILLAS: Record<string, { es: string; en: string; abre?: string; abreNombre?: [string, string] }> = {
  vicia: {
    es: "La vicia es una leguminosa trepadora: sus raíces atrapan nitrógeno del aire y dejan abono en la tierra. En esta granja no se siembra sola, pero viene mezclada en la «Avena con vicia», un forraje que sí puedes sembrar.",
    en: "Vetch is a climbing legume: its roots trap nitrogen from the air and leave fertilizer in the soil. On this farm it is not planted alone, but it comes mixed into «Oats with vetch», a fodder you can plant.",
    abre: "avena", abreNombre: ["Avena con vicia", "Oats with vetch"],
  },
  trebol: {
    es: "El trébol es una leguminosa baja que cubre la tierra y la alimenta con nitrógeno. En el juego no se siembra solo: forma parte de la «Pastura mixta», una mezcla de gramíneas con tréboles que sí puedes sembrar.",
    en: "Clover is a low-growing legume that covers the ground and feeds it with nitrogen. In the game it is not planted alone: it is part of the «Mixed pasture», a blend of grasses and clovers you can plant.",
    abre: "pasto", abreNombre: ["Pastura mixta", "Mixed pasture"],
  },
  alfalfa: {
    es: "La alfalfa es una leguminosa forrajera de raíces muy profundas que mejora el suelo. Todavía no está en el catálogo de esta granja porque no tenemos los datos de su ciclo ni de su agua para la sierra, así que por ahora no se puede sembrar.",
    en: "Alfalfa is a fodder legume with very deep roots that improves the soil. It is not in this farm's catalog yet because we don't have its cycle and water data for the highlands, so it can't be planted for now.",
  },
  biomasa: {
    es: "La biomasa son los restos de plantas (hojas, tallos y raíces) que quedan sobre y dentro de la tierra. Al pudrirse la alimentan y la protegen de la lluvia. No es una semilla: es lo que dejan tus cultivos.",
    en: "Biomass is the plant remains (leaves, stems and roots) left on and in the soil. As they rot they feed the soil and protect it from the rain. It is not a seed: it is what your crops leave behind.",
  },
};
const NOMBRE_EXTRA_EN: Record<string, string> = { vicia: "Vetch", trebol: "Clover", alfalfa: "Alfalfa", biomasa: "Biomass" };
/** «con chocho» / «with lupin», sin repetir la palabra cuando el nombre ya la trae («Avena con vicia» → «avena con vicia»). */
const conLeguminosa = (nom: string) => esc(/\b(con|with)\b/.test(nom) ? nom : `${t("con", "with")} ${nom}`);
const nombreExtra = (k: string) => t(NOMBRE_EXTRA[k], NOMBRE_EXTRA_EN[k]);

async function abrirFamilias() {
  if (J.sembrado) { decir(t("Ya sembraste. Espera la cosecha.", "You already planted. Wait for the harvest.")); return; }
  try { if (!semillasInfo) await cargarSemillas(J.mes ?? (new Date().getMonth() + 1) % 12 + 1); }
  catch { decir(t("No pude traer las semillas. Revisa la señal.", "I couldn't get the seeds. Check your signal."), "preocupada"); return; }
  const lista = [...semillasInfo!.cultivos, ...(J.temporada > 1 ? [DESCANSO] : [])];
  const grupos = FAMILIAS.map((f) => ({ f, cs: lista.filter((c) => f.id.includes(c.familia)) })).filter((g) => g.cs.length);
  const pend = rotacionPendiente();
  const p = abrirPanel(t("Semillas por familia", "Seeds by family"), `
    ${pend ? `<div class="aviso-rot">${ic("rotar", "ic-leccion")}<div><b>${t("Tu rotación sigue con", "Your rotation continues with")} ${esc(nombreCorto(pend.id))}</b>
      <span>${t(`Paso ${pend.k + 1} de ${pend.n}. Busca la semilla marcada con la cinta amarilla.`, `Step ${pend.k + 1} of ${pend.n}. Look for the seed with the yellow ribbon.`)}</span></div></div>` : ""}
    <div class="leccion">${ic("foco", "ic-leccion")}<div>${t(
      "<b>¿Por qué familias?</b> Las plantas de una misma familia se enferman de lo mismo y comen lo mismo del suelo. Si cambias de familia cada vez que siembras, la tierra descansa y las plagas se van. ¡Eso es <b>rotar</b>! Las <b>N+</b> son leguminosas: fabrican su propio abono con el nitrógeno del aire.",
      "<b>Why families?</b> Plants of the same family get sick from the same things and eat the same things from the soil. If you change family each time you plant, the soil rests and the pests go away. That's called <b>rotating</b>! The <b>N+</b> ones are legumes: they make their own fertilizer from the nitrogen in the air.")}</div></div>
    ${grupos.map(({ f, cs }) => `<section class="familia" style="--color:${f.color}">
      <h3>${icono(f.icono, "icono-familia")} ${famNombre(f)}</h3><p>${t(f.pq[0], f.pq[1])}</p>
      <div class="sobres">${cs.map((c) => `<button type="button" class="sobre ${c.apto === false ? "bloqueado" : ""} ${pend?.id === c.id ? "siguiente" : ""}" data-crop="${c.id}">
        ${icono(c.id, "icono-sobre")}${c.apto === false ? `<span class="candado">${ic("candado")}</span>` : ""}
        <span class="sobre-nombre">${esc(nombreDe(c.id, c.nombre))}</span>${c.fija_n ? '<span class="sello-n">N+</span>' : ""}
        ${pend?.id === c.id ? `<span class="cinta-rot">${t("Tu rotación", "Your rotation")}</span>` : ""}</button>`).join("")}
        ${(f.tambien || []).map((k) => `<button type="button" class="sobre info" data-info="${k}" aria-label="${nombreExtra(k)}: ${t("solo información", "information only")}">
          ${icono(k, "icono-sobre")}<span class="sello-i">${ic("info", "ic-chip")}</span><span class="sobre-nombre">${nombreExtra(k)}</span>
          <span class="mini">${t("solo información", "information only")}</span></button>`).join("")}
      </div></section>`).join("")}`, "semillas-panel");
  p.querySelectorAll<HTMLButtonElement>(".sobre[data-crop]").forEach((b) => b.addEventListener("click", () => detalleSemilla(b.dataset.crop!)));
  p.querySelectorAll<HTMLButtonElement>(".sobre[data-info]").forEach((b) => b.addEventListener("click", () => detalleInfo(b.dataset.info!)));
  decirVarias([
    t("Estas son las semillas de la sierra, ordenadas por familia. Las plantas de la misma familia son como primas: les gustan las mismas comidas y les dan las mismas plagas.",
      "These are the seeds of the Andes, sorted by family. Plants of the same family are like cousins: they like the same foods and get the same pests."),
    pend ? t(`Tu rotación pide ${nombreCorto(pend.id)} ahora: es la semilla con la cinta amarilla.`, `Your rotation asks for ${nombreCorto(pend.id)} now: it is the seed with the yellow ribbon.`)
      : t("Las semillas con candado no crecen a la altura de tu granja. Las que tienen una «i» solo te las explico. Toca una semilla para conocerla y elegirla.",
        "Seeds with a padlock don't grow at your farm's altitude. The ones with an “i” I only explain. Tap a seed to learn about it and choose it."),
  ]);
}

/** Semillas de solo información (vicia, trébol, alfalfa, biomasa): se explican y se dice por qué no se siembran. */
function detalleInfo(k: string) {
  const info = INFO_SEMILLAS[k];
  if (!info) return;
  const abre = info.abre ? cultivos.get(info.abre) : null;
  abrirPanel(nombreExtra(k), `<div class="semilla-hero">
      ${icono(k, "icono-grande")}
      <div class="semilla-titulo"><span class="etiqueta info-etiqueta">${ic("info", "ic-chip")} ${t("Solo información", "Information only")}</span></div></div>
    <div class="estado-semilla no-se-siembra">${ic("candado", "ic-linea")} ${t("No se puede sembrar sola en esta granja", "It can't be planted on its own on this farm")}</div>
    <p class="texto-semilla">${esc(t(info.es, info.en))}</p>
    <div class="fila-botones"><button class="btn-juego borde" data-volver>${btn("atras", t("Otras semillas", "Other seeds"))}</button>
      ${abre ? `<button class="btn-juego" data-abre>${btn("semilla", t(`Ver ${info.abreNombre![0]}`, `See ${info.abreNombre![1]}`))}</button>` : ""}</div>`, "centro");
  $("[data-volver]").addEventListener("click", abrirFamilias);
  document.querySelector("[data-abre]")?.addEventListener("click", () => detalleSemilla(info.abre!));
  decir(t(info.es + " Por eso no la puedes elegir para sembrar.", info.en + " That's why you can't choose it for planting."), "pensando");
}

function detalleSemilla(id: string) {
  const c = cultivos.get(id)!;
  const f = familiaDe(c.familia);
  const nom = nombreCultivo(id);
  const meses = new Set(c.meses || []);
  const elev = semillasInfo?.lugar?.elev;
  const dentro = c.alt_min !== undefined && elev !== undefined ? elev >= c.alt_min && elev <= c.alt_max! : null;
  const pend = rotacionPendiente();
  const razon = razonAltura(c, elev, c.razon);
  const epoca = epocaTexto(c.meses, c.epoca_texto);
  abrirPanel(nom, `<div class="semilla-hero" style="--color:${f?.color || "#555"}">
      ${icono(id, "icono-grande")}
      <div class="semilla-titulo"><span class="etiqueta" style="--color:${f?.color || "#555"}">${f ? famNombre(f) : t("Cobertura", "Cover")}</span>
        ${c.fija_n ? `<span class="bueno-chip">${ic("nitrogeno", "ic-chip")} ${t("Alimenta la tierra con nitrógeno", "Feeds the soil with nitrogen")}</span>` : ""}</div></div>
    <div class="estado-semilla ${c.apto === false ? "no-se-siembra" : "si-se-siembra"}">${c.apto === false
      ? `${ic("candado", "ic-linea")} ${esc(razon || t("No se puede sembrar aquí", "It can't be planted here"))}`
      : `${ic("check", "ic-linea")} ${t("Se puede sembrar en tu chacra", "It can be planted on your farm")}`}</div>
    <div class="semilla-datos">
      ${c.ciclo_dias ? `<div class="dato"><span class="dato-ic">${ic("reloj")}</span><b>${t("Tarda hasta la cosecha", "Time to harvest")}</b>
        <span class="dato-v">${c.ciclo_dias} ${t("días", "days")}</span><small>${t(`unos ${Math.round(c.ciclo_dias / 30)} meses`, `about ${Math.round(c.ciclo_dias / 30)} months`)}</small></div>` : ""}
      ${c.alt_min ? `<div class="dato"><span class="dato-ic">${ic("montana")}</span><b>${t("Altura donde crece", "Altitude where it grows")}</b>
        <span class="dato-v">${num(c.alt_min)}–${num(c.alt_max!)} m</span>
        <small class="${dentro === false ? "malo" : "bueno"}">${elev !== undefined ? `${t("Tu chacra: ", "Your farm: ")}${num(elev)} m ${dentro ? "✓" : "✗"}` : ""}</small></div>` : ""}
      ${c.uso ? `<div class="dato"><span class="dato-ic">${ic("cesta")}</span><b>${t("Sirve para", "Used for")}</b><span class="dato-v chico">${esc(usoDe(c.uso))}</span></div>` : ""}
      <div class="dato ancho"><span class="dato-ic">${ic("calendario")}</span><b>${t("Época de siembra en tu zona", "Planting season in your area")}</b>
        <div class="tira-meses">${MESES_CORTOS.map((_, k) => `<span class="mes-chip ${meses.has(k + 1) ? "on" : ""}" title="${nombreMes(k)}">${mesCorto(k)[0].toUpperCase()}</span>`).join("")}</div>
        <small>${esc(epoca)}</small></div>
    </div>
    <div class="fila-botones"><button class="btn-juego borde" data-volver>${btn("atras", t("Otras semillas", "Other seeds"))}</button>
      ${c.apto === false ? "" : `<button class="btn-juego" data-elegir>${btn("semilla", t("Elegir esta semilla", "Choose this seed"))}</button>`}</div>`, "centro semilla-detalle");
  $("[data-volver]").addEventListener("click", abrirFamilias);
  document.querySelector("[data-elegir]")?.addEventListener("click", () => {
    if (pend && pend.id !== id && J.temporada > 1) {
      J.rotacion = null; J.rotPaso = 0;   // cambió de plan: la rotación anterior ya no se sigue
      decir(t(`Elegiste ${nombreCorto(id)} y tu rotación pedía ${nombreCorto(pend.id)}. Está bien, cambiamos de plan: al cosechar te propongo una rotación nueva.`,
        `You picked ${nombreCorto(id)} but your rotation asked for ${nombreCorto(pend.id)}. That's fine, we change the plan: after harvest I'll suggest a new rotation.`));
    }
    J.crop = id;
    paso("calendario");
    abrirCalendario();
  });
  const fam = f ? famNombre(f).split(" (")[0].toLowerCase() : t("plantas de cobertura", "cover plants");
  if (c.apto === false) decir(t(`${nom} no se puede sembrar aquí: ${razon}. Prueba con otra semilla de la lista.`, `${nom} can't be planted here: ${razon}. Try another seed from the list.`), "pensando");
  else decir(c.fija_n
    ? t(`${nom} es una leguminosa. En sus raíces viven bacterias amigas que atrapan el nitrógeno del aire y lo dejan en la tierra como abono. Tarda ${c.ciclo_dias} días en estar lista.`,
      `${nom} is a legume. Friendly bacteria live in its roots and trap nitrogen from the air, leaving it in the soil as fertilizer. It takes ${c.ciclo_dias} days to be ready.`)
    : t(`${nom} es de la familia de las ${fam}. Tarda ${c.ciclo_dias} días en estar lista${c.epoca_texto ? ` y aquí se siembra ${c.epoca_texto}` : ""}.`,
      `${nom} belongs to the ${fam} family. It takes ${c.ciclo_dias} days to be ready${c.meses?.length ? ` and here it is planted in ${epoca}` : ""}.`));
}

// ---------------------------------------------------------------- 5. calendario de siembra
/** Mes abreviado que manda la API (siempre en español) en el idioma actual. */
const mesApi = (m: string) => { const i = MESES_CORTOS.indexOf(m.slice(0, 3).toLowerCase()); return i >= 0 ? mesCorto(i) : m.slice(0, 3); };

function abrirCalendario() {
  if (J.sembrado) { decir(t("Primero cosecha lo que está sembrado.", "First harvest what is planted.")); return; }
  const c = J.crop ? cultivos.get(J.crop) : null;
  if (!c) { abrirFamilias(); return; }
  const nom = nombreCorto(c.id);
  const meses = new Set(c.meses || []);
  const actual = J.mes ?? (new Date().getMonth() + 1) % 12 + 1;
  const r = 120, cx = 140, cy = 140;
  const porciones = MESES_CORTOS.map((_, i) => {
    const a0 = ((i - 3) / 12) * Math.PI * 2, a1 = ((i - 2) / 12) * Math.PI * 2, am = (a0 + a1) / 2;
    const p = (a: number, rr: number) => `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`;
    const ok = meses.has(i + 1);
    return `<g class="mes ${actual === i + 1 ? "elegido" : ""}" data-mes="${i + 1}" tabindex="0" role="button" aria-label="${nombreMes(i)}${ok ? t(", época de siembra", ", planting season") : ""}">
      <path style="fill:${ok ? "#5fb35a" : "#e3dccb"}" d="M${p(a0, 46)} L${p(a0, r)} A${r} ${r} 0 0 1 ${p(a1, r)} L${p(a1, 46)} A46 46 0 0 0 ${p(a0, 46)} Z"/>
      <text x="${cx + 86 * Math.cos(am)}" y="${cy + 86 * Math.sin(am) + 6}" text-anchor="middle">${mesCorto(i)}</text></g>`;
  }).join("");
  abrirPanel(t(`¿Cuándo siembras ${nom}?`, `When do you plant ${nom}?`), `<svg class="rueda" viewBox="0 0 280 280">${porciones}
      <foreignObject x="${cx - 42}" y="${cy - 42}" width="84" height="84"><div class="rueda-icono">${icono(c.id, "icono-rueda")}</div></foreignObject></svg>
    <p class="leyenda"><span class="punto epoca"></span> ${t("Época de siembra en tu zona (INIAP)", "Planting season in your area (INIAP)")} <span class="punto"></span> ${t("Otros meses", "Other months")}</p>`, "centro");
  decir(t(`Los meses verdes son la época de siembra de ${nom} en tu zona, según el INIAP: ahí llega la lluvia justo cuando la semilla la necesita para nacer. Toca un mes.`,
    `The green months are the planting season for ${nom} in your area, according to INIAP: that's when rain arrives just as the seed needs it to sprout. Tap a month.`));
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
    const nom = nombreCorto(c.id), epoca = epocaTexto(c.meses, c.epoca_texto);
    abrirPanel(t("Fuera de época", "Out of season"), `<div class="detalle-semilla">${icono(c.id, "icono-grande")}
      <p class="grande">${t(`En <b>${nombreMes(mes - 1)}</b> no es época de ${nom}. Aquí se siembra <b>${esc(epoca)}</b>.`, `In <b>${nombreMes(mes - 1)}</b> it's not the season for ${nom}. Here it is planted in <b>${esc(epoca)}</b>.`)}</p></div>
      <div class="fila-botones"><button class="btn-juego" data-otro>${btn("calendario", t("Elegir otro mes", "Choose another month"))}</button>
      <button class="btn-juego borde" data-igual>${t("Sembrar igual", "Plant anyway")}</button></div>`, "centro");
    decir(t(`En ${nombreMes(mes - 1)} no es época: la semilla nacería sin lluvia o la cosecha caería en meses de helada. Si siembras igual, tendrás que regar más y la planta puede sufrir.`,
      `In ${nombreMes(mes - 1)} it's not the season: the seed would sprout without rain or the harvest would fall in frost months. If you plant anyway, you'll have to water more and the plant may suffer.`), "pensando");
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
  decir(t(`Tu chacra tiene cuatro parcelas cuadradas. Toca una parcela para sembrar ${nombreCorto(c.id)} en ${nombreMes(J.mes - 1)}, o el botón Sembrar todo para llenar las cuatro.`,
    `Your farm has four square plots. Tap a plot to plant ${nombreCorto(c.id)} in ${nombreMes(J.mes - 1)}, or the Plant all button to fill the four.`));
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
  if (J.sembrado) { decir(t("La temporada ya empezó. Espera la cosecha para sembrar de nuevo.", "The season has already started. Wait for the harvest to plant again.")); return; }
  if (!J.crop || !J.mes) { abrirFamilias(); return; }
  if (pc.crop === J.crop) { decir(t("Esa parcela ya está sembrada. Toca otra o pulsa ¿Cuánta agua?", "That plot is already planted. Tap another one or press How much water?")); return; }
  const antes = pc.crop;
  pc.crop = J.crop;
  pc.riegos = [];
  try {
    const c = await conCarga(t("Sembrando…", "Planting…"), () => pedirCiclo(i));
    if (!J.anio) J.anio = c.anio;
  } catch {
    pc.crop = antes;
    decir(t("No pude sembrar: revisa la señal y toca otra vez.", "I couldn't plant: check your signal and tap again."), "preocupada");
    return;
  }
  guardarTodo();
  pintarMundo();
  pintarControles();
  sonido.siembra();
  const n = J.parcelas.filter((p) => p.crop).length;
  if (n >= N_PARCELAS) { empezarTemporada(); return; }  // las cuatro parcelas sembradas: el tiempo corre solo
  decir(t(`¡Sembraste ${nombreCorto(J.crop)} en la parcela ${i + 1}! Puedes sembrar más parcelas, o dejar alguna con descanso.`,
    `You planted ${nombreCorto(J.crop)} in plot ${i + 1}! You can plant more plots, or leave one resting.`));
}

async function sembrarTodas() {
  for (let i = 0; i < N_PARCELAS; i++) if (J.parcelas[i].crop !== J.crop) await sembrar(i);
}

// ---------------------------------------------------------------- 7. agua que necesita (datos NASA)
function panelAgua() {
  const plant = J.parcelas.map((p, i) => [p, i] as const).filter(([p]) => p.crop);
  const c = plant.length ? ciclos.get(plant[0][1]) : null;
  if (!c) { pedirSiembra(); return; }
  const enCurso = J.sembrado;   // ya está creciendo: solo se consulta, no se reinicia la temporada
  if (!enCurso) paso("agua");
  const k = plant.length; // parcelas sembradas (el ciclo trae litros por parcela)
  const a = c.agua;
  const L = (x: number) => x * k;
  const nom = nombreCorto(c.cultivo.id);
  abrirPanel(t("¿Cuánta agua necesita?", "How much water does it need?"), `<div class="agua-panel">
    ${icono(c.cultivo.id, "icono-grande")}
    <div class="gota-fila"><span class="gota-ic">${ic("brote")}</span><div><b>${agua(L(a.litros_cultivo))}</b><p>${t(`bebe tu ${nom} en todo su ciclo: <b>${num(a.gasto_mm)} litros en cada metro cuadrado</b>`, `your ${nom} drinks over its whole cycle: <b>${num(a.gasto_mm)} liters on each square meter</b>`)}</p></div></div>
    <div class="gota-fila"><span class="gota-ic">${ic("lluvia")}</span><div><b>${agua(L(a.litros_lluvia))}</b><p>${t(`le da la lluvia en un año normal (${num(a.lluvia_util_mm)} litros por m²)`, `rain gives it in a normal year (${num(a.lluvia_util_mm)} liters per m²)`)}</p></div></div>
    <div class="gota-fila destaca"><span class="gota-ic">${ic("gota")}</span><div><b>${a.riego_mm >= 5 ? agua(L(a.litros_riego)) : t("casi nada", "almost nothing")}</b><p>${t("hay que regar en un año normal", "you must water in a normal year")}${a.riego_mm >= 5 ? ` (${num(a.riego_mm)} ${t("litros por m²", "liters per m²")})` : ""}</p></div></div>
    <div class="gota-fila"><span class="gota-ic">${ic("desierto")}</span><div><b>${a.riego_seco_mm >= 5 ? agua(L(a.litros_riego_seco)) : t("casi nada", "almost nothing")}</b><p>${t("en un año seco", "in a dry year")}${a.riego_seco_mm >= 5 ? ` (${num(a.riego_seco_mm)} ${t("litros por m²", "liters per m²")})` : ""}</p></div></div>
    <h3>${t("Agua mes a mes", "Water month by month")}</h3>
    <div class="semaforo grande">${c.meses.map((m, j) => `<span class="sem ${c.estado_mes[j]}">${mesApi(m)}</span>`).join("")}</div>
    <p class="leyenda-mini"><span style="--c:#2e7d32">${t("hay agua", "enough water")}</span><span style="--c:#e0a100">${t("justo", "just enough")}</span><span style="--c:#c62828">${t("falta agua", "not enough water")}</span></p>
    <p class="leyenda">${veredicto(c.veredicto)}</p>
    <p class="fuente">${num(L(c.m2))} m² ${t("sembrados", "planted")} · NASA POWER 2001–2024 · FAO-56 · ${t("riego con 75 % de eficiencia", "irrigation at 75 % efficiency")}</p>
    ${enCurso ? "" : `<button class="btn-juego grande" data-crecer>${btn("sol", t("¡A crecer!", "Grow!"))}</button>`}</div>`, "centro");
  document.querySelector("[data-crecer]")?.addEventListener("click", empezarTemporada);
  decirVarias([
    t(`Las plantas toman agua de la tierra con sus raíces y la sueltan por las hojas, como si sudaran. Cada metro cuadrado de tu ${nom} bebe ${num(a.gasto_mm)} litros en todo su ciclo: en toda tu parcela son ${agua(L(a.litros_cultivo))}.`,
      `Plants take water from the soil with their roots and release it through their leaves, as if sweating. Each square meter of your ${nom} drinks ${num(a.gasto_mm)} liters over its whole cycle: on your whole plot that is ${agua(L(a.litros_cultivo))}.`),
    a.riego_mm >= 5 ? t(`La lluvia de un año normal no alcanza: hay que regar unos ${agua(L(a.litros_riego))}. Mira los meses en rojo: ahí la tierra se queda sin agua.`,
      `Rain in a normal year isn't enough: you must water about ${agua(L(a.litros_riego))}. Look at the red months: that's when the soil runs out of water.`)
      : t(`¡En un año normal la lluvia casi alcanza! Pero en un año seco habría que regar ${agua(L(a.litros_riego_seco))}. Por eso conviene guardar agua.`,
        `In a normal year the rain is almost enough! But in a dry year you would need to water ${agua(L(a.litros_riego_seco))}. That's why it's good to store water.`),
    t("Cuando avances el tiempo, mira la barra de agua del tanque. Si una planta se pone café y se dobla, tiene sed: toca Regar.",
      "When time moves on, watch the tank's water bar. If a plant turns brown and droops, it is thirsty: tap Water."),
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
      if (cultivos.get(prev)?.familia === c.familia) { cambio -= 15; razones.push(t(`la ${nombreCorto(c.id)} repite la familia de antes y eso trae plagas`, `the ${nombreCorto(c.id)} repeats the previous family and that brings pests`)); }
      else cambio += 5;
    }
  });
  if (desnuda && (parcelaInfo?.clima?.meses_lluvia?.length || 0) > 0) {
    cambio -= 5;
    razones.push(t("hay parcelas sin cubrir y los aguaceros lavan la tierra desnuda", "some plots are uncovered and downpours wash away bare soil"));
  }
  J.salud = Math.max(0, Math.min(100, J.salud + cambio));
  J.tanque = J.tanqueMax = plantadas.reduce((acc, [, i]) => acc + (ciclos.get(i)?.tanque_litros || 0), 0);
  J.sembrado = true;
  ultimoInfo = -99; ultimoAguacero = -99; aguacerosTemporada = 0;
  precargarAvisos();
  J.dia = 0;
  paso("crecer");
  if (J.salud >= 85) ganar("sana");
  cerrarPanel();
  pintarMundo();
  pintarControles();
  const nota = t(" Mira cómo crece: el tiempo corre solo. La gota de arriba te dice cuánta agua necesita.",
    " Watch it grow: time runs by itself. The drop at the top tells you how much water it needs.");
  autoPendiente = true;   // el play se enciende solo cuando Pachita termina de hablar
  hablarAviso({ texto: razones.length ? t(`Ojo: ${razones[0]}.${nota}`, `Careful: ${razones[0]}.${nota}`) : t(`¡Listo, a sembrar!${nota}`, `All set, let's plant!${nota}`) });
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

/** Lo que Pachita tiene que decir durante el tiempo. `accion`: pide algo al jugador (regar o cosechar) y el tiempo no sigue hasta entonces. */
type Aviso = { texto: string; animo?: Animo; accion?: "regar" | "cosechar" };
/** Si el jugador tiene que hacer algo antes de que siga el tiempo (y si el play estaba encendido). */
let esperando: { accion: "regar" | "cosechar"; venia: boolean } | null = null;
/** El play estaba encendido y se reanuda solo cuando Pachita termine de hablar. */
let autoPendiente = false;

/** Frases de los avisos que se repiten. Son fijas (sin cifras) para precargarlas al sembrar y que suenen al instante. */
const FRASE = {
  lista: (nom: string) => t(`¡Tu ${nom} está lista para cosechar! Toca «Cosechar todo» o la parcela para usar la guadaña.`, `The ${nom} is ready to harvest! Tap "Harvest all" or the plot to use the sickle.`),
  seca: (nom: string) => t(`¡Arrarray! ¡Qué sequía! Hace días que no llueve y la tierra de tu ${nom} se quedó sin agua. Sus hojas se doblan. Toca Regar para darle de beber.`,
    `Arrarray! What a drought! It hasn't rained for days and the soil of the ${nom} has run out of water. Its leaves are drooping. Tap Water to give it a drink.`),
  crece: (nom: string) => t(`¡Tu ${nom} ya está creciendo! Ahora saca hojas nuevas y sus raíces buscan agua más abajo.`, `The ${nom} is growing now! It sprouts new leaves and its roots look for water deeper down.`),
  flor: (nom: string) => t(`¡Tu ${nom} está floreciendo! Es cuando más agua toma: si le falta ahora, la cosecha sale pequeña.`, `The ${nom} is flowering! That's when it drinks the most: if it lacks water now, the harvest will be small.`),
  calor: () => t("¡Arrarray! ¡Qué calor! Con tanto sol la tierra pierde agua más rápido y las plantas se cansan.", "Arrarray! So hot! With so much sun the soil loses water faster and plants get tired."),
  secoMes: () => t("¡Arrarray! Empieza el tiempo seco: casi no llueve y el sol seca la tierra. Mira las barras de humedad y riega cuando haga falta.",
    "Arrarray! The dry season begins: it hardly rains and the sun dries the soil. Watch the moisture bars and water when needed."),
  aguacero: () => t("¡Achachay! Un aguacero. La tierra cubierta de plantas no se lava; la tierra desnuda se va con el agua.",
    "Achachay! A downpour. Soil covered with plants doesn't wash away; bare soil goes with the water."),
};
/** Pide de antemano la voz de todos los avisos posibles de los cultivos sembrados. */
function precargarAvisos() {
  const noms = [...new Set(J.parcelas.filter((p) => p.crop && !p.cosechada).map((p) => nombreCorto(p.crop!)))];
  precargar([FRASE.calor(), FRASE.secoMes(), FRASE.aguacero(), ...noms.flatMap((n) => [FRASE.lista(n), FRASE.seca(n), FRASE.crece(n), FRASE.flor(n)])]);
}
// Los avisos que solo cuentan algo no detienen el tiempo y tienen un respiro entre uno y otro;
// el del aguacero sale de vez en cuando (máximo una vez cada 45 días de juego y dos por temporada).
let ultimoInfo = -99, aguacerosTemporada = 0;

function eventos(antes: VistaParcela[]): boolean {
  const hoy = diaActual();
  let aviso: Aviso | null = null;
  J.parcelas.forEach((p, i) => {
    if (!p.crop || p.cosechada || aviso) return;
    const v = vista(i), a = antes[i], nom = nombreCorto(p.crop);
    if (v.lista && !a.lista) aviso = { accion: "cosechar", texto: FRASE.lista(nom) };
    else if (v.marchita && !a.marchita) aviso = { accion: "regar", animo: "preocupada", texto: FRASE.seca(nom) };
    else if (v.etapa !== a.etapa && v.etapa === 2) aviso = { texto: FRASE.crece(nom) };
    else if (v.etapa !== a.etapa && v.etapa === 3) aviso = { texto: FRASE.flor(nom) };
  });
  if (hoy && !aviso) {
    if (hoy.calor && !avisos.has(`c${hoy.fecha.slice(0, 7)}`)) {
      avisos.add(`c${hoy.fecha.slice(0, 7)}`);
      aviso = { animo: "preocupada", texto: FRASE.calor() };
    } else if (mesSeco(hoy) && !avisos.has(`s${hoy.fecha.slice(0, 7)}`)) {
      avisos.add(`s${hoy.fecha.slice(0, 7)}`);
      aviso = { animo: "preocupada", texto: FRASE.secoMes() };
    } else if (hoy.lluvia >= 15 && J.dia - ultimoAguacero > 45 && aguacerosTemporada < 2) {
      ultimoAguacero = J.dia;
      aguacerosTemporada++;
      aviso = { animo: "lluvia", texto: FRASE.aguacero() };
    }
  }
  if (!aviso) return false;
  if (!aviso.accion) {
    // solo informa: Pachita lo dice sin parar el tiempo, y no más de un aviso cada 20 días de juego
    if (J.dia - ultimoInfo < 20) return false;
    ultimoInfo = J.dia;
    decir(aviso.texto, aviso.animo);
    return false;
  }
  hablarAviso(aviso);
  return true;
}

/** El tiempo se detiene mientras Pachita habla. Si pide una acción, espera a que se haga (el globo queda a la vista y el botón late);
 *  si solo cuenta algo, el play sigue solo apenas termina. */
function hablarAviso(a: Aviso) {
  const venia = !!auto || autoPendiente;
  autoPendiente = !a.accion && venia;
  detenerAuto();
  if (a.accion) {
    esperando = { accion: a.accion, venia };
    pintarControles();
    decir(a.texto, a.animo, { fijo: true });
    return;
  }
  esperando = null;
  const hablando = decir(a.texto, a.animo);
  const mio = turnoActual();
  pintarControles();
  hablando.then(() => { if (turnoActual() === mio && autoPendiente) { autoPendiente = false; iniciarAuto(); } });
}

/** Play / pausa. Si el play estaba esperando a Pachita, tocarlo lo cancela. */
function alternarAuto() {
  if (autoPendiente) { autoPendiente = false; pintarControles(); return; }
  esperando = null;
  iniciarAuto();
}

/** El mes de hoy es de los que "faltan agua" (rojo) para el cultivo principal. */
function mesSeco(hoy: Dia): boolean {
  const c = cicloPrincipal();
  if (!c) return false;
  const k = c.meses.findIndex((m) => m.slice(0, 3) === MESES_CORTOS[Number(hoy.fecha.slice(5, 7)) - 1]);
  return k >= 0 && c.estado_mes[k] === "rojo";
}
let ultimoAguacero = -99;
/** Play: el cultivo más largo termina en 10 segundos como mucho (un paso cada 100 ms). */
function iniciarAuto() {
  if (auto) { detenerAuto(); return; }
  if (!J.sembrado || todoCosechado()) return;
  autoPendiente = false;
  if (esperando?.accion === "regar") { esperando = null; pintarControles(); }
  $("#btn-auto").innerHTML = ic("pausa");
  const largo = Math.max(1, ...J.parcelas.map((p, i) => (p.crop && !p.cosechada && ciclos.has(i) ? ciclos.get(i)!.dias.length : 0)));
  const porPaso = Math.max(1, Math.ceil(largo / 100));
  auto = window.setInterval(() => avanzar(porPaso), 100);
}
function detenerAuto() { if (auto) { clearInterval(auto); auto = null; } const b = document.querySelector("#btn-auto"); if (b) b.innerHTML = ic(autoPendiente ? "pausa" : "play"); }

async function regar() {
  if (!J.sembrado) { decir(t("Primero siembra y empieza a crecer.", "First plant and let it start growing.")); return; }
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
  const pidio = esperando?.accion === "regar", reanudar = pidio && esperando!.venia;
  if (pidio) { esperando = null; pintarControles(); }
  const hablando = !regadas.length
    ? decir(J.tanque <= 0 ? t("El tanque está vacío. Hay que esperar la lluvia.", "The tank is empty. We have to wait for rain.") : t("La tierra todavía está húmeda. No hace falta regar.", "The soil is still moist. No need to water."))
    : (sonido.riego(), decir(t(`Regamos la ${regadas[0]} con ${agua(gastado)} de agua. Ahora la tierra está húmeda y las raíces pueden beber.`, `We watered the ${regadas[0]} with ${agua(gastado)} of water. Now the soil is moist and the roots can drink.`)));
  if (reanudar) {   // Pachita pidió regar: cuando termina de contestar, el tiempo sigue solo
    autoPendiente = true;
    pintarControles();
    const mio = turnoActual();
    hablando.then(() => { if (turnoActual() === mio && autoPendiente) { autoPendiente = false; iniciarAuto(); } });
  }
}

// ---------------------------------------------------------------- 9. cosecha
function tocarParcela(i: number) {
  const p = J.parcelas[i];
  if (vista(i).lista && !p.cosechada) { cosechar([p.crop!]); return; }
  if (!J.sembrado) { if (J.paso === "sembrar" || J.paso === "agua") sembrar(i); else seguirHistoria(); return; }
  if (!p.crop || p.cosechada) { decir(t("Esta parcela está vacía.", "This plot is empty.")); return; }
  const c = ciclos.get(i)!;
  const d = c.dias[Math.min(J.dia, c.dias.length - 1)];
  const h = Math.round(d.humedad * 100);
  const et = ETAPA_TXT[d.etapa] || [d.etapa, d.etapa];
  decir(t(`${cap(nombreCorto(p.crop))}: ${et[0].toLowerCase()}. La tierra tiene ${h} de cada 100 partes del agua que puede guardar${h < 30 ? ": está muy seca, ¡riégala!" : h < 60 ? ": todavía aguanta." : ": está bien húmeda."}`,
    `${cap(nombreCorto(p.crop))}: ${et[1].toLowerCase()}. The soil holds ${h} out of every 100 parts of the water it can store${h < 30 ? ": it's very dry, water it!" : h < 60 ? ": it can still hold on." : ": it's nicely moist."}`));
}

type Cosecha = { id: string; n: number; puntaje: number; estrellas: number; secos: number; dias: number; calor: number; anio: number;
  veredicto: string; en_epoca: boolean; epoca: string | null };
/** Las semillas distintas que ya están listas (una tarjeta de cosecha por semilla, no por parcela). */
const semillasListas = () => [...new Set(listas().map((i) => J.parcelas[i].crop!))];
let cosechando = false;

/** Cosecha animada: la guadaña siega dos veces cada parcela de cada parcela, saltan terrones, las plantas salen del suelo y los cultivos vuelan
 *  en arco hasta la canasta, que rebota y cuenta lo recogido. `alImpacto` se llama en el segundo golpe (cuando la planta sale). */
async function animarCosecha(indices: number[], cultivo: (i: number) => string, alImpacto: (i: number) => void) {
  const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const capa = document.createElement("div");
  capa.className = "capa-cosecha";
  capa.setAttribute("aria-hidden", "true");
  const total = indices.length * 5;
  capa.innerHTML = `<div class="cesta-cosecha">${ic("cesta")}<b>0</b></div>`;
  document.body.appendChild(capa);
  const cesta = capa.querySelector<HTMLElement>(".cesta-cosecha")!, cuenta = cesta.querySelector("b")!;
  let n = 0;
  const llego = () => { cuenta.textContent = String(++n); cesta.classList.remove("rebota"); void cesta.offsetWidth; cesta.classList.add("rebota"); };
  sonido.cosecha();
  const paso = quieto ? 0.05 : 0.16;
  indices.forEach((i, k) => {
    const pos = mundo?.posicion(i) ?? { x: innerWidth / 2, y: innerHeight / 2 };
    const retraso = k * paso;
    const g = document.createElement("div");
    g.className = "hoz-anim";
    g.style.left = `${pos.x}px`;
    g.style.top = `${pos.y}px`;
    g.style.setProperty("--retraso", `${retraso}s`);
    g.innerHTML = ic("hoz", "ic-hoz");
    capa.appendChild(g);
    // terrones en cada golpe (a 0,32 s y a 0,68 s)
    const golpe = document.createElement("div");
    golpe.className = "punto-golpe";
    golpe.style.left = `${pos.x}px`;
    golpe.style.top = `${pos.y}px`;
    golpe.innerHTML = [0.32, 0.68].map((h) => Array.from({ length: 6 }, (_, j) =>
      `<i class="terron paja" style="--dx:${(j - 2.5) * 15}px;--dy:${-26 - (j % 3) * 16}px;--giro:${(j - 2.5) * 50}deg;animation-delay:${retraso + h}s"></i>`).join("")).join("");
    capa.appendChild(golpe);
    // al segundo golpe la planta sale y los cultivos vuelan a la canasta
    setTimeout(() => {
      alImpacto(i);
      const meta = cesta.getBoundingClientRect();
      const mx = meta.left + meta.width / 2, my = meta.top + meta.height / 2;
      const mas = document.createElement("div");
      mas.className = "mas-uno";
      mas.textContent = "+5";
      mas.style.left = `${pos.x}px`;
      mas.style.top = `${pos.y - 20}px`;
      capa.appendChild(mas);
      for (let j = 0; j < 5; j++) {
        const f = document.createElement("img");
        f.className = "vuela-cultivo";
        f.src = urlIcono(cultivo(i));
        f.alt = "";
        const ox = pos.x + (j - 2) * 14, oy = pos.y - 6 - (j % 2) * 8;
        f.style.left = `${ox - 22}px`;
        f.style.top = `${oy - 22}px`;
        capa.appendChild(f);
        const dx = mx - ox, dy = my - oy, alto = -90 - Math.random() * 60;
        const anim = f.animate([
          { transform: "translate(0, 0) scale(.3) rotate(0deg)", opacity: 0 },
          { transform: `translate(${dx * 0.18}px, ${alto * 0.55}px) scale(1.15) rotate(-14deg)`, opacity: 1, offset: 0.22 },
          { transform: `translate(${dx * 0.55}px, ${alto}px) scale(1) rotate(10deg)`, opacity: 1, offset: 0.55 },
          { transform: `translate(${dx}px, ${dy}px) scale(.45) rotate(0deg)`, opacity: 0.95 },
        ], { duration: quieto ? 300 : 950, delay: j * 70, easing: "cubic-bezier(.3,.6,.4,1)", fill: "forwards" });
        anim.onfinish = () => { f.remove(); llego(); };
      }
    }, (quieto ? 150 : 700) + retraso * 1000);
  });
  await espera((quieto ? 700 : 2000) + indices.length * paso * 1000 + 400);
  cesta.classList.add("sale");
  await espera(250);
  void total;
  capa.remove();
}

/** Cosecha todas las parcelas listas de las semillas dadas. Muestra una sola tarjeta por semilla. */
async function cosechar(ids: string[]) {
  if (cosechando) return;
  const idx = listas().filter((i) => ids.includes(J.parcelas[i].crop!));
  if (!idx.length) return;
  cosechando = true;
  esperando = null;
  autoPendiente = false;
  detenerAuto();
  cerrarPanel();
  decir(t("¡A cosechar con la guadaña!", "Time to harvest with the sickle!"));
  await animarCosecha(idx, (i) => J.parcelas[i].crop!, (i) => mundo?.cosechar(i));
  const cola: Cosecha[] = [];
  for (const id of ids) {
    const is = idx.filter((i) => J.parcelas[i].crop === id);
    if (!is.length) continue;
    const cs = is.map((i) => ciclos.get(i)!);
    const media = (f: (c: Ciclo) => number) => cs.reduce((acc, c) => acc + f(c), 0) / cs.length;
    const puntaje = Math.round(media((c) => c.puntaje));
    const estrellas = puntaje >= 85 ? 3 : puntaje >= 60 ? 2 : 1;
    is.forEach((i) => {
      const p = J.parcelas[i], c = ciclos.get(i)!;
      p.cosechada = true;
      p.puntaje = c.puntaje;
      p.historial.push(p.crop!);
      if (p.crop !== "descanso") { J.cosechas++; J.puntajes.push(c.puntaje); }
      const fams = p.historial.filter((x) => x !== "descanso").slice(-3).map((x) => cultivos.get(x)?.familia);
      if (fams.length === 3 && new Set(fams).size === 3) ganar("rotacion");
    });
    if (id !== "descanso") { ganar("primera"); if (estrellas === 3) ganar("agua"); }
    cola.push({ id, n: is.length, puntaje, estrellas, secos: Math.round(media((c) => c.dias_secos)), dias: cs[0].dias.length,
      calor: cs[0].dias.filter((x) => x.calor).length, anio: cs[0].anio, veredicto: cs[0].veredicto, en_epoca: cs[0].en_epoca, epoca: cs[0].epoca });
  }
  cosechando = false;
  guardarTodo();
  setTimeout(pintarMundo, 900);
  pintarControles();
  mostrarCosechas(cola, 0);
}

function mostrarCosechas(cola: Cosecha[], k: number) {
  const c = cola[k], nom = nombreCorto(c.id);
  const msg = c.puntaje >= 85 ? t("¡Excelente cosecha! Cuidaste muy bien el agua.", "Excellent harvest! You took great care of the water.")
    : c.puntaje >= 60 ? t("Buena cosecha. En algunos días le faltó agua.", "Good harvest. On some days it lacked water.")
    : t("La planta pasó sed. La próxima vez riega cuando la tierra esté seca.", "The plant went thirsty. Next time water when the soil is dry.");
  const ep = epocaTexto(cultivos.get(c.id)?.meses, c.epoca);
  const epoca = c.en_epoca ? "" : t(` Sembraste fuera de época: aquí se siembra ${ep}.`, ` You planted out of season: here it is planted in ${ep}.`);
  const hay = k + 1 < cola.length;
  abrirPanel(t("¡Cosecha!", "Harvest!"), `<div class="cosecha">
    <div class="cosecha-icono">${icono(c.id, "icono-grande")}</div>
    <p class="cosecha-titulo">${c.n > 1 ? t(`${c.n} parcelas de ${esc(nom)}`, `${c.n} plots of ${esc(nom)}`) : t(`1 parcela de ${esc(nom)}`, `1 plot of ${esc(nom)}`)}</p>
    <div class="estrellas">${ic("estrella").repeat(c.estrellas)}${ic("estrellaVacia").repeat(3 - c.estrellas)}</div>
    <p class="grande"><b>${c.puntaje}</b> ${t("puntos", "points")}${c.n > 1 ? ` <small>${t("(promedio de las parcelas)", "(average of the plots)")}</small>` : ""}</p>
    <p>${esc(msg + epoca)}</p>
    <p class="veredicto">${t("En los años de la NASA, para este mes:", "In the NASA years, for this month:")} <b>${veredicto(c.veredicto)}</b></p>
    <p class="fuente">${t(`Días con sed: ${c.secos} de ${c.dias} · días de calor: ${c.calor} · año ${c.anio} de NASA POWER`, `Thirsty days: ${c.secos} of ${c.dias} · hot days: ${c.calor} · NASA POWER year ${c.anio}`)}</p>
    <button class="btn-juego grande" data-ok>${btn("pulgar", hay ? t("Siguiente cosecha", "Next harvest") : t("Seguir", "Continue"))}</button></div>`, "centro");
  $("[data-ok]").addEventListener("click", () => {
    cerrarPanel();
    if (hay) setTimeout(() => mostrarCosechas(cola, k + 1), 250);
    else if (todoCosechado()) { paso("rotacion"); rotarTierra(); }
    else pintarControles();
  });
  decir(msg + epoca, c.puntaje >= 60 ? "feliz" : "preocupada");
}

// ---------------------------------------------------------------- 10. rotación: 3 combinaciones que nutren la tierra
async function leccionRotacion() {
  const ultimo = J.crop || [...J.parcelas].reverse().find((p) => p.crop)?.crop;
  if (!ultimo || !J.mes) { abrirFamilias(); return; }
  const titulo = t("Rotar para cuidar la tierra", "Rotate to care for the soil");
  abrirPanel(titulo, `<div class="cargando-mundo chico"><div class="girar"></div></div>`);
  let rots: any[] = [];
  try {
    const cu = await conCarga(t("Calculando tus rotaciones…", "Working out your rotations…"), () => consultar("cultivo", { crop: ultimo, mes: J.mes }));
    rots = cu.rotaciones || [];
    rots.forEach((r: any) => r.pasos.forEach((s: any) => cultivos.set(s.id, { ...cultivos.get(s.id), ...s })));
  } catch { /* sin señal: queda la lección */ }
  // la API manda el nombre de la leguminosa en español: se busca su id para mostrarlo en el idioma actual
  const nombreLeg = (n: string) => { const id = [...cultivos.values()].find((c) => c.nombre.toLowerCase() === n.toLowerCase())?.id; return id ? nombreCultivo(id) : n; };
  const p = abrirPanel(titulo, `
    <div class="leccion">${ic("foco", "ic-leccion")}<div>${t(
      "<b>¿Por qué rotar?</b> Si siembras siempre lo mismo, la tierra se cansa: pierde nitrógeno, se llena de plagas y la lluvia se la lleva. Al cambiar de familia y sembrar leguminosas, el suelo se recupera.",
      "<b>Why rotate?</b> If you always plant the same thing, the soil gets tired: it loses nitrogen, fills with pests and the rain carries it away. By changing family and planting legumes, the soil recovers.")}</div></div>
    <section class="nitro">
      <h3>${ic("nitrogeno", "ic-linea")} ${t("El secreto de las leguminosas", "The secret of legumes")}</h3>
      <ol class="nitro-pasos">
        <li><div class="nitro-dibujo aire"><span>N</span><span>N</span><span>N</span></div><b>${t("1. El aire", "1. The air")}</b><p>${t("tiene mucho nitrógeno, pero las plantas no lo pueden comer directo.", "has lots of nitrogen, but plants can't eat it directly.")}</p></li>
        <li><div class="nitro-dibujo">${icono("fijadores", "icono-nitro")}</div><b>${t("2. Las raíces", "2. The roots")}</b><p>${t("de haba, chocho, fréjol o vicia tienen bolitas (nódulos) con bacterias que lo atrapan.", "of fava bean, lupin, bean or vetch have little balls (nodules) with bacteria that trap it.")}</p></li>
        <li><div class="nitro-dibujo">${icono("papa", "icono-nitro")}</div><b>${t("3. El abono queda", "3. The fertilizer stays")}</b><p>${t("en la tierra: la papa o el maíz que siembras después crecen más verdes.", "in the soil: the potato or corn you plant afterwards grows greener.")}</p></li>
      </ol>
    </section>
    <div class="medidor"><span>${t("Salud de tu tierra", "Your soil's health")}</span><div class="barra"><i style="width:${J.salud}%;background:${colorSuelo(J.salud)}"></i></div><b>${J.salud}</b></div>
    <h3>${t("Pachita te recomienda 3 rotaciones", "Pachita recommends 3 rotations")}</h3>
    <div class="rotaciones">${rots.slice(0, 3).map((r, k) => `<article class="rotacion">
      <p class="rot-titulo">${t("Opción", "Option")} ${k + 1}${r.leguminosa ? ` · ${ic("nitrogeno", "ic-linea")} ${conLeguminosa(nombreLeg(r.leguminosa).toLowerCase())}` : ""}</p>
      <div class="rot-pasos">${r.pasos.map((s: any, j: number) => `${j ? '<span class="flecha">→</span>' : ""}<span class="rot-paso">${icono(s.id, "icono-mini")}<b>${esc(nombreDe(s.id, s.nombre))}</b><small>${t("desde", "from")} ${esc(mesApi(s.desde))}</small></span>`).join("")}</div>
      ${r.repite_familia ? `<p class="malo">${ic("alerta", "ic-linea")} ${t("Repite una familia", "Repeats a family")}</p>` : `<p class="bueno">${ic("check", "ic-linea")} ${t("Cambia de familia en cada paso", "Changes family at every step")}</p>`}
      <button class="btn-juego" data-rot="${k}">${t("Elegir esta", "Choose this one")}</button></article>`).join("") || `<p>${t("No pude traer las rotaciones. Revisa la señal.", "I couldn't get the rotations. Check your signal.")}</p>`}</div>
    <p class="fuente">${t("Rotaciones calculadas con los datos de tu parcela (NASA POWER, FAO-56) y el calendario del INIAP. La salud de la tierra son puntos del juego.",
      "Rotations computed with your plot's data (NASA POWER, FAO-56) and the INIAP calendar. Soil health is game points.")}</p>`);
  p.querySelectorAll<HTMLButtonElement>("[data-rot]").forEach((b) => b.addEventListener("click", () => {
    J.rotacion = rots[Number(b.dataset.rot)].pasos.map((s: any) => s.id);
    J.rotPaso = 0;   // el primer cultivo de la rotación es el que acabas de cosechar
    paso("certificado");
    certificado();
  }));
  decirVarias([
    t("Las plantas necesitan nitrógeno para crecer verdes y fuertes, como nosotros necesitamos comida. Si siembras papa tras papa, la tierra se queda sin nitrógeno y se llena de plagas.",
      "Plants need nitrogen to grow green and strong, just like we need food. If you plant potato after potato, the soil runs out of nitrogen and fills with pests."),
    t("El aire está lleno de nitrógeno, pero las plantas no lo pueden comer. Las leguminosas, como el haba, el chocho y el fréjol, tienen en sus raíces bolitas con bacterias amigas que lo atrapan.",
      "The air is full of nitrogen, but plants can't eat it. Legumes, like fava beans, lupin and beans, have little balls with friendly bacteria in their roots that trap it."),
    t("Cuando cosechas, esas raíces se quedan en la tierra como abono natural. Por eso, después de una leguminosa, la papa o el maíz crecen mejor. ¡Eso es rotar! Elige una de estas tres rotaciones.",
      "When you harvest, those roots stay in the soil as natural fertilizer. That's why after a legume, potato or corn grow better. That's rotating! Choose one of these three rotations."),
  ]);
}

/** Posición del cultivo actual dentro de la rotación elegida (0 = el primero). */
const rotPaso = () => J.rotPaso ?? 0;
/** El cultivo que sigue en la rotación elegida, o null si ya se terminó (o no hay rotación). */
function rotacionPendiente(): { id: string; k: number; n: number } | null {
  if (!J.rotacion || J.rotacion.length < 2) return null;
  const k = rotPaso() + 1;
  return k < J.rotacion.length ? { id: J.rotacion[k], k, n: J.rotacion.length } : null;
}
const nombreCultivo = (id: string) => nombreDe(id, cultivos.get(id)?.nombre || id);

/** Al terminar la cosecha: sigue la rotación elegida; si no hay (o ya terminó), enseña a elegir una. */
function rotarTierra() {
  if (rotacionPendiente()) siguienteRotacion();
  else if (J.rotacion && J.rotacion.length > 1) rotacionCompleta();
  else leccionRotacion();
}

/** Los pasos de la rotación elegida con lo que ya se hizo. */
function tiraRotacion(): string {
  const cur = rotPaso();
  const hecho = (k: number) => k < cur || (k === cur && J.sembrado && todoCosechado());
  return `<div class="rot-pasos grande">${(J.rotacion || []).map((id, k) => `${k ? '<span class="flecha">→</span>' : ""}<span class="rot-paso ${hecho(k) ? "hecho" : k === cur ? "ahora" : "luego"}">
    ${icono(id, "icono-mini")}<b>${esc(nombreCultivo(id))}</b><small>${hecho(k) ? t("✓ hecho", "✓ done") : k === cur ? t("ahora", "now") : t("sigue", "next")}</small></span>`).join("")}</div>`;
}

/** Tu rotación continúa: se muestra el paso siguiente y se siembra con un toque. */
function siguienteRotacion() {
  const pend = rotacionPendiente();
  if (!pend) { rotacionCompleta(); return; }
  const previo = cultivos.get(J.rotacion![rotPaso()]), nuevoC = cultivos.get(pend.id);
  const razon = previo?.fija_n ? t("Lo que cosechaste dejó nitrógeno en la tierra: ahora crecerá más verde.", "What you harvested left nitrogen in the soil: the next crop will grow greener.")
    : previo && nuevoC && previo.familia !== nuevoC.familia ? t("Cambia de familia: así se cortan las plagas y la tierra descansa.", "It changes family: that breaks pest cycles and lets the soil rest.") : "";
  abrirPanel(t("Sigue tu rotación", "Your rotation continues"), `
    <div class="leccion">${ic("rotar", "ic-leccion")}<div><b>${t(`Paso ${pend.k + 1} de ${pend.n}`, `Step ${pend.k + 1} of ${pend.n}`)}:</b>
      ${t(`la rotación que elegiste sigue con ${esc(nombreCultivo(pend.id).toLowerCase())}.`, `the rotation you chose continues with ${esc(nombreCultivo(pend.id).toLowerCase())}.`)} ${razon}</div></div>
    ${tiraRotacion()}
    <div class="fila-botones"><button class="btn-juego grande" data-sembrar-rot>${btn("semilla", t(`Sembrar ${nombreCultivo(pend.id).toLowerCase()}`, `Plant ${nombreCultivo(pend.id).toLowerCase()}`))}</button></div>
    <div class="fila-botones"><button class="btn-juego borde" data-otra>${btn("rotar", t("Elegir otra rotación", "Choose another rotation"))}</button></div>`, "centro");
  $("[data-sembrar-rot]").addEventListener("click", nuevaTemporada);
  $("[data-otra]").addEventListener("click", () => { J.rotacion = null; J.rotPaso = 0; guardarTodo(); leccionRotacion(); });
  decir(t(`¡Muy bien! Tu rotación sigue con ${nombreCultivo(pend.id).toLowerCase()}, paso ${pend.k + 1} de ${pend.n}. ${razon} Toca Sembrar para continuar.`,
    `Well done! Your rotation continues with ${nombreCultivo(pend.id).toLowerCase()}, step ${pend.k + 1} of ${pend.n}. ${razon} Tap Plant to continue.`));
}

/** Se cosechó el último cultivo de la rotación elegida. */
function rotacionCompleta() {
  abrirPanel(t("¡Rotación completa!", "Rotation complete!"), `
    <div class="leccion">${ic("medalla", "ic-leccion")}<div><b>${t("¡Lo lograste!", "You did it!")}</b> ${t("Sembraste y cosechaste toda la rotación: la tierra descansó, se alimentó y las plagas no se repitieron.", "You planted and harvested the whole rotation: the soil rested, was fed and pests did not repeat.")}</div></div>
    ${tiraRotacion()}
    <div class="medidor"><span>${t("Salud de tu tierra", "Your soil's health")}</span><div class="barra"><i style="width:${J.salud}%;background:${colorSuelo(J.salud)}"></i></div><b>${J.salud}</b></div>
    <div class="fila-botones"><button class="btn-juego grande" data-cert>${btn("medalla", t("Ver mi certificado", "See my certificate"))}</button></div>
    <div class="fila-botones"><button class="btn-juego borde" data-otra>${btn("rotar", t("Elegir una rotación nueva", "Choose a new rotation"))}</button></div>`, "centro");
  $("[data-cert]").addEventListener("click", () => { paso("certificado"); certificado(); });
  $("[data-otra]").addEventListener("click", () => { J.rotacion = null; J.rotPaso = 0; guardarTodo(); leccionRotacion(); });
  decir(t("¡Completaste toda la rotación! Mira cómo mejoró la salud de tu tierra. Ya puedes ver tu certificado o elegir una rotación nueva.",
    "You completed the whole rotation! See how your soil's health improved. You can now see your certificate or choose a new rotation."));
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

/** El certificado se dibuja apaisado en pantallas anchas y vertical en celulares, para que llene toda la pantalla. */
const certificadoVertical = () => innerHeight > innerWidth * 1.05;

function svgCertificado(vertical = certificadoVertical()): string {
  const prom = J.puntajes.length ? Math.round(J.puntajes.reduce((acc, x) => acc + x, 0) / J.puntajes.length) : 0;
  const hoy = new Date();
  const rot = (J.rotacion || []).map((id) => nombreCultivo(id));
  const W = vertical ? 560 : 800, Hh = vertical ? 800 : 560, cx = W / 2;
  const mes = nombreMes(hoy.getMonth());
  const fechaTxt = t(`${hoy.getDate()} de ${mes} de ${hoy.getFullYear()}`, `${mes} ${hoy.getDate()}, ${hoy.getFullYear()}`);
  // estrellas solo en los bordes de la banda: nunca encima del título ni del subtítulo
  const libre = (x: number, y: number) => vertical ? !(x > 50 && x < 480 && y > 50 && y < 162) : !(x > 120 && x < 660 && y > 42 && y < 118);
  const estrellas = Array.from({ length: 60 }, (_, k) => [(k * 97) % (W - 60) + 30, (k * 53) % (vertical ? 112 : 78) + 32, 1 + (k % 3)])
    .filter(([x, y]) => libre(x, y)).slice(0, 22)
    .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity=".8"/>`).join("");
  const medallas = (y: number) => J.medallas.map((m, k, todas) => icG(MEDALLAS[m]?.icono || "medalla", cx - todas.length * 20 + k * 40, y, 34)).join("");
  const nombreTam = Math.max(24, Math.min(vertical ? 46 : 44, (vertical ? 470 : 700) / (Math.max(J.granja.length, 1) * 0.56)));
  const pie = t("Datos: NASA POWER, FAO-56, INIAP", "Data: NASA POWER, FAO-56, INIAP");
  const cohete = (x: number) => `<g transform="translate(${x} 30) scale(.42)">${COHETE.replace('class="cohete-svg"', 'width="120" height="200"')}</g>`;
  const cabeza = vertical
    ? `<path d="M24 40 Q24 24 40 24 H520 Q536 24 536 40 V170 H24 Z" fill="#1d3b6a"/>${estrellas}${cohete(452)}
       <text x="${cx - 24}" y="82" text-anchor="middle" font-size="26" font-weight="900" fill="#fff">${t("CERTIFICADO DE", "CERTIFICATE OF")}</text>
       <text x="${cx - 24}" y="120" text-anchor="middle" font-size="36" font-weight="900" fill="#fff">${t("GRANJERO CÓSMICO", "COSMIC FARMER")}</text>
       <text x="${cx}" y="152" text-anchor="middle" font-size="15" fill="#ffd34d">Astro Granja · NASA Space Apps 2026</text>`
    : `<path d="M24 40 Q24 24 40 24 H760 Q776 24 776 40 V124 H24 Z" fill="#1d3b6a"/>${estrellas}${cohete(712)}
       <text x="380" y="80" text-anchor="middle" font-size="31" font-weight="900" fill="#fff">${t("CERTIFICADO DE GRANJERO CÓSMICO", "COSMIC FARMER CERTIFICATE")}</text>
       <text x="380" y="108" text-anchor="middle" font-size="16" fill="#ffd34d">Astro Granja · NASA Space Apps 2026</text>`;
  const frase = t("aprendió a sembrar, regar con datos de la NASA y rotar para cuidar la tierra.", "learned to plant, to water with NASA data and to rotate crops to care for the land.");
  const partes = vertical ? frase.split(/(?<=,)\s|\s(?=y rotar|and to rotate)/).slice(0, 3) : [frase];
  const estad = [[t("Cosechas", "Harvests"), J.cosechas], [t("Puntaje promedio", "Average score"), prom], [t("Salud de la tierra", "Soil health"), J.salud]];
  const cuerpo = vertical
    ? `<text x="${cx}" y="236" text-anchor="middle" font-size="20" fill="#5b4a3a">${t("Pachita certifica que la granja", "Pachita certifies that the farm")}</text>
       <text x="${cx}" y="296" text-anchor="middle" font-size="${nombreTam}" font-weight="900" fill="#2e7d4f">${esc(J.granja)}</text>
       ${partes.map((x, k) => `<text x="${cx}" y="${340 + k * 26}" text-anchor="middle" font-size="18" fill="#3b2a1a">${esc(x)}</text>`).join("")}
       ${estad.map(([n, v], k) => `<text x="${cx}" y="${434 + k * 32}" text-anchor="middle" font-size="21" fill="#3b2a1a">${n}: <tspan font-weight="900">${v}</tspan></text>`).join("")}
       ${rot.length ? `<text x="${cx}" y="548" text-anchor="middle" font-size="16" fill="#5b4a3a">${t("Rotación elegida", "Chosen rotation")}:</text>
         <text x="${cx}" y="572" text-anchor="middle" font-size="${Math.min(18, 500 / Math.max(rot.join(" → ").length * 0.55, 1))}" font-weight="800" fill="#2e7d4f">${esc(rot.join(" → "))}</text>` : ""}
       ${medallas(588)}`
    : `<text x="400" y="172" text-anchor="middle" font-size="20" fill="#5b4a3a">${t("Pachita certifica que la granja", "Pachita certifies that the farm")}</text>
       <text x="400" y="222" text-anchor="middle" font-size="${nombreTam}" font-weight="900" fill="#2e7d4f">${esc(J.granja)}</text>
       <text x="400" y="262" text-anchor="middle" font-size="18" fill="#3b2a1a">${esc(frase)}</text>
       <text x="400" y="306" text-anchor="middle" font-size="19" fill="#3b2a1a">${estad.map(([n, v]) => `${n}: <tspan font-weight="900">${v}</tspan>`).join("  ·  ")}</text>
       ${rot.length ? `<text x="400" y="346" text-anchor="middle" font-size="17" fill="#5b4a3a">${t("Rotación elegida", "Chosen rotation")}: <tspan font-weight="800" fill="#2e7d4f">${esc(rot.join(" → "))}</tspan></text>` : ""}
       ${medallas(360)}`;
  // la mano de la ilustración llega justo al borde derecho: un desvanecido corto evita el corte recto
  const pw = vertical ? 96 : 104, ph = vertical ? 207 : 224;
  const pachita = pachitaDatos ? `<defs><linearGradient id="pFade" x1="0" x2="1"><stop offset=".9" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <mask id="pMask" maskContentUnits="userSpaceOnUse"><rect width="${pw}" height="${ph}" fill="url(#pFade)"/></mask></defs>
    <image href="${pachitaDatos}" width="${pw}" height="${ph}" mask="url(#pMask)"/>
    <text x="${pw - 4}" y="${ph - 4}" text-anchor="end" font-size="9" font-weight="900" fill="#fff" stroke="#3b2a1a" stroke-width="2" paint-order="stroke">IA</text>` : "";
  const firma = vertical
    ? `<g transform="translate(46 552)">${pachita}</g>
       <line x1="290" y1="716" x2="508" y2="716" stroke="#3b2a1a" stroke-width="1.5"/>
       <text x="399" y="708" text-anchor="middle" font-size="28" font-style="italic" fill="#2b4a7a">Pachita</text>
       <text x="399" y="738" text-anchor="middle" font-size="14" fill="#5b4a3a">${t("Granjera de la sierra", "Highland farmer")}</text>
       <text x="${W - 30}" y="772" text-anchor="end" font-size="12" fill="#8a7a6a">${fechaTxt} · ${pie}</text>`
    : `<g transform="translate(62 296)">${pachita}</g>
       <line x1="520" y1="482" x2="720" y2="482" stroke="#3b2a1a" stroke-width="1.5"/>
       <text x="620" y="474" text-anchor="middle" font-size="26" font-style="italic" fill="#2b4a7a">Pachita</text>
       <text x="620" y="502" text-anchor="middle" font-size="14" fill="#5b4a3a">${t("Granjera de la sierra", "Highland farmer")}</text>
       <text x="400" y="528" text-anchor="middle" font-size="13" fill="#8a7a6a">${fechaTxt} · ${pie}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${Hh}" class="certificado-svg${vertical ? " vertical" : ""}" data-w="${W}" data-h="${Hh}" font-family="Nunito, Arial, sans-serif">
    <rect width="${W}" height="${Hh}" rx="28" fill="#fffaf0"/>
    ${cabeza}
    <rect x="12" y="12" width="${W - 24}" height="${Hh - 24}" rx="22" fill="none" stroke="#e6b33a" stroke-width="6"/>
    <rect x="24" y="24" width="${W - 48}" height="${Hh - 48}" rx="16" fill="none" stroke="#2e7d4f" stroke-width="2" stroke-dasharray="8 6"/>
    ${cuerpo}
    ${firma}
  </svg>`;
}

async function certificado() {
  ganar("cosmico");
  await cargarPachitaDatos();
  const p = abrirPanel(t("¡Eres Granjero Cósmico!", "You are a Cosmic Farmer!"), `<div class="certificado">${svgCertificado()}</div>
    <div class="fila-botones"><button class="btn-juego" data-bajar>${btn("descargar", t("Descargar", "Download"))}</button>
      ${rotacionPendiente() ? `<button class="btn-juego borde" data-seguir>${btn("semilla", t("Sembrar la rotación", "Plant the rotation"))}</button>` : ""}
      <button class="btn-juego borde" data-nueva>${btn("cohete", t("Nueva granja", "New farm"))}</button></div>`, "certificado-panel");
  lanzarConfeti();
  decir(t(`¡Felicitaciones, granja ${J.granja}! Aprendiste a leer los datos de la NASA, a regar cuando la tierra tiene sed y a rotar con leguminosas. Ganaste el certificado de Granjero Cósmico. ¡La tierra te lo agradece!`,
    `Congratulations, farm ${J.granja}! You learned to read NASA data, to water when the soil is thirsty and to rotate with legumes. You won the Cosmic Farmer certificate. The land thanks you!`));
  p.querySelector("[data-bajar]")!.addEventListener("click", descargarCertificado);
  p.querySelector("[data-seguir]")?.addEventListener("click", nuevaTemporada);
  p.querySelector("[data-nueva]")!.addEventListener("click", reiniciar);
}

function descargarCertificado() {
  const vertical = certificadoVertical();
  const w = vertical ? 1120 : 1600, h = vertical ? 1600 : 1120;
  const img = new Image();
  img.onload = () => {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    c.getContext("2d")!.drawImage(img, 0, 0, w, h);
    const a = document.createElement("a");
    a.download = `${t("certificado", "certificate")}-${J.granja.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}.png`;
    a.href = c.toDataURL("image/png");
    a.click();
  };
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgCertificado(vertical));
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
  esperando = null;
  autoPendiente = false;
  J.temporada++;
  J.mes = null;
  J.anio = fin ? Number(fin.slice(0, 4)) + (proximo === 1 ? 1 : 0) : J.anio;
  J.dia = 0;
  J.sembrado = false;
  J.parcelas.forEach((p) => { p.crop = null; p.riegos = []; p.cosechada = false; p.puntaje = undefined; });
  const pend = rotacionPendiente();
  const siguiente = pend ? pend.id : null;
  if (pend) J.rotPaso = pend.k;   // ahora toca el paso siguiente de la rotación (no siempre el segundo)
  J.crop = siguiente;
  ciclos.clear();
  try { await cargarSemillas(proximo); } catch { /* se reintenta luego */ }
  pintarMundo();
  pintarControles();
  if (siguiente && cultivos.get(siguiente)?.apto !== false) {
    paso("calendario");
    abrirCalendario();
    decir(t(`Tu rotación sigue con ${nombreCorto(siguiente)}, paso ${rotPaso() + 1} de ${J.rotacion!.length}. ¡Elige el mes!`, `Your rotation continues with ${nombreCorto(siguiente)}, step ${rotPaso() + 1} of ${J.rotacion!.length}. Choose the month!`));
  } else { paso("semillas"); abrirFamilias(); }
}

function reiniciar() {
  esperando = null;
  autoPendiente = false;
  detenerAuto();
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
  const caja = $("#medalla");
  caja.innerHTML = `<span>${ic(m.icono, "ic-medalla")}</span><div><b>${t(m.nombre, m.nombreEn)}</b><p>${t(m.texto, m.textoEn)}</p></div>`;
  caja.hidden = false;
  caja.classList.remove("aparece"); void caja.offsetWidth; caja.classList.add("aparece");
  setTimeout(() => (caja.hidden = true), 3500);
}

function abrirLogros() {
  abrirPanel(t("Mis medallas", "My medals"), `<div class="medallas">${Object.entries(MEDALLAS).map(([id, m]) =>
    `<div class="medalla-carta ${J.medallas.includes(id) ? "ganada" : ""}"><span>${ic(m.icono, "ic-medalla")}</span><b>${t(m.nombre, m.nombreEn)}</b><p>${t(m.texto, m.textoEn)}</p></div>`).join("")}</div>
    <p class="ayuda">${t("Granja", "Farm")} ${esc(J.granja)} · ${t("cosechas", "harvests")}: ${J.cosechas} · ${t("temporada", "season")} ${J.temporada}</p>
    ${J.paso === "certificado" ? `<button class="btn-juego" data-cert>${btn("medalla", t("Ver mi certificado", "See my certificate"))}</button>` : ""}
    <button class="btn-juego borde" data-reiniciar>${btn("cohete", t("Empezar otra granja", "Start another farm"))}</button>`);
  document.querySelector("[data-cert]")?.addEventListener("click", certificado);
  $("[data-reiniciar]").addEventListener("click", reiniciar);
}

// ---------------------------------------------------------------- HUD y controles
function pintarHud() {
  const lugarTxt = document.querySelector<HTMLElement>("#hud-lugar");
  if (!lugarTxt) return;
  lugarTxt.textContent = J.granja || t("Mi granja", "My farm");
  const hoy = diaActual();
  const lugarNombre = ["Mi chacra", "My farm"].includes(lugar().nombre || "") ? t("Mi chacra", "My farm") : lugar().nombre || "";
  $("#hud-fecha").textContent = hoy ? fecha(hoy.fecha) : J.mes ? t(`Siembra en ${nombreMes(J.mes - 1)}`, `Planting in ${nombreMes(J.mes - 1)}`) : lugarNombre;
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
    sem.innerHTML = c.meses.map((m, k) => `<span class="sem ${c.estado_mes[k]} ${m.slice(0, 3) === mesHoy ? "hoy" : ""}" title="${mesDeApi(m)}">${mesApi(m)}</span>`).join("")
      + `<span class="sem-temp" title="${t("Temperatura máxima de hoy", "Today's maximum temperature")}">${ic("termometro", "ic-mini")} ${num(d.tmax)} °C</span>`;
    sem.innerHTML = `<span class="sem-titulo">${t("Agua por mes", "Water by month")}</span>` + sem.innerHTML;
    sem.hidden = false;
  } else sem.hidden = true;
  pintarCronologia();
  pintarRotHud();
}

// ---------------------------------------------------------------- cronología: cuánto falta para cosechar
const ETAPA_COLOR: Record<string, string> = { "recién sembrado": "#a1887f", creciendo: "#7cb342", "en plena producción": "#f2b705",
  madurando: "#ef8f2e", "listo para cosechar": "#ffc93c", "antes de sembrar": "#d7ccc8" };
const ETAPA_TXT: Record<string, [string, string]> = { "recién sembrado": ["Recién sembrada", "Just planted"], creciendo: ["Creciendo", "Growing"],
  "en plena producción": ["En plena producción", "In full production"], madurando: ["Madurando", "Ripening"],
  "listo para cosechar": ["¡Lista para cosechar!", "Ready to harvest!"], "antes de sembrar": ["Preparando", "Getting ready"] };
const fechaCorta = (iso: string) => { const [, m, d] = iso.split("-").map(Number); return t(`${d} ${mesCorto(m - 1)}`, `${mesCorto(m - 1)} ${d}`); };

/** Una barra por semilla sembrada: las etapas del cultivo, dónde va hoy y cuántos días faltan para la cosecha. */
function pintarCronologia() {
  const caja = $("#cronologia");
  if (!J.sembrado || todoCosechado()) { caja.hidden = true; return; }
  const vistos = new Set<string>();
  const filas: string[] = [];
  J.parcelas.forEach((p, i) => {
    const c = ciclos.get(i);
    if (!p.crop || p.cosechada || !c || vistos.has(p.crop)) return;
    vistos.add(p.crop);
    const n = c.dias.length, d = Math.min(J.dia, n - 1), faltan = n - 1 - d;
    const segs: { e: string; k: number }[] = [];
    c.dias.forEach((x) => { const u = segs[segs.length - 1]; if (u && u.e === x.etapa) u.k++; else segs.push({ e: x.etapa, k: 1 }); });
    const etapa = ETAPA_TXT[c.dias[d].etapa] || [c.dias[d].etapa, c.dias[d].etapa];
    const meses = faltan > 45 ? t(` (unos ${Math.round(faltan / 30)} meses)`, ` (about ${Math.round(faltan / 30)} months)`) : "";
    filas.push(`<button class="crono-fila" type="button" data-crono="${p.crop}">
      <span class="crono-cab">${icono(p.crop, "icono-crono")}<b>${esc(cap(nombreCorto(p.crop)))}</b><span class="crono-etapa">${t(etapa[0], etapa[1])}</span>
        <span class="crono-falta">${faltan > 0 ? t(`Faltan ${num(faltan)} días`, `${num(faltan)} days left`) : t("¡Lista!", "Ready!")}</span></span>
      <span class="crono-barra" style="--p:${(d / Math.max(n - 1, 1)) * 100}%" role="img" aria-label="${t(`Faltan ${faltan} días para cosechar`, `${faltan} days until harvest`)}">
        <span class="crono-segs">${segs.map((x) => `<i style="flex:${x.k};background:${ETAPA_COLOR[x.e] || "#bbb"}"></i>`).join("")}</span><b class="crono-marca"></b></span>
      <span class="crono-pie"><span>${t("Siembra", "Planted")}: ${fechaCorta(c.dias[0].fecha)}</span><span>${t("Cosecha", "Harvest")}: ${fechaCorta(c.dias[n - 1].fecha)}${meses}</span></span></button>`);
  });
  caja.innerHTML = filas.slice(0, 2).join("") +
    `<button class="crono-agua" type="button" data-agua-info>${ic("gota", "ic-chip")} ${t("¿Cuánta agua necesita?", "How much water does it need?")}</button>`;
  caja.hidden = !filas.length;
  caja.querySelectorAll<HTMLButtonElement>("[data-crono]").forEach((b) => b.addEventListener("click", () => {
    const id = b.dataset.crono!, i = J.parcelas.findIndex((p) => p.crop === id && !p.cosechada), c = ciclos.get(i);
    if (!c) return;
    const faltan = c.dias.length - 1 - Math.min(J.dia, c.dias.length - 1);
    decir(faltan > 0 ? t(`La ${nombreCorto(id)} va en la etapa «${(ETAPA_TXT[c.dias[Math.min(J.dia, c.dias.length - 1)].etapa] || ["", ""])[0].toLowerCase()}». Faltan ${num(faltan)} días para cosechar, el ${fecha(c.dias[c.dias.length - 1].fecha)}.`,
        `The ${nombreCorto(id)} is in the "${(ETAPA_TXT[c.dias[Math.min(J.dia, c.dias.length - 1)].etapa] || ["", ""])[1].toLowerCase()}" stage. ${num(faltan)} days left to harvest, on ${fecha(c.dias[c.dias.length - 1].fecha)}.`)
      : t(`¡La ${nombreCorto(id)} ya está lista!`, `The ${nombreCorto(id)} is ready!`));
  }));
  caja.querySelector("[data-agua-info]")?.addEventListener("click", panelAgua);
}

/** La rotación elegida, siempre a la vista: qué se hizo, qué toca ahora y qué sigue. */
/** Nombre corto para la barra de rotación: en español la primera palabra; en inglés el nombre completo sin el paréntesis. */
const nombreChip = (id: string) => (idioma() === "en" ? nombreCultivo(id).replace(/\s*\(.*\)/, "") : nombreCultivo(id).split(" ")[0]);
function pintarRotHud() {
  const caja = $("#rot-hud");
  if (!J.rotacion || J.rotacion.length < 2) { caja.hidden = true; return; }
  const cur = rotPaso();
  caja.innerHTML = `<span class="rot-hud-t">${ic("rotar", "ic-chip")} ${t("Rotación", "Rotation")}</span>` + J.rotacion.map((id, k) => {
    const hecho = k < cur || (k === cur && J.sembrado && todoCosechado());
    return `${k ? '<span class="flecha">›</span>' : ""}<span class="rot-chip ${hecho ? "hecho" : k === cur ? "ahora" : "luego"}" title="${esc(nombreCultivo(id))}">${icono(id, "icono-chip")}<b>${esc(nombreChip(id))}</b>${hecho ? '<i class="visto">✓</i>' : ""}</span>`;
  }).join("");
  caja.hidden = false;
}

function pintarControles() {
  const ctl = $("#tiempo");
  const plantadas = J.parcelas.some((p) => p.crop);
  if (!J.sembrado) {
    if (J.paso === "sembrar" || J.paso === "agua") {
      ctl.innerHTML = `<button class="t ancho" data-todas>${btn("semilla", t("Sembrar todo", "Plant all"))}</button>
        ${plantadas ? `<button class="btn-juego" data-agua>${btn("gota", t("¿Cuánta agua?", "How much water?"))}</button>` : ""}`;
      ctl.querySelector("[data-todas]")!.addEventListener("click", sembrarTodas);
      ctl.querySelector("[data-agua]")?.addEventListener("click", panelAgua);
    } else ctl.innerHTML = "";
  } else if (todoCosechado()) {
    const pend = rotacionPendiente();
    const txt = pend ? t(`Seguir la rotación: ${nombreCorto(pend.id)}`, `Continue the rotation: ${nombreCorto(pend.id)}`)
      : J.rotacion && J.rotacion.length > 1 ? t("Rotación completa", "Rotation complete") : t("Rotar la tierra", "Rotate the soil");
    ctl.innerHTML = `<button class="btn-juego grande" data-rotar>${btn("rotar", txt)}</button>`;
    ctl.querySelector("[data-rotar]")!.addEventListener("click", () => { paso("rotacion"); rotarTierra(); });
  } else if (listas().length && J.dia >= diaFinal()) {
    ctl.innerHTML = `<button class="btn-juego grande" data-cosechar>${btn("hoz", t("Cosechar todo", "Harvest all"))}</button>`;
    ctl.querySelector("[data-cosechar]")!.addEventListener("click", () => cosechar(semillasListas()));
  } else {
    ctl.innerHTML = `${listas().length ? `<button class="t cosechar" data-cosechar aria-label="${t("Cosechar todo", "Harvest all")}">${ic("hoz")}<span>${t("Cosechar todo", "Harvest all")}</span></button>` : ""}
      <button class="t" data-d="1" aria-label="${t("Avanzar un día", "Advance one day")}">${t("+1 día", "+1 day")}</button>
      <button class="t" data-d="7" aria-label="${t("Avanzar una semana", "Advance one week")}">${t("+1 sem", "+1 wk")}</button>
      <button class="t" data-d="30" aria-label="${t("Avanzar un mes", "Advance one month")}">${t("+1 mes", "+1 mo")}</button>
      <button class="t redondo" id="btn-auto" aria-label="${t("Avance automático", "Automatic advance")}">${ic(auto || autoPendiente ? "pausa" : "play")}</button>`;
    ctl.querySelector("[data-cosechar]")?.addEventListener("click", () => cosechar(semillasListas()));
    ctl.querySelectorAll<HTMLButtonElement>("[data-d]").forEach((b) => b.addEventListener("click", () => avanzar(Number(b.dataset.d))));
    $("#btn-auto").addEventListener("click", alternarAuto);
  }
  $("#btn-regar").classList.toggle("pide", esperando?.accion === "regar");
  ctl.querySelector("[data-cosechar]")?.classList.toggle("pide", esperando?.accion === "cosechar");
  pintarHud();
}

async function restaurar() {
  // al volver a la página: recupera los ciclos sembrados (la API los guarda en sessionStorage)
  await Promise.all(J.parcelas.map(async (p, i) => { if (p.crop) { try { await pedirCiclo(i); } catch { /* sin señal */ } } }));
  if (J.sembrado) precargarAvisos();
  try { await cargarSemillas(J.mes ?? (new Date().getMonth() + 1) % 12 + 1); } catch { /* sin señal */ }
  if (!parcelaInfo) { try { parcelaInfo = await consultar("parcela"); } catch { /* sin señal */ } }
}

// ---------------------------------------------------------------- arranque
/** Textos fijos de la página (barra de acciones, HUD y créditos): cada uno trae su español y su inglés. */
function aplicarEstatico() {
  document.documentElement.lang = idioma();
  document.querySelectorAll<HTMLElement>("[data-es]").forEach((el) => { el.textContent = t(el.dataset.es!, el.dataset.en!); });
  document.querySelectorAll<HTMLElement>("[data-aria-es]").forEach((el) => el.setAttribute("aria-label", t(el.dataset.ariaEs!, el.dataset.ariaEn!)));
  document.querySelectorAll<HTMLElement>("[data-title-es]").forEach((el) => el.setAttribute("title", t(el.dataset.titleEs!, el.dataset.titleEn!)));
  document.title = t("Astro Granja", "Astro Farm");
  const hud = $("#idioma");
  hud.innerHTML = `<b>${idioma() === "es" ? "EN" : "ES"}</b>`;
  hud.setAttribute("aria-label", t("Cambiar a inglés", "Switch to Spanish"));
}

/** Cambia entre español e inglés sin perder la partida: se vuelve a dibujar lo que se está viendo. */
function cambiarIdioma() {
  fijarIdioma(idioma() === "es" ? "en" : "es");
  aplicarEstatico();
  callar();   // calla lo que Pachita estaba diciendo en el otro idioma
  if (pantalla === "menu") menuPrincipal();
  else if (pantalla === "nombre") pantallaNombre();
  else if (pantalla === "mapa" && mapaCtl) {
    const c = mapaCtl.centro(), r = mapaCtl.radio();
    mapaCtl.destruir();
    pantallaMapa({ lat: c.lat, lon: c.lng, radio: r });
  } else if (pantalla === "mundo") {
    const abierto = !$("#panel").hidden;
    pintarHud();
    pintarControles();
    if (abierto) seguirHistoria();
    else decir(t("¡Ahora hablamos en español!", "Now we speak English!"));
  }
}

export function arrancar() {
  $("#pachita").innerHTML = PACHITA_SVG;
  document.addEventListener("pointerdown", desbloquearAudio, { once: true });
  $("#silencio").addEventListener("click", () => {
    silenciar(!estaSilenciado());
    $("#silencio").innerHTML = ic(estaSilenciado() ? "mudo" : "sonido");
  });
  $("#idioma").addEventListener("click", cambiarIdioma);
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
  // equipos modestos (pocos núcleos o poca memoria): sin adornos animados en el paisaje
  if ((navigator.hardwareConcurrency || 4) <= 2 || ((navigator as unknown as { deviceMemory?: number }).deviceMemory || 4) <= 2) document.body.classList.add("economico");
  medirLayout();
  aplicarEstatico();
  menuPrincipal();
}

// ---------------------------------------------------------------- dibujos de la historia (SVG propios)
/** Punto del dibujo del paisaje (800 × 600) donde aterriza el cohete: sobre el campo, delante de la casa. */
const SUELO_X = 430, SUELO_Y = 482;
const COHETE = `<svg viewBox="0 0 160 260" class="cohete-svg" aria-hidden="true">
  <defs>
    <linearGradient id="cuerpoC" x1="0" x2="1"><stop offset="0" stop-color="#c9ccd6"/><stop offset=".35" stop-color="#ffffff"/><stop offset=".7" stop-color="#e9ebf1"/><stop offset="1" stop-color="#a9adbb"/></linearGradient>
    <linearGradient id="narizC" x1="0" x2="1"><stop offset="0" stop-color="#a8261b"/><stop offset=".4" stop-color="#ef5a43"/><stop offset="1" stop-color="#9c2218"/></linearGradient>
    <linearGradient id="aletaC" x1="0" x2="1"><stop offset="0" stop-color="#1d4f8f"/><stop offset=".5" stop-color="#3b82d0"/><stop offset="1" stop-color="#173f73"/></linearGradient>
    <radialGradient id="vidrioC" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#e8f7ff"/><stop offset=".5" stop-color="#7cc4ec"/><stop offset="1" stop-color="#2a6f9e"/></radialGradient>
    <linearGradient id="toberaC" x1="0" x2="1"><stop offset="0" stop-color="#4b525f"/><stop offset=".5" stop-color="#9aa3b2"/><stop offset="1" stop-color="#3d434e"/></linearGradient>
    <radialGradient id="fuegoC" cx=".5" cy=".1" r=".9"><stop offset="0" stop-color="#fffbe0"/><stop offset=".3" stop-color="#ffe066"/><stop offset=".65" stop-color="#ff9a1f"/><stop offset="1" stop-color="#e2401c" stop-opacity="0"/></radialGradient>
  </defs>
  <g class="fuego"><ellipse class="brillo-llama" cx="80" cy="226" rx="46" ry="58" fill="url(#fuegoC)" opacity=".5"/>
    <path class="llama l1" d="M56 186 Q80 270 104 186 Q80 206 56 186Z" fill="url(#fuegoC)"/>
    <path class="llama l2" d="M65 186 Q80 242 95 186 Q80 198 65 186Z" fill="#ffd34d"/>
    <path class="llama l3" d="M72 186 Q80 220 88 186 Q80 192 72 186Z" fill="#fffbe0"/></g>
  <g class="patas-g"><path d="M52 150 L34 196 L46 196 L60 160Z M108 150 L126 196 L114 196 L100 160Z" fill="#6c7380" stroke="#2c241c" stroke-width="3" stroke-linejoin="round"/>
    <rect x="28" y="194" width="22" height="6" rx="3" fill="#3d434e"/><rect x="110" y="194" width="22" height="6" rx="3" fill="#3d434e"/></g>
  <path d="M46 120 L18 170 Q16 178 24 176 L50 164Z" fill="url(#aletaC)" stroke="#2c241c" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M114 120 L142 170 Q144 178 136 176 L110 164Z" fill="url(#aletaC)" stroke="#2c241c" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M80 8 C112 36 120 92 114 168 L46 168 C40 92 48 36 80 8Z" fill="url(#cuerpoC)" stroke="#2c241c" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M80 8 C112 36 120 92 114 168 L96 168 C100 96 96 40 80 8Z" fill="#6b7282" opacity=".22"/>
  <path d="M58 40 Q52 90 56 150" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".55"/>
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
// El paisaje va en capas: la fija se dibuja una sola vez y solo se mueven las capas pequeñas (nubes, rayos, hierba, montañas lejanas),
// así el celular no vuelve a pintar todo el dibujo en cada cuadro.
const PAISAJE = `<div class="paisaje-caja"><svg viewBox="0 0 800 600" preserveAspectRatio="xMidYMax slice" aria-hidden="true" class="paisaje-svg capa c-fondo">
  <defs>
    <linearGradient id="cieloM" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9f5f"/><stop offset=".3" stop-color="#ffc784"/><stop offset=".62" stop-color="#ffe6b8"/><stop offset="1" stop-color="#fff5de"/></linearGradient>
    <radialGradient id="solM" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fffbe6"/><stop offset=".35" stop-color="#ffe27a"/><stop offset="1" stop-color="#ffb03a" stop-opacity="0"/></radialGradient>
    <linearGradient id="volcanM" x1="0" x2="1"><stop offset="0" stop-color="#6d7d96"/><stop offset=".5" stop-color="#a2b0c6"/><stop offset="1" stop-color="#62718a"/></linearGradient>
    <linearGradient id="volcan2" x1="0" x2="1"><stop offset="0" stop-color="#8a9ab2"/><stop offset=".6" stop-color="#b3c0d4"/><stop offset="1" stop-color="#7585a0"/></linearGradient>
    <linearGradient id="neveM" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#dfe9f8"/><stop offset=".5" stop-color="#ffffff"/><stop offset="1" stop-color="#cdd9ee"/></linearGradient>
    <linearGradient id="brumaM" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3d6" stop-opacity="0"/><stop offset="1" stop-color="#fff3d6" stop-opacity=".85"/></linearGradient>
    <linearGradient id="colina1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fbf5a"/><stop offset="1" stop-color="#5f9a3e"/></linearGradient>
    <linearGradient id="campoA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9d86c"/><stop offset="1" stop-color="#8fc04e"/></linearGradient>
    <linearGradient id="campoB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ecd070"/><stop offset="1" stop-color="#d4aa48"/></linearGradient>
    <linearGradient id="campoC" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bddc74"/><stop offset="1" stop-color="#93c250"/></linearGradient>
    <linearGradient id="campoD" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9a877"/><stop offset="1" stop-color="#b98456"/></linearGradient>
    <linearGradient id="tierraM" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9a6538"/><stop offset="1" stop-color="#5e3a1f"/></linearGradient>
    <radialGradient id="nubeG" cx=".5" cy=".35" r=".7"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#ffe9d0"/></radialGradient>
  </defs>
  <rect width="800" height="600" fill="url(#cieloM)"/>
  <g class="sol-menu"><circle cx="490" cy="150" r="120" fill="url(#solM)"/><circle cx="490" cy="150" r="46" fill="#ffe066"/><circle cx="478" cy="138" r="20" fill="#fffbe0" opacity=".7"/></g>
</svg>
<svg viewBox="0 0 800 600" preserveAspectRatio="xMidYMax slice" aria-hidden="true" class="paisaje-svg capa c-rayos"><g class="rayos" fill="#fff3b0" fill-opacity=".22"><path d="M490 150 L750 150 L747 191Z"/><path d="M490 150 L674 334 L642 361Z"/><path d="M490 150 L490 410 L449 407Z"/><path d="M490 150 L306 334 L279 302Z"/><path d="M490 150 L230 150 L233 109Z"/><path d="M490 150 L306 -34 L338 -61Z"/><path d="M490 150 L490 -110 L531 -107Z"/><path d="M490 150 L674 -34 L701 -2Z"/></g></svg>
<svg viewBox="0 0 800 600" preserveAspectRatio="xMidYMax slice" aria-hidden="true" class="paisaje-svg capa c-lejos">
  <path d="M-20 400 L90 290 Q110 272 132 296 L220 400Z" fill="#b8c5dc" opacity=".8"/>
  <path d="M560 410 L690 280 Q712 258 736 282 L840 410Z" fill="#b3c1d8" opacity=".85"/>
</svg>
<svg viewBox="0 0 800 600" preserveAspectRatio="xMidYMax slice" aria-hidden="true" class="paisaje-svg capa c-nubes">
  <g class="nube-m n1"><g fill="url(#nubeG)"><ellipse cx="140" cy="122" rx="62" ry="20"/><ellipse cx="182" cy="106" rx="42" ry="24"/><ellipse cx="108" cy="110" rx="32" ry="18"/><ellipse cx="150" cy="96" rx="28" ry="18"/></g><ellipse cx="140" cy="132" rx="62" ry="6" fill="#f2b98a" opacity=".35"/></g>
  <g class="nube-m n2"><g fill="url(#nubeG)" opacity=".92"><ellipse cx="500" cy="70" rx="52" ry="16"/><ellipse cx="530" cy="58" rx="34" ry="19"/><ellipse cx="474" cy="62" rx="24" ry="13"/></g><ellipse cx="500" cy="78" rx="52" ry="5" fill="#f2b98a" opacity=".3"/></g>
  <g class="nube-m n3"><g fill="url(#nubeG)" opacity=".85"><ellipse cx="690" cy="170" rx="46" ry="14"/><ellipse cx="716" cy="160" rx="30" ry="16"/></g></g>
  <g class="condor"><path d="M0 0 Q-16 -9 -34 -3 Q-18 -2 -8 3 Q0 6 8 3 Q18 -2 34 -3 Q16 -9 0 0Z" fill="#2c2a35"/></g>
</svg>
<svg viewBox="0 0 800 600" preserveAspectRatio="xMidYMax slice" aria-hidden="true" class="paisaje-svg capa c-medio">
  <path d="M190 405 L336 186 Q352 166 368 186 L520 405Z" fill="url(#volcanM)"/>
  <path d="M336 186 Q352 166 368 186 L520 405 L430 405 L368 230Z" fill="#4a5870" opacity=".35"/>
  <path d="M312 222 L336 186 Q352 166 368 186 L392 222 Q380 232 370 225 Q360 238 348 227 Q336 236 326 227 Q318 232 312 222Z" fill="url(#neveM)"/>
  <path d="M330 230 L322 262 M352 232 L352 270 M372 230 L384 262" stroke="#8b9bb5" stroke-width="2" opacity=".5" fill="none"/>
  <path d="M520 415 L650 252 Q662 238 676 252 L810 395 L810 425Z" fill="url(#volcan2)"/>
  <path d="M630 276 L650 252 Q662 238 676 252 L696 276 Q684 284 672 278 Q660 288 648 280 Q640 286 630 276Z" fill="url(#neveM)"/>
  <rect x="0" y="330" width="800" height="100" fill="url(#brumaM)"/>
</svg>
<svg viewBox="0 0 800 600" preserveAspectRatio="xMidYMax slice" aria-hidden="true" class="paisaje-svg capa c-tierra">
  <path d="M0 422 Q140 366 300 396 T600 384 T800 376 L800 600 L0 600Z" fill="url(#colina1)"/>
  <path d="M0 440 Q120 410 240 424 L232 456 Q120 446 0 474Z" fill="url(#campoA)"/>
  <path d="M240 424 Q400 404 560 418 L552 448 Q400 440 232 456Z" fill="url(#campoB)"/>
  <path d="M560 418 Q690 404 800 410 L800 442 Q690 438 552 448Z" fill="url(#campoC)"/>
  <path d="M0 474 Q120 446 232 456 L222 492 Q120 488 0 512Z" fill="#6aa544"/>
  <path d="M232 456 Q400 440 552 448 L542 484 Q400 478 222 492Z" fill="url(#campoC)"/>
  <path d="M552 448 Q690 438 800 442 L800 478 Q690 476 542 484Z" fill="url(#campoD)"/>
  <g stroke="#fff" stroke-opacity=".28" stroke-width="1.6" fill="none">
    <path d="M262 436 Q400 420 540 430 M256 444 Q400 430 534 438 M250 452 Q400 438 548 446"/>
    <path d="M244 462 Q400 450 530 458 M236 472 Q400 462 526 470 M228 482 Q400 474 520 480"/>
    <path d="M580 424 Q690 414 790 420 M576 432 Q690 424 790 430 M574 440 Q690 432 790 438"/>
    <path d="M14 462 Q120 440 226 452 M10 474 Q120 456 224 466 M8 486 Q120 470 222 480"/>
  </g>
  <g transform="translate(600 392)"><rect x="0" y="0" width="58" height="34" rx="5" fill="#f1d9b5" stroke="#6e3f17" stroke-width="3"/>
    <rect x="40" y="-22" width="9" height="20" fill="#a5682a" stroke="#6e3f17" stroke-width="2"/>
    <path d="M-8 2 L29 -24 L66 2Z" fill="#c0533a" stroke="#6e3f17" stroke-width="3" stroke-linejoin="round"/><rect x="22" y="12" width="13" height="22" rx="2" fill="#8a5a33"/>
    <rect x="42" y="14" width="10" height="10" rx="2" fill="#7cc4ec" stroke="#6e3f17" stroke-width="2"/></g>
  <path d="M0 512 Q240 480 420 500 T800 492 L800 600 L0 600Z" fill="url(#tierraM)"/>
  <path d="M0 546 Q260 518 460 536 T800 530 L800 600 L0 600Z" fill="#5a381d"/>
</svg>
<svg viewBox="0 0 800 600" preserveAspectRatio="xMidYMax slice" aria-hidden="true" class="paisaje-svg capa c-viva">
  <g class="polylepis">
    <g class="arbol a1"><rect x="96" y="402" width="5" height="22" fill="#6e3f17"/><circle cx="98" cy="396" r="17" fill="#3f8a3c"/><circle cx="90" cy="402" r="11" fill="#4f9d45"/></g>
    <g class="arbol a2"><rect x="716" y="390" width="5" height="22" fill="#6e3f17"/><circle cx="718" cy="384" r="15" fill="#3f8a3c"/><circle cx="726" cy="390" r="10" fill="#4f9d45"/></g>
  </g>
  <g class="humo-casa" fill="#fff"><circle cx="644" cy="366" r="5"/><circle cx="644" cy="366" r="5"/><circle cx="644" cy="366" r="5"/></g>
  <g class="aves" fill="none" stroke="#3b2a4a" stroke-width="2" stroke-linecap="round">
    <path class="ave v1" d="M0 0 q6 -6 12 0 q6 -6 12 0"/><path class="ave v2" d="M0 0 q5 -5 10 0 q5 -5 10 0"/><path class="ave v3" d="M0 0 q4 -4 8 0 q4 -4 8 0"/>
  </g>
  <g class="hierba" fill="#4f9d45" stroke="#2e6b2a" stroke-width="1">
    <path class="brizna" d="M20 512 q-3 -22 -11 -30 q8 6 14 28Z"/><path class="brizna" d="M26 514 q2 -26 10 -34 q-3 12 -4 34Z"/>
    <path class="brizna" d="M120 506 q-3 -20 -10 -27 q7 5 12 25Z"/><path class="brizna" d="M126 508 q3 -24 11 -31 q-4 11 -5 31Z"/>
    <path class="brizna" d="M300 500 q-3 -18 -10 -25 q7 4 12 23Z"/><path class="brizna" d="M560 498 q2 -22 10 -29 q-4 10 -5 29Z"/>
    <path class="brizna" d="M690 494 q-3 -22 -11 -30 q8 5 14 28Z"/><path class="brizna" d="M697 496 q3 -26 11 -33 q-4 12 -5 33Z"/><path class="brizna" d="M770 492 q-3 -20 -10 -28 q7 5 12 26Z"/>
  </g>
  <g class="polvo" fill="#fff" opacity=".7"><circle cx="150" cy="300" r="1.8"/><circle cx="300" cy="360" r="1.4"/><circle cx="460" cy="330" r="2"/><circle cx="620" cy="350" r="1.5"/><circle cx="720" cy="300" r="1.8"/><circle cx="60" cy="380" r="1.5"/></g>
</svg></div>`;
