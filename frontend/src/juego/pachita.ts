// Pachita: granjera de la sierra que guía al jugador con globos cortos y voz (/api/voz).
// Ilustraciones del equipo (generadas con asistencia de IA y marcadas con "IA").

import { esc } from "../lib/api";
import { idioma } from "./i18n";

export type Animo = "feliz" | "pensando" | "preocupada" | "lluvia";
const POSE: Record<Animo, string> = { feliz: "saluda", pensando: "piensa", preocupada: "piensa", lluvia: "paraguas" };
export const POSES = ["saluda", "piensa", "paraguas"];
export const urlPose = (pose: string) => `/img/pachita/pachita-${pose}.webp`;

// Dónde está la boca en cada pose (% del ancho y alto de la imagen) para animarla cuando habla
const BOCA: Record<string, { ancho: number; x: number; y: number; w: number }> = {
  saluda: { ancho: 297, x: 54.2, y: 23.6, w: 15 },
  piensa: { ancho: 264, x: 59.5, y: 22.5, w: 17 },
  paraguas: { ancho: 381, x: 61.9, y: 29.1, w: 13 },
};

/** Pachita con las tres poses del equipo (se cambia de pose con data-animo) y una boca que se mueve al hablar. */
export const PACHITA_HTML = POSES.map((p) => {
  const b = BOCA[p];
  return `<div class="pose pose-${p}" style="aspect-ratio:${b.ancho}/640">
    <img src="${urlPose(p)}" alt="" draggable="false" ${p === "saluda" ? "" : 'loading="lazy"'}>
    <span class="boca" style="left:${b.x}%;top:${b.y}%;width:${b.w}%"><i></i></span></div>`;
}).join("");
// compatibilidad: el resto del juego aún importa este nombre
export const PACHITA_SVG = PACHITA_HTML;

let silencio = false;
let reproductor: HTMLAudioElement | null = null;
const audios = new Map<string, Promise<string | null>>();

export function silenciar(v: boolean) {
  silencio = v;
  if (v) { reproductor?.pause(); if ("speechSynthesis" in window) speechSynthesis.cancel(); }
}
export const estaSilenciado = () => silencio;

/** Desbloquea el audio en el primer toque (los celulares no suenan sin un gesto del usuario). */
export function desbloquearAudio() {
  if (reproductor) return;
  reproductor = new Audio();
  reproductor.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
  reproductor.play().catch(() => {});
}

function limpiarParaVoz(t: string) {
  return t.replace(/[\u{1F000}-\u{1FAFF}☀-➿️]/gu, "").trim();
}

/** Pide el audio antes de que haga falta: así una frase sigue a la otra sin pausas. */
export function precargar(textos: string[]) { textos.forEach((t) => void urlVoz(limpiarParaVoz(t))); }

async function urlVoz(texto: string): Promise<string | null> {
  if (!texto) return null;
  const lang = idioma(), clave = `${lang}|${texto}`;
  if (!audios.has(clave)) {
    // GET cacheable: el navegador y el CDN guardan cada frase, así las que se repiten salen al instante
    const q = new URLSearchParams({ texto, estilo: "nina", lang });
    audios.set(clave, fetch(`/api/voz?${q}`)
      .then(async (r) => (r.ok ? URL.createObjectURL(await r.blob()) : null)).catch(() => null));
  }
  return audios.get(clave)!;
}

function vozDelTelefono(texto: string) {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texto);
  const en = idioma() === "en";
  u.lang = en ? "en-US" : "es-EC";
  const v = speechSynthesis.getVoices().find((x) => x.lang.startsWith(en ? "en" : "es"));
  if (v) u.voice = v;
  u.pitch = 1.5;  // respaldo sin red: voz del teléfono más aguda, como de niña
  u.rate = 1.05;
  speechSynthesis.speak(u);
}

let turno = 0;

/** Pachita se calla: se corta el audio y se esconde el globo (por ejemplo, al cambiar de idioma). */
export function callar() {
  turno++;
  reproductor?.pause();
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  document.querySelector("#pachita")?.classList.remove("habla");
  const g = document.querySelector<HTMLElement>("#globo");
  if (g) g.hidden = true;
  alTerminar = null;
}
let ocultar: number | undefined;
let alTerminar: (() => void) | null = null;
/** Número de la frase que se está diciendo: sirve para saber si otra frase la interrumpió. */
export const turnoActual = () => turno;

/** El globo se esconde unos segundos después de hablar, para no tapar la chacra (salvo si la frase pide una acción). */
function terminar(mio: number, fijo = false) {
  if (mio !== turno) return;
  document.querySelector("#pachita")?.classList.remove("habla");
  const fin = alTerminar; alTerminar = null; fin?.();
  clearTimeout(ocultar);
  if (fijo) return;
  ocultar = window.setTimeout(() => { if (mio === turno) document.querySelector<HTMLElement>("#globo")!.hidden = true; }, 4000);
}

/** Pachita dice algo: globo de diálogo y voz. El globo muestra tres puntitos mientras llega la voz y las palabras aparecen
 *  justo cuando empieza a sonar, al ritmo del audio. `fijo`: el globo se queda hasta que el jugador haga lo que ella pide.
 *  La promesa se cumple cuando termina de hablar (o cuando otra frase la interrumpe). */
export function decir(texto: string, animo: Animo = "feliz", op: { fijo?: boolean } = {}): Promise<void> {
  const caja = document.querySelector<HTMLElement>("#pachita");
  const globo = document.querySelector<HTMLElement>("#globo");
  if (!caja || !globo) return Promise.resolve();
  const anterior = alTerminar; alTerminar = null; anterior?.();
  const mio = ++turno;
  const palabras = texto.split(/\s+/).filter(Boolean);
  const leer = (ms: number) => { globo.style.setProperty("--ritmo", `${Math.round(Math.min(400, Math.max(18, ms)))}ms`); globo.classList.add("lee"); };
  globo.classList.remove("lee");
  globo.innerHTML = `<span class="globo-nombre">Pachita</span><span class="globo-puntos" aria-hidden="true"><i></i><i></i><i></i></span><span class="globo-texto">${palabras.map((w, k) => `<span style="--i:${k}">${esc(w)}</span>`).join(" ")}</span>`;
  globo.hidden = false;
  globo.classList.remove("aparece");
  void globo.offsetWidth;
  globo.classList.add("aparece");
  caja.dataset.animo = animo;
  caja.dataset.pose = POSE[animo];
  caja.classList.add("habla");
  clearTimeout(ocultar);
  globo.onclick = () => (globo.hidden = true);
  const espera = 1500 + texto.length * 55;  // si no hay voz, el tiempo de leer el globo
  const sinVoz = (limpio: string, usarTelefono: boolean) => {
    if (usarTelefono) vozDelTelefono(limpio);
    leer(Math.min(70, 4200 / Math.max(palabras.length, 1)));
    setTimeout(() => terminar(mio, op.fijo), espera);
  };
  return new Promise<void>((resolver) => {
    alTerminar = resolver;
    if (silencio) { sinVoz("", false); return; }
    const limpio = limpiarParaVoz(texto);
    urlVoz(limpio).then((url) => {
      if (mio !== turno) return;
      if (url && reproductor) {
        reproductor.src = url;
        reproductor.onended = () => terminar(mio, op.fijo);
        reproductor.play().then(() => {
          if (mio !== turno) return;
          const dur = reproductor!.duration;
          leer(Number.isFinite(dur) && dur > 0 ? (dur * 880) / Math.max(palabras.length, 1) : 45);
        }).catch(() => sinVoz(limpio, true));
      } else sinVoz(limpio, true);
    });
  });
}

/** Varias frases seguidas (cada una espera a que termine la anterior). */
export async function decirVarias(frases: string[], animo: Animo = "feliz") {
  precargar(frases);
  for (const f of frases) {
    const promesa = decir(f, animo);
    const mio = turno;
    await promesa;
    if (turno !== mio) return;  // otra frase la interrumpió
  }
}
