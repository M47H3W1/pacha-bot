# INEC, INIAP y otras fuentes de Ecuador

## INEC: ESPAC (equivalente a USDA NASS QuickStats)
**Encuesta de Superficie y Producción Agropecuaria Continua**: superficie sembrada y cosechada, producción y ventas por cultivo.
- Bases anuales en Excel, CSV y SPSS, con metodología y diccionario, en [ecuadorencifras.gob.ec](https://www.ecuadorencifras.gob.ec/category/estadisticas-agropecuarias/).
- [Años anteriores](https://www.ecuadorencifras.gob.ec/informacion-de-anos-anteriores-espac/) y [Manual ESPAC 2025](https://www.ecuadorencifras.gob.ec/documentos/web-inec/Estadisticas_agropecuarias/espac/2025/Manual_ESPAC_2025.pdf).
- En Datos Abiertos solo aparece ESPAC 2020; las ediciones más nuevas están en el sitio del INEC.
- **Uso en Pacha:** calibrar rendimientos esperados por provincia (por ejemplo, papa en Chimborazo frente a Carchi) y ver qué rotaciones son comunes en la zona.
- Cuidado: hay que distinguir superficie *sembrada* de *cosechada* al calcular rendimiento.

## INIAP (Instituto Nacional de Investigaciones Agropecuarias)
- Variedades mejoradas de papa, chocho, quinua, haba, cebada y maíz suave, con su rango de altura y ciclo. Repositorio: `repositorio.iniap.gob.ec`.
- Publicaciones relevantes:
  - Manual de granos andinos ([Peralta et al. 2012](https://balcon.mag.gob.ec/mag01/magapaldia/Quinua/pdf%20publicaciones/27-MANUAL_AGRICOLA_GRANOS_ANDINOS_2012.pdf)).
  - Estudios de papa en suelos erosionados de Cacha, Chimborazo (2024).
- No encontramos un calendario de siembra por provincia en formato de datos. **Uso:** reemplazar los Kc "estimados" de chocho, melloco y oca, y los ciclos de `crops.csv`, por valores INIAP de variedades locales (por ejemplo, INIAP-450 Andino para chocho).

## IEE / SIGTIERRAS
- La cartografía geopedológica 1:25.000 que hoy publica el MAG nació de SIGTIERRAS e IEE (2009–2015).
- SIGTIERRAS también produjo ortofotos de 30–50 cm, equivalentes a NAIP.
- Un estudio de carbono orgánico usó **12.924 perfiles de suelo** de levantamientos 1:25.000.

## GADs provinciales y fondos de agua
- **Tungurahua (HGPT):** red hidrometeorológica propia desde 2010 (ver [01-INAMHI.md](01-INAMHI.md)).
- **FONAG / iMHEA:** monitoreo hidrológico de páramo.
- Las universidades (ESPOCH en Chimborazo, UTA en Ambato, UCuenca) tienen estudios y redes locales. Por ejemplo, un trabajo de la UTA analizó 17 estaciones INAMHI y HGPT entre 1985 y 2024 junto con ERA5-Land y CHIRPS.

## Fuentes globales que complementan bien en Ecuador
| Fuente | Qué aporta | Acceso |
|---|---|---|
| **SoilGrids (ISRIC)** | Ya se usa: arcilla, arena y carbono orgánico. También tiene **`wv0033` y `wv1500` (agua a capacidad de campo y punto de marchitez)**, `phh2o`, `bdod`, `cec` y `nitrogen` | API REST sin clave, verificada. **No es NASA ni recurso de la convocatoria**: reemplazar por MAG + GAEZ |
| **CHIRPS** (UCSB/USGS) | Lluvia a 0,05° (≈5 km) que mezcla satélite con estaciones, incluidas las del INAMHI. Se usa mucho en los Andes | Descarga de rásteres; no hay API de punto oficial |
| **Open-Meteo** | Ya se usa: ECMWF IFS 9 km, ERA5 y pronóstico | API sin clave |

### SoilGrids en Guamote (-1,93; -78,71), verificado

| Propiedad | 0–5 cm | 15–30 cm | 30–60 cm |
|---|---|---|---|
| Agua a capacidad de campo `wv0033` (cm³/cm³ × 100) | 32,9 | 32,0 | 30,9 |
| Agua en punto de marchitez `wv1500` | 13,8 | 13,5 | 14,5 |
| **Agua disponible (`wv0033 − wv1500`)** | **19,1 %** | **18,5 %** | **16,4 %** |
| pH en agua | 6,3 | 6,4 | 6,6 |
| Densidad aparente (kg/dm³) | 1,16 | 1,26 | 1,29 |
| CIC (cmol/kg) | 30,4 | 21,7 | 19,7 |

Con raíces de 40 cm, eso equivale a unos **73 mm de agua útil** en el suelo. Hoy el bot no usa ese dato.
