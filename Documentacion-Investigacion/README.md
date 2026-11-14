# Documentación de investigación: datos para Pacha

Investigación del 2026-11-14 sobre qué datos de NASA y de Ecuador pueden hacer más precisas las recomendaciones de rotación de
cultivos de **@Pacha_EC_Bot**. Todos los endpoints se probaron en vivo; las cifras salen de esas pruebas, no de la documentación.

## Estructura

```
Documentacion-Investigacion/
├── 01-NASA/
│   ├── 01-recursos-de-la-convocatoria.md   Los 23 recursos del reto: ¿cubren Ecuador? ¿cómo se accede?
│   ├── 02-NASA-POWER-catalogo-completo.md  Los 152 parámetros diarios de POWER, con relevancia para Pacha
│   └── 03-fuentes-permitidas.md            Regla: todo NASA + recursos de la convocatoria; auditoría del código
├── 02-Ecuador/
│   ├── 01-INAMHI.md                        Estaciones, datos abiertos, alertas y otras redes
│   ├── 02-MAG-Geoportal-y-SIPA.md          Suelos 1:25.000, zonificación, riesgos y precios
│   ├── 03-INEC-INIAP-y-otras-fuentes.md    ESPAC, variedades, SoilGrids y CHIRPS
│   └── 04-estudios-de-suelos.md            Cartografía MAG, cangahua, erosión y estudios en Chimborazo
├── 03-Verificacion-Endpoints/
│   ├── 01-volumen-de-datos.md              Cuánta data devuelve cada endpoint
│   ├── 02-validacion-lluvia-INAMHI.md      85 estaciones frente a MERRA-2, IMERG, ERA5 e IFS
│   ├── 03-validacion-temperatura-minima.md Heladas: POWER y ERA5 frente al INAMHI
│   ├── 04-validacion-suelo-GAEZ-vs-MAG.md  Suelo: FAO GAEZ v4 frente al geopedológico MAG en 2.340 puntos
│   ├── 05-estado-de-endpoints.md           Verificación de los 24 endpoints y 38 enlaces (2026-11-14)
│   ├── scripts/                            Scripts reproducibles
│   └── resultados/                         JSON con los resultados
├── 04-Recomendaciones/
│   ├── 01-top5-parametros.md               Detalle de los 5 primeros parámetros
│   ├── 02-plan-de-integracion.md           Cómo meterlos en app/clients.py y app/engine.py
│   ├── 03-matriz-NASA-vs-Ecuador.md        Cada variable NASA con su contraste ecuatoriano y error medido
│   └── 04-top15-parametros.md              **Los 15 parámetros finales** (clima, terreno, crecimiento y suelo)
├── 05-Modelado/
│   └── 01-determinista-vs-probabilistico.md  Viabilidad de cada enfoque, con experimento sobre el motor actual
└── 06-Gases-y-Crecimiento/
    ├── 01-gases-y-aerosoles.md             CO2, SO2, O3, NO2, aerosoles: qué hay y qué sirve
    └── 02-parametros-de-crecimiento.md     Luz, suelo, lancha, GPP/LAI y nutrientes
```

**Principio de datos:** las entradas globales del modelo salen de **todos los productos NASA** más los recursos globales de la
convocatoria que no son de NASA (ERA5, Sentinel-2 y FAO GAEZ). Ver [01-NASA/03-fuentes-permitidas.md](01-NASA/03-fuentes-permitidas.md). Las fuentes de Ecuador (INAMHI, MAG,
INEC) sirven para **contrastar**: miden el error de NASA, lo calibran y verifican que las recomendaciones coincidan con el
criterio oficial.

## Resumen ejecutivo

### Qué ofrece NASA
- **NASA POWER** (lo que ya usa el bot) tiene **152 parámetros diarios** desde 1981, sin clave. Pedir 20 parámetros por 46 años toma
  3,8 s y devuelve 5,5 MB. Incluye **lluvia IMERG** (con `time-standard=UTC`), humedad del suelo en zona de raíces (`GWETROOT`),
  punto de rocío, temperatura de superficie y extremos con periodo de retorno.
- **12 de los 23 recursos** de la convocatoria cubren Ecuador. Los otros 11 son solo de EE. UU. (SSURGO, CDL, PRISM, NAIP, NASS…);
  para cada uno hay un equivalente ecuatoriano.
- Los productos de Earthdata (SMAP, IMERG, MODIS, HLS, ECOSTRESS, GLDAS, SRTM) tienen cobertura completa sobre Chimborazo, pero
  **la descarga requiere Earthdata Login**. MODIS (NDVI, LST, GPP, LAI) se puede leer sin clave por la API de ORNL, que es lenta
  y da errores 502/503 intermitentes. En ORNL, SMAP solo tiene la humedad superficial (`SPL3SMP_E`); la zona de raíces
  (`SPL4SMGP`) requiere Earthdata.
- **Estado verificado:** 24 de 24 endpoints devuelven el dato esperado
  ([03-Verificacion-Endpoints/05-estado-de-endpoints.md](03-Verificacion-Endpoints/05-estado-de-endpoints.md)).

### Qué encontramos al validar contra el INAMHI
| Hallazgo | Dato |
|---|---|
| MERRA-2 (`PRECTOTCORR`, lo que usa el bot) **duplica la lluvia** en la sierra centro | San Juan-Chimborazo: 1.415 mm frente a 658 observados |
| **IMERG sigue mejor los meses** | r mensual de 0,68 frente a 0,51; mejor error mensual en 50 de 85 estaciones |
| Ninguna fuente acierta el volumen sin ajuste local | IMERG: +39 % de sesgo mediano; ERA5: +140 % |
| La corrección con ECMWF IFS no mostró mejora (7 estaciones, 2018–2019) | Sesgo mediano de +56 % |
| La corrección por altura de 6,5 °C/km **empeora la mínima en los valles** | Patate: +5,6 °C. No ve la inversión térmica nocturna |

### Los 15 parámetros finales
| # | Parámetro | Fuente global | Contraste o fuente principal en Ecuador |
|---|---|---|---|
| 1 | Lluvia diaria | IMERG (POWER) | INAMHI, 85 estaciones |
| 2 | Humedad en zona de raíces | POWER `GWETROOT`, SMAP | Lluvia INAMHI, suelo MAG |
| 3 | Temperatura nocturna de superficie | MODIS LST, POWER | Tmin INAMHI, riesgo de helada MAG |
| 4 | Pendiente | NASADEM 30 m | MAG `pen` |
| 5 | Verdor NDVI/EVI | MODIS | INEC ESPAC, ZAE MAG |
| 6 | Riesgo de lancha | POWER horario | INAMHI, INIAP |
| 7 | Productividad real (GPP, LAI) | MODIS | INEC ESPAC |
| 8 | SO2 y ceniza volcánica | OMI/OMPS, `AOD_55` | IG-EPN, SNGR |
| 9 | Temperatura y humedad superficial del suelo | POWER | INAMHI |
| 10 | Luz PAR y nubes | POWER | INAMHI |
| 11 | Profundidad efectiva y pedregosidad | GAEZ SQ3/SQ7 (respaldo) | **MAG geopedológico (principal)** |
| 12 | Textura y agua disponible | GAEZ SQ2, SMAP/GLDAS | **MAG** |
| 13 | pH y toxicidad por aluminio | GAEZ SQ1 | **MAG** |
| 14 | Fertilidad: materia orgánica, CIC, saturación de bases | GAEZ SQ1/SQ2 | **MAG** |
| 15 | Aptitud de suelo y terreno por cultivo | GAEZ `res05` | **ZAE MAG** |

Detalle en [04-Recomendaciones/04-top15-parametros.md](04-Recomendaciones/04-top15-parametros.md).

### Suelo: GAEZ frente al MAG
En 2.340 puntos de la sierra centro, GAEZ ordena bien los terrenos (Spearman de 0,34 a 0,62), pero ve **la mitad de la
pendiente** (mediana de 23 % frente a 55 %) y marca el 84 % "sin restricción para raíces", cuando el MAG tiene un tercio de
suelos superficiales o poco profundos. Además, su aptitud por cultivo da cebada = 0 en Guamote. **El MAG es la fuente principal
de suelo y GAEZ el respaldo global.** Ver [03-Verificacion-Endpoints/04-validacion-suelo-GAEZ-vs-MAG.md](03-Verificacion-Endpoints/04-validacion-suelo-GAEZ-vs-MAG.md).
Aviso: el DBF del MAG tiene los nombres de columna corridos (ver [02-Ecuador/02-MAG-Geoportal-y-SIPA.md](02-Ecuador/02-MAG-Geoportal-y-SIPA.md)).

### ¿Determinista o probabilístico?
Lo viable es un **híbrido**: el núcleo físico FAO-56 actual corrido sobre años NASA × error medido contra el INAMHI, con la
recomendación expresada como probabilidad. Calibrar con el INAMHI baja el error de lluvia de 40 % a 15 %. En el 14 % de los
casos probados, ese error restante cambia el cultivo #1. En Guamote (octubre), la respuesta actual (avena) gana solo 2 de cada
10 años. Un modelo probabilístico puro (ML) no es viable sin rendimientos por parcela.
Detalle en [05-Modelado/01-determinista-vs-probabilistico.md](05-Modelado/01-determinista-vs-probabilistico.md).

### Gases y crecimiento
- NASA tiene datos globales de CO2 (OCO-2/3), SO2 (OMI, OMPS), NO2, O3, CO, CH4 y aerosoles (POWER `AOD_55`, MERRA-2,
  MODIS MAIAC), y todos cubren Ecuador. En la sierra centro, lo que cambia la decisión es el **SO2 y la ceniza volcánica**,
  con contraste del IG-EPN. El CO2 es casi igual en toda la sierra: solo sirve para escenarios climáticos.
- Para el crecimiento:
  - **riesgo de lancha** con POWER horario: de 8 a 10 días favorables en agosto-septiembre, frente a 27–29 en la época lluviosa;
  - **productividad real** con MODIS GPP y LAI: hasta 3 veces de diferencia entre puntos cercanos;
  - luz PAR: las nubes quitan el 45 %;
  - temperatura del suelo;
  - nutrientes: ningún satélite los mide; se usan FAO GAEZ v4 y el MAG.

  Ver [06-Gases-y-Crecimiento/](06-Gases-y-Crecimiento/).

### Lo más valioso de Ecuador
- **INAMHI:** lluvia mensual de **947 estaciones (1960–2019)** en Datos Abiertos; 85 sirven para calibrar la sierra.
- **MAG:** mapa geopedológico 1:25.000 (202.145 polígonos: profundidad, textura, pH, toxicidad, fertilidad, pendiente), zonificación agroecológica por cultivo,
  riesgos de helada y sequía por parroquia, y precios al productor por provincia (2016–2026, incluye papa, haba, chocho, quinua y cebada).
- **INEC ESPAC** para rendimientos e **INIAP** para variedades y ciclos locales.

## Fuentes consultadas
- NASA POWER API: https://power.larc.nasa.gov/api/
- NASA CMR (Earthdata): https://cmr.earthdata.nasa.gov/search/
- ORNL DAAC MODIS/VIIRS Web Service: https://modis.ornl.gov/rst/api/v1/
- FAO GAEZ v4 ImageServer: https://gaez-services.fao.org/server/rest/services
- ISRIC SoilGrids (usado hoy por el bot; fuera de la regla de fuentes): https://rest.isric.org/soilgrids/v2.0/
- Open-Meteo (ERA5, ECMWF IFS): https://open-meteo.com/
- Datos Abiertos Ecuador (INAMHI, MAG, INEC): https://www.datosabiertos.gob.ec/
- [INAMHI: servicios y aplicaciones web](https://servicios.inamhi.gob.ec/aplicaciones-web/), [Biblioteca](https://www.inamhi.gob.ec/biblioteca/), [GEOGLOWS](https://inamhi.geoglows.org/)
- [SIPA (MAG): boletines](https://sipa.agricultura.gob.ec/)
- [INEC: ESPAC](https://www.ecuadorencifras.gob.ec/category/estadisticas-agropecuarias/)
- [MAG: Política pública agropecuaria 2026 (zonificaciones)](https://www.agricultura.gob.ec/wp-content/uploads/2026/02/Poli%CC%81tica-pu%CC%81blica-agropecuaria-9-2-26-compressed.pdf)
- [Magoffin et al. 2023: satellite precipitation and temperature datasets in Ecuador (Remote Sensing)](https://www.mdpi.com/2072-4292/15/24/5713)
- [Ochoa-Tocachi et al. 2018: iMHEA (Scientific Data)](https://www.nature.com/articles/sdata201880.pdf)
- [Red Hidrometeorológica de Tungurahua](https://www.gob.ec/gadp-tungurahua/tramites/red-hidrometeorologica-provincial)
- [FAO GAEZ v4](https://www.fao.org/gaez/gaezv4/en)
- [Manual de granos andinos (INIAP, 2012)](https://balcon.mag.gob.ec/mag01/magapaldia/Quinua/pdf%20publicaciones/27-MANUAL_AGRICOLA_GRANOS_ANDINOS_2012.pdf)
- Alertas de heladas del INAMHI: [Expreso, dic. 2025](https://www.expreso.ec/actualidad/inamhi-alerta-madrugadas-heladas-afectaran-la-sierra-ecuatoriana-266435.html), [Extra, mar. 2026](https://www.extra.ec/noticia/ecuador/temperaturas-cero-sacuden-sierra-ecuatoriana-productores-agricolas-alerta-149496.html)
