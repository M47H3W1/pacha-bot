# Cuánta data entregan los endpoints (verificado el 2026-11-14)

Puntos de prueba:
- **Guamote** (-1,93; -78,71; ~3.050 m)
- Riobamba (-1,67; -78,65)
- Cayambe (0,04; -78,14)
- Saraguro (-3,62; -79,24)

Además se usaron las estaciones del INAMHI. Los scripts están en [scripts/](scripts/) y las salidas en [resultados/](resultados/).

## 1. NASA POWER (`power.larc.nasa.gov/api/temporal/daily/point`)

| Pedido | Resultado |
|---|---|
| 20 parámetros, 1981-01-01 a 2026-11-10 | **5,5 MB de JSON en 3,8 s**; 16.750 días por parámetro |
| Límite por pedido | 20 parámetros |
| Clave | No hace falta |
| `PSC` (presión corregida) | Exige pasar la altura del sitio. Sin ella responde error |

Disponibilidad por parámetro en Guamote (días con dato / días pedidos):

| Parámetro | Días con dato | Primer día | Último día |
|---|---|---|---|
| `T2M_MAX`, `T2M_MIN`, `T2MDEW`, `RH2M`, `WS2M`, `PRECTOTCORR` | 16.750 / 16.750 | 1981-01-01 | 2026-11-10 |
| `GWETTOP`, `GWETROOT`, `GWETPROF`, `EVLAND`, `TS_MIN`, `TSOIL1`, `FROST_DAYS` | 16.750 / 16.750 | 1981-01-01 | 2026-11-10 |
| `ALLSKY_SFC_SW_DWN` | 15.652 | 1984-01-01 | 2026-11-09 |
| `ALLSKY_SFC_PAR_TOT` | 15.583 | 1984-01-01 | 2026-08-30 |
| `CLRSKY_DAYS` | 9.373 | 2001-01-01 | 2026-08-30 |
| `IMERG_PRECTOT` (con `time-standard=UTC`) | 10.484 | **1998-01-01** | 2026-09-14 |
| `IMERG_PRECTOT` (sin UTC) | **0** | Devuelve "IMERG Source Data is not available at the LST standard" | |
| `RZMC`, `SFMC`, `PRMC`, `*_PRCNTL`, `GWM_HEIGHT` | **0** | No hay datos fuera de EE. UU. | |

Climatología (`/temporal/climatology/point`), período 2001–2025:
- `CD_DB_EXTREME_MIN_05/10/20` en Guamote: 1,6 / 1,2 / 0,8 °C.
- `FROST_DAYS`: 0 días en todos los meses. Ese umbral no sirve para la sierra.
- `GWETROOT` mensual: 0,76 (septiembre) a 0,86 (abril-mayo).

### Comparación de lluvia y temperatura mínima entre fuentes (2018–2024)

| Punto | POWER MERRA-2 | POWER IMERG | ECMWF IFS 9 km | ERA5 | Tmin media POWER | Tmin media IFS | Tmin media ERA5 |
|---|---|---|---|---|---|---|---|
| Guamote | 1.589 mm | **866 mm** | 1.169 mm | 1.722 mm | 7,5 °C | 10,3 °C | 8,7 °C |
| Riobamba | 1.632 | **964** | 935 | 1.525 | 7,3 | 11,4 | 10,3 |
| Cayambe | 1.487 | 1.512 | 3.128 | 2.207 | 6,5 | 9,7 | 9,9 |
| Saraguro | 662 | 1.009 | (429) | 1.647 | 12,8 | — | 11,7 |

(429) significa que Open-Meteo devolvió "Too Many Requests". Las fuentes difieren hasta 3 veces en la lluvia anual. Por eso
es imprescindible validar contra estaciones: ver [02-validacion-lluvia-INAMHI.md](02-validacion-lluvia-INAMHI.md).

## 2. NASA Earthdata (CMR): cobertura sobre Chimborazo
Consulta: `cmr.earthdata.nasa.gov/search/granules.json?collection_concept_id=…&bounding_box=-79.2,-2.5,-78.3,-1.3`. El catálogo no
requiere clave, pero **todas las descargas requieren Earthdata Login**. No hay `.netrc` en esta máquina.

| Producto | Versión | Desde | Hasta | Gránulos en Chimborazo | Resolución |
|---|---|---|---|---|---|
| SMAP `SPL3SMP_E` | 006 | 2015-03-31 | en curso | 4.167 | 9 km diario |
| SMAP `SPL4SMGP` | 008 | 2015-03-31 | en curso | 33.961 | 9 km cada 3 h, con zona de raíces |
| SMAP `SPL2SMAP_S` | 003 | 2015-03-31 | en curso | 2.208 | 3 km |
| SMAP `SPL3FTP` | 004 | 2015-03-31 | en curso | 4.160 | 36 km (congelamiento) |
| GPM `GPM_3IMERGDF` | 07 | 1998-01-01 | 2025-09-30 | 10.135 | 0,1° diario |
| GPM `GPM_3IMERGM` | 07 | 1998-01-01 | 2025-09-30 | 333 | 0,1° mensual |
| MODIS `MOD13Q1` | 061 | 2000-02-18 | en curso | 614 | 250 m, 16 días |
| MODIS `MYD13Q1` | 061 | 2002-07-04 | en curso | 560 | 250 m, 16 días |
| VIIRS `VNP13A1` | 002 | 2012-01-17 | en curso | 680 | 500 m, 16 días |
| MODIS `MOD16A2GF` (ET) | 061 | 2000-01-01 | en curso | 1.196 | 500 m, 8 días |
| MODIS `MOD11A2` (LST) | 061 | 2000-02-18 | en curso | 1.226 | 1 km, 8 días |
| MODIS `MOD15A2H` (LAI) | 061 | 2000-02-18 | en curso | 1.223 | 500 m, 8 días |
| MODIS `MCD12Q1` (cobertura) | 061 | 2001 | en curso | 25 | 500 m, anual |
| HLS `HLSL30` (Landsat) | 2.0 | 2013-04-11 | en curso | 2.467 | 30 m |
| HLS `HLSS30` (Sentinel-2) | 2.0 | 2015-11-28 | en curso | 3.407 | 30 m |
| ECOSTRESS `ECO_L2T_LSTE` | 003 | 2018-07-09 | en curso | 840 | 70 m |
| ECOSTRESS `ECO_L3T_JET` (ET) | 003 | 2018-07-09 | en curso | **81** | 70 m |
| ECOSTRESS `ECO_L4T_ESI` | 003 | 2018-07-09 | en curso | **81** | 70 m |
| GLDAS `GLDAS_NOAH025_3H` | 2.1 | 2000-01-01 | en curso | 77.671 | 0,25°, 3 h |
| GLDAS `GLDAS_NOAH025_M` | 2.1 | 2000-01-01 | en curso | 319 | 0,25° mensual |
| GLDAS `GLDAS_CLSM025_DA1_D` | 2.2 | 2003-02-01 | en curso | 8.613 | 0,25° diario (asimila GRACE) |
| FLDAS `FLDAS_NOAH01_C_GL_M` | 001 | 1982-01-01 | en curso | 537 | 0,1° mensual (CHIRPS) |
| SRTM `SRTMGL1` | 003 | 2000-02 | — | 4 teselas | 30 m |
| `NASADEM_HGT` | 001 | 2000-02 | — | 4 teselas | 30 m |
| GEDI `GEDI02_B` | 003 | 2019-04-04 | en curso | 263 | huellas de 25 m |
| OPERA `DSWX-HLS` (agua superficial) | 1.0 | 2016 | en curso | 5.734 | 30 m |

## 3. ORNL DAAC: API de punto sin clave (`modis.ornl.gov/rst/api/v1`)
- Tiene 46 productos, entre ellos MOD13Q1, MOD11A2, MOD16A2GF, MOD17A2HGF (GPP), MCD15A2H (LAI), ECO4ESIPTJPL, VNP13A1 y
  dos de SMAP: **`SPL3SMP_E`** (humedad superficial, 5 cm) y `SPL4CMDL` (carbono).
- **`SPL4SMGP` (humedad en zona de raíces) no está en ORNL**: hay que descargarlo con Earthdata Login (NSIDC).
- `MOD13Q1` en Guamote: **614 fechas (2000-02-18 a 2026-10-16)**, con bandas NDVI, EVI, reflectancias y fiabilidad del píxel.
- `MOD11A2` `LST_Night_1km`: funciona. Primera fecha de 2024: 13.741 × 0,02 = 274,8 K, es decir **1,7 °C** en la superficie de noche.
- `MOD16A2GF`: 1.196 fechas (2000 a 2025-12-27).
- `MOD17A2HGF` y `MCD15A2H`: funcionan. En el centro poblado de Guamote devuelven el código "urbano" (32762 y 250); hay que
  muestrear el campo alrededor.
- `SPL4CMDL` y `ECO4ESIPTJPL`: "No data available for -1.93 -78.71". ORNL solo tiene algunos sitios para esos productos.
- **Estabilidad:** ORNL devuelve errores **502/503 intermitentes**: en la verificación del 2026-11-14 hubo varios seguidos. Hay
  que reintentar con espera; el cliente de [scripts/verificar_endpoints.py](scripts/verificar_endpoints.py) reintenta 3 veces.
- Velocidad: **30–180 s por pedido**, con máximo 10 fechas por pedido. Para 25 años de NDVI hacen falta unos 60 pedidos. **Hay
  que precalcular por celda y guardar en caché.**

## 4. Ecuador

| Endpoint | Resultado |
|---|---|
| Datos Abiertos (CKAN) `datosabiertos.gob.ec/api/3/action/package_search` | OK. INAMHI tiene 4 conjuntos y MAG 70 |
| CSV de precipitación del INAMHI | **947 estaciones, 20.588 filas (años-estación), 1960–2019**. Sierra a 2.000 m o más: 334 estaciones; 85 con 10 o más años completos en 2001–2019 |
| CSV de Tmin absoluta del INAMHI | 134 estaciones, solo 2013 |
| CSV de precios al productor del MAG | 16.748 filas, 2016–2026-06, 112 productos, por provincia |
| Shapefile geopedológico del MAG | 1,29 GB (`Content-Length: 1293801341`), 202.145 polígonos, acepta pedidos por rango |
| `servicios.inamhi.gob.ec` / `inamhi.gob.ec` | Al inicio del día, certificado SSL inválido para clientes automáticos. En la re-verificación respondió 200 |
| `geoportal.agricultura.gob.ec/geoserver/*` | Sin servicio (404 o tiempo de espera agotado; no hay WMS/WFS público) |
| `sipa.agricultura.gob.ec` | 200 |

## 5. FAO GAEZ v4 (`gaez-services.fao.org/server/rest/services`)
- Servicios ImageServer: `LR` (recursos de tierra: suelo, terreno, agua; 134 rásteres) y `res01`, `res02`, `res05`, `res06`,
  `res07`. `res05` tiene **122.708 rásteres** de aptitud y rendimiento por cultivo, escenario e insumos.
- **`getSamples` por punto o multipunto, sin clave**: unas 400 coordenadas por pedido en menos de 1 s.
- **Exige un `User-Agent` de navegador**; con el de Python responde 403.
- Resolución: suelo dominante y pendiente a 30″ (≈1 km); calidades de suelo SQ1–SQ7 y aptitud a 5′ (≈9 km).
- Contraste con el MAG: [04-validacion-suelo-GAEZ-vs-MAG.md](04-validacion-suelo-GAEZ-vs-MAG.md).

## 6. SoilGrids (`rest.isric.org/soilgrids/v2.0`), fuera de la regla de fuentes
Tiene 14 propiedades: `bdod, cec, cfvo, clay, nitrogen, ocd, ocs, phh2o, sand, silt, soc, wv0010, wv0033, wv1500`.
El bot hoy pide solo `clay, sand, soc`. Valores de Guamote en
[../02-Ecuador/03-INEC-INIAP-y-otras-fuentes.md](../02-Ecuador/03-INEC-INIAP-y-otras-fuentes.md).
