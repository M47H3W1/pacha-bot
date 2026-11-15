// Idioma del juego: español (por defecto) o inglés. Cada texto se escribe junto a su traducción: t("hola", "hello").

export type Idioma = "es" | "en";
const CLAVE = "pacha.idioma";

function inicial(): Idioma {
  try {
    const g = localStorage.getItem(CLAVE);
    if (g === "es" || g === "en") return g;
  } catch { /* sin almacenamiento */ }
  return "es";
}

let actual: Idioma = inicial();
if (typeof document !== "undefined") document.documentElement.lang = actual;

export const idioma = (): Idioma => actual;
export const ingles = () => actual === "en";
/** Código de idioma para formatear números y para la voz del navegador. */
export const locale = () => (actual === "en" ? "en-US" : "es-EC");

export function fijarIdioma(l: Idioma) {
  actual = l;
  try { localStorage.setItem(CLAVE, l); } catch { /* modo privado */ }
  document.documentElement.lang = l;
}

/** El texto en el idioma actual. */
export const t = (es: string, en: string): string => (actual === "en" ? en : es);
