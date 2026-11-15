# Gases y aerosoles: lo que da NASA y lo que sirve para los cultivos

Pregunta: ¿qué datos NASA hay sobre los gases del aire que ayuden a recomendar cultivos? ¿Se pueden contrastar con Ecuador?

**Respuesta corta:** NASA tiene datos globales de CO2, SO2, NO2, ozono, CO, metano y aerosoles, y todos cubren Ecuador. Para
elegir cultivos en la sierra centro, lo que cambia la decisión es el **SO2 y la ceniza volcánica** (Sangay y Tungurahua). El CO2
es casi igual en toda la sierra, así que no distingue un terreno de otro. El ozono y el NO2 rurales tienen poca relevancia.

Probado el 2026-11-14 sobre Chimborazo, en el recuadro −79,2 a −78,3 de longitud y −2,5 a −1,3 de latitud.
- Script: [../03-Verificacion-Endpoints/scripts/gases.py](../03-Verificacion-Endpoints/scripts/gases.py).
- Resultado: [../03-Verificacion-Endpoints/resultados/gases_y_crecimiento_chimborazo.json](../03-Verificacion-Endpoints/resultados/gases_y_crecimiento_chimborazo.json).

## Catálogo NASA verificado

| Gas o variable | Producto NASA | Resolución | Desde | Archivos sobre Chimborazo | Acceso | ¿Sirve para el cultivo? |
|---|---|---|---|---|---|---|
| **SO2** (volcanes) | OMI `OMSO2e` | 0,25°, diario | 2004 | 8.043 | Earthdata | **Alto en la sierra centro** |
| **SO2** | OMPS `OMPS_NPP_NMSO2_PCA_L2` | Unos 50 km | 2012 | 5.469 | Earthdata | **Alto** |
| **Aerosoles** `AOD_55`, `AOD_84` | NASA POWER (MERRA-2) | 0,5°, diario | 1981 | Guamote: 7.305 de 7.305 días. Media 0,40; máximo 2,83 el 21 de septiembre de 2005 | **Sin clave** | **Alto**: ceniza, humo y menos luz |
| Aerosoles por tipo (sulfato, polvo, carbono) | MERRA-2 `M2T1NXAER` | 0,5°, por hora | 1980 | 17.076 | Earthdata | Medio |
| AOD a 1 km | MODIS MAIAC `MCD19A2` | 1 km | 2000 | 9.690 | Earthdata | Medio |
| Incendios y quemas | MODIS `MOD14A1`, `MCD64A1` | 1 km; 500 m | 2000 | 1.227; 311 | Earthdata o FIRMS (clave gratuita) | Medio: quema de páramo y rastrojo |
| CO2 (columna, XCO2) | OCO-2 `OCO2_L2_Lite_FP` | Huella de unos 2 km, sin cubrir todo el mapa | 2014 | 970 | Earthdata | Solo escenarios climáticos |
| CO2 | OCO-3 `OCO3_L2_Lite_FP` | Igual | 2019 | 2.151 | Earthdata | Igual |
| CO2 en la troposfera media | AIRS `AIRS3C2M` | 2° | 2010–2017 (terminado) | 86 | Earthdata | No |
| Fluorescencia (SIF), fotosíntesis | OCO-2 `OCO2_L2_Lite_SIF` | Huella de unos 2 km | 2014–2024 | 3.274 | Earthdata | Investigación; muy disperso |
| CO, CH4, O3, vapor de agua | AIRS `AIRS3STD` | 1° | 2002 | 8.758 | Earthdata | Bajo |
| NO2 | OMI `OMNO2d` | 0,25° | 2004 | 8.029 | Earthdata | Bajo en zonas rurales |
| O3 y CO en superficie | MERRA-2 `M2I3NVCHM` | 0,5° | 1980 | 17.076 | Earthdata | Bajo |
| O3 total | POWER `TO3`; OMI `OMTO3e` | 0,5°; 0,25° | 1981; 2004 | Media de 248 DU en Guamote. CMR no indexa `OMTO3e` por región | POWER sin clave | Indirecto: filtra el UV-B |
| Pronóstico de O3, NO2, SO2, CO y PM2.5 | GEOS-CF v2 | 0,25° | 2018 | — | La API de punto se pide al equipo GMAO | Bajo; útil para alertas de ceniza |
| NO2 por hora | TEMPO | — | 2023 | **0: solo cubre Norteamérica** | — | No aplica |

## CO2: hay datos, pero no ayuda a elegir cultivo
- El CO2 se mezcla bien en la atmósfera. La diferencia entre dos terrenos de la sierra es de pocos ppm, menor que el error de
  OCO-2.
- Su efecto sobre las plantas (más fotosíntesis en cultivos C3 como papa, haba, quinua y cebada, frente al maíz, que es C4) es
  igual en toda la zona.
- **Uso correcto:** escenarios de cambio climático ("en 2050 con más CO2 y +1,5 °C"), junto con `comparar_escenario` del motor.
- OCO-2 tiene solo 970 mediciones en 12 años sobre Chimborazo, por la nube y el relieve.

## Volcanes: el gas que sí importa en Chimborazo y Tungurahua
- **Por qué importa:**
  - el Sangay y el Tungurahua emiten SO2 y ceniza que cae sobre Guamote, Cebadas, Palmira, Columbe y Riobamba;
  - en enero de 2024 se reportaron **unas 12.000 hectáreas de cultivos y 36 comunidades afectadas**
    ([Vistazo](https://www.vistazo.com/actualidad/nacional/cae-ceniza-volcanica-en-chimborazo-advierten-alta-posibilidad-en-bolivar-los-rios-guayas-y-manabi-YY1313320),
    [Primicias](https://primicias.ec/noticias/sociedad/sangay-caida-ceniza-guamote));
  - la ceniza tapa las hojas, quita luz y cambia el suelo, y el SO2 quema el follaje.
- **Datos NASA, de más simple a más completo:**
  1. POWER `AOD_55`: diario, sin clave. Detecta aerosoles, pero no distingue ceniza de humo o polvo.
  2. OMI y OMPS: SO2 diario desde 2004 y 2012. Identifica que la nube es volcánica.
  3. MODIS MAIAC: AOD a 1 km, para ver por dónde pasó la nube.
- **Contraste en Ecuador:**
  - **IG-EPN**: informes diarios, mapas de caída de ceniza y mediciones de SO2 de su red DOAS;
  - **SNGR**: alertas por cantón.
- **Uso en el bot:**
  1. **Riesgo histórico por zona:** días al año con SO2 o AOD alto sobre la celda, validados con los reportes de ceniza del
     IG-EPN. Si es alto, preferir cultivos de ciclo corto y no recomendar hortalizas de hoja.
  2. **Alerta:** con GEOS-CF (pronóstico de SO2) o con el reporte del IG-EPN hacia el cantón, avisar al agricultor (cubrir,
     cosechar antes, no regar sobre la ceniza).
- **Validación pendiente:** comparar SO2 de OMPS y `AOD_55` con las fechas de caída de ceniza del IG-EPN (por ejemplo, el 6 de
  enero de 2024 en Guamote).

## Calidad del aire urbana (contraste, prioridad baja)
- **REMMAQ (Quito):** mide O3, NO2, SO2, CO, PM10 y PM2.5 ([aireambiente.quito.gob.ec](https://aireambiente.quito.gob.ec)).
- Sirve para validar el O3 y el NO2 de MERRA-2, GEOS-CF y OMI, pero en Quito, lejos de la zona del bot.
- El límite nacional de ozono (NECA) es 100 µg/m³ en 8 horas.

## Veredicto
| Variable | Producto NASA | Contraste Ecuador | ¿Incluir? | Prioridad |
|---|---|---|---|---|
| SO2 y ceniza volcánica | OMI/OMPS SO2, POWER `AOD_55`, MODIS MAIAC | IG-EPN, SNGR | **Sí** | Alta en Chimborazo y Tungurahua |
| Pronóstico de ceniza o SO2 | GEOS-CF | IG-EPN | Sí, si GMAO da acceso | Media |
| Quemas | MODIS fuego | SNGR, MAATE | Opcional | Media |
| CO2 | OCO-2/OCO-3 | — | Solo en escenarios climáticos | Baja |
| O3, NO2, CO, CH4 | OMI, AIRS, MERRA-2 | REMMAQ (Quito) | No | Baja |

Fuentes:
- [GEOS-CF: acceso a datos](https://gmao.gsfc.nasa.gov/gmao-products/geos-cf/data-access_geos-cf)
- [GEOS-CF: preguntas frecuentes](https://gmao.gsfc.nasa.gov/gmao-products/geos-cf/faq_geos-cf/)
- [Primicias: ceniza del Sangay en Guamote](https://primicias.ec/noticias/sociedad/sangay-caida-ceniza-guamote)
- [Primicias: nube de ceniza hacia Chimborazo](https://primicias.ec/noticias/sociedad/volcan-sangay-nube-ceniza-chimborazo)
- [Teleamazonas](https://www.teleamazonas.com/caida-ceniza-chimborazo-volcan-sangay/)
- [Extra: calidad del aire en Quito](https://www.extra.ec/noticia/servicios-y-tramites/calidad-aire-quito-consultarla-real-dias-alerta-155140.html)
