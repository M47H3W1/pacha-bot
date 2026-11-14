# Estado de los endpoints (verificado el 2026-11-14)

Cada prueba comprueba que el **dato devuelto sea el esperado**, no solo que responda HTTP 200. También hay pruebas de control
para los requisitos documentados (que IMERG falle sin UTC y que GAEZ falle sin User-Agent).

- Script: [scripts/verificar_endpoints.py](scripts/verificar_endpoints.py). Resultado: [resultados/verificacion_endpoints.json](resultados/verificacion_endpoints.json).
- Enlaces citados en los documentos: [scripts/verificar_enlaces.py](scripts/verificar_enlaces.py). Resultado: [resultados/verificacion_enlaces.json](resultados/verificacion_enlaces.json).

## Endpoints de datos: 24 de 24 correctos

| Endpoint | Parámetros que alimenta | Resultado | Notas |
|---|---|---|---|
| NASA POWER diario | #1–#3, #9, #10 | OK: 9 parámetros × 31 días sin −999 | Sin clave |
| NASA POWER IMERG con `time-standard=UTC` | #1 | OK | |
| NASA POWER IMERG sin UTC (control) | — | Devuelve −999, como se documentó | Requisito confirmado |
| NASA POWER horario | #6 | OK: 48 horas | |
| NASA POWER climatología | #3 | OK | |
| NASA POWER catálogo de parámetros (`/api/system/manager/parameters`) | — | 200 en diario, horario, mensual y climatología | |
| NASA CMR (Earthdata) | #2, #4, #8 | OK: SPL4SMGP 33.961, NASADEM 4 teselas, OMSO2e 8.043, OMPS 5.469, MOD13Q1 614, IMERG 10.135 | Catálogo sin clave; descarga con Earthdata Login |
| ORNL MOD13Q1 NDVI | #5 | OK | Reintentos por 502/503 |
| ORNL MOD11A2 LST nocturna | #3 | OK | |
| ORNL MOD17A2HGF GPP | #7 | OK al segundo intento (antes, 502) | |
| ORNL MCD15A2H LAI | #7 | OK (184 s) | |
| ORNL lista de productos SMAP | #2 | Solo `SPL3SMP_E` y `SPL4CMDL` | **Corrección:** `SPL4SMGP` no está en ORNL |
| FAO GAEZ v4 `LR/getSamples` | #11–#15 | OK: Guamote = 3 (Andosols) | |
| FAO GAEZ v4 sin User-Agent (control) | — | 403, como se documentó | Requisito confirmado |
| FAO GAEZ v4 `res05` | #15 | OK: 122.708 rásteres | Aptitud por cultivo |
| MAG zip geopedológico | #11–#15 | OK: 206 con rangos, 1.293.801.341 bytes | |
| MAG geoserver (control) | — | Sin servicio | No hay consulta por punto |
| Datos Abiertos: CSV INAMHI lluvia | Contraste #1 | OK | |
| Datos Abiertos: CSV INAMHI Tmin | Contraste #3 | OK | |
| Datos Abiertos: API CKAN | Precios, INEC | OK | |
| Open-Meteo ERA5 | Contraste | OK | |
| Open-Meteo elevation | Código actual | OK | Fuera de la regla de fuentes |
| Open-Meteo forecast | Código actual | OK | Fuera de la regla de fuentes |
| ISRIC SoilGrids | Código actual | OK | Fuera de la regla de fuentes |
| INAMHI servicios web | Avisos | OK (200) | Antes, certificado SSL inválido: es intermitente |

## Correcciones a la documentación anterior
| Dónde | Decía | Correcto |
|---|---|---|
| README y recursos | "SMAP figura en ORNL, pero devolvió 502/503" | ORNL solo tiene `SPL3SMP_E` (5 cm); **la zona de raíces (`SPL4SMGP`) requiere Earthdata** |
| MAG: diccionario del geopedológico | `pfe` = profundidad, `phi` = pH, `ndr` = drenaje… | Columnas corridas: profundidad = `ndr`, pH = `txc`, drenaje = `ttd`, pedregosidad = `pfe` (ver [../02-Ecuador/02-MAG-Geoportal-y-SIPA.md](../02-Ecuador/02-MAG-Geoportal-y-SIPA.md)) |
| Volumen de datos | INAMHI con SSL inválido | Intermitente: hoy respondió 200 |
| Volumen de datos | ORNL tarda 30–60 s | De 30 a 180 s, con 502/503 frecuentes: precalcular y reintentar |

## Enlaces citados (38)
- **35 responden** (200 o 206).
- Dos devuelven **403 a clientes automáticos**, pero abren en el navegador (protección anti-robots): MDPI (Magoffin et al.
  2023) y la documentación del IRD.
- Dialnet responde, pero con un certificado SSL inválido.
- La plantilla `…/parameters?community=AG&temporal=<nivel>` es un patrón, no un enlace; con cada nivel real responde 200.
