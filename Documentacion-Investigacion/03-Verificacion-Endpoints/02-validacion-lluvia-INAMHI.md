# Validación de la lluvia satelital frente a 85 estaciones del INAMHI

**Pregunta:** ¿qué fuente de lluvia se equivoca menos en la sierra? La lluvia es la entrada más importante del "banco de agua"
y de la recomendación de cultivos.

## Método
- **Estaciones:** 85 del INAMHI a 2.000 m o más, con 10 o más años completos entre 2001 y 2019 (de 13 a 19 años cada una). La mediana de lluvia observada es 918 mm/año.
- **Fuentes comparadas** en las coordenadas de cada estación y solo en los años completos de esa estación:
  - **MERRA-2**: POWER `PRECTOTCORR`, lo que usa hoy el bot antes de corregir;
  - **IMERG**: POWER `IMERG_PRECTOT` con `time-standard=UTC`;
  - **ERA5**: vía Open-Meteo.
- **Métricas mensuales:**
  - sesgo de volumen, `(modelo − observado) / observado`;
  - correlación de Pearson `r` entre los meses;
  - error absoluto medio mensual (MAE) en mm.
- Script: [scripts/valid.py](scripts/valid.py). Datos: [resultados/validacion_lluvia_85_estaciones.json](resultados/validacion_lluvia_85_estaciones.json).

## Resultados (85 estaciones)

| Fuente | Sesgo mediano | Rango intercuartil del sesgo | r mensual mediano | MAE mensual mediano | Estaciones dentro de ±25 % | Estaciones con más de +50 % | Mejor MAE en |
|---|---|---|---|---|---|---|---|
| MERRA-2 (POWER `PRECTOTCORR`) | +21 % | −16 % a +74 % | 0,51 | 51,5 mm | 35 | 27 | 33 estaciones |
| **IMERG (POWER `IMERG_PRECTOT`)** | +39 % | +6 % a +64 % | **0,68** | **46,4 mm** | 34 | 31 | **50 estaciones** |
| ERA5 | **+140 %** | +67 % a +285 % | 0,66 | 110,5 mm | 6 | 69 | 2 estaciones |

Sesgo mediano por franja de altura:

| Altura | n | MERRA-2 | IMERG | ERA5 |
|---|---|---|---|---|
| 2.000–2.600 m | 31 | +6 % | +37 % | +165 % |
| 2.600–3.000 m | 31 | +30 % | +49 % | +157 % |
| 3.000–4.000 m | 23 | +21 % | +21 % | +103 % |

### Sierra centro (Cotopaxi, Tungurahua, Chimborazo, Bolívar), lluvia anual en mm

| Estación | Altura | INAMHI | MERRA-2 | IMERG | ERA5 |
|---|---|---|---|---|---|
| San Juan (Chimborazo) | 3.220 | **658** | 1.415 | 922 | 1.350 |
| Cebadas | 2.930 | **637** | 1.354 | 952 | 1.512 |
| Licto | 2.865 | **722** | 1.365 | 1.029 | 2.788 |
| Guano | 2.620 | **373** | 1.338 | 937 | 1.381 |
| Achupallas | 3.178 | **707** | 1.146 | 819 | 1.891 |
| Alausí | 2.267 | **605** | 1.201 | 830 | 12.220 |
| Querochaca (UTA) | 2.865 | **602** | 1.399 | 827 | 2.085 |
| Pilahuín | 3.314 | **735** | 1.440 | 900 | 1.185 |
| Cusubamba | 3.175 | **559** | 1.149 | 807 | 1.290 |
| Rumipamba-Salcedo | 2.685 | **534** | 1.258 | 1.043 | 1.852 |

## Interpretación
1. **En los valles secos de la sierra centro, MERRA-2 duplica la lluvia.** Es la zona objetivo del bot (Chimborazo y Tungurahua).
   Confirma lo que ya dice el README: "sin corrección POWER duplica la lluvia en los Andes".
2. **IMERG sigue mejor el ritmo de los meses**: r = 0,68 frente a 0,51, y tiene el menor error mensual en 50 de 85 estaciones.
   Para decidir **cuándo** sembrar y **en qué mes** falta agua, IMERG es mejor base que MERRA-2.
3. **Ningún satélite acierta el volumen sin corrección local.** IMERG sobrestima entre 20 y 50 % en la sierra centro.
4. **ERA5 no sirve para lluvia en la sierra.** Mezcla la lluvia de las vertientes amazónica y costera; en Alausí y Chunchi da más de 12.000 mm.

### ¿Y ECMWF IFS, que el bot usa para corregir?
El archivo de IFS en Open-Meteo empieza en 2017, y solo 7 estaciones tienen 2018 y 2019 completos. El resultado es indicativo:

| Fuente (2018–2019, 7 estaciones) | Sesgo mediano | r mensual mediano |
|---|---|---|
| MERRA-2 | +33 % | 0,82 |
| IMERG | +57 % | 0,71 |
| **ECMWF IFS 9 km** | **+56 %** | 0,71 |

En Rumipamba-Salcedo, IFS dio +302 % con r = −0,36. **No hay evidencia de que la corrección con IFS acerque la lluvia a lo
observado.** Conviene reemplazarla o complementarla con un factor por estación INAMHI.

## Recomendación
- **Base:** usar `IMERG_PRECTOT` (POWER, mismo cliente y sin clave) como serie de lluvia, en lugar de `PRECTOTCORR`.
- **Corrección de volumen:** aplicar un factor mensual `estación / IMERG` con la estación INAMHI más cercana y de altura parecida,
  calculado en el período común. Si no hay estación cerca, interpolar los factores de las 85 estaciones por distancia y altura.
- **Explicar la incertidumbre al usuario:** mostrar un rango, por ejemplo "entre 650 y 950 mm al año", no un único número.

## Limitaciones
- La serie abierta del INAMHI termina en 2019.
- Una estación es un punto y una celda IMERG mide ~11 km. Parte del error es diferencia de escala, no del satélite.
- No se evaluó CHIRPS por falta de una API de punto. Los estudios lo ubican junto a IMERG como lo mejor en Ecuador ([Magoffin et al. 2023](https://www.mdpi.com/2072-4292/15/24/5713)).
