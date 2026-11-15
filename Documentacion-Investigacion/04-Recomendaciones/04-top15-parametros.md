# Los 15 parámetros finales para Pacha

Reemplaza al top 10. Amplía el [top 5](01-top5-parametros.md) con los parámetros de
[gases y crecimiento](../06-Gases-y-Crecimiento/) (#6–#10) y de **suelo** (#11–#15). Todos los endpoints se verificaron
el 2026-11-14 ([estado de endpoints](../03-Verificacion-Endpoints/05-estado-de-endpoints.md)).

**Regla de fuentes:** el dato global sale de NASA o de un recurso de la convocatoria (FAO GAEZ para suelo), y se contrasta con
Ecuador. En suelo, el contraste mostró que **el MAG debe ser la fuente principal** y GAEZ el respaldo
([validación](../03-Verificacion-Endpoints/04-validacion-suelo-GAEZ-vs-MAG.md)).

## Clima y agua (1–3)
| # | Parámetro | Fuente global | Contraste con Ecuador | Qué aporta | Evidencia |
|---|---|---|---|---|---|
| 1 | **Lluvia diaria** `IMERG_PRECTOT` | GPM IMERG vía POWER | INAMHI, 85 estaciones | Mes de siembra y agua que falta por mes | r mensual 0,68 frente a 0,51; error anual de 40 % → 15 % al calibrar |
| 2 | **Humedad en zona de raíces** `GWETROOT`; SMAP `SPL4SMGP` | POWER; SMAP (Earthdata) | Lluvia INAMHI; suelo MAG | Agua inicial del suelo; años secos | 16.750 días; SMAP 33.961 archivos |
| 3 | **Temperatura nocturna de superficie** `LST_Night_1km`, `TS_MIN`, `T2MDEW` | MODIS (ORNL), POWER | Tmin INAMHI; riesgo de helada MAG | Heladas de noches despejadas y de valle | Ningún modelo detectó las 2 heladas observadas |

## Terreno y vegetación (4–5)
| # | Parámetro | Fuente global | Contraste con Ecuador | Qué aporta | Evidencia |
|---|---|---|---|---|---|
| 4 | **Pendiente** | SRTM/NASADEM 30 m; GAEZ clase de pendiente | MAG `pen` | No recomendar tubérculos en más de 25 %; cobertura y leguminosas | GAEZ ve la mitad: mediana de 23 % frente a 55 % del MAG |
| 5 | **Verdor** NDVI/EVI | MODIS `MOD13Q1` (ORNL) | INEC ESPAC; ZAE del MAG | Historial de la zona: descansos, calendario, suelos cansados | 614 fechas desde 2000 |

## Crecimiento y sanidad (6–10)
| # | Parámetro | Fuente global | Contraste con Ecuador | Qué aporta | Evidencia |
|---|---|---|---|---|---|
| 6 | **Riesgo de lancha** (HR ≥ 90 % y 7–25 °C) | POWER horario | HR del INAMHI; INIAP | Meses de menor riesgo para papa | 8–10 días favorables en agosto-septiembre frente a 27–29 en época lluviosa |
| 7 | **Productividad real** (GPP, LAI) | MODIS `MOD17A2HGF`, `MCD15A2H` (ORNL) | INEC ESPAC | Zonas más productivas; caída que pide leguminosas o descanso | Hasta 3 veces de diferencia entre puntos cercanos |
| 8 | **SO2 y ceniza volcánica** | OMI/OMPS; POWER `AOD_55`; MODIS MAIAC | IG-EPN, SNGR | Riesgo de ceniza; ciclos cortos; alertas | Unas 12.000 ha afectadas en enero de 2024 |
| 9 | **Temperatura y humedad superficial del suelo** `TSOIL1`, `GWETTOP` | POWER | INAMHI agrometeorológico | Fecha de siembra por germinación | 11,3–13,5 °C; hay que corregirla por altura |
| 10 | **Luz PAR y nubes** | POWER | Radiación del INAMHI | Potencial de rendimiento por mes | Las nubes quitan el 45 % de la luz |

## Suelo (11–15)
Datos de 2.340 puntos de la sierra centro, GAEZ frente al MAG.

| # | Parámetro | Fuente principal (Ecuador) | Respaldo global | Qué aporta | Evidencia |
|---|---|---|---|---|---|
| 11 | **Profundidad efectiva y pedregosidad** | MAG `ndr` (profundidad), `pfe` (pedregosidad) | GAEZ SQ3 (raíces), SQ7 (laboreo) | Tamaño real del banco de agua; si se puede labrar; evitar tubérculos en suelos delgados o pedregosos | MAG: 34 % superficial o poco profundo; GAEZ: 84 % "sin restricción" (Spearman 0,34). En Guamote, 66 % superficial o poco profundo |
| 12 | **Textura y agua disponible del suelo** | MAG `stx` (superficial), `txs` (subsuperficial) | GAEZ SQ2 (retención); humedad de SMAP y GLDAS | Capacidad de agua útil por tipo de textura (franco arenoso retiene menos que franco) | MAG: franco 36 %, franco arenoso 33 % |
| 13 | **pH y toxicidad por aluminio o carbonatos** | MAG `txc` (pH), `pdr` (toxicidad) | GAEZ SQ1 | Excluir cultivos sensibles a la acidez (haba, cebada) donde hay toxicidad; favorecer chocho y quinua; cal | pH de muy ácido a alcalino; 7 % con toxicidad por acidez. Spearman con GAEZ 0,51 |
| 14 | **Fertilidad: materia orgánica, CIC y saturación de bases** | MAG `rmo`, `cic`, `sdb` | GAEZ SQ1/SQ2 | Priorizar leguminosas, abonos verdes o descanso donde la materia orgánica es baja | 40 % con materia orgánica baja o muy baja. GAEZ casi no la distingue (Spearman 0,20) |
| 15 | **Aptitud de suelo y terreno por cultivo** | MAG ZAE (papa, cebada, quinua, chocho…) | GAEZ `res05` (índice 0–10000) y `LR` 697/698 | Contraste oficial de la recomendación por cultivo | GAEZ da **cebada = 0** en Guamote y San Juan, donde es un cultivo principal. No sirve sin la ZAE |

### Detalle de GAEZ para el #15 (secano, bajos insumos, 1981–2010)
| Cultivo | Guamote | San Juan | Patate |
|---|---|---|---|
| Papa | 4.185 | 0 | 3.320 |
| Cebada | **0** | **0** | 0 |
| Maíz | 0 | 0 | 4.864 |
| Fréjol | 0 | 0 | 1.973 |
| Arveja | 0 | 0 | 1.973 |
| Trigo | 7.716 | 6.168 | 4.361 |

GAEZ no tiene quinua, chocho, haba, melloco ni oca. A 9 km, el clima de la celda no representa los valles cultivados. Por
eso la ZAE del MAG debe ser la fuente principal de aptitud. Resultado:
[../03-Verificacion-Endpoints/resultados/gaez_aptitud_cultivos_3_sitios.json](../03-Verificacion-Endpoints/resultados/gaez_aptitud_cultivos_3_sitios.json).

## Reparto en el puntaje del motor (`PESOS` en `app/engine.py`)
| Componente | Parámetros |
|---|---|
| `agua` | 1 lluvia, 2 humedad, 11 profundidad, 12 textura |
| `helada` | 3 temperatura nocturna |
| `suelo` | 4 pendiente, 5 verdor, 7 productividad, 13 pH y toxicidad, 14 fertilidad |
| `sanidad` (nuevo) | 6 lancha, 8 ceniza |
| Filtro de aptitud | 15 aptitud (excluye cultivos "no aptos") y 13 toxicidad |
| Fecha de siembra y potencial | 9 temperatura del suelo, 10 luz |

## Orden de implementación
1. **POWER, sin clave:** 1, 2, 6, 9 y 10. Comparten cliente y pedido.
2. **MAG geopedológico** (preprocesar una vez a GeoPackage o PostGIS) + **GAEZ `getSamples`** como respaldo: 11–14.
   Reemplaza a SoilGrids.
3. **MODIS por ORNL**, con caché semanal y reintentos: 3, 5 y 7.
4. **ZAE del MAG y GAEZ:** 15.
5. **Earthdata:** 4 (NASADEM), 8 (OMI/OMPS) y SMAP para el 2.

Cada paso se valida con estaciones INAMHI separadas para prueba (ver [03-matriz-NASA-vs-Ecuador.md](03-matriz-NASA-vs-Ecuador.md)).
