// Estado del juego Astro Granja en el navegador (clave propia; la parcela se comparte con la app vía lib/estado).

export const N_PARCELAS = 4;

export interface Parcela {
  crop: string | null;       // cultivo sembrado (o "descanso")
  riegos: [number, number][]; // [día del ciclo, mm] que puso el jugador
  cosechada: boolean;
  historial: string[];       // cultivos anteriores en esta franja (para rotar)
  puntaje?: number;
}

export type Paso = "nombre" | "mapa" | "tierra" | "semillas" | "calendario" | "sembrar" | "agua" | "crecer" | "rotacion" | "certificado";

export interface Juego {
  version: 1;
  granja: string;            // nombre que el jugador le pone a su granja
  paso: Paso;                // momento de la historia
  crop: string | null;       // semilla elegida en esta temporada
  rotacion: string[] | null; // rotación elegida al final
  rotPaso?: number;          // posición del cultivo actual dentro de la rotación (0 = el primero); falta en partidas guardadas antes
  puntajes: number[];        // puntaje de cada cosecha
  temporada: number;         // 1, 2, 3...
  mes: number | null;        // mes de siembra de la temporada
  anio: number | null;       // año de NASA POWER que se está jugando
  dia: number;               // días desde la siembra
  sembrado: boolean;         // ya empezó a correr el tiempo
  tanque: number;            // litros en el tanque
  tanqueMax: number;
  salud: number;             // puntos de "salud de la tierra" (0–100), puntos del juego, no una medición
  parcelas: Parcela[];
  medallas: string[];
  cosechas: number;
}

const CLAVE = "pacha.juego.v1";

export function nuevo(): Juego {
  return {
    version: 1, granja: "", paso: "nombre", crop: null, rotacion: null, puntajes: [], temporada: 1, mes: null, anio: null, dia: 0, sembrado: false, tanque: 0, tanqueMax: 0, salud: 60,
    parcelas: Array.from({ length: N_PARCELAS }, () => ({ crop: null, riegos: [], cosechada: false, historial: [] })),
    medallas: [], cosechas: 0,
  };
}

export function cargar(): Juego {
  try {
    const j = JSON.parse(localStorage.getItem(CLAVE) || "null");
    if (j && j.version === 1 && Array.isArray(j.parcelas) && typeof j.granja === "string") return j;
  } catch { /* sin almacenamiento */ }
  return nuevo();
}

export function guardarJuego(j: Juego) {
  try { localStorage.setItem(CLAVE, JSON.stringify(j)); } catch { /* modo privado */ }
}

export function borrarJuego() {
  try { localStorage.removeItem(CLAVE); } catch { /* nada */ }
}

/** Color del suelo según la salud de la tierra: pálido y cansado → oscuro y rico. */
export function colorSuelo(salud: number): string {
  const t = Math.max(0, Math.min(1, salud / 100));
  const a = [196, 156, 108], b = [74, 47, 29];
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export const MEDALLAS: Record<string, { icono: string; nombre: string; texto: string; nombreEn: string; textoEn: string }> = {
  primera: { icono: "medalla", nombre: "Primera cosecha", texto: "Cosechaste tu primer cultivo.", nombreEn: "First harvest", textoEn: "You harvested your first crop." },
  agua: { icono: "gota", nombre: "Buen regador", texto: "Cosecha con 3 estrellas de agua.", nombreEn: "Good waterer", textoEn: "A harvest with 3 water stars." },
  rotacion: { icono: "rotar", nombre: "Rotación completa", texto: "Una parcela con tres familias distintas seguidas.", nombreEn: "Full rotation", textoEn: "A plot with three different families in a row." },
  leguminosa: { icono: "nitrogeno", nombre: "Amiga del suelo", texto: "Sembraste una leguminosa que alimenta la tierra.", nombreEn: "Friend of the soil", textoEn: "You planted a legume that feeds the soil." },
  sana: { icono: "tierra", nombre: "Tierra sana", texto: "La salud de tu tierra llegó a 85.", nombreEn: "Healthy soil", textoEn: "The health of your soil reached 85." },
  cosmico: { icono: "cohete", nombre: "Granjero cósmico", texto: "Terminaste la historia y ganaste tu certificado.", nombreEn: "Cosmic farmer", textoEn: "You finished the story and won your certificate." },
};
