# Parámetros para un buen crecimiento de la planta

Además de agua y helada, que ya usa el bot, estos parámetros NASA describen las condiciones de crecimiento: luz, temperatura del
suelo, humedad del aire, enfermedades y vigor real de la vegetación. Todos tienen cobertura global y se verificaron en Guamote
(−1,933; −78,712), 2005–2024.

## Luz para la fotosíntesis (POWER, sin clave)
| Parámetro | Qué es | Guamote |
|---|---|---|
| `ALLSKY_SFC_PAR_TOT` | Luz útil para la fotosíntesis (PAR) que llega al suelo | **6,3 MJ/m²/día**. Menor en junio (5,9), mayor en octubre (7,0) |
| `CLRSKY_SFC_PAR_TOT` | La misma luz si no hubiera nubes | 11,4 MJ/m²/día |
| `CLOUD_AMT` | Cobertura de nubes | 79 %. Máxima en marzo (87 %), mínima en agosto-septiembre (72 %) |
| `ALLSKY_SFC_UV_INDEX`, `ALLSKY_SFC_UVB` | Radiación ultravioleta | Más alta en octubre-noviembre |

- **Hallazgo:** las nubes quitan **el 45 % de la luz** en promedio.
- **Uso:** para un cultivo, la luz total del ciclo (`Σ PAR × fracción interceptada`) da su potencial de rendimiento. Es un dato
  extra para elegir el mes de siembra, por ejemplo septiembre-noviembre frente a marzo-abril.
- **Contraste en Ecuador:** heliógrafos y piranómetros del INAMHI, en sus anuarios. No hay serie abierta en CSV.

## Temperatura y humedad del suelo, para la germinación (POWER)
| Parámetro | Qué es | Guamote |
|---|---|---|
| `TSOIL1`, `TSOIL2` (hasta `TSOIL6`) | Temperatura del suelo por capa | **12,7 °C** de media. Mínima en julio (11,3 °C), máxima en noviembre (13,5 °C) |
| `GWETTOP` | Humedad de los primeros 5 cm (0 a 1) | 0,80. Mínima en septiembre (0,74) |
| `GWETROOT` | Humedad en la zona de raíces | Ya está en el top 5 |

- **Uso:** comparar con el umbral de germinación de cada cultivo y avisar cuando el suelo está frío para sembrar. Hay que agregar
  una columna `t_germ_min` a `crops.csv`, con valores del INIAP o la FAO; no los inventé en este documento.
- **Cuidado:** es la temperatura de una celda de 55 km, más cálida que la de un sitio a 3.000 m o más. Por ejemplo,
  `FROST_DAYS` vale **0 todos los días de 20 años**, aunque en Guamote sí hay heladas. Hay que corregirla con la altura y
  contrastarla con las estaciones agrometeorológicas del INAMHI.

## Humedad del aire y enfermedades: la lancha de la papa
La lancha (*Phytophthora infestans*) es la principal enfermedad de la papa en la sierra. Aparece con humedad relativa alta y
temperaturas templadas.

- **Datos NASA:** POWER **horario** (`T2M`, `RH2M`), sin clave. Otras variables relacionadas: `T2MDEW`, `QV2M` y `T2MWET`.
- **Prueba:** días al mes con 10 o más horas con humedad ≥ 90 % y entre 7 y 25 °C, en Guamote, 2019–2023. Script:
  [../03-Verificacion-Endpoints/scripts/lancha.py](../03-Verificacion-Endpoints/scripts/lancha.py).

| Ene | Feb | Mar | Abr | May | Jun | Jul | Ago | Sep | Oct | Nov | Dic |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 28 | 27 | 29 | 29 | 26 | 18 | 13 | **8** | **10** | 23 | 28 | 29 |

- **Lectura:** la presión de lancha baja mucho de julio a septiembre. Para papa, eso favorece siembras cuyo crecimiento coincida
  con meses menos húmedos, o pide prever fungicida o variedades resistentes del INIAP en la época lluviosa.
- **Cuidado:** POWER sobrestima la humedad, porque su celda incluye zonas húmedas de las vertientes. El número absoluto está
  inflado; **sirve el ritmo estacional, no el conteo**. Habría que contrastarlo con la humedad horaria del INAMHI y con los
  modelos de pronóstico de lancha del INIAP y del CIP (SimCast).
- **Uso en el bot:** un nuevo componente `sanidad` en el puntaje de la papa, y en rotaciones recordar que papa tras papa aumenta
  la lancha y los nematodos (el motor ya penaliza `papa_tras_papa`).

## Vigor real de la vegetación (MODIS por ORNL, sin clave)
Muestran **cómo crece de verdad la vegetación**, no lo que dice un modelo.

| Producto | Qué mide | Resolución | Fechas disponibles |
|---|---|---|---|
| `MOD17A2HGF` GPP | Fotosíntesis bruta (carbono fijado) | 500 m, cada 8 días | 1.196 archivos desde 2000 |
| `MCD15A2H` LAI y FPAR | Área de hojas y fracción de luz que captura | 500 m, cada 8 días | 1.116 fechas desde 2002 |
| `MOD13Q1` NDVI y EVI | Verdor | 250 m | Ya está en el top 5 |

Muestras de enero a marzo de 2023 en tres puntos rurales cerca de Guamote (GPP convertido a g C/m² por día):

| Punto | GPP | LAI |
|---|---|---|
| −1,90; −78,68 | 0,9 a 2,9 | 0,1 a 0,6 |
| −1,97; −78,74 | 1,1 a 2,7 | 0,1 a 0,7 |
| −1,86; −78,75 | 1,8 a 6,2 | 0,2 a 2,7 |

- **Hallazgo:** zonas a pocos kilómetros tienen hasta **3 veces** más productividad. Ese dato no lo da el clima.
- **Cuidado:** en el pueblo de Guamote (el punto exacto −1,933; −78,712), MODIS devuelve el código "urbano" (32762 y 250), no un
  valor. Hay que muestrear el campo alrededor del punto del usuario, no el centro poblado.
- **Uso:**
  - un índice de productividad de la zona (GPP de la temporada de cultivo comparado con la mediana de la sierra);
  - detectar suelos cansados (GPP bajo y en descenso año a año), donde conviene meter leguminosas o descanso.
- **Contraste en Ecuador:** rendimientos por cultivo y provincia de **INEC ESPAC**. A esa escala no valida parcelas, pero sí si
  las provincias con más GPP rinden más.

## Nutrientes del suelo (no hay datos NASA)

> Los parámetros de suelo finales (#11–#15) y su contraste GAEZ frente al MAG están en
> [../04-Recomendaciones/04-top15-parametros.md](../04-Recomendaciones/04-top15-parametros.md) y
> [../03-Verificacion-Endpoints/04-validacion-suelo-GAEZ-vs-MAG.md](../03-Verificacion-Endpoints/04-validacion-suelo-GAEZ-vs-MAG.md).

Ningún producto NASA **mide nutrientes** (N, P, K ni pH). Dentro de la regla de fuentes:
- **FAO GAEZ v4** (recurso de la convocatoria): capas globales de recursos y calidad del suelo, con limitantes de nutrientes y de
  enraizamiento. Se accede por rásteres; todavía no se verificó por punto.
- **MAG geopedológico 1:25.000** y su mapa de fertilidad: pH (`phi`), CIC (`cic`), profundidad (`pfe`) y drenaje (`ndr`). Es
  más detallado que GAEZ y sirve de contraste ecuatoriano.
- SoilGrids, que usa hoy el bot, **no es NASA ni recurso de la convocatoria** (ver [../01-NASA/03-fuentes-permitidas.md](../01-NASA/03-fuentes-permitidas.md)).
- **Uso:** el pH para excluir cultivos fuera de rango (el chocho y la quinua toleran más que la haba) y el nitrógeno bajo para
  priorizar leguminosas en la rotación.

## Resumen de parámetros de crecimiento
| Parámetro | NASA | Contraste Ecuador | Impacto en la recomendación | Esfuerzo |
|---|---|---|---|---|
| Riesgo de lancha (HR y T horarias) | POWER horario | INAMHI, INIAP | **Alto para papa** | Bajo |
| Productividad real (GPP y LAI) | MODIS por ORNL | INEC ESPAC | Alto en rotación y descanso | Medio |
| Temperatura del suelo | POWER `TSOIL1` | INAMHI agrometeorológico | Medio: fecha de siembra | Bajo |
| Luz PAR y nubes | POWER | INAMHI | Medio: potencial por mes | Bajo |
| Ceniza y SO2 volcánico | OMI/OMPS SO2, POWER `AOD_55`, MODIS MAIAC | IG-EPN | Alto en zonas volcánicas | Medio |
| Fotosíntesis (SIF) | OCO-2 SIF | — | Bajo: datos muy dispersos | Alto |
| Nutrientes y pH | FAO GAEZ v4 (convocatoria) | MAG geopedológico | Alto en rotación | Medio |
