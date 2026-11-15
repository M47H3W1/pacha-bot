// 18 íconos 3D de cultivos de la sierra (lámina del equipo, generada con asistencia de IA y marcada con "IA").
// Se recortaron con scripts/recortar_cultivos.py a 256 px con fondo transparente.

export const NOMBRES_ICONO: Record<string, string> = {
  papa: "Papa", haba: "Haba", cebada: "Cebada", avena: "Avena", vicia: "Vicia", trebol: "Trébol", quinua: "Quinua",
  chocho: "Chocho", maiz: "Maíz", frejol: "Fréjol", arveja: "Arveja", trigo: "Trigo", melloco: "Melloco", oca: "Oca",
  alfalfa: "Alfalfa", biomasa: "Biomasa", pasto: "Pasturas", fijadores: "Fijadores de nitrógeno",
};
export const TODOS_LOS_ICONOS = Object.keys(NOMBRES_ICONO);

export const urlIcono = (id: string) => {
  const clave = id === "descanso" ? "trebol" : id;
  return `/img/cultivos3d/${clave in NOMBRES_ICONO ? clave : "biomasa"}.webp`;
};

/** Ícono de un cultivo del juego (los ids de crops.csv; descanso usa el trébol de cobertura). */
export function icono(id: string, clase = "icono"): string {
  const clave = id === "descanso" ? "trebol" : id;
  return `<img class="${clase}" src="${urlIcono(id)}" alt="${NOMBRES_ICONO[clave] || id}" draggable="false" decoding="async">`;
}
