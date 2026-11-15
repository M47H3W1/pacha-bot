# MAG: Geoportal del Agro y SIPA

El Ministerio de Agricultura y Ganadería (MAG) publica **70 conjuntos de datos** en Datos Abiertos Ecuador, consultados por API
CKAN el 2026-11-14. Varios son reemplazos directos de los recursos de EE. UU. de la convocatoria (SSURGO, CDL, NASS, AMS).

Endpoint: `https://www.datosabiertos.gob.ec/api/3/action/package_search?fq=organization:mag&rows=100`

## Los más útiles para Pacha

### 1. Mapa Geopedológico del Ecuador continental, 1:25.000 (2009–2015, editado en 2019)
Es el equivalente ecuatoriano de SSURGO: **202.145 polígonos** en UTM 17S (WGS84).

> **Corrección (verificado registro a registro el 2026-11-14):** en el DBF de 2019 los **nombres de columna están corridos** respecto a
> su contenido, así que el diccionario de datos no se puede usar tal cual. Esta tabla da el contenido real de cada columna:

| Columna en el DBF | Contenido real | Ejemplo de valor | Uso en Pacha |
|---|---|---|---|
| `DPA_DESPRO` | Cantón | GUAMOTE | Ubicación |
| `pen` | Pendiente | `> 40 - 70 %` | Erosión; cultivos de cobertura (#4) |
| `nug`, `otx`, `sotx`, `gtx` | Orden, suborden, gran grupo y subgrupo (Soil Taxonomy) | ANDISOLES; CRYANDS | Tipo de suelo |
| `stx` | Textura superficial | FRANCO ARENOSO | Agua disponible (#12) |
| `txs` | Textura subsuperficial | ARCILLOSO | Agua disponible (#12) |
| `ttd` | Drenaje | BUENO | Encharcamiento |
| `ndr` | **Profundidad efectiva** | POCO PROFUNDO | Banco de agua (#11) |
| `pfe` | Pedregosidad | FRECUENTES | Laboreo (#11) |
| `pdr` | Toxicidad: AC (acidez o aluminio), CAR (carbonatos) | ALTA (AC) | pH y toxicidad (#13) |
| `txc` | **pH** | LIGERAMENTE ACIDO | pH y toxicidad (#13) |
| `phi` | Salinidad | NO SALINO | Sin variación en la sierra |
| `rmo` | Materia orgánica | MEDIO | Fertilidad (#14) |
| `cic` | Capacidad de intercambio catiónico | ALTA | Fertilidad (#14) |
| `sdb` | Saturación de bases | BAJA | Fertilidad (#14) |
| `fld` | Inundación | NULA (MUY CORTA) | Riesgo |
| `uge` | Unidad geomorfológica | RELIEVE COLINADO MUY ALTO | Contexto |

- Descarga: `http://geoportal.agricultura.gob.ec/descargar/zip/shp_unidad_geopedologica_2019.zip`. Es un **shapefile de
  1,29 GB**; el servidor acepta pedidos por rango (HTTP 206).
- El script [../03-Verificacion-Endpoints/scripts/gaez_vs_mag.py](../03-Verificacion-Endpoints/scripts/gaez_vs_mag.py) lo lee
  desde el zip sin descomprimir y aplica estos nombres corregidos.
- No hay un servicio WMS/WFS público para consultar un punto: `/geoserver/ows` no responde.
- **Implicación:** hay que preprocesarlo offline. Por ejemplo, recortar a la sierra, simplificar y guardar en SQLite/GeoPackage o en una tabla de Supabase con PostGIS. Así el bot consulta por punto.

### 2. Mapas de riesgos agroclimáticos por inundación, sequía y helada (2022)
- Amenaza, exposición, vulnerabilidad y riesgo para los subsectores agrícola, pecuario y forestal, **por parroquia**.
- Campos del diccionario: `provincia`, `canton`, `parroquia`, `mriag` (multirriesgo normalizado) y `mriag_desc` (categoría).
- Pacha podría mostrarlo así: "Tu parroquia tiene riesgo de helada ALTO según el MAG (2022)". Es un contraste oficial con el cálculo propio del bot.
- Metadatos: `geoportal.agricultura.gob.ec/geonetwork/srv/spa/catalog.search#/metadata/2f9bf165-e160-4edb-928a-994af426e7c3`

### 3. Zonificación agroecológica (ZAE) por cultivo
El MAG reporta **50 cultivos con zonificación agroecológica y 19 con zonificación agroecológica económica** ([Política Agropecuaria 2026](https://www.agricultura.gob.ec/wp-content/uploads/2026/02/Poli%CC%81tica-pu%CC%81blica-agropecuaria-9-2-26-compressed.pdf)).
Entre ellos están papa, quinua, chocho, cebada y otros cultivos de altura.

- **Papa en época seca** (2025), con campos `zae` (apto, moderado, marginal o no apto), `lmt` (limitante), `rtm` (temperatura media) y `rpv` (días húmedos al año).
- También en Datos Abiertos: cebada, chía, durazno, babaco y brócoli.
- Para quinua y chocho existen documentos de 2014. La quinua se considera entre 2.000 y 3.500 m; el chocho prioriza cantones de Pichincha, Carchi, Imbabura, Tungurahua, Cotopaxi y Chimborazo.
- **Uso:** el puntaje de aptitud de Pacha hoy solo mira la altura (`alt_min` y `alt_max` en `app/crops.csv`). La zona ZAE del MAG agrega suelo, pendiente y clima de forma oficial.

### 4. Capacidad de uso de las tierras, 1:25.000 (2021)
- Clases I a VIII de aptitud general. Las clases VI a VIII no son aptas para cultivos anuales; ahí conviene recomendar pasto o descanso.

### 5. Mapa digital de fertilidad química de suelos, 30 m (2022)
- Materia orgánica, pH, fósforo y otros elementos, en clases.

### 6. Otros mapas
- Cobertura y uso de la tierra 1:100.000 (2013–2014) y sistemas productivos (2020). Es el equivalente de CropScape/NLCD.
- Mapa de microreservorios (2017–2019): sirve para saber si hay riego cerca.
- Modelo Digital del Terreno de Ecuador.
- Carbono orgánico del suelo a 1 km (2021).

## SIPA: precios al productor (equivalente a USDA AMS)
Conjunto: "Promedio de precios mensuales según la producción provincial, a nivel productor".
CSV verificado (corte junio de 2026):
- **16.748 filas**, de 2016 a 2026, mensual, **por provincia**, con 112 productos.
- Columnas: `PP_ANIO, PP_MES, DPA_PROVINCIA, PP_PRODUCTO, PP_UNIDAD, PP_PONDERADO_USD, PP_PONDERADO_USD_KG`.
- Productos de altura presentes: varias papas (Superchola, Chaucha, Fripapa, Única, Gabriela, Cecilia…), Maíz Suave Choclo y Seco, Haba Tierna, Arveja Tierna, fréjoles, **Quinua**, **Chocho**, Cebada Grano Seco y Trigo.
- **Uso:** hoy el campo `ingreso` de `crops.csv` es fijo (alto, medio o bajo). Con estos precios se puede calcular por provincia y mes, y mostrar la tendencia.
- Boletines mensuales de precios mayoristas en `sipa.agricultura.gob.ec/boletines/` (en PDF).

## Estado de los portales (2026-11-14)
| URL | Resultado |
|---|---|
| `datosabiertos.gob.ec` (API CKAN) | OK |
| `sipa.agricultura.gob.ec` | HTTP 200 |
| `geoportal.agricultura.gob.ec` (descargas `.zip`) | OK por HTTP, con soporte de rangos (206) |
| `geoportal.agricultura.gob.ec/geoserver/…` | Sin servicio (404 o tiempo de espera agotado) |

La verificación completa y repetible de todos los endpoints está en
[../03-Verificacion-Endpoints/05-estado-de-endpoints.md](../03-Verificacion-Endpoints/05-estado-de-endpoints.md).
