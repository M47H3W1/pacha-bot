# INAMHI: Instituto Nacional de Meteorología e Hidrología

Es la fuente oficial de observaciones de clima en Ecuador. Para Pacha cumple dos papeles:
1. **Verdad de terreno** para medir el error de NASA POWER, IMERG y ERA5 en la sierra.
2. **Factor de corrección local**, porque sus estaciones están a la altura real del agricultor.

## Qué datos están disponibles (verificado el 2026-11-14)

### 1. Datos Abiertos Ecuador (sin registro, API CKAN)
Endpoint: `https://www.datosabiertos.gob.ec/api/3/action/package_search?fq=organization:instituto-nacional-de-meteorologia-e-hidrologia-inamhi`

| Conjunto | Contenido real | Volumen |
|---|---|---|
| **Precipitación Total Mensual** | Aunque dice "2019", trae la **serie mensual histórica** de cada estación | **947 estaciones, 20.588 años-estación, de 1960 a 2019** |
| Temperatura Mínima Absoluta | Mínima absoluta de cada mes y el día en que ocurrió | 134 estaciones, solo año 2013 |
| Temperatura Máxima Absoluta | Ídem para la máxima | Solo 2013 |
| Temperatura Media Mensual | Media mensual | Solo 2013 |

- Formato: CSV separado por `;`, codificación ISO-8859-1 y coma decimal.
- Columnas de precipitación: `Estacion;NombreEstacion;longitud2;latitud2;altitud;anio;ene;…;dic`.
- URL directa: `https://www.datosabiertos.gob.ec/dataset/eaa8894f-68d1-4a15-80f8-1a6f528f946c/resource/98c77d18-e863-4e00-8a22-eb47f2981d9c/download/inamhi-precipitacion-2019diciembre.csv`

Filtros aplicados a la sierra:
- Estaciones a 2.000 m o más: **334**.
- De ellas, con 10 o más años completos entre 2001 y 2019: **85**. Esas 85 son las que usamos en la validación.

### 2. Servicios web del INAMHI
- `servicios.inamhi.gob.ec`: visor hidrometeorológico, pronósticos y aplicaciones web. Desde Python el certificado SSL falló (`self-signed certificate`); en navegador funciona.
- No hay una API pública documentada de series diarias. Para obtener series diarias o horarias hay que pedirlas formalmente al INAMHI.
- Los anuarios meteorológicos en PDF existen desde los años 80 ([biblioteca INAMHI](https://www.inamhi.gob.ec/biblioteca/)). Son útiles para revisar, no para automatizar.
- [INAMHI GEOGLOWS](https://inamhi.geoglows.org/) responde (HTTP 200) y tiene pronósticos hidrológicos e información satelital, pero no series observadas.

### 3. Alertas de heladas
El INAMHI emite avisos de heladas para la sierra. Por ejemplo, del 2 al 5 de diciembre de 2025 alertó de posibles daños
a cultivos sobre los 2.800 m ([Expreso](https://www.expreso.ec/actualidad/inamhi-alerta-madrugadas-heladas-afectaran-la-sierra-ecuatoriana-266435.html)),
y en marzo de 2026 alertó por frío extremo ([Extra](https://www.extra.ec/noticia/ecuador/temperaturas-cero-sacuden-sierra-ecuatoriana-productores-agricolas-alerta-149496.html)).
No encontramos un feed estructurado (RSS o API). Pacha podría enlazar a estos avisos en la alerta de 7 días.

## Calidad y limitaciones
- La red es densa en el callejón interandino y escasa en páramo alto.
- Hay estudios que señalan sesgo de ubicación de las estaciones, que no representan el país de forma uniforme ([Magoffin et al. 2023, Remote Sensing](https://www.mdpi.com/2072-4292/15/24/5713)).
- Los pluviómetros fallan más en relieve complejo, y una estación representa mal la lluvia de una ladera a pocos km.
- La serie abierta termina en 2019. Para 2020 en adelante hay que pedir los datos o usar satélite.

## Cómo lo usaría Pacha
1. **Validación (hecho):** ver [../03-Verificacion-Endpoints/02-validacion-lluvia-INAMHI.md](../03-Verificacion-Endpoints/02-validacion-lluvia-INAMHI.md).
2. **Corrección por estación cercana:** si hay una estación INAMHI a menos de ~15 km y con una diferencia de altura menor a ~300 m, escalar mes a mes la lluvia satelital por la razón `estación / satélite` del período común. Es la misma idea de `_ajuste_ifs` en `app/engine.py`, pero con observación real.
3. **Mostrar la fuente:** "Lluvia ajustada con la estación INAMHI Guamote (M0xxx), a 6 km". Esto da confianza al agricultor.

## Otras redes de estaciones en la sierra

| Red | Qué ofrece | Acceso |
|---|---|---|
| **Gobierno Provincial de Tungurahua (HGPT)** | 15 estaciones meteorológicas automáticas, 4 pluviométricas y 10 convencionales en páramos | Visor en `rrnn.tungurahua.gob.ec/red` y anuarios en PDF. Los datos crudos (CSV por FTP) [requieren convenio](https://www.gob.ec/gadp-tungurahua/tramites/red-hidrometeorologica-provincial) |
| **iMHEA** (CONDESAN, FONAG) | Microcuencas de páramo con lluvia y caudal de alta resolución ([Ochoa-Tocachi et al. 2018, Scientific Data](https://www.nature.com/articles/sdata201880.pdf)) | Datos publicados con el artículo |
| **IIGE** (Instituto de Investigación Geológico y Energético) | 5 estaciones automáticas (Nitón, Carapungo, Baños-Cuenca, San Gabriel, Chachimbiro) | CSV en Datos Abiertos (2024) |
