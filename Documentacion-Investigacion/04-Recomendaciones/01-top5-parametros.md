# Los 5 parámetros NASA que más reducen el error de Pacha

> Este documento detalla los 5 primeros. La lista final de **15 parámetros** (con crecimiento, sanidad y suelo) está en
> [04-top15-parametros.md](04-top15-parametros.md).

## Criterio de selección
Un parámetro entra si cumple las cuatro condiciones:
1. **Ataca un error medido** o un hueco real del motor actual (`app/engine.py`).
2. **Cambia la recomendación**: qué cultivo, cuándo sembrar, cuánto regar o qué rotación.
3. **Tiene datos en la sierra de Ecuador**, verificados el 2026-11-14.
4. **Es accesible para un bot en producción**: sin clave, o con proceso offline razonable.

Lo que el bot ya usa (`T2M_MAX`, `T2M_MIN`, `PRECTOTCORR`, `RH2M`, `WS2M` y `ALLSKY_SFC_SW_DWN`) no entra en la lista.

## Resumen

| # | Parámetro | Producto NASA | Qué error reduce | Acceso | Esfuerzo |
|---|---|---|---|---|---|
| 1 | **Lluvia diaria IMERG** (`IMERG_PRECTOT`) | GPM IMERG V07 vía POWER | Lluvia mal distribuida en el año: MERRA-2 tiene r = 0,51 e IMERG r = 0,68 | POWER, sin clave | **Bajo** |
| 2 | **Humedad en zona de raíces** (`GWETROOT` y SMAP L4 `sm_rootzone`) | MERRA-2 vía POWER; SMAP `SPL4SMGP` | El banco de agua arranca siempre "lleno" y no ve los años secos reales | POWER sin clave; SMAP con Earthdata | Bajo (POWER) / Medio (SMAP) |
| 3 | **Temperatura nocturna de superficie** (`LST_Night_1km` y `TS_MIN`) | MODIS `MOD11A2`; POWER | Heladas: errores de ±2–5 °C con la mínima de 0,5°, y no se ve la inversión del valle | ORNL sin clave; POWER | Medio |
| 4 | **Pendiente del terreno** | SRTM / NASADEM 30 m | El bot ignora la erosión: recomienda papa igual en ladera de 40 % que en plano | OpenTopography con clave gratuita, o Earthdata | Medio |
| 5 | **NDVI/EVI de 16 días** | MODIS `MOD13Q1` 250 m | El bot no sabe qué pasó realmente en el lote: descanso, fecha de siembra local, vigor | ORNL sin clave | Medio |

## 1. Lluvia diaria IMERG (`IMERG_PRECTOT`)
- **Problema actual:** `Clima` usa `PRECTOTCORR` (MERRA-2). Contra 85 estaciones INAMHI, MERRA-2 tiene correlación mensual mediana de 0,51
  y duplica la lluvia en la sierra centro (San Juan-Chimborazo: 1.415 mm frente a 658 observados).
- **Evidencia:** IMERG tiene r = 0,68 y el menor error mensual en **50 de 85 estaciones**. Ver [validación](../03-Verificacion-Endpoints/02-validacion-lluvia-INAMHI.md).
- **Qué mejora:** el mes de déficit en el banco de agua, el mes de siembra recomendado y la lluvia útil por etapa del cultivo.
- **Cuidado:** sobrestima entre 20 y 50 % en valles secos. Combinarlo con un factor por estación INAMHI (ver el plan).
- **Detalle técnico:** el pedido a POWER debe ir aparte con `time-standard=UTC`; si no, devuelve `-999`. Hay datos desde 1998.

## 2. Humedad en la zona de raíces
- **Problema actual:** `banco_de_agua` calcula lluvia útil menos ETc mes a mes, sin memoria del suelo. Un año que arranca seco y uno
  que arranca húmedo dan la misma recomendación de riego del primer mes.
- **Opción inmediata:** POWER `GWETROOT` (0 a 1), con 16.750 días completos en Guamote desde 1981. Su climatología va de 0,76 en
  septiembre a 0,86 en abril-mayo.
- **Opción más precisa:** SMAP L4 `SPL4SMGP` (9 km, cada 3 h, desde 2015, 33.961 gránulos en Chimborazo). Asimila la medición
  satelital de banda L. Requiere Earthdata Login y procesar HDF5, así que conviene un cron que guarde una serie por celda.
- **Qué mejora:**
  - el agua inicial al sembrar (`litros` y `riego_semana`);
  - los percentiles de sequía ("este año está en el 20 % más seco");
  - la elección de cultivos tolerantes (chocho, quinua, cebada) cuando el suelo arranca bajo.
- **Cuidado:** ninguno de los dos está validado en andisoles de páramo, porque esos suelos retienen mucha agua. Úsese como **anomalía**
  (más seco o más húmedo que lo normal), no como valor absoluto. La capacidad de agua del suelo puede salir de GLDAS por capas o
  del MAG (profundidad y textura). SoilGrids da unos 73 mm útiles en 40 cm en Guamote, pero no es NASA ni recurso de la convocatoria.

## 3. Temperatura nocturna de superficie (heladas)
- **Problema actual:** la probabilidad de helada se calcula con `T2M_MIN ≤ 4 °C` en una celda de 0,5°, corregida con IFS o con
  6,5 °C/km. Frente al INAMHI (2013, 24 estaciones):
  - ningún modelo detectó los meses con mínima ≤ 0 °C;
  - en los valles, la corrección por altura empeoró el sesgo hasta +5,6 °C (Patate).

  Ver [validación](../03-Verificacion-Endpoints/03-validacion-temperatura-minima.md).
- **Por qué este parámetro:** la helada en la sierra es **radiativa**: noche despejada, aire seco y frío que baja a la hondonada.
  La temperatura de superficie nocturna de MODIS (1 km, cada 8 días, desde 2000) "ve" ese enfriamiento y las diferencias entre
  ladera y fondo de valle que la celda de 50 km no ve.
- **Complementos en POWER, sin costo extra:**
  - `TS_MIN`: mínima de superficie;
  - `T2MDEW`: punto de rocío; si está por debajo de 0 °C, la noche es seca y hay riesgo alto;
  - `CD_DB_EXTREME_MIN_10`: mínima con periodo de retorno de 10 años.
- **Qué mejora:** el puntaje de exposición a helada (`exposicion_helada`), los meses de siembra prohibidos para papa, maíz y fréjol
  (sensibilidad "alta"), y la alerta de 7 días.
- **Acceso:** API de ORNL sin clave, ya verificada. LST nocturna en Guamote del 1 de enero de 2024: 1,7 °C. Es lenta (30–60 s por
  pedido), así que hay que precalcular una climatología mensual por celda.

## 4. Pendiente del terreno (SRTM/NASADEM 30 m)
- **Problema actual:** el sitio solo tiene altura (Open-Meteo, Copernicus de 90 m). No hay pendiente, y la erosión es el mayor
  problema del suelo en Chimborazo. Por ejemplo, el INIAP estudió siembra de papa en hoyos en suelos erosionados de Cacha.
- **Qué mejora:**
  - en laderas de más de 25–30 % se penalizan cultivos que dejan el suelo desnudo (papa, melloco, oca) y se priorizan cobertura y
    leguminosas (avena con vicia, chocho, pasto con trébol, descanso);
  - se ajusta la lluvia útil, porque en pendiente hay más escorrentía;
  - coincide con el criterio oficial: la zonificación ZAE y la capacidad de uso del MAG usan `pen` (pendiente) como limitante.
- **Acceso:** `SRTMGL1` y `NASADEM_HGT` cubren Chimborazo con 4 teselas. Se puede descargar una vez la sierra (unos 30 teselas de
  1°) y calcular la pendiente local. NASADEM también debe reemplazar a la altura de Open-Meteo, que no es NASA ni recurso de la convocatoria.

## 5. NDVI/EVI de 16 días (MODIS `MOD13Q1`, 250 m)
- **Problema actual:** el bot recomienda rotaciones sin saber qué pasó en el terreno.
- **Qué mejora:**
  - **historial del lote**: con 614 fechas desde 2000, detecta años de descanso (NDVI bajo y plano) frente a cultivo (pico estacional)
    y valida lo que el agricultor dice;
  - **calendario local**: el mes del pico de verdor en la zona muestra cuándo se siembra realmente allí, para contrastar con el
    `mes_siembra` recomendado;
  - **vigor relativo**: un NDVI máximo bajo de forma repetida sugiere un suelo cansado y favorece meter leguminosas o descanso en la rotación.
- **Acceso:** API de ORNL sin clave, ya verificada. A 250 m, un píxel mezcla varios lotes pequeños de la sierra, así que sirve como
  señal de zona, no de parcela. Para la parcela: HLS 30 m o Sentinel-2, con el límite de la nube.

## Los que quedaron cerca
| Parámetro | Por qué no entró |
|---|---|
| `T2MDEW` (punto de rocío) | Entra como complemento del #3 |
| `GDD4_4`, `GDD10` (grados día) | El ciclo de los cultivos ya está en días; ayudaría a ajustarlo con la altura |
| `EVLAND` / `MOD16A2GF` (ET real) | Útil para validar la ETc calculada; no cambia la recomendación directamente |
| `ALLSKY_SFC_PAR_TOT` | Potencial de rendimiento; poco diferencial entre cultivos de altura |
| `CLOUD_AMT_NIGHT` | Complementa la helada; ya cubierto por LST y punto de rocío |
| ECOSTRESS ET/ESI 70 m | Solo 81 escenas en Chimborazo desde 2018: demasiado irregular |
| Landsat/HLS 30 m | Nubosidad persistente en la sierra |

## Complementos de Ecuador (no NASA) con alto impacto
Estos no son parámetros NASA, pero reducen el error tanto o más que los anteriores:

| Fuente | Dato | Qué corrige |
|---|---|---|
| **INAMHI** (85 estaciones de sierra) | Lluvia mensual observada | El volumen de lluvia: factor por estación sobre IMERG |
| **MAG geopedológico 1:25.000** | Profundidad efectiva (`pfe`), drenaje (`ndr`), pH (`phi`), textura | Tamaño del banco de agua y aptitud por suelo |
| **MAG ZAE por cultivo** | Apto, moderado o marginal para papa, cebada, quinua, chocho… | Reemplaza la aptitud basada solo en altura |
| **MAG riesgos agroclimáticos 2022** | Riesgo de helada y sequía por parroquia | Contraste oficial del cálculo de helada |
| **MAG/SIPA precios al productor** | USD/kg mensual por provincia, 2016–2026 | Reemplaza `ingreso` fijo (alto, medio o bajo) en `crops.csv` |
| **FAO GAEZ v4** (convocatoria) + MAG | Recursos de suelo y aptitud global | La capacidad del banco de agua y la aptitud del suelo (reemplaza a SoilGrids, fuera de la regla) |
