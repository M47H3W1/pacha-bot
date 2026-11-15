// 18 íconos vectoriales de cultivos de la sierra (redibujados en SVG a partir de la lámina del equipo).
// Estilo: círculo verde claro de fondo, contorno café oscuro, colores cálidos.

const T = "#3b2a1a"; // trazo
const HOJA = "#6fb43f", HOJA2 = "#3d8a2e";

const hoja = (x: number, y: number, l: number, a: number, c = HOJA) =>
  `<g transform="translate(${x} ${y}) rotate(${a})"><path d="M0 0 C${l * 0.3} ${-l * 0.32} ${l * 0.72} ${-l * 0.3} ${l} 0 C${l * 0.72} ${l * 0.3} ${l * 0.3} ${l * 0.32} 0 0Z" fill="${c}" stroke="${T}" stroke-width="1.6" stroke-linejoin="round"/><path d="M${l * 0.12} 0 L${l * 0.85} 0" stroke="#d9efb8" stroke-width="1.2" stroke-linecap="round"/></g>`;
const tallo = (d: string, c = HOJA2, w = 2.4) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
const flor = (x: number, y: number, r: number, c: string, centro = "#f6d24a") =>
  `<g transform="translate(${x} ${y})">${[0, 72, 144, 216, 288].map((a) =>
    `<circle cx="${(r * 0.62 * Math.cos((a * Math.PI) / 180)).toFixed(1)}" cy="${(r * 0.62 * Math.sin((a * Math.PI) / 180)).toFixed(1)}" r="${(r * 0.5).toFixed(1)}" fill="${c}" stroke="${T}" stroke-width="0.8"/>`).join("")}<circle r="${(r * 0.32).toFixed(1)}" fill="${centro}"/></g>`;
const tuber = (x: number, y: number, rx: number, ry: number, c: string, a = 0, ojos = true) =>
  `<g transform="translate(${x} ${y}) rotate(${a})"><ellipse rx="${rx}" ry="${ry}" fill="${c}" stroke="${T}" stroke-width="1.8"/><ellipse cx="${-rx * 0.3}" cy="${-ry * 0.4}" rx="${rx * 0.35}" ry="${ry * 0.22}" fill="#fff" opacity=".25"/>${ojos ? `<circle cx="${rx * 0.3}" cy="${ry * 0.1}" r="1.2" fill="${T}" opacity=".5"/><circle cx="${-rx * 0.2}" cy="${ry * 0.4}" r="1.1" fill="${T}" opacity=".5"/>` : ""}</g>`;
const grano = (x: number, y: number, rx: number, ry: number, c: string, a = 0) =>
  `<ellipse transform="translate(${x} ${y}) rotate(${a})" rx="${rx}" ry="${ry}" fill="${c}" stroke="${T}" stroke-width="1"/>`;
function espiga(x: number, y: number, h: number, a: number, c: string, barbas = false) {
  let g = `<g transform="translate(${x} ${y}) rotate(${a})">${tallo(`M0 0 L0 ${-h}`, "#b8892e", 1.6)}`;
  for (let k = 0; k < 6; k++) {
    const yy = -h * 0.35 - k * (h * 0.11);
    g += grano(-3.2, yy, 2.6, 4.2, c, -25) + grano(3.2, yy - 2, 2.6, 4.2, c, 25);
    if (barbas) g += `<path d="M-4 ${yy - 3} L-11 ${yy - 16} M4 ${yy - 5} L11 ${yy - 18}" stroke="#c99a3a" stroke-width=".9"/>`;
  }
  return g + grano(0, -h * 0.97, 2.6, 4.4, c) + "</g>";
}
const suelo = (cx: number, cy: number, w: number, c = "#6b4226") =>
  `<path d="M${cx - w} ${cy} Q${cx} ${cy - 10} ${cx + w} ${cy} Q${cx + w * 0.9} ${cy + 14} ${cx} ${cy + 15} Q${cx - w * 0.9} ${cy + 14} ${cx - w} ${cy}Z" fill="${c}" stroke="${T}" stroke-width="1.8"/>`;
const vaina = (x: number, y: number, l: number, a: number, c = "#7cc04a") =>
  `<g transform="translate(${x} ${y}) rotate(${a})"><path d="M0 0 C${l * 0.25} ${-l * 0.32} ${l * 0.8} ${-l * 0.3} ${l} ${-l * 0.08} C${l * 0.85} ${l * 0.16} ${l * 0.3} ${l * 0.22} 0 0Z" fill="${c}" stroke="${T}" stroke-width="1.8"/><path d="M${l * 0.15} ${-l * 0.06} C${l * 0.4} ${-l * 0.2} ${l * 0.7} ${-l * 0.18} ${l * 0.88} ${-l * 0.08}" stroke="#d6f0ae" stroke-width="1.6" fill="none"/></g>`;

const DIBUJOS: Record<string, string> = {
  papa: hoja(54, 56, 18, -140) + hoja(64, 54, 18, -45) + tuber(48, 66, 15, 12, "#c98a4b", -10) + tuber(70, 62, 16, 13, "#d79a55", 8) + tuber(58, 76, 15, 11, "#c27f40", -4),
  haba: hoja(72, 36, 20, -70) + vaina(30, 70, 54, -32, "#6fbb45") + [[44, 58], [54, 52], [64, 46]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="4.5" ry="3.4" fill="#9ed36a" stroke="#4f8f2e" stroke-width=".8"/>`).join("") + grano(70, 76, 9, 6.5, "#e8d39a", -10) + grano(52, 78, 7, 5, "#d9c487", 10),
  cebada: espiga(46, 84, 50, -14, "#e2b33a", true) + espiga(60, 84, 56, 0, "#e8bd45", true) + espiga(74, 84, 48, 14, "#dcae35", true) + hoja(56, 82, 22, -160) + hoja(64, 82, 22, -20),
  avena: tallo("M60 86 L60 30 M60 50 L44 36 M60 44 L76 30 M60 62 L42 52 M60 58 L78 48", "#b8892e", 1.6) +
    [[44, 36], [40, 44], [76, 30], [80, 38], [42, 52], [38, 60], [78, 48], [82, 56], [60, 28], [56, 36], [64, 38]].map(([x, y], i) => grano(x, y, 3, 5, "#e3cf9a", i % 2 ? 20 : -20)).join("") +
    hoja(58, 84, 20, -155) + hoja(62, 84, 20, -25),
  vicia: tallo("M40 84 C46 64 58 52 76 40 M60 84 C62 66 72 56 84 50") +
    [[48, 66, -30], [56, 56, -40], [66, 48, -45], [64, 66, -20], [74, 58, -30]].map(([x, y, a]) => hoja(x, y, 11, a) + hoja(x, y, 11, a + 160)).join("") +
    flor(42, 52, 7, "#b06ad8") + flor(76, 36, 7, "#b06ad8") + flor(84, 52, 6, "#e85b7a") + flor(58, 44, 6, "#e85b7a"),
  trebol: tallo("M60 88 L60 54 M60 70 L44 52 M60 66 L76 50") +
    [[60, 44], [42, 46], [78, 44]].map(([x, y]) => [0, 120, 240].map((a) =>
      `<path transform="translate(${x} ${y}) rotate(${a})" d="M0 0 C-9 -4 -10 -14 -4 -15 C-1 -15 0 -12 0 -10 C0 -12 1 -15 4 -15 C10 -14 9 -4 0 0Z" fill="${HOJA}" stroke="${T}" stroke-width="1.4"/>`).join("")).join(""),
  quinua: tallo("M44 86 L44 48 M60 86 L60 36 M76 86 L76 46") +
    [[44, 40, "#e8a43a"], [60, 30, "#d6435b"], [76, 38, "#d6435b"]].map(([x, y, c]) =>
      Array.from({ length: 9 }, (_, k) => `<circle cx="${(x as number) + ((k % 3) - 1) * 4}" cy="${(y as number) + Math.floor(k / 3) * 5 - 6}" r="3" fill="${c}" stroke="${T}" stroke-width=".8"/>`).join("")).join("") +
    hoja(44, 68, 14, -150) + hoja(60, 64, 16, -30) + hoja(76, 70, 14, -30),
  chocho: [0, 40, 80, 120, 160, 200].map((a) => hoja(60, 64, 16, a - 190)).join("") + flor(44, 36, 6, "#b06ad8") + flor(60, 30, 6, "#9b5fd0") + flor(76, 38, 6, "#b06ad8") +
    tallo("M44 42 L52 60 M60 36 L60 58 M76 44 L68 60", HOJA2, 1.6) + grano(46, 82, 7, 5, "#e3cf9a") + grano(62, 84, 7, 5, "#d9c487") + grano(76, 80, 6, 4.5, "#e3cf9a"),
  maiz: `<g transform="rotate(20 60 58)"><ellipse cx="60" cy="54" rx="13" ry="28" fill="#f2c230" stroke="${T}" stroke-width="1.8"/>${Array.from({ length: 30 }, (_, k) =>
    `<circle cx="${52 + (k % 4) * 5.3}" cy="${34 + Math.floor(k / 4) * 5.4}" r="2" fill="#f7d65a" stroke="#c99316" stroke-width=".7"/>`).join("")}</g>` +
    `<path d="M40 88 C34 64 42 48 52 40 C50 58 56 76 62 88Z" fill="#7cc04a" stroke="${T}" stroke-width="1.8"/><path d="M82 86 C88 64 80 50 72 44 C72 62 66 78 58 88Z" fill="#5fa83a" stroke="${T}" stroke-width="1.8"/>`,
  frejol: hoja(44, 38, 20, -30) + vaina(54, 46, 34, -25, "#8acb55") + grano(46, 70, 9, 11, "#8a2f2f", -20) + grano(62, 76, 9, 12, "#9b3a3a", 10) + grano(76, 68, 8, 10, "#7d2828", 25),
  arveja: hoja(60, 30, 14, -60) + `<g transform="rotate(-15 60 60)"><path d="M28 60 C40 40 80 40 92 58 C80 72 40 74 28 60Z" fill="#6fbb45" stroke="${T}" stroke-width="1.8"/><path d="M34 60 C46 50 76 50 86 58" stroke="#d6f0ae" stroke-width="1.4" fill="none"/>${[40, 50, 60, 70, 80].map((x) => `<circle cx="${x}" cy="${60}" r="4.6" fill="#9ad65e" stroke="${T}" stroke-width="1"/>`).join("")}</g>` +
    `<circle cx="64" cy="82" r="4.6" fill="#9ad65e" stroke="${T}" stroke-width="1"/><circle cx="76" cy="78" r="4.6" fill="#9ad65e" stroke="${T}" stroke-width="1"/>`,
  trigo: espiga(46, 86, 46, -16, "#e2a93a") + espiga(60, 86, 56, 0, "#e8b545") + espiga(74, 86, 44, 16, "#dca236") + hoja(56, 82, 22, -160) + hoja(64, 82, 22, -20),
  melloco: hoja(58, 60, 16, -115) + hoja(60, 60, 14, -60) + tuber(46, 70, 14, 11, "#f0d9a0", -10, false) + tuber(66, 64, 15, 12, "#e2587a", 6, false) + tuber(58, 78, 14, 10, "#e9b44c", 0, false) +
    `<circle cx="70" cy="62" r="1.5" fill="#fff" opacity=".6"/>`,
  oca: [0, 120, 240].map((a) => `<path transform="translate(60 38) rotate(${a})" d="M0 0 C-8 -4 -9 -12 -4 -13 C-1 -13 0 -10 0 -9 C0 -10 1 -13 4 -13 C9 -12 8 -4 0 0Z" fill="${HOJA}" stroke="${T}" stroke-width="1.3"/>`).join("") +
    tuber(46, 68, 9, 16, "#e2587a", -20, false) + tuber(68, 64, 9, 15, "#e9b44c", 20, false) + tuber(58, 78, 9, 13, "#d64568", 70, false),
  alfalfa: tallo("M44 86 L46 50 M60 86 L60 40 M76 86 L74 48", HOJA2, 1.8) +
    [[46, 70], [60, 64], [74, 72], [46, 56], [60, 50], [74, 58]].map(([x, y]) => hoja(x, y, 9, -150) + hoja(x, y, 9, -30)).join("") +
    flor(46, 44, 5, "#b06ad8") + flor(60, 34, 5, "#9b5fd0") + flor(74, 42, 5, "#b06ad8") + flor(38, 52, 4.5, "#b06ad8") + flor(82, 50, 4.5, "#9b5fd0"),
  biomasa: suelo(60, 74, 30) + `<path d="M40 70 L48 64 M68 66 L76 70 M54 78 L60 76" stroke="#e7c27a" stroke-width="2" stroke-linecap="round"/>` +
    hoja(56, 66, 22, -120) + hoja(60, 66, 22, -55) + `<path d="M40 66 C44 56 54 54 58 62 C50 60 46 64 40 66Z" fill="#e8b545" stroke="${T}" stroke-width="1.4"/>`,
  pasto: suelo(60, 76, 32, "#5b3a22") + [36, 44, 52, 60, 68, 76, 84].map((x, i) =>
    `<path d="M${x - 6} 76 C${x - 4} ${62 - (i % 3) * 6} ${x} ${50 - (i % 2) * 8} ${x + 2} ${46 - (i % 3) * 4} C${x + 2} ${58} ${x + 4} ${66} ${x + 6} 76Z" fill="${i % 2 ? HOJA : "#86c858"}" stroke="${T}" stroke-width="1.2"/>`).join(""),
  fijadores: suelo(58, 74, 28) + tallo("M58 72 L58 44") + hoja(58, 50, 16, -150) + hoja(58, 46, 16, -40) +
    `<path d="M58 74 L50 84 M58 74 L64 86 M54 80 L46 82" stroke="#e7c27a" stroke-width="1.4"/><circle cx="50" cy="84" r="2" fill="#e85b7a"/><circle cx="64" cy="86" r="2" fill="#e85b7a"/><circle cx="46" cy="82" r="1.8" fill="#e85b7a"/>` +
    `<circle cx="82" cy="32" r="12" fill="#2b8fc4" stroke="${T}" stroke-width="1.8"/><text x="82" y="37.5" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="15" fill="#fff">N</text>`,
};

export const NOMBRES_ICONO: Record<string, string> = {
  papa: "Papa", haba: "Haba", cebada: "Cebada", avena: "Avena", vicia: "Vicia", trebol: "Trébol", quinua: "Quinua",
  chocho: "Chocho", maiz: "Maíz", frejol: "Fréjol", arveja: "Arveja", trigo: "Trigo", melloco: "Melloco", oca: "Oca",
  alfalfa: "Alfalfa", biomasa: "Biomasa", pasto: "Pasturas", fijadores: "Fijadores de nitrógeno",
};

/** Ícono de un cultivo del juego (los ids de crops.csv; descanso usa el trébol de cobertura). */
export function icono(id: string, clase = "icono"): string {
  const clave = id === "descanso" ? "trebol" : id;
  const dibujo = DIBUJOS[clave] ?? DIBUJOS.biomasa;
  return `<svg class="${clase}" viewBox="0 0 120 120" role="img" aria-label="${NOMBRES_ICONO[clave] || id}">
    <ellipse cx="60" cy="96" rx="30" ry="4.5" fill="#000" opacity=".1"/>
    <circle cx="60" cy="58" r="44" fill="#e8efd6"/>${dibujo}</svg>`;
}

export const TODOS_LOS_ICONOS = Object.keys(DIBUJOS);
