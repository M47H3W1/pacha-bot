// Lugar de la granja en el navegador. El servidor no guarda nada del jugador.
export interface Estado {
  lat?: number;
  lon?: number;
  nombre?: string;      // "Calpi, Chimborazo" o "Mi ubicación"
  provincia?: string;
  area_m2?: number;     // tamaño de la parcela
  mes?: number;         // mes de siembra elegido (1-12)
  crop?: string;        // cultivo elegido
  dias?: number;        // días desde la siembra (para el riego)
  demo?: boolean;
}

const CLAVE = "pacha.estado.v1";

export function leer(): Estado {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) || "{}");
  } catch {
    return {};
  }
}

export function guardar(cambios: Partial<Estado>): Estado {
  const nuevo = { ...leer(), ...cambios };
  try {
    localStorage.setItem(CLAVE, JSON.stringify(nuevo));
  } catch { /* modo privado: la app sigue funcionando en esta página */ }
  return nuevo;
}

export function tieneParcela(e = leer()): boolean {
  return typeof e.lat === "number" && typeof e.lon === "number";
}

/** El backend trabaja con un círculo: radio (m) a partir del área. */
export function radio(e: Estado): number {
  return Math.sqrt((e.area_m2 || 2500) / Math.PI);
}
