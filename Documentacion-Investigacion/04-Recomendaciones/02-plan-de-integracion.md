# Plan de integración en el código de Pacha

Ordenado por impacto y esfuerzo. Cada paso es un PR pequeño hacia `develop`, según `CONTRIBUTING.md`.

## Fase 1: cambios baratos en el cliente actual (1–2 días)

### 1.1 Lluvia IMERG como base (`app/clients.py`, `app/engine.py`)
- Agregar una función `power_imerg(lat, lon)` que pida `IMERG_PRECTOT` con `time-standard=UTC` (1998–2024) y la guarde en caché
  igual que `power_daily`.
- En `Clima.__init__`, usar IMERG como `p`. Si IMERG falta en un día, rellenar con `PRECTOTCORR` escalado por la razón mensual
  entre ambos.
- Mantener `self.metodo` actualizado para que la tarjeta diga de dónde sale la lluvia.

### 1.2 Más variables de POWER en el mismo pedido
Agregar a `POWER_PARAMS`: `T2MDEW`, `TS_MIN` y `GWETROOT`. Siguen siendo menos de 20 parámetros, así que basta un solo pedido.
- `GWETROOT` → percentil del año actual frente a la climatología, para mostrar "suelo más seco que lo normal".
- `T2MDEW` y `TS_MIN` → índice de helada radiativa: `p(TS_MIN ≤ 0 °C)` y noches con `T2MDEW < 0 °C`.

### 1.3 Fuentes dentro de la regla (NASA + recursos de la convocatoria)
Ver [../01-NASA/03-fuentes-permitidas.md](../01-NASA/03-fuentes-permitidas.md).
- `clients.elevation`: cambiar Open-Meteo por NASADEM/SRTM. Es el mismo trabajo que la pendiente de la fase 3.2, así que
  conviene adelantarlo.
- `clients.soil`: SoilGrids queda fuera. Reemplazarlo por FAO GAEZ v4 y por el MAG (fase 2.2). Mientras tanto, la capacidad de
  agua puede salir de la textura del MAG.
- `_ajuste_ifs`: reemplazar por el factor INAMHI sobre IMERG (fase 2.1).
- `forecast_week`: evaluar GEOS-FP o GEOS-CF de NASA (GMAO) para reemplazar el pronóstico de Open-Meteo. Todavía no se probaron.

### 1.4 Precios reales (`app/crops.csv` y `app/catalog.py`)
- Descargar el CSV de precios al productor del MAG (Datos Abiertos) una vez al mes con un script en `scripts/`.
- Mapear `PP_PRODUCTO` a `crop.id`, por ejemplo "Papa Superchola" → `papa` y "Haba Tierna En Vaina" → `haba`.
- Reemplazar el `ingreso` fijo por la mediana de USD/kg de los últimos 24 meses en la provincia del agricultor.

## Fase 2: datos de Ecuador preprocesados (3–5 días)

### 2.1 Factor de lluvia por estación INAMHI
- Script `scripts/factores_inamhi.py` que:
  1. lee el CSV de precipitación del INAMHI;
  2. para las 85 estaciones de sierra, calcula el factor mensual `obs / IMERG`;
  3. guarda `app/factores_inamhi.csv` con `cod, lat, lon, alt, f_ene … f_dic`.
- En `Clima`, si hay una estación a menos de 15 km y con menos de 300 m de diferencia de altura, aplicar su factor. Si no, usar
  ponderación por inverso de la distancia.
- Reemplaza o complementa `_ajuste_ifs`, que no mostró mejora en la validación 2018–2019.

### 2.2 Suelo: MAG como fuente principal y GAEZ como respaldo (parámetros #11–#15)
- Script offline que recorta a la sierra el geopedológico (1,29 GB). Se puede leer desde el zip con
  [../03-Verificacion-Endpoints/scripts/gaez_vs_mag.py](../03-Verificacion-Endpoints/scripts/gaez_vs_mag.py).
  **Usar los nombres de columna corregidos** (el DBF los tiene corridos): profundidad = `ndr`, pedregosidad = `pfe`,
  pH = `txc`, toxicidad = `pdr`, textura = `stx`/`txs`, materia orgánica = `rmo`, CIC = `cic`, saturación de bases = `sdb`,
  pendiente = `pen`.
- Recortar también la ZAE de papa, cebada, quinua y chocho, la capacidad de uso y los riesgos agroclimáticos.
- Guardar en GeoPackage o PostGIS (Supabase ya está en el stack).
- Nueva función `clients.suelo(lat, lon)`:
  1. MAG por punto: `{profundidad, pedregosidad, textura, ph, toxicidad, mo, cic, sb, pendiente, zae: {papa: "apto", …}}`;
  2. si no hay polígono MAG o es "NO APLICABLE", usar GAEZ `getSamples` (`LR`: 676, 682, 683, 686, 694, 718), sin clave y con
     un User-Agent de navegador.
- Reemplaza a `clients.soil` (SoilGrids).
- En `recomendar_para_empezar` y `evaluar_rotacion`:
  - **#11** profundidad → tope del banco de agua; si es superficial o pedregoso, penalizar papa, melloco y oca;
  - **#12** textura → agua útil por cm (franco arenoso menos que franco);
  - **#13** pH ácido o toxicidad por aluminio → penalizar haba y cebada, favorecer chocho y quinua, y sugerir cal;
  - **#14** materia orgánica baja → subir el peso de leguminosas, abonos verdes y descanso en la rotación;
  - **#15** ZAE "no apto" → excluir el cultivo; mostrar GAEZ como dato global de contraste.
- Mostrar en la tarjeta el riesgo agroclimático del MAG y la fuente: "suelo: MAG 1:25.000 (respaldo FAO GAEZ)".

## Fase 3: satélites con proceso batch (1 semana)

### 3.1 LST nocturna y NDVI (ORNL, sin clave)
- Un cron semanal que, para cada celda de 1 km donde haya usuarios (o una grilla de la sierra), descarga `MOD11A2 LST_Night_1km` y
  `MOD13Q1 NDVI` y guarda climatologías mensuales.
- Respetar el límite de ORNL: máximo 10 fechas por pedido y de 30 a 180 s cada uno, con 502/503 intermitentes. Reintentar con espera y paralelizar con prudencia.
- Agregar `MOD17A2HGF` (GPP) y `MCD15A2H` (LAI) para el parámetro #7.
- Usos:
  - `prob_helada` = combinación de POWER corregido y la frecuencia de LST nocturna ≤ 0 °C en ese mes;
  - "Historial de tu zona": gráfico de NDVI de los últimos 5 años con la temporada de siembra marcada.

### 3.2 Pendiente (NASADEM 30 m)
- Crear una cuenta gratuita de Earthdata (o una clave de OpenTopography) y guardar la clave en `.env`, nunca en el código.
- Descargar una vez las teselas de la sierra, calcular la pendiente y guardarla como ráster recortado (unos cientos de MB) o
  muestrearla bajo demanda.
- En el puntaje: penalizar tubérculos en pendientes de más de 25 % y bonificar cobertura o leguminosas.

### 3.3 SMAP L4 (opcional)
- Requiere Earthdata Login y lectura de HDF5 (`h5py`). Se justifica cuando haya usuarios activos, para anomalías de humedad casi en
  tiempo real.

## Variables de entorno nuevas
| Variable | Para qué |
|---|---|
| `EARTHDATA_TOKEN` | NASADEM y SMAP (fase 3) |
| `OPENTOPO_API_KEY` | Alternativa para el DEM |

Recordatorio de `CONTRIBUTING.md`: las claves solo van en `.env`; el hook `pre-commit` y gitleaks bloquean secretos.

## Cómo medir que mejoramos
- Reutilizar [../03-Verificacion-Endpoints/scripts/valid.py](../03-Verificacion-Endpoints/scripts/valid.py) como prueba de regresión.
- Separar estaciones INAMHI en calibración (70 %) y validación (30 %), y reportar sesgo y MAE antes y después de cada cambio.
- Meta inicial: sesgo mediano de lluvia dentro de ±15 % y correlación mensual de 0,7 o más en las estaciones de validación.
