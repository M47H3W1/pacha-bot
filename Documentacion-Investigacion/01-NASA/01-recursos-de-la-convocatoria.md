# Recursos de la convocatoria: qué sirve para la sierra de Ecuador

Revisamos los 23 recursos que lista el reto "Field Shift" (NASA Space Apps 2026). Para cada uno respondemos tres preguntas:
¿cubre Ecuador?, ¿cómo se accede?, ¿mejora las rotaciones de Pacha?

La cobertura de los productos NASA se verificó en el catálogo CMR de Earthdata (`cmr.earthdata.nasa.gov`) con un recuadro sobre
Chimborazo (`-79,2 -2,5 -78,3 -1,3`) el 2026-11-14. Detalle en
[../03-Verificacion-Endpoints/01-volumen-de-datos.md](../03-Verificacion-Endpoints/01-volumen-de-datos.md).

## Resumen

| Recurso | ¿Cubre Ecuador? | Acceso | Utilidad para Pacha |
|---|---|---|---|
| **NASA POWER** | Sí, celda de 0,5° | API REST pública, sin clave | **Alta**. Ya es la base del bot; ofrece 152 parámetros diarios |
| **GPM IMERG** | Sí, 0,1° (≈11 km) | Vía POWER (`IMERG_PRECTOT`) sin clave; archivos completos en GES DISC con Earthdata Login | **Alta**. Es la mejor lluvia satelital en nuestra validación |
| **SMAP** | Sí, 9 km (L3E/L4) y 3 km (SMAP/Sentinel-1) | NSIDC con Earthdata Login. ORNL sin clave solo tiene `SPL3SMP_E` (superficial), no `SPL4SMGP` (zona de raíces) | **Alta**. Humedad en zona de raíces |
| **MODIS / VIIRS** | Sí, 250 m a 1 km | ORNL DAAC sin clave (punto); LP DAAC con login | **Alta**. NDVI/EVI 250 m y LST nocturna 1 km |
| **Landsat (HLS)** | Sí, 30 m | LP DAAC con Earthdata Login | Media. Mucha nube en la sierra |
| **SRTM / NASADEM** | Sí, 30 m | LP DAAC con login; OpenTopography con clave gratuita | **Alta**. Pendiente y erosión |
| **ECOSTRESS** | Sí, 70 m, 81 escenas ET en Chimborazo (2018–hoy) | LP DAAC con login; ORNL no tiene el punto | Baja. Pocas escenas sin nube |
| **GLDAS / FLDAS** | Sí, 0,25° / 0,1° | GES DISC con login | Media. Humedad de suelo y ET modeladas. FLDAS usa CHIRPS |
| **GEDI** | Sí, solo huellas sueltas (L2B: 263 gránulos) | LP DAAC con login | Baja. Pensado para bosques |
| **Copernicus Sentinel-2 (ESA)** | Sí, 10–20 m | Copernicus Data Space; también dentro de HLS (`HLSS30`) | Media. Igual que Landsat, la nube limita |
| **ERA5 (ECMWF)** | Sí, ≈31 km | Open-Meteo sin clave (ya se usa la familia ECMWF) | Media. En la validación sobrestima mucho la lluvia en la sierra |
| **FAO GAEZ v4** | Sí, global: suelo y pendiente a ≈1 km, calidades de suelo y aptitud a ≈9 km | ImageServer `getSamples` sin clave (necesita un User-Agent de navegador), verificado | Media. Respaldo global de suelo. Frente al MAG: ve la mitad de la pendiente y sobrestima la profundidad ([contraste](../03-Verificacion-Endpoints/04-validacion-suelo-GAEZ-vs-MAG.md)) |
| USDA Ag Data Commons | Mayormente EE. UU. | Web | Baja. Sirve para literatura de Kc o rotaciones, no para datos locales |
| Web Soil Survey | **No**, solo EE. UU. | — | Ninguna. En Ecuador se reemplaza por el mapa geopedológico del MAG y SoilGrids |
| CropScape (CDL) | **No**, solo EE. UU. | — | Ninguna. Equivalente local: cobertura y uso del MAG |
| PRISM | **No**, solo EE. UU. | — | Ninguna. Equivalente local: estaciones del INAMHI |
| SSURGO / STATSGO2 | **No**, solo EE. UU. | — | Ninguna. Equivalente: geopedológico MAG 1:25.000 |
| NAIP | **No**, solo EE. UU. | — | Ninguna. Equivalente: ortofotos SIGTIERRAS |
| NLCD | **No**, solo EE. UU. | — | Ninguna. Equivalente: MODIS MCD12Q1 o el mapa de cobertura del MAG |
| NLDAS | **No**, solo Norteamérica | — | Ninguna. Usar GLDAS o FLDAS |
| CoCoRaHS | **No**, Norteamérica | — | Ninguna. Equivalente: pluviómetros del INAMHI |
| USGS NWIS | **No**, solo EE. UU. | — | Ninguna. Equivalente: estaciones hidrológicas del INAMHI |
| USDA AMS Market News | **No**, mercados de EE. UU. | — | Ninguna. Equivalente: precios al productor del MAG/SIPA |
| USDA NASS QuickStats | **No**, solo EE. UU. | — | Ninguna. Equivalente: INEC ESPAC |
| OpenET | **No**, oeste de EE. UU. | — | Ninguna. Usar MOD16A2GF o ECOSTRESS |
| USFS LANDFIRE | **No**, solo EE. UU. | — | Ninguna |

**Conclusión:** 12 recursos sirven en Ecuador y 11 son exclusivos de EE. UU. Para cada recurso de EE. UU. hay un equivalente
ecuatoriano, documentado en [../02-Ecuador/](../02-Ecuador/).

## Notas por producto NASA

### NASA POWER
- 152 parámetros diarios. La meteorología (MERRA-2, celda de 0,5° × 0,625°) va desde 1981; la radiación, desde 1984. Pedimos hasta el 2026-11-10 y la meteorología llegó completa.
- La celda de Guamote está a 2.984 m. La de Saraguro, a 1.976 m frente a ~2.500 m reales: la celda puede errar cientos de metros.
- POWER ya incluye capas de IMERG (`IMERG_PRECTOT`, `IMERG_PRECLIQUID_PROB`). Solo responden con `time-standard=UTC`; si no, devuelven `-999` con el mensaje "The IMERG Source Data is not available at the Local Solar Time (LST) standard".
- Los parámetros de humedad de suelo en m³/m³ (`RZMC`, `SFMC`, `PRMC` y sus percentiles) y de agua subterránea (`GWM_*`) **no tienen datos en Ecuador**. Los que sí funcionan son `GWETROOT`, `GWETTOP` y `GWETPROF`, que son humedad relativa de 0 a 1.
- Catálogo completo: [02-NASA-POWER-catalogo-completo.md](02-NASA-POWER-catalogo-completo.md).

### GPM IMERG (V07)
- `GPM_3IMERGDF`: diario, 0,1°, desde 1998-01-01. Tiene 10.135 gránulos sobre Chimborazo; el producto Final llega hasta 2025-09-30.
- La forma más simple de usarlo es `IMERG_PRECTOT` en POWER: misma API y sin clave. Al 2026-11-14 traía datos hasta 2026-09-14.
- En nuestra validación contra 85 estaciones del INAMHI es la fuente con menor sesgo. Ver [../03-Verificacion-Endpoints/02-validacion-lluvia-INAMHI.md](../03-Verificacion-Endpoints/02-validacion-lluvia-INAMHI.md).

### SMAP
- `SPL3SMP_E`: L3 mejorado a 9 km, diario, desde 2015-03-31, 4.167 gránulos en Chimborazo. Mide los 5 cm superiores.
- `SPL4SMGP`: L4 cada 3 h a 9 km, con humedad **superficial y de zona de raíces (0–100 cm)**, desde 2015-03-31. Tiene 33.961 gránulos.
- `SPL2SMAP_S`: 3 km combinado con Sentinel-1, con escenas irregulares (2.208).
- `SPL3FTP` (congelado/descongelado): en el trópico no aporta.
- Limitaciones: la banda L pierde precisión con relieve fuerte y suelos orgánicos (páramo, andisoles). No encontramos validación publicada de SMAP en el páramo ecuatoriano.
- Acceso: NSIDC exige Earthdata Login. ORNL, sin clave, solo ofrece `SPL3SMP_E` (5 cm superficiales) y `SPL4CMDL`.
  `SPL4SMGP`, la zona de raíces, no está en ORNL (verificado con su lista de productos el 2026-11-14).

### MODIS / VIIRS
- `MOD13Q1` (NDVI/EVI 16 días, 250 m): 614 fechas desde 2000-02-18 hasta 2026-10-16 en Guamote. Se lee sin clave por la API de ORNL (`modis.ornl.gov/rst/api/v1`).
- `MOD11A2` (LST 8 días, 1 km): verificado sin clave. La LST nocturna del 1 de enero de 2024 en Guamote fue 274,8 K (1,7 °C).
- `MOD16A2GF` (ET real 8 días, 500 m, con huecos rellenos): 1.196 fechas desde 2000 hasta 2025-12-27.
- `MOD15A2H` (LAI/FPAR), `MCD12Q1` (cobertura anual) y `VNP13A1` (NDVI VIIRS 500 m) también están disponibles.
- La API de ORNL tarda 30–60 s por consulta y acepta como máximo 10 fechas por pedido. Hay que precalcular y guardar en caché.

### Landsat / HLS
- `HLSL30` (Landsat 30 m, desde 2013) y `HLSS30` (Sentinel-2 armonizado 30 m, desde 2015) tienen cobertura completa.
- Problema práctico: la sierra húmeda tiene nubosidad alta casi todo el año, así que las series de 30 m quedan con muchos huecos.
- Exigen Earthdata Login y procesar rásteres; no hay API de punto lista para usar.

### SRTM / NASADEM
- `SRTMGL1` y `NASADEM_HGT`: 30 m, 4 teselas cubren Chimborazo. Requieren Earthdata Login u OpenTopography con clave gratuita.
- Sirve para calcular **pendiente**, que hoy el bot no usa. La pendiente cambia la recomendación: en laderas de más de 25 % se priorizan cultivos de cobertura y se evitan los tubérculos sin terrazas.
- Hoy el bot obtiene la altura de Open-Meteo, que usa Copernicus DEM de 90 m.

### ECOSTRESS
- `ECO_L3T_JET` (ET) y `ECO_L4T_ESI` (índice de estrés evaporativo): 70 m, solo **81 escenas** sobre Chimborazo desde 2018, con horario irregular.
- `ECO_L2T_LSTE` (temperatura de superficie): 840 escenas.
- Para un bot que responde por punto y en cualquier mes, la cobertura es demasiado irregular. Sirve para demostraciones o mapas puntuales.

### GLDAS / FLDAS
- `GLDAS_NOAH025_3H` (cada 3 h, 0,25°, desde 2000) y `GLDAS_CLSM025_DA1_D`, que asimila GRACE.
- `FLDAS_NOAH01_C_GL_M`: 0,1° mensual desde 1982, forzado con **CHIRPS**. Es buena alternativa para humedad de suelo y ET mensuales.
- Todos requieren Earthdata Login (GES DISC).

### GEDI
- `GEDI02_B`: 263 gránulos de huellas sobre Chimborazo. `GEDI04_A` no aparece en CMR con ese nombre corto.
- No aporta a cultivos anuales de altura.
