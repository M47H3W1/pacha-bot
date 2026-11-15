// Íconos de interfaz de Astro Granja: SVG propios con el mismo trazo café grueso y colores cálidos de los íconos
// de cultivos (reemplazan a los emojis, que cambian de aspecto en cada teléfono).

const T = "#3b2a1a";
const s = (w = 2.6) => `stroke="${T}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

const D: Record<string, string> = {
  casa: `<path d="M8 24 L24 9 L40 24" fill="none" ${s(3)}/><path d="M12 22 V40 H36 V22" fill="#f1d9b5" ${s()}/><path d="M8 24 L24 9 L40 24 L36 26 L24 15 L12 26Z" fill="#c0533a" ${s()}/><rect x="20" y="28" width="8" height="12" rx="2" fill="#8a5a33" ${s(2)}/>`,
  sonido: `<path d="M8 19 H15 L24 11 V37 L15 29 H8Z" fill="#ffc93c" ${s()}/><path d="M30 18 Q34 24 30 30 M34 14 Q41 24 34 34" fill="none" ${s()}/>`,
  mudo: `<path d="M8 19 H15 L24 11 V37 L15 29 H8Z" fill="#e3dccb" ${s()}/><path d="M31 19 L40 29 M40 19 L31 29" fill="none" ${s(3)}/>`,
  ficha: `<rect x="10" y="9" width="28" height="33" rx="4" fill="#fff6e3" ${s()}/><rect x="17" y="6" width="14" height="7" rx="2" fill="#a5682a" ${s(2)}/><path d="M16 21 H32 M16 28 H32 M16 35 H26" fill="none" ${s(2.4)}/>`,
  semilla: `<path d="M24 41 C24 33 24 28 24 22" fill="none" stroke="#3d8a2e" stroke-width="3" stroke-linecap="round"/><path d="M24 26 C16 26 11 20 11 13 C19 13 24 18 24 26Z" fill="#6fb43f" ${s(2.2)}/><path d="M24 22 C24 14 29 9 37 9 C37 17 32 22 24 22Z" fill="#8fd05a" ${s(2.2)}/><ellipse cx="24" cy="41" rx="11" ry="3.5" fill="#8a5a33" ${s(2)}/>`,
  calendario: `<rect x="7" y="11" width="34" height="30" rx="5" fill="#fff6e3" ${s()}/><path d="M7 19 H41 V16 Q41 11 36 11 H12 Q7 11 7 16Z" fill="#c8372d" ${s()}/><path d="M15 7 V14 M33 7 V14" fill="none" ${s(3)}/><circle cx="16" cy="27" r="2.4" fill="#5fb35a"/><circle cx="24" cy="27" r="2.4" fill="#5fb35a"/><circle cx="32" cy="27" r="2.4" fill="#e3dccb"/><circle cx="16" cy="34" r="2.4" fill="#e3dccb"/><circle cx="24" cy="34" r="2.4" fill="#5fb35a"/>`,
  gota: `<path d="M24 6 C31 16 37 23 37 30 A13 13 0 0 1 11 30 C11 23 17 16 24 6Z" fill="#4fb3e8" ${s()}/><path d="M17 30 Q17 36 23 37" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".8"/>`,
  medalla: `<path d="M16 6 L22 20 M32 6 L26 20" fill="none" stroke="#c8372d" stroke-width="5" stroke-linecap="round"/><circle cx="24" cy="30" r="12" fill="#ffc93c" ${s()}/><path d="M24 23 L26 28 L31 28 L27 31 L28.5 36 L24 33 L19.5 36 L21 31 L17 28 L22 28Z" fill="#fff3c2" ${s(1.6)}/>`,
  cohete: `<path d="M24 5 C33 13 35 24 33 34 H15 C13 24 15 13 24 5Z" fill="#f4f1ea" ${s()}/><path d="M24 5 C28 9 31 13 32 18 H16 C17 13 20 9 24 5Z" fill="#d94f3d" ${s(2)}/><circle cx="24" cy="24" r="4.5" fill="#9fd0ee" ${s(2)}/><path d="M15 27 L9 37 L16 34Z M33 27 L39 37 L32 34Z" fill="#2b6cb0" ${s(2)}/><path d="M19 35 Q24 47 29 35Z" fill="#ffb02e"/>`,
  check: `<circle cx="24" cy="24" r="17" fill="#5fb35a" ${s()}/><path d="M16 24 L22 30 L33 18" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
  play: `<path d="M16 11 L37 24 L16 37Z" fill="#fff6e3" ${s(3)}/>`,
  pausa: `<rect x="13" y="11" width="8" height="26" rx="2" fill="#fff6e3" ${s(2.6)}/><rect x="27" y="11" width="8" height="26" rx="2" fill="#fff6e3" ${s(2.6)}/>`,
  cesta: `<path d="M14 20 Q24 4 34 20" fill="none" ${s(3)}/><path d="M7 20 H41 L37 40 H11Z" fill="#d9a066" ${s()}/><path d="M13 26 H35 M14 32 H34 M19 20 L18 40 M29 20 L30 40" fill="none" stroke="#a5682a" stroke-width="2"/><circle cx="18" cy="17" r="4.5" fill="#c98a4b" ${s(2)}/><circle cx="28" cy="16" r="4.5" fill="#e2587a" ${s(2)}/>`,
  atras: `<path d="M28 11 L15 24 L28 37" fill="none" ${s(4)}/>`,
  candado: `<path d="M16 22 V16 A8 8 0 0 1 32 16 V22" fill="none" ${s(3.2)}/><rect x="11" y="21" width="26" height="20" rx="4" fill="#ffc93c" ${s()}/><circle cx="24" cy="30" r="2.6" fill="${T}"/><path d="M24 31 V35" ${s(2.6)}/>`,
  reloj: `<circle cx="24" cy="25" r="15" fill="#fff6e3" ${s()}/><path d="M24 16 V25 L30 29" fill="none" ${s(2.8)}/><path d="M19 6 H29" ${s(3)}/>`,
  montana: `<path d="M4 40 L19 14 L27 27 L32 20 L44 40Z" fill="#8d9aa8" ${s()}/><path d="M14 23 L19 14 L24 23 L21 21 L19 24 L17 21Z" fill="#fff" ${s(1.8)}/>`,
  alerta: `<path d="M24 6 L43 40 H5Z" fill="#ffc93c" ${s()}/><path d="M24 18 V29" ${s(3.6)}/><circle cx="24" cy="34.5" r="2.2" fill="${T}"/>`,
  estrella: `<path d="M24 5 L29.5 17.5 L43 18.5 L32.5 27.5 L36 41 L24 33.5 L12 41 L15.5 27.5 L5 18.5 L18.5 17.5Z" fill="#ffc93c" ${s()}/><path d="M18 21 L21 20" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`,
  estrellaVacia: `<path d="M24 5 L29.5 17.5 L43 18.5 L32.5 27.5 L36 41 L24 33.5 L12 41 L15.5 27.5 L5 18.5 L18.5 17.5Z" fill="#efe3cb" ${s()}/>`,
  termometro: `<path d="M19 30 V11 A5 5 0 0 1 29 11 V30 A8 8 0 1 1 19 30Z" fill="#fff6e3" ${s()}/><circle cx="24" cy="36" r="5" fill="#e0473a"/><path d="M24 36 V18" stroke="#e0473a" stroke-width="4" stroke-linecap="round"/>`,
  lluvia: `<path d="M13 27 A8 8 0 0 1 14 11 A11 11 0 0 1 35 13 A7 7 0 0 1 36 27Z" fill="#cfe3f2" ${s()}/><path d="M16 33 L13 40 M25 33 L22 40 M34 33 L31 40" fill="none" stroke="#2b8fc4" stroke-width="3.2" stroke-linecap="round"/>`,
  sol: `<circle cx="24" cy="24" r="9" fill="#ffc93c" ${s()}/>${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<path transform="rotate(${a} 24 24)" d="M24 5 V10" ${s(3)}/>`).join("")}`,
  nube: `<path d="M12 34 A8 8 0 0 1 13 18 A11 11 0 0 1 34 19 A8 8 0 0 1 36 34Z" fill="#eef5fb" ${s()}/>`,
  grafico: `<path d="M8 8 V40 H41" fill="none" ${s(3)}/><rect x="13" y="27" width="6" height="10" rx="1.5" fill="#5c7da8" ${s(2)}/><rect x="22" y="20" width="6" height="17" rx="1.5" fill="#6a1b9a" ${s(2)}/><rect x="31" y="13" width="6" height="24" rx="1.5" fill="#c8372d" ${s(2)}/>`,
  brote: `<path d="M24 40 V24" stroke="#3d8a2e" stroke-width="3.4" stroke-linecap="round"/><path d="M24 28 C15 28 11 21 12 14 C20 14 24 20 24 28Z" fill="#6fb43f" ${s(2.2)}/><path d="M24 25 C24 17 29 12 37 13 C37 21 32 25 24 25Z" fill="#8fd05a" ${s(2.2)}/><path d="M8 40 Q24 34 40 40" fill="#8a5a33" ${s(2.2)}/>`,
  desierto: `<circle cx="34" cy="13" r="6" fill="#ffc93c" ${s(2.2)}/><path d="M4 40 Q16 30 28 36 T44 34 V42 H4Z" fill="#e9c46a" ${s(2.2)}/><path d="M17 36 V20 Q17 17 20 17 Q23 17 23 20 V34 M17 28 H13 V23" fill="#6fb43f" ${s(2.2)}/>`,
  rotar: `<path d="M37 18 A15 15 0 0 0 10 21" fill="none" ${s(3.4)}/><path d="M11 30 A15 15 0 0 0 38 27" fill="none" ${s(3.4)}/><path d="M37 9 V18 H28" fill="none" ${s(3.4)}/><path d="M11 39 V30 H20" fill="none" ${s(3.4)}/><circle cx="24" cy="24" r="4" fill="#5fb35a" ${s(2)}/>`,
  descargar: `<path d="M24 7 V29 M15 21 L24 30 L33 21" fill="none" ${s(3.6)}/><path d="M9 33 V40 H39 V33" fill="none" ${s(3.4)}/>`,
  pin: `<path d="M24 43 C24 43 10 28 10 18 A14 14 0 0 1 38 18 C38 28 24 43 24 43Z" fill="#c8372d" ${s()}/><circle cx="24" cy="18" r="5" fill="#fff6e3" ${s(2)}/>`,
  gps: `<circle cx="24" cy="24" r="12" fill="#fff6e3" ${s()}/><circle cx="24" cy="24" r="4.5" fill="#2b8fc4"/><path d="M24 5 V11 M24 37 V43 M5 24 H11 M37 24 H43" ${s(3)}/>`,
  foco: `<path d="M17 28 A11 11 0 1 1 31 28 Q29 31 29 34 H19 Q19 31 17 28Z" fill="#ffe066" ${s()}/><path d="M19 38 H29 M20 42 H28" ${s(2.6)}/><path d="M20 20 Q21 16 25 15" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`,
  luna: `<path d="M30 7 A17 17 0 1 0 41 31 A13 13 0 0 1 30 7Z" fill="#fff3c2" ${s()}/>`,
  viento: `<path d="M6 18 H30 A5 5 0 1 0 25 13 M6 26 H38 A5 5 0 1 1 33 31 M6 34 H22" fill="none" ${s(3)}/>`,
  nitrogeno: `<path d="M24 42 V22" stroke="#3d8a2e" stroke-width="3" stroke-linecap="round"/><path d="M24 26 C16 26 12 20 12 14 C20 14 24 19 24 26Z" fill="#6fb43f" ${s(2)}/><circle cx="35" cy="14" r="9" fill="#2b8fc4" ${s(2.2)}/><text x="35" y="18.5" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="12" fill="#fff">N</text><circle cx="18" cy="40" r="2.6" fill="#e85b7a" ${s(1.4)}/><circle cx="29" cy="41" r="2.6" fill="#e85b7a" ${s(1.4)}/>`,
  tierra: `<path d="M6 26 Q24 18 42 26 L40 38 Q24 44 8 38Z" fill="#6b4226" ${s()}/><path d="M24 22 V12" stroke="#3d8a2e" stroke-width="3" stroke-linecap="round"/><path d="M24 15 C18 15 15 11 15 6 C21 6 24 10 24 15Z" fill="#6fb43f" ${s(2)}/><circle cx="16" cy="31" r="1.8" fill="#e7c27a"/><circle cx="30" cy="33" r="1.8" fill="#e7c27a"/><path d="M33 26 Q36 22 34 19" fill="none" stroke="#e85b7a" stroke-width="2.4" stroke-linecap="round"/>`,
  pulgar: `<path d="M8 22 H15 V41 H8Z" fill="#ffc93c" ${s(2.4)}/><path d="M15 22 L22 8 Q27 8 26 14 L25 20 H37 Q41 20 40 25 L37 37 Q36 41 32 41 H15Z" fill="#f2c879" ${s(2.4)}/>`,
  tanque: `<path d="M12 12 H36 L34 41 H14Z" fill="#7fd3ff" ${s()}/><path d="M12 12 Q24 7 36 12" fill="none" ${s(2.4)}/><path d="M13 22 Q24 26 35 22" fill="none" stroke="#2b8fc4" stroke-width="2.4"/><path d="M8 18 Q4 22 9 25" fill="none" ${s(2.4)}/>`,
  mas: `<path d="M24 10 V38 M10 24 H38" ${s(5)}/>`,
  dia: `<circle cx="24" cy="24" r="8" fill="#ffc93c" ${s(2.2)}/><path d="M24 6 V11 M24 37 V42 M6 24 H11 M37 24 H42" ${s(2.8)}/>`,
  // guadaña (hoz andina): hoja curva oscura y mango naranja con muescas
  hoz: `<path d="M21 31 C33 33 45 24 44 11 C43.5 6 41 3 38 2 C42 9 40 22 21 27Z" fill="#2c313b" stroke="${T}" stroke-width="1.4" stroke-linejoin="round"/><path d="M39 6 C41 12 39 19 32 24" fill="none" stroke="#9aa3b2" stroke-width="1.4" stroke-linecap="round" opacity=".8"/><path d="M7 45 L5 42 L18 27 L22 30 L9 46Z" fill="#e8962e" stroke="${T}" stroke-width="2" stroke-linejoin="round"/><path d="M10 39 l3 2 M13 35.5 l3 2 M16 32 l3 2" stroke="${T}" stroke-width="1.6" stroke-linecap="round"/>`,
  azada: `<path d="M9 42 L30 14" fill="none" stroke="#a5682a" stroke-width="5.5" stroke-linecap="round"/><path d="M9 42 L30 14" fill="none" stroke="${T}" stroke-width="1.6" stroke-linecap="round" opacity=".5"/><path d="M24 9 Q34 4 42 12 L36 24 Q29 19 22 18Z" fill="#c9ced8" ${s()}/><path d="M28 11 Q34 9 38 13" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".8"/>`,
  info: `<circle cx="24" cy="24" r="17" fill="#4fb3e8" ${s()}/><circle cx="24" cy="15.5" r="2.6" fill="#fff"/><path d="M24 22 V33" stroke="#fff" stroke-width="4.4" stroke-linecap="round"/>`,
  globo: `<circle cx="24" cy="24" r="17" fill="#fff6e3" ${s()}/><path d="M7 24 H41 M24 7 Q14 24 24 41 M24 7 Q34 24 24 41" fill="none" ${s(2.2)}/>`,
};

/** Ícono de interfaz en SVG (por nombre). */
export function ic(nombre: string, clase = "ic"): string {
  return `<svg class="${clase === "ic" ? "ic" : `ic ${clase}`}" viewBox="0 0 48 48" aria-hidden="true" focusable="false">${D[nombre] || D.brote}</svg>`;
}

/** El mismo dibujo como grupo SVG para meterlo dentro de otro SVG (certificado). */
export function icG(nombre: string, x: number, y: number, tam: number): string {
  return `<g transform="translate(${x} ${y}) scale(${tam / 48})">${D[nombre] || ""}</g>`;
}
