# Estudios de suelos en Ecuador

## Cartografía oficial (MAG)
| Estudio | Escala | Contenido | Estado |
|---|---|---|---|
| **Mapa geopedológico** (SIGTIERRAS/IEE 2009–2015, edición 2019) | 1:25.000 | 202.145 polígonos con relieve, pendiente, taxonomía, textura, drenaje, profundidad, pedregosidad, toxicidad, pH, salinidad, materia orgánica, CIC, saturación de bases e inundación | **Descargado y usado** en el [contraste con GAEZ](../03-Verificacion-Endpoints/04-validacion-suelo-GAEZ-vs-MAG.md). Columnas corridas: ver el aviso en ese documento |
| Capacidad de uso de las tierras (2021) | 1:25.000 | Clases de uso según suelo y pendiente | Geoportal MAG |
| Fertilidad química de suelos (2022) | 30 m | Nutrientes | Geoportal MAG |
| Carbono orgánico del suelo (2021) | 1 km | Carbono | Geoportal MAG |
| Zonificación agroecológica (ZAE) | Por cultivo | Aptitud para 50 cultivos | Geoportal MAG |

El levantamiento 1:25.000 se apoyó en unos **12.924 perfiles de suelo**.

## Estudios sobre Chimborazo
- **Cangahua** (toba volcánica endurecida y estéril): cubre el 6,3 % de Chimborazo, unas 82.778 ha. Un proyecto de recuperación
  devolvió 79 ha al cultivo con roturación y abonos verdes, y la materia orgánica pasó de 1,7 % a 1,91 %
  ([Siembra, UCE](https://revistadigital.uce.edu.ec/index.php/SIEMBRA/article/download/9603/11811/52541)).
- **Erosión**: 600 t/ha/año en cangahua habilitada frente a 80 t/ha/año en suelo negro andino. Son mediciones de 1986
  ([Dialnet](https://dialnet.unirioja.es/descarga/articulo/8234817.pdf)).
- **Guamote**: tesis de la ESPOCH (2021) que mide la erosión con cesio-137 en el barrio San Juan.
- **INIAP**: siembra de papa en suelos erosionados de Cacha (2024).
- **IRD/ORSTOM y PRONAREG**: mapas de suelos de la sierra de los años 80
  ([IRD](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/pleins_textes_7/b_fdi_57-58/010024449.pdf)).

## Fuentes globales para contrastar
- **FAO GAEZ v4** (recurso de la convocatoria): suelo dominante (HWSD), calidades de suelo SQ1 a SQ7, pendiente y aptitud. El
  contraste con el MAG está en
  [../03-Verificacion-Endpoints/04-validacion-suelo-GAEZ-vs-MAG.md](../03-Verificacion-Endpoints/04-validacion-suelo-GAEZ-vs-MAG.md).
- NASA no mide nutrientes. Sí aporta humedad del suelo (SMAP, GLDAS) y pendiente (NASADEM).

## Cómo entran al bot
Cinco parámetros de suelo (#11–#15: profundidad y pedregosidad, textura, pH y toxicidad, fertilidad, aptitud por cultivo) en
[../04-Recomendaciones/04-top15-parametros.md](../04-Recomendaciones/04-top15-parametros.md).
