import { leer, radio, type Estado } from "./estado";

export class ErrorApi extends Error {}

const memo = new Map<string, Promise<any>>();

/** Llama a /api/app/<nombre> con el estado de la parcela. Guarda en memoria y en sessionStorage. */
export async function consultar<T = any>(nombre: string, extra: Partial<Estado> & Record<string, unknown> = {}): Promise<T> {
  const e = { ...leer(), ...extra };
  // n, anio, m2 y riegos los usa el juego Astro Granja (terreno y ciclo diario)
  const juego = Object.fromEntries(["n", "anio", "m2", "riegos"].filter((k) => k in extra).map((k) => [k, extra[k]]));
  const estado = { lat: e.lat, lon: e.lon, radio: radio(e), mes: e.mes, crop: e.crop, dias: e.dias, ...juego };
  const clave = `pacha.api.${nombre}.${JSON.stringify(estado)}`;
  try {
    const guardado = sessionStorage.getItem(clave);
    if (guardado) return JSON.parse(guardado);
  } catch { /* sin almacenamiento */ }
  if (!memo.has(clave)) {
    memo.set(clave, (async () => {
      let r: Response;
      try {
        r = await fetch(`/api/app/${nombre}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ estado }),
        });
      } catch {
        throw new ErrorApi("Sin conexión. Revise su señal e intente otra vez.");
      }
      const datos = await r.json().catch(() => ({}));
      if (!r.ok) throw new ErrorApi(datos.error || "No pudimos traer los datos. Intente otra vez.");
      try { sessionStorage.setItem(clave, JSON.stringify(datos)); } catch { /* lleno o privado */ }
      return datos;
    })());
  }
  try {
    return await memo.get(clave)!;
  } catch (err) {
    memo.delete(clave);
    throw err;
  }
}

export async function obtener<T = any>(ruta: string): Promise<T> {
  const r = await fetch(ruta);
  if (!r.ok) throw new ErrorApi("No pudimos traer los datos.");
  return r.json();
}

export const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre",
  "octubre", "noviembre", "diciembre"];
export const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export const num = (x: number, d = 0) =>
  x.toLocaleString("es-EC", { minimumFractionDigits: d, maximumFractionDigits: d });

export function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

/** Pinta el estado de carga o de error en un contenedor. */
export function cargando(el: HTMLElement, texto = "Consultando los datos de la NASA…") {
  el.innerHTML = `<div class="cargando" role="status"><div class="girar"></div><p>${esc(texto)}</p></div>`;
}

export function mostrarError(el: HTMLElement, err: unknown, reintentar?: () => void) {
  const msg = err instanceof Error ? err.message : "Algo salió mal.";
  el.innerHTML = `<div class="tarjeta error" role="alert"><h3>No se pudo cargar</h3><p>${esc(msg)}</p>
    ${reintentar ? '<button class="btn btn-borde" type="button" data-reintentar>Intentar otra vez</button>' : ""}</div>`;
  el.querySelector("[data-reintentar]")?.addEventListener("click", () => reintentar?.());
}

/** Lee el texto en voz alta con la voz del teléfono (gratis y sin red). */
export function hablar(texto: string) {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texto);
  u.lang = "es-EC";
  const voz = speechSynthesis.getVoices().find((v) => v.lang.startsWith("es"));
  if (voz) u.voice = voz;
  u.rate = 0.95;
  speechSynthesis.speak(u);
}
