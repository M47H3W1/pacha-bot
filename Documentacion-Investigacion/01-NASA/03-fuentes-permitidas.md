# Regla de fuentes: todo NASA + recursos de la convocatoria, contrastado con Ecuador

**Regla del equipo:** las fuentes globales del modelo son:
1. **todos los productos de NASA** (POWER, Earthdata, ORNL, GES DISC, LP DAAC, NSIDC y GMAO), estén o no en la lista de la
   convocatoria;
2. **los recursos globales de la convocatoria que no son de NASA:** ERA5 (ECMWF), Copernicus Sentinel-2 (ESA) y FAO GAEZ v4.

Las fuentes ecuatorianas (INAMHI, MAG, INEC, INIAP, IG-EPN y SNGR) sirven para **contrastar y calibrar** cada variable.

## Catálogo permitido, por tema
| Tema | Productos |
|---|---|
| Clima y meteorología | NASA POWER (MERRA-2 y CERES), MERRA-2 directo, ERA5 |
| Lluvia | GPM IMERG (vía POWER o GES DISC) |
| Humedad del suelo y agua | SMAP, GLDAS/FLDAS, POWER `GWET*`, ECOSTRESS, MODIS `MOD16` |
| Vegetación y crecimiento | MODIS/VIIRS (NDVI, EVI, GPP, LAI, FPAR, LST), Landsat/HLS, Sentinel-2, GEDI, OCO-2 SIF |
| Relieve | SRTM / NASADEM |
| Gases y aerosoles | OCO-2/OCO-3 (CO2), OMI y OMPS (SO2, NO2, O3), AIRS (CO, CH4, O3), MERRA-2 (aerosoles y química), MODIS MAIAC y fuego, GEOS-CF (pronóstico de composición) |
| Pronóstico | GEOS-FP y GEOS-CF de GMAO (NASA) |
| Suelo y aptitud | FAO GAEZ v4. **NASA no tiene nutrientes de suelo** |

## Lo que queda fuera
| Fuente | Por qué | Reemplazo |
|---|---|---|
| ISRIC SoilGrids (código actual: `clients.soil`) | No es NASA ni está en la convocatoria | FAO GAEZ v4 + geopedológico del MAG |
| Open-Meteo elevation (Copernicus DEM; `clients.elevation`) | Igual | SRTM/NASADEM 30 m, que además da la pendiente |
| ECMWF IFS (`clients.ifs_diario`) | No es ERA5 | Factor INAMHI sobre IMERG. La corrección con IFS no mostró mejora |
| Pronóstico de Open-Meteo (`clients.forecast_week`) | Igual | GEOS-FP o GEOS-CF (NASA); ver abajo |
| Sentinel-5P (ESA), aunque GES DISC lo distribuye | Es de ESA y no está en la convocatoria | OMI y OMPS |
| CHIRPS, NOAA GML | Igual | Solo referencia bibliográfica |

ERA5 se puede seguir leyendo por Open-Meteo: ahí Open-Meteo solo es el medio de acceso, no la fuente.

## Pronóstico de 7 días con NASA
- **GEOS-FP** (GMAO) publica pronósticos meteorológicos globales a unos 25 km, con temperatura, lluvia y humedad, como archivos
  NetCDF por OPeNDAP. Para tener la serie de un punto hay que descargar y recortar los archivos.
- **GEOS-CF** tiene una API de punto, pero el acceso se pide al equipo GMAO. Desde el 24 de noviembre de 2025 la versión por
  defecto es la v2.
- Ninguno de los dos se probó todavía. Si no resulta práctico, la alternativa dentro de la regla son los avisos del INAMHI.
