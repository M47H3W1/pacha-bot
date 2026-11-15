# 5 · Evidencia, demo y respuestas

## 5.1 Guion de demo (3 minutos)

| Tiempo | Qué se muestra | Qué se dice |
|---|---|---|
| 0:00 | Portada con el cohete aterrizando | "Pachita viene del espacio con datos de la NASA para ayudar a una granja de la sierra." |
| 0:20 | Nombre de la granja y mapa satelital que se abre **en tu ubicación**; círculo de 0,1 a 10 ha | "Esta es **mi** parcela, no un ejemplo." |
| 0:45 | Carga (≈ 12 s la primera vez) y relieve 3D + ficha "Así es tu tierra" | "Lluvia de un año normal y de uno seco, evaporación, humedad del suelo mes a mes: todo de NASA POWER." |
| 1:10 | Semillas por familia; tocar una con candado y una "solo información" (trébol) | "No toda semilla sirve a esta altura y no toda planta es cosecha." |
| 1:30 | Calendario de 12 meses → Sembrar todo → el tiempo corre | "El tiempo del juego es un año real de la NASA." |
| 1:50 | Sequía: el botón de regar late, Pachita habla, el tanque baja | "El banco de agua se vacía: regar cuesta litros." |
| 2:15 | Cosechar todo con la hoz y la canasta | "El puntaje sale del servidor, no del juego." |
| 2:30 | Rotación: tres opciones calculadas y la elegida en la barra | "Arveja, papa, mixtura: la app la sigue paso a paso." |
| 2:50 | Certificado a pantalla completa; botón ES/EN | "Un certificado para la casa. Y todo en inglés con voz propia." |

Consejo: usar un lugar ya consultado (cargará al instante) y dejar el 3D con `?sin3d=1` como plan B si el proyector es lento.

## 5.2 Cifras que se pueden verificar

| Cifra | Valor | Dónde se comprueba |
|---|---|---|
| Años de clima | 24 (2001–2024), ≈ 8.700 días por punto | `app/clients.py` (`POWER_START`, `POWER_END`) |
| Variables NASA | 6 diarias + 2 de humedad de suelo | `POWER_PARAMS`, `power_clima()` |
| Años simulados por cultivo | ≈ 23 (los que caben el ciclo completo) | respuesta de `/api/app/cultivo` (`anios`) |
| Cultivos | 13 sembrables + 4 informativos | `app/crops.csv`, `frontend/src/juego/juego.ts` |
| Rotaciones evaluadas por consulta | todas las combinaciones de 3 cultivos aptos a la altura (cientos) | `comparar_rotaciones()` |
| Pruebas automáticas | **20 pasan** (`pytest tests`) | `tests/` |
| Primera consulta de un punto nuevo | ≈ 12 s en producción (límite 60 s) | medido en pacha-chat.vercel.app |
| Sitios con datos locales | 4 (sin red) | `app/semillas/` |
| Coste | función serverless gratuita, NASA POWER sin costo | `vercel.json` |
| Archivos versionados | ≈ 220 | `git ls-files` |

Ejemplo concreto: papa sembrada en octubre en Chimborazo (2.776 m) → "regar a veces", mes crítico enero (la planta pide 91 mm y la lluvia útil pone 53 mm). Ver la sección 4.4 de [04-Banco-de-Agua-y-Rotacion.md](04-Banco-de-Agua-y-Rotacion.md).

## 5.3 Capturas y entregables ya listos
- [`docs/entregables/capturas/`](../docs/entregables/capturas/): menú, ficha de la tierra, rotación y certificado en español e inglés.
- [`docs/entregables/Presentacion_ES.pdf`](../docs/entregables/Presentacion_ES.pdf) y [`Presentation_EN.pdf`](../docs/entregables/Presentation_EN.pdf): diapositivas.
- [`docs/entregables/Ficha_Proyecto_ES_EN.pdf`](../docs/entregables/Ficha_Proyecto_ES_EN.pdf): ficha del proyecto con fuentes y declaración de IA.
- [`Documentacion-Investigacion/`](../Documentacion-Investigacion/): investigación NASA y Ecuador, verificación de endpoints y validación contra INAMHI.

## 5.4 Cómo reproducirlo
```bash
pip install -r requirements.txt uvicorn
cd frontend && npm install && npm run build && cd ..
uvicorn api.index:app --port 8765        # abre http://localhost:8765
python -m pytest -q tests                # 20 pruebas
```

## 5.5 Límites honestos (decirlos antes de que pregunten)
- La celda de NASA POWER es gruesa (≈ 55 × 70 km). Se corrige con ECMWF IFS 9 km, pero no reemplaza una estación; hay validación contra INAMHI en la documentación.
- MERRA-2 duplica la lluvia de la sierra centro (San Juan: 658 mm observados frente a 1.415); el juego la corrige con ECMWF IFS, pero la validación no mostró mejora con IFS en 7 estaciones. Úsalo para comparar meses y años, no para predecir milímetros exactos. La hoja de ruta (IMERG + calibración INAMHI) está en [06-Investigacion.md](06-Investigacion.md).
- La humedad del suelo es un **modelo de balance**, no una medición satelital (SMAP no resuelve parcelas pequeñas).
- Kc de chocho, melloco y oca son estimados.
- El relieve (Copernicus DEM vía Open-Meteo), SoilGrids y ECMWF **no son de la NASA** y así se indica en el juego.
- El puntaje de rotación es comparativo y explicable, no un pronóstico de rendimiento ni de ingreso (los valores de ingreso son relativos y por validar).
- Las heladas no se muestran en la demo web por decisión de diseño; ¡Achachay! se activa por frío y aguacero.
- Las palabras en kichwa están por validar con hablantes nativos.
- Audio y fluidez del 3D se verificaron en navegador de pruebas; falta una prueba en celulares reales de la comunidad.

## 5.6 Preguntas probables y respuestas cortas

| Pregunta | Respuesta |
|---|---|
| ¿Por qué un juego y no una app técnica? | Quien más necesita los datos no lee tablas; los niños aprenden jugando y llevan el mensaje a casa. El mismo motor sirve al bot para adultos. |
| ¿Los números son reales? | Sí: clima diario NASA POWER del punto, corregido por altura, con FAO-56 y balance de suelo. Ningún número lo inventa un modelo de lenguaje. |
| ¿Dónde usa IA? | Para desarrollar el código (Claude Code), las ilustraciones y la voz sintética. Dentro del juego no hay modelos de lenguaje; el bot de Telegram usa Gemini solo para explicar resultados. |
| ¿Por qué NASA POWER y no SMAP? | POWER da clima diario por punto desde 2001 y es abierto; SMAP no resuelve parcelas pequeñas. Se planea sumarlo. |
| ¿Cómo se valida? | Pruebas automáticas del motor, contraste con INAMHI y casos publicados de rotación (Sicalpa, Illangama, Río Paute, Santa Catalina, Tumbaco). |
| ¿Funciona sin internet? | La primera consulta de un lugar nuevo necesita red; los sitios de demostración y las consultas repetidas funcionan con datos guardados. |
| ¿Cuánto cuesta operarlo? | Función serverless gratuita, datos abiertos, sin cuentas ni anuncios. |
| ¿Se puede extender? | Sí: nuevos cultivos son una fila en `crops.csv` y otra en `calendario.csv`; el idioma, un par de textos. |

## 5.7 Declaración de IA
Código, documentación y análisis con asistencia de Claude Code (Anthropic); el equipo definió el problema, la metodología científica, los cultivos, el calendario y los casos, y revisó cada cambio por Pull Request. Las ilustraciones de Pachita y de los cultivos son imágenes generadas con IA y llevan la marca "IA". Sin logotipos de la NASA.
*These data were obtained from the NASA Langley Research Center (LaRC) POWER Project funded through the NASA Earth Science/Applied Science Program.*
