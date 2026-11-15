// Sonidos de Astro Granja hechos con Web Audio (sin archivos de audio): el cohete que baja, el aterrizaje y pequeños efectos.
import { estaSilenciado } from "./pachita";

let ctx: AudioContext | null = null;
let ruido: AudioBuffer | null = null;

/** Crea o reanuda el audio. Hay que llamarlo dentro de un toque del jugador (los celulares no suenan sin un gesto). */
export function preparar(): AudioContext | null {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
    if (!ruido) {
      ruido = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = ruido.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return ctx;
  } catch { return null; }
}

const fuente = (c: AudioContext) => { const s = c.createBufferSource(); s.buffer = ruido!; s.loop = true; return s; };
function filtro(c: AudioContext, tipo: BiquadFilterType, f: number, q = 0.7) {
  const b = c.createBiquadFilter(); b.type = tipo; b.frequency.value = f; b.Q.value = q; return b;
}
/** Ganancia con una envolvente [segundos desde ahora, volumen]. */
function ganancia(c: AudioContext, t0: number, puntos: [number, number][]) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  for (const [s, v] of puntos) g.gain.linearRampToValueAtTime(Math.max(v, 0.0001), t0 + s);
  return g;
}

/** El cohete baja frenando: rugido de motor que crece, zumbido grave y el silbido del aire. Dura `seg` segundos. */
export function cohete(seg: number) {
  const c = preparar();
  if (!c || estaSilenciado()) return;
  const t0 = c.currentTime, fin = t0 + seg;
  const salida = c.createGain();
  salida.gain.value = 0.8;
  salida.connect(c.destination);

  const rugido = fuente(c), pasoBajo = filtro(c, "lowpass", 1800);
  pasoBajo.frequency.setValueAtTime(1800, t0);
  pasoBajo.frequency.exponentialRampToValueAtTime(420, fin);
  rugido.connect(pasoBajo).connect(ganancia(c, t0, [[0.1, 0.05], [seg * 0.45, 0.32], [seg - 0.45, 0.62], [seg, 0.05]])).connect(salida);
  rugido.start(t0); rugido.stop(fin + 0.1);

  const zumbido = c.createOscillator();
  zumbido.type = "sawtooth";
  zumbido.frequency.setValueAtTime(96, t0);
  zumbido.frequency.exponentialRampToValueAtTime(46, fin);
  zumbido.connect(filtro(c, "lowpass", 240)).connect(ganancia(c, t0, [[0.3, 0.05], [seg - 0.45, 0.24], [seg, 0.02]])).connect(salida);
  zumbido.start(t0); zumbido.stop(fin + 0.1);

  const aire = fuente(c), banda = filtro(c, "bandpass", 3200, 1.1);
  banda.frequency.setValueAtTime(3200, t0);
  banda.frequency.exponentialRampToValueAtTime(700, fin);
  aire.connect(banda).connect(ganancia(c, t0, [[0.2, 0.2], [seg * 0.7, 0.1], [seg, 0.01]])).connect(salida);
  aire.start(t0); aire.stop(fin + 0.1);
}

/** Toca tierra: golpe grave, clac de las patas al abrirse y el siseo del humo. */
export function aterrizaje() {
  const c = preparar();
  if (!c || estaSilenciado()) return;
  const t0 = c.currentTime;
  const salida = c.createGain();
  salida.gain.value = 0.9;
  salida.connect(c.destination);

  const golpe = c.createOscillator();
  golpe.type = "sine";
  golpe.frequency.setValueAtTime(130, t0);
  golpe.frequency.exponentialRampToValueAtTime(36, t0 + 0.35);
  golpe.connect(ganancia(c, t0, [[0.01, 0.9], [0.4, 0.0001]])).connect(salida);
  golpe.start(t0); golpe.stop(t0 + 0.5);

  const polvo = fuente(c);
  polvo.connect(filtro(c, "lowpass", 900)).connect(ganancia(c, t0, [[0.01, 0.55], [0.6, 0.0001]])).connect(salida);
  polvo.start(t0); polvo.stop(t0 + 0.7);

  [[0.1, 320], [0.2, 230]].forEach(([d, f]) => {
    const o = c.createOscillator();
    o.type = "triangle";
    o.frequency.value = f;
    o.connect(ganancia(c, t0 + d, [[0.005, 0.35], [0.12, 0.0001]])).connect(salida);
    o.start(t0 + d); o.stop(t0 + d + 0.2);
  });

  const siseo = fuente(c);
  siseo.connect(filtro(c, "highpass", 2500)).connect(ganancia(c, t0 + 0.1, [[0.15, 0.16], [1.6, 0.0001]])).connect(salida);
  siseo.start(t0 + 0.1); siseo.stop(t0 + 1.9);
}

function tono(c: AudioContext, destino: AudioNode, f0: number, f1: number, t0: number, dur: number, vol: number, tipo: OscillatorType = "sine") {
  const o = c.createOscillator();
  o.type = tipo;
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  o.connect(ganancia(c, t0, [[0.01, vol], [dur, 0.0001]])).connect(destino);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

/** Semilla en la tierra: un "pop" suave. */
export function siembra() {
  const c = preparar();
  if (!c || estaSilenciado()) return;
  tono(c, c.destination, 420, 820, c.currentTime, 0.14, 0.3);
}

/** Azadón que golpea la tierra y campanitas de cosecha. */
export function cosecha() {
  const c = preparar();
  if (!c || estaSilenciado()) return;
  const t0 = c.currentTime;
  [0.32, 0.68].forEach((d) => {
    tono(c, c.destination, 190, 70, t0 + d, 0.16, 0.5, "triangle");
    const r = fuente(c);
    r.connect(filtro(c, "lowpass", 700)).connect(ganancia(c, t0 + d, [[0.01, 0.3], [0.2, 0.0001]])).connect(c.destination);
    r.start(t0 + d); r.stop(t0 + d + 0.25);
  });
  [660, 880, 1320].forEach((f, k) => tono(c, c.destination, f, f, t0 + 0.9 + k * 0.13, 0.5, 0.18));
}

/** Chorro de agua. */
export function riego() {
  const c = preparar();
  if (!c || estaSilenciado()) return;
  const t0 = c.currentTime, r = fuente(c);
  r.connect(filtro(c, "bandpass", 1900, 0.8)).connect(ganancia(c, t0, [[0.1, 0.18], [0.7, 0.12], [1.0, 0.0001]])).connect(c.destination);
  r.start(t0); r.stop(t0 + 1.1);
}
