# NASA POWER: catálogo completo (comunidad AG)

Generado el 2026-11-14 desde el endpoint oficial `https://power.larc.nasa.gov/api/system/manager/parameters?community=AG&temporal=<nivel>`.

## Cuántos parámetros hay

| Nivel temporal | Parámetros | Notas |
|---|---|---|
| Diario (`daily`) | **152** | 89 de meteorología, 60 de radiación, 2 de hidrología y 1 de geometría solar |
| Horario (`hourly`) | 105 | Igual que el diario más `CLOUD_PHASE` |
| Mensual (`monthly`) | 1.388 | Los mismos de base, más variantes por hora del día (`_00` a `_23`), `_MAX`, `_MIN` y `_SD` |
| Climatología (`climatology`) | 1.634 | Período 2001–2025. Incluye 16 extremos con periodo de retorno (`CD_DB_EXTREME_MIN_05/10/20/50`, etc.) |

Los niveles mensual y climatológico solo agregan variantes estadísticas. **Todos los parámetros físicos distintos están en la lista diaria de abajo.**

Los extremos climatológicos útiles para Pacha son:

| Parámetro | Qué es | Guamote (-1,93; -78,71) |
|---|---|---|
| `CD_DB_EXTREME_MIN_05` | Temperatura mínima extrema anual, retorno de 5 años | 1,6 °C |
| `CD_DB_EXTREME_MIN_10` | Ídem, retorno de 10 años | 1,2 °C |
| `CD_DB_EXTREME_MIN_20` | Ídem, retorno de 20 años | 0,8 °C |

Ojo: son de la celda de 0,5° (≈2.984 m en Guamote) y no tienen corrección por altura ni por inversión térmica en valles.

## Columna "Relevancia para Pacha"

- **YA SE USA**: está en `POWER_PARAMS` de `app/clients.py`.
- **ALTA, Media o Baja**: utilidad para recomendar rotaciones en la sierra.
- **Sin datos en Ecuador**: el catálogo lo lista, pero la API devolvió solo `-999` en Guamote (prueba del 2026-11-14).


## METEOROLOGY (89)

| Parámetro | Nombre | Unidad | Relevancia para Pacha |
|---|---|---|---|
| `EVLAND` | Evaporation Land | mm/day | Media. Evaporación real de suelo+planta (MERRA-2) |
| `EVPTRNS` | Evapotranspiration Energy Flux | MJ/m^2/day | Baja. Flujo energético de ET |
| `FROST_DAYS` | Frost Days | Days | Media. Días de helada (umbral del producto, muy conservador en sierra) |
| `FRSEAICE` | Ice Covered Fraction | 1 |  |
| `FRSNO` | Land Snowcover Fraction | 1 | Baja |
| `GDD10` | Growing Degree Days Above 10 C | degree-day-c | Media. Grados día base 10 °C (maíz) |
| `GDD13_3` | Growing Degree Days Above 13.3 C | degree-day-c | Baja |
| `GDD15_6` | Growing Degree Days Above 15.6 C | degree-day-c | Baja |
| `GDD4_4` | Growing Degree Days Above 4.4 C | degree-day-c | Media. Grados día base 4,4 °C (papa, haba, cebada) |
| `GDD7_2` | Growing Degree Days Above 7.2 C | degree-day-c | Media. Grados día base 7,2 °C |
| `GWETPROF` | Profile Soil Moisture | 1 | Media. Humedad de todo el perfil |
| `GWETROOT` | Root Zone Soil Wetness | 1 | ALTA. Humedad en zona de raíces (0-1) |
| `GWETTOP` | Surface Soil Wetness | 1 | Media. Humedad superficial (siembra) |
| `HDD0` | Heating Degree Days Below 0 C | degree-day-c |  |
| `HDD10` | Heating Degree Days Below 10 C | degree-day-c |  |
| `HDD18_3` | Heating Degree Days Below 18.3 C | degree-day-c |  |
| `IMERG_PRECLIQUID_PROB` | Probability of Liquid Precipitation | % | Baja. Granizo/nieve en páramo |
| `IMERG_PRECTOT` | Total Precipitation | mm/day | ALTA. Lluvia satelital GPM; exige time-standard=UTC |
| `IMERG_PRECTOT_COUNT` | Count of Precipitation Retrievals | count |  |
| `PBLTOP` | Planetary Boundary Layer Top Pressure | kPa |  |
| `PRECSNO` | Snow Precipitation | mm/day | Baja |
| `PRECSNOLAND` | Snow Precipitation Land | mm/day |  |
| `PRECTOT` | Total Precipitation | mm/hour |  |
| `PRECTOTCORR` | Precipitation Corrected | mm/day | YA SE USA. Lluvia (MERRA-2, sobrestima en sierra) |
| `PRMC` | Profile Soil Moisture | m3 m-3 | Sin datos en Ecuador |
| `PRMC_PRCNTL` | Profile Soil Moisture (Percentile) | % | Sin datos en Ecuador |
| `PS` | Surface Pressure | kPa | Baja. Presión (ET0 ya la calcula por altura) |
| `PSC` | Corrected Atmospheric Pressure (Adjusted For Site Elevation) | kPa |  |
| `PSH` | Peak Sun Hour | MJ/m^2/day |  |
| `PW` | Precipitable Water | cm |  |
| `QV10M` | Specific Humidity at 10 Meters | g/kg |  |
| `QV2M` | Specific Humidity at 2 Meters | g/kg | Baja. Alternativa a RH2M |
| `RH2M` | Relative Humidity at 2 Meters | % | YA SE USA. ET0 |
| `RHOA` | Surface Air Density | kg m-3 |  |
| `RZMC` | Root Zone Soil Moisture | m3 m-3 | Sin datos en Ecuador (solo EE. UU.) |
| `RZMC_PRCNTL` | Root Zone Soil Moisture (Percentile) | % | Sin datos en Ecuador |
| `SFMC` | Surface Soil Moisture | m3 m-3 | Sin datos en Ecuador |
| `SLP` | Sea Level Pressure | kPa |  |
| `SNODP` | Snow Depth | cm | Baja |
| `T10M` | Temperature at 10 Meters | C |  |
| `T10M_MAX` | Temperature at 10 Meters Maximum | C |  |
| `T10M_MIN` | Temperature at 10 Meters Minimum | C |  |
| `T10M_RANGE` | Temperature at 10 Meters Range | C |  |
| `T2M` | Temperature at 2 Meters | C | Media |
| `T2MDEW` | Dew/Frost Point at 2 Meters | C | ALTA. Punto de rocío: noches secas = helada radiativa |
| `T2MWET` | Wet Bulb Temperature at 2 Meters | C | Baja |
| `T2M_MAX` | Temperature at 2 Meters Maximum | C | YA SE USA. ET0 y GDD |
| `T2M_MIN` | Temperature at 2 Meters Minimum | C | YA SE USA. Heladas y ET0 |
| `T2M_RANGE` | Temperature at 2 Meters Range | C | Media. Amplitud térmica |
| `TO3` | Total Column Ozone | Dobsons |  |
| `TQV` | Total Column Precipitable Water | kg m-2 |  |
| `TROPPB` | Tropopause Pressure based on blended estimate. | kPa |  |
| `TROPQ` | Tropopause Specific Humidity using blended TROPP estimate. | g/kg |  |
| `TROPT` | Tropopause Temperature using blended TROPP estimate. | C |  |
| `TS` | Earth Skin Temperature | C | Media. Temperatura de superficie |
| `TSOIL1` | Soil Temperatures Layer 1 | C | Media. Temperatura del suelo capa 1 (germinación) |
| `TSOIL2` | Soil Temperatures Layer 2 | C |  |
| `TSOIL3` | Soil Temperatures Layer 3 | C |  |
| `TSOIL4` | Soil Temperatures Layer 4 | C |  |
| `TSOIL5` | Soil Temperatures Layer 5 | C |  |
| `TSOIL6` | Soil Temperatures Layer 6 | C |  |
| `TSURF` | Surface Temperature of Land and Snow | C |  |
| `TS_ADJ` | Earth Skin Temperature Adjusted | C |  |
| `TS_MAX` | Earth Skin Temperature Maximum | C | Baja |
| `TS_MIN` | Earth Skin Temperature Minimum | C | ALTA. Temperatura mínima de la superficie (proxy de helada en hoja) |
| `TS_RANGE` | Earth Skin Temperature Range | C |  |
| `U10M` | Eastward Wind at 10 Meters | m/s |  |
| `U2M` | Eastward Wind at 2 Meters | m/s |  |
| `U50M` | Eastward Wind at 50 Meters | m/s |  |
| `V10M` | Northward Wind at 10 Meters | m/s |  |
| `V2M` | Northward Wind at 2 Meters | m/s |  |
| `V50M` | Northward Wind at 50 Meters | m/s |  |
| `WD10M` | Wind Direction at 10 Meters | Degrees |  |
| `WD2M` | Wind Direction at 2 Meters | Degrees |  |
| `WD50M` | Wind Direction at 50 Meters | Degrees |  |
| `WS10M` | Wind Speed at 10 Meters | m/s |  |
| `WS10M_MAX` | Wind Speed at 10 Meters Maximum | m/s |  |
| `WS10M_MIN` | Wind Speed at 10 Meters Minimum | m/s |  |
| `WS10M_RANGE` | Wind Speed at 10 Meters Range | m/s |  |
| `WS2M` | Wind Speed at 2 Meters | m/s | YA SE USA. ET0 |
| `WS2M_MAX` | Wind Speed at 2 Meters Maximum | m/s |  |
| `WS2M_MIN` | Wind Speed at 2 Meters Minimum | m/s |  |
| `WS2M_RANGE` | Wind Speed at 2 Meters Range | m/s |  |
| `WS50M` | Wind Speed at 50 Meters | m/s |  |
| `WS50M_MAX` | Wind Speed at 50 Meters Maximum | m/s |  |
| `WS50M_MIN` | Wind Speed at 50 Meters Minimum | m/s |  |
| `WS50M_RANGE` | Wind Speed at 50 Meters Range | m/s |  |
| `WSC` | Corrected Wind Speed (Adjusted For Elevation) | m/s |  |
| `Z0M` | Surface Roughness | m |  |

## HYDROLOGY (2)

| Parámetro | Nombre | Unidad | Relevancia para Pacha |
|---|---|---|---|
| `GWM_HEIGHT` | GWM Height | m | Sin datos en Ecuador (pozos EE. UU.) |
| `GWM_HEIGHT_ANOMALY` | GWM Height Anomaly | m | Sin datos en Ecuador |

## RADIATION (60)

| Parámetro | Nombre | Unidad | Relevancia para Pacha |
|---|---|---|---|
| `AIRMASS` | Air Mass | dimensionless |  |
| `ALLSKY_KT` | All Sky Insolation Clearness Index | dimensionless |  |
| `ALLSKY_NKT` | All Sky Normalized Insolation Clearness Index | dimensionless |  |
| `ALLSKY_SFC_LW_DWN` | All Sky Surface Longwave Downward Irradiance | MJ/m^2/day |  |
| `ALLSKY_SFC_LW_UP` | All Sky Surface Longwave Upward Irradiance | MJ/m^2/day |  |
| `ALLSKY_SFC_PAR_DIFF` | All Sky Surface Diffuse PAR | MJ/m^2/day |  |
| `ALLSKY_SFC_PAR_DIRH` | All Sky Surface Direct Horizontal PAR | MJ/m^2/day |  |
| `ALLSKY_SFC_PAR_TOT` | All Sky Surface Total PAR | MJ/m^2/day | Media. Radiación fotosintética (potencial de rendimiento) |
| `ALLSKY_SFC_SW_DIFF` | All Sky Surface Shortwave Diffuse Irradiance | MJ/m^2/day |  |
| `ALLSKY_SFC_SW_DIRH` | All Sky Surface Shortwave Direct Horizontal Irradiance | MJ/m^2/day |  |
| `ALLSKY_SFC_SW_DNI` | All Sky Surface Shortwave Downward Direct Normal Irradiance | MJ/m^2/day |  |
| `ALLSKY_SFC_SW_DWN` | All Sky Surface Shortwave Downward Irradiance | MJ/m^2/day | YA SE USA. ET0 (radiación) |
| `ALLSKY_SFC_SW_UP` | All Sky Surface Shortwave Upward Irradiance | MJ/m^2/day |  |
| `ALLSKY_SFC_UVA` | All Sky Surface UVA Irradiance | MJ/m^2/day |  |
| `ALLSKY_SFC_UVB` | All Sky Surface UVB Irradiance | MJ/m^2/day |  |
| `ALLSKY_SFC_UV_INDEX` | All Sky Surface UV Index | W m-2 x 40 |  |
| `ALLSKY_SRF_ALB` | All Sky Surface Albedo | dimensionless |  |
| `AOD_55` | Aerosol Optical Depth 55 | dimensionless |  |
| `AOD_55_ADJ` | Adjusted Aerosol Optical Depth 55 | dimensionless |  |
| `AOD_84` | Aerosol Optical Depth 84 | dimensionless |  |
| `CDD0` | Cooling Degree Days Above 0 C | degree-day-c |  |
| `CDD10` | Cooling Degree Days Above 10 C | degree-day-c |  |
| `CDD18_3` | Cooling Degree Days Above 18.3 C | degree-day-c |  |
| `CLOUD_AMT` | Cloud Amount | % |  |
| `CLOUD_AMT_DAY` | Cloud Amount at Daytime | % |  |
| `CLOUD_AMT_NIGHT` | Cloud Amount at Nighttime | % | Media. Nubosidad nocturna (cielo despejado = helada) |
| `CLOUD_BT` | Cloud Bottom Temperature | C |  |
| `CLOUD_BT_MAX` | Maximum Cloud Bottom Temperature | C |  |
| `CLOUD_BT_MIN` | Minimum Cloud Bottom Temperature | C |  |
| `CLOUD_OD` | Cloud Optical Visible Depth | dimensionless |  |
| `CLOUD_TT` | Cloud Top Temperature | C |  |
| `CLOUD_TT_MAX` | Maximum Cloud Top Temperature | C |  |
| `CLOUD_TT_MIN` | Minimum Cloud Top Temperature | C |  |
| `CLRSKY_DAYS` | Clear Sky Days | Days | Media. Días despejados |
| `CLRSKY_KT` | Clear Sky Insolation Clearness Index | dimensionless |  |
| `CLRSKY_NKT` | Clear Sky Normalized Insolation Clearness Index | dimensionless |  |
| `CLRSKY_SFC_LW_DWN` | Clear Sky Surface Longwave Downward Irradiance | MJ/m^2/day |  |
| `CLRSKY_SFC_LW_UP` | Clear Sky Surface Longwave Upward Irradiance | MJ/m^2/day |  |
| `CLRSKY_SFC_PAR_DIFF` | Clear Sky Surface Diffuse PAR | MJ/m^2/day |  |
| `CLRSKY_SFC_PAR_DIRH` | Clear Sky Surface Direct Horizontal PAR | MJ/m^2/day |  |
| `CLRSKY_SFC_PAR_TOT` | Clear Sky Surface Total PAR | MJ/m^2/day |  |
| `CLRSKY_SFC_SW_DIFF` | Clear Sky Surface Shortwave Downward Diffuse Irradiance | MJ/m^2/day |  |
| `CLRSKY_SFC_SW_DIRH` | Clear Sky Surface Shortwave Direct Horizontal Irradiance | MJ/m^2/day |  |
| `CLRSKY_SFC_SW_DNI` | Clear Sky Surface Shortwave Downward Direct Normal Irradiance | MJ/m^2/day |  |
| `CLRSKY_SFC_SW_DWN` | Clear Sky Surface Shortwave Downward Irradiance | MJ/m^2/day |  |
| `CLRSKY_SFC_SW_UP` | Clear Sky Surface Shortwave Upward Irradiance | MJ/m^2/day |  |
| `CLRSKY_SRF_ALB` | Clear Sky Surface Albedo | dimensionless |  |
| `DISPH` | Zero Plane Displacement Height | m |  |
| `LWLAND` | Downward Longwave Flux Land | MJ/m^2/day |  |
| `MIDDAY_INSOL` | Midday Insolation Incident | MJ/m^2/day |  |
| `ORIGINAL_ALLSKY_SFC_LW_DWN` | All Sky Surface Longwave Downward Irradiance | MJ/m^2/day |  |
| `ORIGINAL_ALLSKY_SFC_SW_DIFF` | All Sky Surface Shortwave Diffuse Irradiance | MJ/m^2/day |  |
| `ORIGINAL_ALLSKY_SFC_SW_DIRH` | All Sky Surface Shortwave Direct Horizontal Irradiance | MJ/m^2/day |  |
| `ORIGINAL_ALLSKY_SFC_SW_DWN` | All Sky Surface Shortwave Downward Irradiance | MJ/m^2/day |  |
| `ORIGINAL_CLRSKY_SFC_LW_DWN` | Clear Sky Surface Longwave Downward Irradiance | MJ/m^2/day |  |
| `ORIGINAL_CLRSKY_SFC_SW_DWN` | Clear Sky Surface Shortwave Downward Irradiance | MJ/m^2/day |  |
| `SRF_ALB_ADJ` | Surface Albedo Adjusted | dimensionless |  |
| `SWLAND` | Downward Shortwave Flux Land | MJ/m^2/day |  |
| `TOA_SW_DNI` | Top-Of-Atmosphere Shortwave Direct Normal Radiation | MJ/m^2/day |  |
| `TOA_SW_DWN` | Top-Of-Atmosphere Shortwave Downward Irradiance | MJ/m^2/day |  |

## SOLAR-GEOMETRY (1)

| Parámetro | Nombre | Unidad | Relevancia para Pacha |
|---|---|---|---|
| `SZA` | Solar Zenith Angle | Degrees |  |
