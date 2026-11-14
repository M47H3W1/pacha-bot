"""Cultivos de la sierra ecuatoriana, provincias y textos fijos."""
import csv
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Crop:
    id: str
    nombre: str
    emoji: str
    familia: str
    fija_n: bool
    alt_min: int
    alt_max: int
    ciclo_dias: int
    kc_ini: float
    kc_mid: float
    kc_end: float
    fr: tuple  # fracciones de etapas: inicial, desarrollo, media, final
    helada: str  # alta | media | baja | ninguna
    ingreso: str  # alto | medio | bajo | ninguno (referencial, validar)
    uso: str
    fuente: str

    @property
    def etiqueta(self) -> str:
        return f"{self.emoji} {self.nombre}"

    def aptitud_altura(self, z: float) -> float:
        """1 dentro del rango, 0.5 hasta 200 m fuera, 0 más lejos."""
        if self.alt_min <= z <= self.alt_max:
            return 1.0
        d = self.alt_min - z if z < self.alt_min else z - self.alt_max
        return 0.5 if d <= 200 else 0.0


def _load():
    out = {}
    with open(Path(__file__).with_name("crops.csv"), encoding="utf-8") as f:
        for r in csv.DictReader(f):
            out[r["id"]] = Crop(
                id=r["id"], nombre=r["nombre"], emoji=r["emoji"], familia=r["familia"],
                fija_n=r["fija_n"] == "1", alt_min=int(r["alt_min"]), alt_max=int(r["alt_max"]),
                ciclo_dias=int(r["ciclo_dias"]), kc_ini=float(r["kc_ini"]),
                kc_mid=float(r["kc_mid"]), kc_end=float(r["kc_end"]),
                fr=(float(r["f_ini"]), float(r["f_dev"]), float(r["f_mid"]), float(r["f_late"])),
                helada=r["helada"], ingreso=r["ingreso"], uso=r["uso"], fuente=r["fuente"],
            )
    return out


CROPS = _load()

# Punto rural representativo por provincia de la sierra (lat, lon)
PROVINCIAS = {
    "CAR": ("Carchi", 0.60, -77.83),
    "IMB": ("Imbabura", 0.30, -78.27),
    "PIC": ("Pichincha", 0.04, -78.14),
    "COT": ("Cotopaxi", -0.96, -78.70),
    "TUN": ("Tungurahua", -1.17, -78.53),
    "BOL": ("Bolívar", -1.59, -79.00),
    "CHI": ("Chimborazo", -1.60, -78.70),
    "CAN": ("Cañar", -2.56, -78.94),
    "AZU": ("Azuay", -2.99, -79.04),
    "LOJ": ("Loja", -3.62, -79.24),
}

MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
MESES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
               "septiembre", "octubre", "noviembre", "diciembre"]

RIEGO = {
    "g": ("Por surcos o inundación", 0.50),
    "a": ("Aspersión", 0.75),
    "d": ("Goteo", 0.90),
    "n": ("Solo lluvia, sin riego", 1.00),
}

GLOSARIO = {
    "et": ("Evapotranspiración",
           "Es el agua que 'se va' de tu terreno: la que se evapora del suelo y la que la planta "
           "suda por sus hojas. Cuando hace sol, viento y aire seco, se va más agua."),
    "kc": ("Coeficiente del cultivo (Kc)",
           "Dice cuánta agua toma tu cultivo comparado con un pasto corto. Una papa en flor toma "
           "más (1,15) que una papa recién sembrada (0,5)."),
    "pe": ("Lluvia útil",
           "No toda la lluvia sirve: parte se escurre o se va muy hondo. La lluvia útil es la que "
           "se queda donde están las raíces."),
    "bh": ("Balance de agua",
           "Es como una cuenta: la lluvia útil es lo que entra, lo que gasta el cultivo es lo que "
           "sale. Si sale más de lo que entra, ese faltante lo pones con riego."),
    "he": ("Helada",
           "Cuando el aire baja de unos 2 °C en la noche, en el suelo puede congelarse y quemar las "
           "hojas. Pasa más en noches despejadas y sin viento."),
    "nd": ("NDVI",
           "Es una medida que hacen los satélites de qué tan verde y sana se ve la vegetación. "
           "Suelo desnudo da valores bajos; un cultivo fuerte, valores altos."),
    "ro": ("Rotación",
           "Cambiar de cultivo cada temporada. Así el suelo descansa, se cortan las plagas que "
           "atacan siempre a la misma planta y las leguminosas (haba, chocho, arveja) dejan "
           "nitrógeno para el siguiente cultivo."),
}

AVISO = ("Pacha te ayuda a pensar, pero la decisión es tuya. Conversa siempre con tu técnico "
         "agrícola o tu comunidad antes de cambiar tu siembra.")
