// Nombres y textos que vienen de la API en español (cultivos, usos, épocas, meses). En inglés se arman aquí a partir de los ids
// y de los números, no se traducen palabra por palabra.
import { ingles, t } from "./i18n";

const MES_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MES_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const CORTO_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const CORTO_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Nombre del mes (índice 0–11) en el idioma actual. */
export const nombreMes = (i: number) => (ingles() ? MES_EN : MES_ES)[i];
export const mesCorto = (i: number) => (ingles() ? CORTO_EN : CORTO_ES)[i];
/** Un nombre de mes en español (como lo manda la API: "enero") al idioma actual. */
export function mesDeApi(nombre: string): string {
  const i = MES_ES.indexOf(nombre.toLowerCase());
  return i >= 0 ? nombreMes(i) : nombre;
}

const NOMBRES_EN: Record<string, string> = {
  papa: "Potato", haba: "Fava bean", cebada: "Barley", avena: "Oats with vetch", quinua: "Quinoa", chocho: "Andean lupin (chocho)",
  maiz: "Soft corn", frejol: "Common bean", arveja: "Pea", trigo: "Wheat", melloco: "Ulluco (melloco)", oca: "Oca", pasto: "Mixed pasture",
  descanso: "Cover-crop rest",
};
/** Nombre del cultivo en el idioma actual (la API lo manda en español). */
export const nombreDe = (id: string, es: string) => (ingles() ? NOMBRES_EN[id] ?? es : es);

const USO_EN: Record<string, string> = {
  "alimento y venta": "food and sale", "grano y verde": "grain and fresh pods", "grano y máchica": "grain and toasted flour (máchica)",
  "forraje para animales": "animal fodder", "grano andino": "Andean grain", "choclo y grano": "fresh corn and grain", "grano": "grain",
  "verde y grano": "fresh pods and grain", "grano y harina": "grain and flour", "tubérculo andino": "Andean tuber",
  "pastoreo y leche": "grazing and milk", "dejar reposar el suelo": "letting the soil rest",
};
export const usoDe = (es: string) => (ingles() ? USO_EN[es] ?? es : es);

/** "Jan, May and Jul–Dec" a partir de los meses de siembra (1–12). En español se usa el texto del calendario del INIAP. */
export function epocaTexto(meses: number[] | undefined, textoEs?: string | null): string {
  if (!ingles()) return textoEs || t("todo el año", "all year");
  const m = [...new Set(meses || [])].sort((a, b) => a - b);
  if (!m.length || m.length >= 12) return "all year";
  const tramos: string[] = [];
  for (let i = 0; i < m.length;) {
    let j = i;
    while (j + 1 < m.length && m[j + 1] === m[j] + 1) j++;
    tramos.push(j - i >= 2 ? `${CORTO_EN[m[i] - 1]}–${CORTO_EN[m[j] - 1]}` : m.slice(i, j + 1).map((x) => CORTO_EN[x - 1]).join(", "));
    i = j + 1;
  }
  return tramos.length > 1 ? `${tramos.slice(0, -1).join(", ")} and ${tramos[tramos.length - 1]}` : tramos[0];
}

/** Por qué una semilla no se puede sembrar aquí (altura), armado con los números. */
export function razonAltura(c: { alt_min?: number; alt_max?: number }, elev: number | undefined, razonEs?: string): string {
  if (!ingles() || elev === undefined || c.alt_min === undefined) return razonEs || "";
  const n = (x: number) => x.toLocaleString("en-US");
  return elev < c.alt_min ? `it needs higher ground (from ${n(c.alt_min)} m)` : `it prefers lower land (up to ${n(c.alt_max!)} m)`;
}
