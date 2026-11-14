# Suelo: FAO GAEZ v4 frente al mapa geopedológico del MAG

**Pregunta:** ¿la información de suelo de FAO GAEZ v4 (global, recurso de la convocatoria) coincide con los estudios de suelo de
Ecuador? ¿Sirve para el bot?

**Respuesta corta:**
- GAEZ apunta en la **dirección correcta**: donde el MAG ve más pendiente, más acidez o suelos más delgados, GAEZ también ve
  "peor", con correlaciones de 0,34 a 0,62.
- Pero es **demasiado grueso para la sierra**:
  - ve la mitad de la pendiente real;
  - marca el 84 % de los puntos "sin restricción para raíces", cuando el MAG dice que un tercio son suelos superficiales o
    poco profundos;
  - el tipo de suelo coincide solo en el 48 % de los puntos.
- **Recomendación:** el MAG debe ser la fuente principal de suelo para cada parcela; GAEZ queda como respaldo global y para la
  aptitud de cultivos.

## Método
- **GAEZ v4**: ImageServer `gaez-services.fao.org/server/rest/services/LR/ImageServer`, operación `getSamples`, sin clave.
  Necesita un `User-Agent` de navegador; sin él responde 403.
- **Puntos**: grilla cada 0,02° (unos 2,2 km) entre −79,15 y −78,35 de longitud y −2,35 y −0,75 de latitud (Cotopaxi,
  Tungurahua, Chimborazo, Bolívar y el borde alto de Morona). Se quedan los puntos con altitud GAEZ entre 2.400 y 4.000 m:
  **2.340 puntos**.
- **MAG**: mapa geopedológico 1:25.000 (2019), 202.145 polígonos. El shapefile (1,29 GB) se lee directamente desde el zip y cada
  punto se asigna al polígono que lo contiene; los 2.340 puntos encontraron polígono.
- **Capas GAEZ usadas** (identificador entre paréntesis):

  | Capa | Resolución |
  |---|---|
  | Suelo dominante HWSD (676) | 30″ ≈ 1 km |
  | Pendiente mediana (718) | 30″ ≈ 1 km |
  | Calidad de suelo SQ1 a SQ7 con bajos insumos (682–694) | 5′ ≈ 9 km |
  | Limitante principal (678) | 5′ ≈ 9 km |
  | Aptitud de suelo (697, 698) | 5′ ≈ 9 km |

- **Lectura de los valores de GAEZ:**
  - las calidades SQ van de 1 a 10, donde 10 es "sin restricción". Lo comprobé con lugares de referencia: Iowa da 10, el
    Sahara 1 y Siberia 11 (permafrost);
  - el suelo dominante sigue el orden de la leyenda: 3 = Andosols, 21 = Phaeozems, 16 = Leptosols. Comprobado con Iowa
    (Phaeozems), Ucrania (Chernozems) y Holanda (Fluvisols).
- **Correlación**: Spearman entre clases ordenadas.
- Scripts: [scripts/gaez_muestreo.py](scripts/gaez_muestreo.py), [scripts/gaez_vs_mag.py](scripts/gaez_vs_mag.py) y
  [scripts/gaez_mag_analisis.py](scripts/gaez_mag_analisis.py). Datos:
  [resultados/suelo_gaez_mag_2340_puntos.json](resultados/suelo_gaez_mag_2340_puntos.json). Resumen:
  [resultados/suelo_gaez_vs_mag_concordancia.json](resultados/suelo_gaez_vs_mag_concordancia.json).

> **Aviso sobre el archivo del MAG:** en el DBF de 2019 los nombres de columna están corridos respecto a su contenido. Por
> ejemplo, el pH está en `txc`, la profundidad efectiva en `ndr`, el drenaje en `ttd` y la pedregosidad en `pfe`. El diccionario
> de datos no sirve tal cual; el script asigna los campos según su contenido real.

## Resultados (2.340 puntos)

| Variable | GAEZ v4 | MAG 1:25.000 | Concordancia | Lectura |
|---|---|---|---|---|
| **Tipo de suelo** | Andosols 54 %, Phaeozems 31 %, Leptosols 13 % | Andisoles 42 %, Mollisoles 32 %, Inceptisoles 10 %, sin suelo o misceláneo 10 %, Entisoles 6 % | **48 %** del mismo tipo | Coinciden en lo dominante (suelos volcánicos y suelos negros con materia orgánica). Muchos Mollisoles del MAG son Andosols en GAEZ, y GAEZ no ve las zonas sin suelo |
| **Pendiente** | Mediana **23 %**; 47 % de los puntos con más de 30 % | Mediana **55 %**; 60 % con más de 40 % | Spearman **0,62** | Ordena bien, pero **ve la mitad de la pendiente** porque promedia 1 km |
| **Profundidad de raíces** (SQ3 frente a profundidad efectiva) | 84 % "sin restricción" | 34 % superficial o poco profundo | Spearman **0,34** | GAEZ **sobrestima la profundidad**, y eso infla el banco de agua |
| **Nutrientes** (SQ1) frente al pH del MAG | Escala 8–10 | De muy ácido a alcalino | Spearman **0,51** | Bueno en dirección |
| SQ1 frente a la CIC | | | 0,46 | Moderado |
| SQ1 frente a la saturación de bases | | | 0,21 | Débil |
| SQ1 frente a la materia orgánica | | | 0,20 | Débil |
| **Laboreo** (SQ7) frente a la pedregosidad | 81 % "sin restricción" | 10 % con piedras frecuentes o más, 2 % rocoso | Spearman **−0,32**: el signo esperado, porque más piedra es peor laboreo | GAEZ no ve la mayoría de los terrenos pedregosos |
| **Oxígeno** (SQ4) frente al drenaje | 100 % "sin restricción" | 83 % buen drenaje; 1 % mal drenado | Coinciden; casi no hay problema | Sin valor diferencial |
| **Salinidad** (SQ5) | 100 % "sin restricción" | 99,9 % no salino | Coinciden | Sin valor diferencial |
| Limitante principal | Pendiente en el 86 %; nutrientes en el 2 % | — | — | Coincide con el MAG en que la pendiente es el problema central |
| Toxicidad | No se mide | 7 % con toxicidad por acidez (aluminio); 2 % por carbonatos | — | Solo el MAG lo detecta |

### Cantón Guamote (211 puntos)
| | GAEZ | MAG |
|---|---|---|
| Pendiente | Clase más común: 16–30 % | **52 % de los puntos entre 70 y 100 %** |
| Profundidad | 86 % sin restricción | **66 % superficial o poco profundo** |
| pH | Nutrientes 8–10 | Mayormente ligeramente ácido a neutro; 17 % alcalino |

## Interpretación
1. **El tipo de suelo coincide en lo grueso.** La sierra centro es de Andisoles (cenizas volcánicas) y Mollisoles. GAEZ y el MAG
   están de acuerdo en eso, pero GAEZ asigna un solo suelo dominante por píxel de 1 km, y en la sierra el suelo cambia en
   cientos de metros.
2. **La pendiente y la profundidad son los errores que más afectan al bot.** Con GAEZ, el bot creería que los terrenos son más
   planos y más profundos de lo que son. Eso lleva a recomendar papa y otros tubérculos en laderas, y a sobrestimar el agua
   del suelo.
3. **GAEZ no ve lo que dañaría una recomendación:** suelos sin cultivo (rocas, páramo, cangahua), toxicidad por aluminio y
   pedregosidad.
4. **Salinidad y drenaje no son un problema** en la sierra centro según ambas fuentes, así que no hace falta incluirlos en el
   puntaje.

## Recomendación para Pacha
| Variable | Fuente principal | Respaldo | Uso en el motor |
|---|---|---|---|
| Profundidad efectiva | **MAG** (`ndr`) | GAEZ SQ3 | Capacidad del banco de agua |
| Pendiente | **MAG** (`pen`) o NASADEM 30 m | GAEZ clase 718 | Penalizar tubérculos en más de 25 % |
| pH y toxicidad | **MAG** (`txc`, `pdr`) | GAEZ SQ1 | Excluir cultivos sensibles a la acidez (haba, cebada) donde hay toxicidad por aluminio; favorecer chocho y quinua |
| Materia orgánica, CIC y saturación de bases | **MAG** | — | Priorizar leguminosas y descanso donde la materia orgánica es baja |
| Tipo de suelo | **MAG** | GAEZ HWSD | Explicación en la tarjeta |
| Aptitud por cultivo | MAG ZAE | **GAEZ** (aptitud por cultivo, ImageServer `res05`) | Contraste |

GAEZ sirve donde el MAG no tenga dato, que en esta muestra no ocurrió, o fuera de Ecuador. También es la fuente global de la
convocatoria, así que conviene **mostrar ambos al jurado**: "dato global GAEZ, corregido con el estudio nacional del MAG".

## Implementación
- Recortar el geopedológico del MAG a la sierra, con solo los campos útiles y con nombres corregidos, y guardarlo en GeoPackage
  o PostGIS (Supabase).
- `clients.suelo(lat, lon)` que devuelva primero el MAG y después GAEZ (`getSamples`, que es rápido y sin clave).
- Así se reemplaza `clients.soil` (SoilGrids).

## Limitaciones
- La grilla de 2,2 km cubre zonas de páramo y ladera que no se cultivan, así que el contraste mezcla terreno agrícola y no
  agrícola.
- Las calidades SQ de GAEZ están a 9 km: un píxel contiene decenas de polígonos del MAG.
- El MAG describe unidades de paisaje, no muestras de laboratorio de la parcela. Es mucho más fino que GAEZ, pero no reemplaza un
  análisis de suelo.
- Falta contrastar la aptitud por cultivo de GAEZ con la ZAE del MAG (papa, cebada, quinua y chocho).
