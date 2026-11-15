// Pachita: granjera de la sierra que guía al jugador con globos cortos y voz (/api/voz).
// Ilustración SVG propia, hecha con asistencia de IA (marcada con "IA" en la esquina).

export const PACHITA_SVG = `
<svg viewBox="0 0 120 160" class="pachita-svg" role="img" aria-label="Pachita, granjera de la sierra">
  <title>Pachita</title>
  <ellipse cx="60" cy="154" rx="34" ry="5" fill="#000" opacity=".15"/>
  <!-- anaco (falda) -->
  <path d="M34 112 L86 112 L92 150 L28 150 Z" fill="#26324a"/>
  <path d="M30 138 L90 138 L91 144 L29 144 Z" fill="#d94f3d"/>
  <rect x="44" y="148" width="10" height="6" rx="3" fill="#5b3a24"/>
  <rect x="66" y="148" width="10" height="6" rx="3" fill="#5b3a24"/>
  <!-- poncho -->
  <path d="M60 62 L98 116 Q60 124 22 116 Z" fill="#c8372d"/>
  <path d="M60 62 L98 116 Q60 124 22 116 Z" fill="none" stroke="#f2b134" stroke-width="3" stroke-dasharray="6 4"/>
  <path d="M30 108 Q60 115 90 108" stroke="#2e7d4f" stroke-width="4" fill="none"/>
  <!-- manos -->
  <circle cx="27" cy="114" r="6" fill="#b5764a"/>
  <circle cx="93" cy="114" r="6" fill="#b5764a"/>
  <!-- trenzas -->
  <path d="M41 58 Q36 80 40 100" stroke="#1d1410" stroke-width="7" fill="none" stroke-linecap="round"/>
  <path d="M79 58 Q84 80 80 100" stroke="#1d1410" stroke-width="7" fill="none" stroke-linecap="round"/>
  <circle cx="40" cy="101" r="4" fill="#d94f3d"/><circle cx="80" cy="101" r="4" fill="#d94f3d"/>
  <!-- cara -->
  <ellipse cx="60" cy="56" rx="20" ry="22" fill="#c58457"/>
  <path d="M40 50 Q60 34 80 50 L80 44 Q60 30 40 44 Z" fill="#1d1410"/>
  <circle class="ojo" cx="52" cy="57" r="2.6" fill="#1d1410"/>
  <circle class="ojo" cx="68" cy="57" r="2.6" fill="#1d1410"/>
  <circle cx="47" cy="64" r="3.5" fill="#e0715a" opacity=".55"/>
  <circle cx="73" cy="64" r="3.5" fill="#e0715a" opacity=".55"/>
  <path class="boca" d="M53 67 Q60 73 67 67" stroke="#7a2e22" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <!-- sombrero de paño -->
  <ellipse cx="60" cy="38" rx="36" ry="8" fill="#f1ece0"/>
  <path d="M42 37 Q44 14 60 13 Q76 14 78 37 Z" fill="#f6f2e8"/>
  <path d="M43 31 Q60 35 77 31 L78 36 Q60 40 42 36 Z" fill="#2b2b2b"/>
  <text x="114" y="157" font-size="7" text-anchor="end" fill="#6b5b4b" opacity=".7" font-family="sans-serif">IA</text>
</svg>`;

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

async function urlVoz(texto: string): Promise<string | null> {
  if (!audios.has(texto)) {
    audios.set(texto, fetch("/api/voz", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texto }),
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
export function decir(texto: string, animo: "feliz" | "pensando" | "preocupada" = "feliz"): Promise<void> {
  const caja = document.querySelector<HTMLElement>("#pachita");
  const globo = document.querySelector<HTMLElement>("#globo");
  if (!caja || !globo) return Promise.resolve();
  const anterior = alTerminar; alTerminar = null; anterior?.();
  const mio = ++turno;
  globo.textContent = texto;
  globo.hidden = false;
  globo.classList.remove("aparece");
  void globo.offsetWidth;
  globo.classList.add("aparece");
  caja.dataset.animo = animo;
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
export async function decirVarias(frases: string[], animo: "feliz" | "pensando" | "preocupada" = "feliz") {
  for (const f of frases) {
    const promesa = decir(f, animo);
    const mio = turno;
    await promesa;
    if (turno !== mio) return;  // otra frase la interrumpió
  }
}
