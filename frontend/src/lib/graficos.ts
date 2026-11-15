// Gráficos simples en SVG (sin librerías): se leen en un teléfono y respetan el tema claro u oscuro.
import { MESES_CORTOS, num } from "./api";

/** Lluvia (barras) contra lo que se evapora (línea) por mes. */
export function lluviaVsEvaporacion(lluvia: number[], et0: number[], tipos: string[]): string {
  const W = 340, H = 170, pad = { l: 30, r: 8, t: 12, b: 24 };
  const max = Math.max(...lluvia, ...et0, 10) * 1.1;
  const x = (i: number) => pad.l + (i + 0.5) * ((W - pad.l - pad.r) / 12);
  const y = (v: number) => H - pad.b - (v / max) * (H - pad.t - pad.b);
  const bw = ((W - pad.l - pad.r) / 12) * 0.62;
  const color = (t: string) => (t === "lluvia" ? "var(--azul)" : t === "seco" ? "var(--naranja)" : "var(--salvia)");
  const barras = lluvia.map((v, i) =>
    `<rect x="${x(i) - bw / 2}" y="${y(v)}" width="${bw}" height="${Math.max(0, H - pad.b - y(v))}" rx="3" fill="${color(tipos[i])}"><title>${MESES_CORTOS[i]}: ${num(v)} mm de lluvia</title></rect>`).join("");
  const linea = et0.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const ejes = [0, 0.5, 1].map((f) => {
    const v = Math.round((max * f) / 10) * 10;
    return `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}" stroke="var(--borde)" stroke-dasharray="3 3"/>
            <text x="${pad.l - 4}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
  }).join("");
  const meses = MESES_CORTOS.map((m, i) => `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${m[0].toUpperCase()}</text>`).join("");
  return `<svg viewBox="0 0 ${W} ${H}" class="grafico" role="img" aria-label="Lluvia y evaporación de cada mes, en milímetros">
    ${ejes}${barras}<path d="${linea}" fill="none" stroke="var(--texto)" stroke-width="2.2" stroke-linejoin="round"/>
    ${et0.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="2.6" fill="var(--texto)"><title>${MESES_CORTOS[i]}: se evaporan ${num(v)} mm</title></circle>`).join("")}
    ${meses}</svg>`;
}

/** Tira de 12 meses con la humedad del suelo (0 a 1). */
export function tiraHumedad(h: number[]): string {
  const celdas = h.map((v, i) => {
    const pct = Math.round(v * 100);
    const color = v < 0.3 ? "var(--naranja)" : v < 0.6 ? "var(--arena)" : "var(--azul)";
    return `<div class="celda" title="${MESES_CORTOS[i]}: suelo ${pct} % lleno">
      <div class="vaso"><div style="height:${Math.max(6, pct)}%;background:${color}"></div></div><span>${MESES_CORTOS[i][0].toUpperCase()}</span></div>`;
  }).join("");
  return `<div class="tira-humedad" role="img" aria-label="Humedad del suelo mes a mes">${celdas}</div>`;
}

/** Semáforo de meses de un cultivo: verde, amarillo o rojo según los años con falta de agua. */
export function semaforo(meses: { mes: string; estado: string; falta: number; riego_texto: string }[]): string {
  const c = (e: string) => (e === "verde" ? "var(--ok)" : e === "amarillo" ? "var(--ambar)" : "var(--rojo)");
  const t = (e: string) => (e === "verde" ? "Bien" : e === "amarillo" ? "A veces falta" : "Falta agua");
  return `<ol class="semaforo">${meses.map((m) => `<li>
    <span class="mes">${m.mes}</span><span class="luz" style="background:${c(m.estado)}" aria-hidden="true"></span>
    <span class="estado">${t(m.estado)}</span><span class="riego">${m.riego_texto ? "💧 " + m.riego_texto : ""}</span></li>`).join("")}</ol>`;
}

/** 10 puntos: cuántos de cada 10 años gana este cultivo. */
export function deCada10(gana: number, de: number): string {
  const n = de ? Math.round((gana / de) * 10) : 0;
  return `<div class="dc10" role="img" aria-label="${n} de cada 10 años">${Array.from({ length: 10 },
    (_, i) => `<span class="${i < n ? "on" : ""}"></span>`).join("")}</div>`;
}
