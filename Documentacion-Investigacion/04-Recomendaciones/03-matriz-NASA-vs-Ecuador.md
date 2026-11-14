# Matriz de precisión: NASA global contrastada con Ecuador

Regla: **la entrada del modelo sale de productos NASA o de recursos globales de la convocatoria** ([../01-NASA/03-fuentes-permitidas.md](../01-NASA/03-fuentes-permitidas.md)). Para cada variable hay una fuente ecuatoriana que mide su error y, si se
puede, lo corrige. La columna "Error medido" sale de las pruebas de esta carpeta.

| Variable | Fuente NASA (núcleo) | Contraste en Ecuador | Método | Error medido | Estado |
|---|---|---|---|---|---|
| Lluvia | `IMERG_PRECTOT` (POWER) | INAMHI, 85 estaciones de sierra (1960–2019) | Factor `obs/NASA` con 5 vecinas por distancia y altura | 40 % → **15 %** de error anual | Validado |
| Lluvia (respaldo) | `PRECTOTCORR` MERRA-2 | Igual | Igual | 35 % → 16 % | Validado |
| Temperatura mínima y helada | `T2M_MIN`, `TS_MIN`, `T2MDEW`; MODIS LST nocturna | INAMHI Tmin (2013, 24 estaciones); MAG riesgo de helada por parroquia | Diferencia por estación; probabilidad de helada frente a la tabla del MAG | Sesgo de +0,4 °C con desvío de 2,2 °C; 0 de 2 heladas detectadas | Faltan más años de datos del INAMHI |
| Humedad del suelo | `GWETROOT`, SMAP L4, GLDAS por capas | Sin red abierta. Indirecto: lluvia INAMHI y profundidad y textura del MAG | Usar como anomalía, no como valor absoluto | Sin validar | Pendiente |
| Evapotranspiración | ET0 FAO-56 con datos POWER | Tanques evaporímetros del INAMHI (anuarios) | Razón mensual | Sin validar | Pendiente |
| Luz PAR | `ALLSKY_SFC_PAR_TOT` | Radiación del INAMHI (anuarios) | Razón mensual | Sin validar | Pendiente |
| Humedad del aire y lancha | POWER horario `RH2M`, `T2M` | INAMHI HR; INIAP lancha | Corregir el sesgo de HR y comparar con brotes reportados | HR sobrestimada (estimación cualitativa) | Pendiente |
| Altura y pendiente | NASADEM/SRTM 30 m (reemplaza a Open-Meteo elevation) | MAG `pen` (geopedológico) | Comparar por clase de pendiente | — | Pendiente |
| Vigor y productividad | MODIS NDVI, GPP, LAI | INEC ESPAC (rendimiento por provincia) | Correlación provincial | — | Pendiente |
| Ceniza y SO2 volcánico | OMI/OMPS SO2, POWER `AOD_55`, MODIS MAIAC; GEOS-CF para pronóstico | IG-EPN (caída de ceniza, SO2 DOAS), SNGR | Días con evento frente a reportes | — | Pendiente |
| Pendiente (GAEZ) | GAEZ clase de pendiente 30″ | MAG `pen` | Spearman en 2.340 puntos | r = 0,62; GAEZ ve **la mitad** (mediana 23 % frente a 55 %) | **Validado: usar MAG o NASADEM** |
| Profundidad efectiva y pedregosidad (#11) | GAEZ SQ3 (raíces), SQ7 (laboreo) | MAG `ndr`, `pfe` | Spearman | r = 0,34 y −0,32; GAEZ: 84 % "sin restricción" frente a 34 % superficial o poco profundo en el MAG | **Validado: MAG principal** |
| Textura y agua disponible (#12) | GAEZ SQ2; SMAP/GLDAS | MAG `stx`, `txs` | — | GAEZ: 59 % de retención 9 y 41 % de 10; sin contraste directo | Pendiente |
| pH y toxicidad (#13) | GAEZ SQ1 | MAG `txc`, `pdr` | Spearman | r = 0,51 con el pH; GAEZ no ve la toxicidad por aluminio (7 % de puntos) | **Validado: MAG principal** |
| Fertilidad (#14) | GAEZ SQ1 | MAG `rmo`, `cic`, `sdb` | Spearman | r = 0,20 (materia orgánica), 0,46 (CIC), 0,21 (saturación de bases) | **Validado: MAG principal** |
| Tipo de suelo | GAEZ HWSD 30″ | MAG Soil Taxonomy | Coincidencia por orden | 48 % | Validado |
| Aptitud por cultivo (#15) | GAEZ `res05` (índice 0–10000) | MAG ZAE (50 cultivos) | Coincidencia "apto/no apto" | GAEZ: cebada = 0 en Guamote y San Juan; sin quinua, chocho ni haba | Pendiente con la ZAE |

## Orden sugerido para ganar precisión
1. **Lluvia IMERG + factor INAMHI.** Es el único paso ya validado y el de mayor efecto (el error baja a menos de la mitad).
2. **Modelo híbrido probabilístico** con el error medido ([../05-Modelado/01-determinista-vs-probabilistico.md](../05-Modelado/01-determinista-vs-probabilistico.md)).
3. **Helada:** temperatura nocturna de MODIS más el riesgo por parroquia del MAG como contraste. Pedir al INAMHI series de Tmin
   de más años.
4. **Lancha** para papa, con POWER horario.
5. **GPP, NDVI y pendiente** para el historial de la zona y la erosión.
6. **Ceniza volcánica** en cantones expuestos al Sangay y al Tungurahua.
7. **Suelo del MAG** (profundidad, textura, pH, toxicidad y fertilidad), con GAEZ como respaldo. Reemplaza a SoilGrids.
8. **Aptitud ZAE del MAG** como filtro de cultivos, contrastada con GAEZ.

Cada paso debe repetir la validación con estaciones INAMHI separadas (70 % para calibrar y 30 % para probar) y reportar el error
antes y después del cambio.
