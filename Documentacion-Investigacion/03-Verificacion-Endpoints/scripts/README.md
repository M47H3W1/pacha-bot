# Scripts de verificación

Son los scripts usados el 2026-11-14 para sondear los endpoints. Se ejecutan desde una carpeta de trabajo, porque leen y escriben
archivos relativos. Solo usan la biblioteca estándar de Python, salvo `openpyxl` para leer los diccionarios del MAG.

| Script | Qué hace | Entrada | Salida |
|---|---|---|---|
| `chk.py` | Resume la disponibilidad por parámetro de un JSON de POWER | `pd.json` o `pu.json` | consola |
| `cmr.py` | Busca colecciones NASA en CMR y cuenta gránulos sobre Chimborazo | — | `cmr_result.json` |
| `om.py` | Compara lluvia, Tmin y ET0 de POWER, IMERG, ERA5 e IFS en 4 puntos | — | `comparacion_lluvia.json` |
| `ornl.py` | Prueba la API de punto de ORNL (MODIS, SMAP, ECOSTRESS) | — | consola |
| `ec.py`, `ec2.py` | Lista conjuntos de INAMHI, MAG e INEC en Datos Abiertos (CKAN) | — | consola |
| `inamhi.py` | Analiza el CSV de lluvia del INAMHI y elige estaciones de sierra | `inamhi_p2019.csv` | `inamhi_sierra.json` |
| `valid.py` | Validación de lluvia: 85 estaciones frente a MERRA-2, IMERG y ERA5 | `inamhi_p2019.csv`, `inamhi_sierra.json` | `validacion.json` |
| `ifs.py` | Validación de ECMWF IFS en 2018–2019 | `inamhi_p2019.csv` | `validacion_ifs.json` |
| `tmin.py` | Validación de la mínima absoluta mensual frente a POWER y ERA5 | `inamhi_tmin2019.csv` | `validacion_tmin.json` |
| `loo_calibracion.py` | Calibra la lluvia NASA con estaciones INAMHI vecinas, dejando una fuera cada vez | `resultados/validacion_lluvia_85_estaciones.json` | `calibracion_loo_lluvia.json` (por consola) |
| `gases.py` | Gases, aerosoles y crecimiento: POWER en Guamote, cobertura CMR y GPP/LAI de ORNL | — | `gases_y_crecimiento_chimborazo.json` |
| `gpp_lai_co2.py` | GPP y LAI en puntos rurales, prueba de la API GEOS-CF y CO2 global de NOAA | — | `gpp_lai_geoscf_co2.json` |
| `lancha.py` | Días favorables a la lancha con POWER horario (2019–2023) | — | `lancha_power_horario_guamote.json` |
| `verificar_endpoints.py` | Prueba los 24 endpoints y comprueba que devuelvan el dato esperado, con controles de requisitos | — | `verificacion_endpoints.json` |
| `verificar_enlaces.py` | Revisa todos los enlaces citados en los `.md` | carpeta de documentos | `verificacion_enlaces.json` |
| `gaez_cliente.py` | Cliente `getSamples` del ImageServer de FAO GAEZ v4 (necesita un User-Agent de navegador) | — | — |
| `gaez_muestreo.py` | Muestrea 11 capas de suelo GAEZ en una grilla de la sierra centro (2.400–4.000 m) | — | `gaez_puntos.json` |
| `gaez_vs_mag.py` | Asigna cada punto a su polígono del geopedológico MAG, leyendo el zip de 1,29 GB sin descomprimir | zip del MAG, `gaez_puntos.json` | `suelo_gaez_mag_2340_puntos.json` |
| `gaez_mag_analisis.py` | Concordancia GAEZ frente a MAG: tipo de suelo, pendiente, profundidad, nutrientes, laboreo | `suelo_gaez_mag_2340_puntos.json` | `suelo_gaez_vs_mag_concordancia.json` |
| `sensibilidad.py` | ¿Cambia el cultivo recomendado con el error medido y año a año? Se ejecuta desde la raíz del repo e importa `app.engine` | red (POWER, SoilGrids, Open-Meteo) | `sensibilidad_recomendacion.json` (por consola) |

Descargar primero los CSV del INAMHI:
```bash
curl -o inamhi_p2019.csv "https://www.datosabiertos.gob.ec/dataset/eaa8894f-68d1-4a15-80f8-1a6f528f946c/resource/98c77d18-e863-4e00-8a22-eb47f2981d9c/download/inamhi-precipitacion-2019diciembre.csv"
curl -o inamhi_tmin2019.csv "https://www.datosabiertos.gob.ec/dataset/40c970c4-be1d-446d-b2c2-1ae9b8a2dde5/resource/47a37abc-a8cd-4d2a-a913-f25a7297dd2a/download/inamhi-temperaturaminima-2019diciembre.csv"
```

En Windows, ejecutar con `PYTHONIOENCODING=utf-8`. `valid.py` tarda unos 15 minutos porque hace pausas para no saturar Open-Meteo.
