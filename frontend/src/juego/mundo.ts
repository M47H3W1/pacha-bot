// Contrato común de los dos mundos (3D con three.js y 2D de respaldo).

export interface Terreno {
  n: number;
  lado_m: number;
  alturas: number[][];
  min: number;
  max: number;
  centro: number;
  desnivel_m: number;
  sin_relieve: boolean;
}

export interface VistaParcela {
  crop: string | null;
  familia: string | null;
  emoji: string;
  etapa: number;      // 0 vacía, 1 recién sembrado, 2 creciendo, 3 plena producción, 4 madurando/lista
  marchita: boolean;
  lista: boolean;
}

export interface Mundo {
  actualizar(parcelas: VistaParcela[], colorSuelo: string, lloviendo: boolean): void;
  alTocar(cb: (i: number) => void): void;
  /** El cielo avanza: el sol cruza y llega la noche (se llama cuando pasan días en el juego). */
  pasarTiempo(dias: number): void;
  parcelaEn(x: number, y: number): number | null;
  resaltar(i: number | null): void;
  cosechar(i: number): void;
  regar(i: number): void;
  destruir(): void;
}

export const ETAPAS: Record<string, number> = {
  "antes de sembrar": 0, "recién sembrado": 1, "creciendo": 2, "en plena producción": 3, "madurando": 4,
  "listo para cosechar": 4,
};
