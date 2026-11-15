# Astro Granja 🌱 · Datos de la NASA para la tierra de la sierra

**Español** · [English](README.en.md)

NASA Space Apps Challenge 2026 · Sede Sangolquí (ESPE) · Reto **"Field Shift: Adapting Farms with NASA Data"**

| | |
|---|---|
| **Juego en vivo** | https://pacha-chat.vercel.app (Astro Granja, abre sin cuenta, pensado para celular) |
| **Material de presentación** | [APP-PITCH/](APP-PITCH/) (arquitectura, plantas, idea, banco de agua y rotación, demo) |
| **Licencia** | [MIT](LICENSE) |
| **Datos principales** | [NASA POWER](https://power.larc.nasa.gov/) (comunidad AG, diario, 2001–2024) |

## El problema
En la sierra del Ecuador, sobre los 2.500 m, la mayoría de familias campesinas siembra sin riego tecnificado
y decide qué y cuándo sembrar por costumbre. La lluvia cambia de un año a otro y la papa repetida agota el
suelo y multiplica plagas. Los datos satelitales existen, pero llegan en tablas, unidades técnicas e inglés;
quien más los necesita (personas mayores, con poca lectura o que hablan kichwa) no puede usarlos.

## La solución
**Astro Granja**, un juego de granja casual para el navegador y el celular (Astro + three.js, instalable), donde
**Pachita** enseña a sembrar, regar y rotar cultivos en una parcela real de la sierra con datos de la NASA. El sitio web
es solo el juego; la historia y las pantallas están en [Juego Astro Granja](#juego-astro-granja-niños-de-8-a-12-años).

En el juego se vive lo que dicen los datos: el clima de la parcela es el **clima real de la NASA** de ese punto, el agua se cuenta en
baldes y tanques, y las rotaciones se calculan para esa tierra (ver [APP-PITCH/](APP-PITCH/)).

## Datos de la NASA y cómo se usan
| Dato | Producto | Para qué |
|---|---|---|
| Temperatura máxima y mínima a 2 m (`T2M_MAX`, `T2M_MIN`) | [NASA POWER Daily API](https://power.larc.nasa.gov/docs/services/api/temporal/daily/) (MERRA-2) | Rango de temperatura, días de calor, evaporación |
| Lluvia corregida (`PRECTOTCORR`) | NASA POWER (MERRA-2 / GPM IMERG) | Lluvia mensual, año seco, aguaceros, balance de agua |
| Humedad relativa (`RH2M`) y viento a 2 m (`WS2M`) | NASA POWER (MERRA-2) | Evaporación FAO-56 Penman-Monteith |
| Radiación solar (`ALLSKY_SFC_SW_DWN`) | NASA POWER (CERES) | Evaporación FAO-56 Penman-Monteith |

Consulta usada: `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M_MAX,T2M_MIN,PRECTOTCORR,RH2M,WS2M,ALLSKY_SFC_SW_DWN&community=AG&start=20010101&end=20241231&latitude=…&longitude=…&format=JSON`
(ver [`app/clients.py`](app/clients.py)).

**Fuentes complementarias (no NASA):** ECMWF IFS 9 km vía Open-Meteo (corrección de lluvia y temperatura
por altura), [SoilGrids](https://soilgrids.org/) de ISRIC (textura y materia orgánica del suelo), modelo de
elevación de Open-Meteo (altura y pendiente del círculo). Calendario de siembra, variedades y casos de
rotación: INIAP y estudios de campo recopilados por el equipo ([Documentacion-Investigacion/](Documentacion-Investigacion/)).

## Procesamiento (de los datos crudos a la respuesta)
1. **Descarga**: serie diaria de NASA POWER 2001–2024 para el punto (unos 8.700 días), en paralelo con
   suelo y altura. Se guarda en caché.
2. **Limpieza**: valores faltantes (`-999`) se rellenan con el promedio del mismo mes.
3. **Corrección por altura**: la celda de POWER (0,5° × 0,625°, unos 55 × 70 km) promedia valles y páramos y en los Andes llega a
   duplicar la lluvia. Se corrige mes a mes con ECMWF IFS 9 km (razón para la lluvia, diferencia para
   temperaturas); si no hay datos, se ajusta la temperatura con 6,5 °C por km de diferencia de altura.
4. **Evaporación (ET0)**: FAO-56 Penman-Monteith diaria con temperatura, humedad, viento y radiación.
5. **Balance de agua en el suelo**: cubeta diaria con la reserva del suelo (raíz × agua útil según textura),
   85 % de lluvia efectiva y Kc por etapa FAO-56. Se simula **cada uno de los ~23 años** para dar la
   probabilidad de éxito y el riego por mes; el año seco usa 20 % menos lluvia.
6. **Rasgos de la parcela**: días sobre 25 °C, días con más de 10 mm, humedad del suelo mes a mes y
   comparación de la década 2013–2024 contra 2001–2012.
7. **Reglas agronómicas**: altitud apta por cultivo, épocas de siembra por zona (INIAP), familias botánicas
   para rotar y leguminosas que fijan nitrógeno.
8. **Respuesta**: JSON que el navegador dibuja en 3D, con texto corto y la voz de Pachita (voz neuronal es-EC / en-US).

## Arquitectura
```
Juego Astro Granja (frontend/, Astro + three.js + Leaflet, PWA estática)
   │  POST /api/app/{parcela|terreno|semillas|cultivo|ciclo} · POST /api/voz
   ▼
FastAPI en Vercel (Python 3.12)
   ├─ web/app_api.py    respuestas JSON del juego (relieve, ficha, semillas, ciclo diario, rotaciones)
   ├─ web/servicio.py   sitio y clima con caché, áreas y textos de agua
   ├─ app/engine.py     sitio, clima corregido, FAO-56, balance de suelo, rotaciones
   ├─ app/clients.py    NASA POWER, ECMWF IFS, SoilGrids, elevación (con caché)
   └─ app/voz.py        texto a voz (edge-tts, respaldo gTTS)
```
El servidor no guarda datos del jugador: el navegador envía el lugar en cada llamada.

## Ejecutar y reproducir
```bash
pip install -r requirements.txt uvicorn
cd frontend && npm install && npm run build && cd ..   # compila el juego en frontend/dist
uvicorn api.index:app --port 8765        # abre http://localhost:8765 (juego)
python -m pytest -q tests                # pruebas del motor y de la API
```
Para editar el juego con recarga: `cd frontend && npm run dev` (http://localhost:4321, usa la API del 8765).
Vercel compila `frontend/` según `vercel.json` y publica la API de Python en `/api`.
Los sitios de demostración traen datos guardados en `app/semillas/` para que el juego no dependa de la red.

## Limitaciones conocidas
- La celda de NASA POWER es gruesa; la corrección con ECMWF reduce el error, pero no reemplaza una estación.
  La validación contra estaciones del INAMHI está en [Documentacion-Investigacion/03-Verificacion-Endpoints](Documentacion-Investigacion/03-Verificacion-Endpoints/).
- La humedad del suelo es un modelo de balance, no una medición satelital (SMAP no resuelve parcelas pequeñas).
- Kc de chocho, melloco y oca son estimados. Las palabras en kichwa están por validar con hablantes nativos.
- Las heladas no se muestran en la demo web por decisión de diseño.

## Impacto y siguientes pasos
- **Usuarios:** familias campesinas de la sierra (Chimborazo, Cotopaxi, Tungurahua, Pichincha, Imbabura,
  Carchi, Bolívar, Cañar, Azuay, Loja). Funciona en celular con datos móviles y habla en audio.
- **Siguiente paso:** validar el juego con escuelas y 2–3 comunidades, con técnicos del MAG o de juntas de riego, agregar kichwa hablado y sustituir fuentes no NASA por SMAP/NASADEM donde
  la resolución lo permita.
- **Costo de operación:** función serverless gratuita y NASA POWER sin costo; sin cuentas ni anuncios.

## Juego Astro Granja (niños de 8 a 12 años)

**Jugar:** https://pacha-chat.vercel.app (en el celular; `?sin3d=1` fuerza el modo sin 3D). **Español e inglés:** el botón ES/EN está en el menú, el mapa y la barra de arriba; la voz de Pachita cambia con el idioma.

Aplicación de granja casual, original, para aprender a sembrar y cuidar la tierra de la sierra con datos reales.
La guía **Pachita**, una granjera de la sierra (sombrero, poncho y anaco), con globos cortos y voz. La historia:

1. **Nombre de la granja:** Pachita, desde su cohete, pide el nombre de tu granja.
2. **Llegada:** el cohete baja con fuego y sonido, aterriza sobre el campo y Pachita da la bienvenida. Luego pide
   elegir la parcela en un mapa satelital que **se abre en tu ubicación** (sin sitios de ejemplo): un círculo cuyo tamaño
   va de 0,1 a 10 hectáreas con el deslizador, y se puede escribir más (hasta 100 ha).
3. **Así es tu tierra:** la parcela aparece en 3D con su relieve real (`/api/app/terreno`) y una ficha técnica con los
   datos que vienen solo de NASA POWER: lluvia de un año normal y seco, evaporación, temperatura y días de calor, sol (CERES),
   humedad del aire y viento, **humedad del suelo en las raíces mes a mes** (GWETROOT) y cambio de la última década
   (`/api/app/parcela`), más la **pendiente del terreno** con el perfil de la parcela (relieve Copernicus DEM de
   Open-Meteo, que no es dato de la NASA y así se indica). Pachita lo explica con frases simples.
4. **Semillas por familia botánica:** los 13 cultivos como íconos animados, agrupados en leguminosas, solanáceas,
   gramíneas, amarantáceas, tubérculos andinos y pastos/cobertura, con el porqué de cada familia para rotar. Cada semilla
   abre una ficha con su ciclo, la altura donde crece, para qué sirve y los meses de siembra. Las que no sirven por altura
   aparecen con candado y su razón (`/api/app/semillas`); vicia, trébol, alfalfa y biomasa son «solo información»: Pachita
   explica por qué no se siembran solas.
5. **Calendario:** rueda de 12 meses con la época de siembra del cultivo en la zona (INIAP); fuera de época, Pachita avisa.
6. **Sembrar:** tocar las parcelas (o «Sembrar todo»). Al llenar las cuatro, **el tiempo corre solo**.
7. **¿Cuánta agua necesita?:** litros que bebe el cultivo en su ciclo (por metro cuadrado y en toda la parcela), lo que
   da la lluvia y lo que hay que regar en un año normal y en uno seco, con el semáforo mes a mes (`/api/app/ciclo`).
8. **Crecer:** el tiempo avanza con el clima real de un año de NASA POWER. Una **cronología** muestra las etapas del
   cultivo y los días que faltan para cosechar. Estrés por sequía y por calor (¡Arrarray!), y aguaceros (¡Achachay!);
   regar descuenta litros del tanque y el servidor recalcula el ciclo. **Cuando Pachita habla, el tiempo espera**: si pide regar o cosechar, el botón late hasta que lo hagas; si solo cuenta algo, el play sigue solo al terminar. Una pantalla de carga con consejos aparece si algo tarda, y los datos de la parcela se piden a la vez para esperar menos.
9. **Cosecha:** «Cosechar todo» con una azada animada; una sola tarjeta por semilla (promedio de sus parcelas), con el
   puntaje calculado en el servidor según el agua que faltó y la época.
10. **Rotar:** Pachita explica por qué rotar evita la degradación del suelo y recomienda **3 rotaciones** calculadas
    para la parcela (`/api/app/cultivo`). **La app sigue la rotación elegida paso a paso** (por ejemplo arveja → papa →
    mixtura) y la muestra siempre en la barra de arriba, hasta completarla.
11. **Certificado de Granjero Cósmico:** a pantalla completa (apaisado en escritorio, vertical en celular), con el
    nombre de la granja, cosechas, puntaje, rotación elegida y medallas; se puede descargar como imagen. Sin compras ni anuncios.

Los 18 íconos 3D de cultivos (`frontend/public/img/cultivos3d/`) se recortaron de la lámina del equipo con `scripts/recortar_cultivos.py`; los íconos de interfaz son SVG propios (`frontend/src/juego/ui.ts`), sin emojis. El cielo del mundo 3D pasa del día a la noche, el mapa muestra los nombres de pueblos y vías, y el botón de play termina el cultivo más largo en 10 segundos.

| Archivo | Qué hace |
|---|---|
| `frontend/src/pages/index.astro` | Página del juego (portada del sitio) |
| `frontend/src/juego/` | Controlador, mundo 3D y 2D, mapa, Pachita, sonidos (Web Audio), idioma ES/EN y estado |
| `web/app_api.py` | `parcela`, `terreno`, `semillas`, `cultivo` y `ciclo` (todo número sale de aquí) |
| `tests/test_juego.py` | Pruebas de `/api/app/terreno` sin red |

## Declaración de uso de inteligencia artificial
- **Desarrollo:** el código, la documentación y el análisis contaron con asistencia de **Claude Code (Anthropic)**.
  El equipo definió el problema, la metodología científica, los cultivos, el calendario y los casos de campo,
  y revisó cada cambio por Pull Request.
- **Dentro del juego:** no hay modelos de lenguaje; todo número sale del motor. La voz de Pachita se genera con
  edge-tts / gTTS (en inglés, la voz infantil `en-US-AnaNeural`); los sonidos del cohete se sintetizan en el navegador.
- **Imágenes:** las ilustraciones de Pachita (tres poses) y los 18 íconos 3D de cultivos, entregados por el equipo y
  generados con IA, llevan la marca "IA"; los modelos 3D se programaron con asistencia de IA. La voz de Pachita es edge-tts con tono de niña.
- No se usan logotipos de la NASA.

## Créditos y licencia
- Código bajo [licencia MIT](LICENSE). Las fotos conservan su propia licencia (CC BY-SA / CC0).
- *These data were obtained from the NASA Langley Research Center (LaRC) POWER Project funded through the
  NASA Earth Science/Applied Science Program.*
- FAO-56 (Allen et al., 1998) para evaporación y coeficientes de cultivo; INIAP para variedades y épocas de siembra.
- Antes de tu primer commit, lee [CONTRIBUTING.md](CONTRIBUTING.md).
