// Pachita: granjera de la sierra que guía al jugador con globos cortos y voz (/api/voz).
// Ilustraciones del equipo (generadas con asistencia de IA y marcadas con "IA").

import { esc } from "../lib/api";

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
  if (!audios.has(texto)) {
    audios.set(texto, fetch("/api/voz", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texto, estilo: "nina" }),
    }).then(async (r) => (r.ok ? URL.createObjectURL(await r.blob()) : null)).catch(() => null));
  }
  return audios.get(texto)!;
}

function vozDelTelefono(texto: string) {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texto);
  u.lang = "es-EC";
  const v = speechSynthesis.getVoices().find((x) => x.lang.startsWith("es"));
  if (v) u.voice = v;
  u.pitch = 1.5;  // respaldo sin red: voz del teléfono más aguda, como de niña
  u.rate = 1.05;
  speechSynthesis.speak(u);
}

let turno = 0;
let ocultar: number | undefined;
let alTerminar: (() => void) | null = null;

/** El globo se esconde unos segundos después de hablar, para no tapar la chacra. Tocarlo también lo esconde. */
function terminar(mio: number) {
  if (mio !== turno) return;
  document.querySelector("#pachita")?.classList.remove("habla");
  const fin = alTerminar; alTerminar = null; fin?.();
  clearTimeout(ocultar);
  ocultar = window.setTimeout(() => { if (mio === turno) document.querySelector<HTMLElement>("#globo")!.hidden = true; }, 4000);
}

/** Pachita dice algo: globo de diálogo (1–2 frases) y voz. La promesa se cumple cuando termina de hablar. */
export function decir(texto: string, animo: Animo = "feliz"): Promise<void> {
  const caja = document.querySelector<HTMLElement>("#pachita");
  const globo = document.querySelector<HTMLElement>("#globo");
  if (!caja || !globo) return Promise.resolve();
  const anterior = alTerminar; alTerminar = null; anterior?.();
  const mio = ++turno;
  // el globo tiene la cinta con el nombre y las palabras aparecen una tras otra, al ritmo de la voz
  const palabras = texto.split(/\s+/).filter(Boolean);
  const ritmo = Math.min(70, Math.max(18, 4200 / Math.max(palabras.length, 1)));
  globo.style.setProperty("--ritmo", `${Math.round(ritmo)}ms`);
  globo.innerHTML = `<span class="globo-nombre">Pachita</span><span class="globo-texto">${palabras.map((w, k) => `<span style="--i:${k}">${esc(w)}</span>`).join(" ")}</span>`;
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
  return new Promise<void>((resolver) => {
    alTerminar = resolver;
    if (silencio) { setTimeout(() => terminar(mio), espera); return; }
    const limpio = limpiarParaVoz(texto);
    urlVoz(limpio).then((url) => {
      if (mio !== turno) return;
      if (url && reproductor) {
        reproductor.src = url;
        reproductor.onended = () => terminar(mio);
        reproductor.play().catch(() => { vozDelTelefono(limpio); setTimeout(() => terminar(mio), espera); });
      } else {
        vozDelTelefono(limpio);
        setTimeout(() => terminar(mio), espera);
      }
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
