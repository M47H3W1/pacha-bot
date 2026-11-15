# Pacha 🌱 · Datos de la NASA para la tierra de la sierra

**Español** · [English](README.en.md)

NASA Space Apps Challenge 2026 · Sede Sangolquí (ESPE) · Reto **"Field Shift: Adapting Farms with NASA Data"**

| | |
|---|---|
| **Demo en vivo** | https://pacha-chat.vercel.app (abre sin cuenta, pensada para celular) |
| **Bot de Telegram** | [@Pacha_EC_Bot](https://t.me/Pacha_EC_Bot) |
| **Licencia** | [MIT](LICENSE) |
| **Datos principales** | [NASA POWER](https://power.larc.nasa.gov/) (comunidad AG, diario, 2001–2024) |

## El problema
En la sierra del Ecuador, sobre los 2.500 m, la mayoría de familias campesinas siembra sin riego tecnificado
y decide qué y cuándo sembrar por costumbre. La lluvia cambia de un año a otro y la papa repetida agota el
suelo y multiplica plagas. Los datos satelitales existen, pero llegan en tablas, unidades técnicas e inglés;
quien más los necesita (personas mayores, con poca lectura o que hablan kichwa) no puede usarlos.

## La solución
**Aplicación web y móvil** (Astro, instalable en el celular) con seis pantallas: Bienvenida → Ubicación
(parroquia o GPS y tamaño de la parcela) → **Mi parcela** → **Qué sembrar** (los 3 mejores cultivos y en
**cuántos de cada 10 años** gana cada uno, mes a mes y rotaciones) → **Riego** de esta semana → **Datos** (fuentes
NASA y de Ecuador, validación y créditos). Cada cifra muestra su fuente y se puede escuchar en voz alta.

El chat anterior sigue en `/chat/` como "Preguntar a Pacha": un asistente que responde **con dibujos, mensajes de una a tres líneas y audio**, como una
conversación de mensajería. El agricultor manda **un punto y un círculo** con el tamaño de su tierra, y Pacha:

1. **📋 Ver mi tierra**: altura, pendiente, suelo, temperatura, lluvia de un año normal y de un año seco,
   evaporación, **humedad del suelo mes a mes** y cuánto cambió la lluvia en la última década.
2. **🌱 Qué sembrar**: los cultivos que sirven a su altura y que están en época de siembra en su zona, con un
   veredicto de agua (✅ lluvia alcanza · ⚠️ regar a veces · ❌ necesita riego) y el mes de cosecha.
3. **🔁 Qué sembrar después**: rotaciones que cortan plagas y alimentan la tierra (leguminosas), y
   **📚 rotaciones probadas** en campo en Ecuador (Sicalpa, Illangama, Río Paute, Santa Catalina, Tumbaco).
4. **💧 Cuánto regar**: qué días de esta semana regar y cuánta agua, contada en **baldes, tanques o tanqueros**
   para el área real de su tierra.
5. **Preguntas libres** escritas o por nota de voz, respondidas por modelos abiertos que solo hablan con los
   números calculados para esa tierra.

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
8. **Respuesta**: imagen generada con matplotlib, texto corto y audio (voz neuronal es-EC).

## Arquitectura
```
App Astro (frontend/, PWA estática)          Chat (frontend/public/chat/, HTML + JS, Leaflet, voz)
   │  GET /api/parroquias · /api/fuentes          │  POST /api/accion · /api/pregunta · /api/voz · /api/transcribir
   │  POST /api/app/{parcela|recomendacion|cultivo|riego|probadas}
   ▼                                              ▼
FastAPI en Vercel (Python 3.12)
   ├─ web/app_api.py    respuestas JSON para la app (incluye "gana X de N años")
   ├─ web/servicio.py   respuestas del chat: imagen + texto + audio
   ├─ app/engine.py     sitio, clima corregido, FAO-56, balance de suelo, rotaciones
   ├─ app/charts.py     dibujos (fichas, semáforos, tarjetas de cultivos)
   ├─ app/clients.py    NASA POWER, ECMWF IFS, SoilGrids, elevación (con caché)
   ├─ app/voz.py        texto a voz (edge-tts, respaldo gTTS)
   └─ web/openrouter.py preguntas libres con modelos abiertos en cascada
```
El servidor no guarda datos del agricultor: el celular envía el estado en cada llamada.
El bot de Telegram ([`app/bot.py`](app/bot.py)) usa el mismo motor.

## Ejecutar y reproducir
```bash
pip install -r requirements.txt uvicorn
cd frontend && npm install && npm run build && cd ..   # compila la app Astro en frontend/dist
uvicorn api.index:app --port 8765        # abre http://localhost:8765 (app) y /chat/ (chat)
python -m pytest -q tests                # pruebas del motor y de la API
```
Para editar la interfaz con recarga: `cd frontend && npm run dev` (http://localhost:4321, usa la API del 8765).
Vercel compila `frontend/` según `vercel.json` y publica la API de Python en `/api`.
El ejemplo de Calpi (el del mock) trae datos guardados en `app/semillas/` para que la demo no dependa de la red.
Variables opcionales (en `.env` o en Vercel, nunca en el código): `OPENROUTER_API_KEY` activa las preguntas
libres; sin ella todo lo demás funciona con botones. El bot de Telegram necesita `TELEGRAM_BOT_TOKEN`
(ver [`.env.example`](.env.example) y `docker compose up -d --build`).

## Limitaciones conocidas
- La celda de NASA POWER es gruesa; la corrección con ECMWF reduce el error, pero no reemplaza una estación.
  La validación contra estaciones del INAMHI está en [Documentacion-Investigacion/03-Verificacion-Endpoints](Documentacion-Investigacion/03-Verificacion-Endpoints/).
- La humedad del suelo es un modelo de balance, no una medición satelital (SMAP no resuelve parcelas pequeñas).
- Kc de chocho, melloco y oca son estimados. Las palabras en kichwa del bot están por validar con hablantes nativos.
- Las heladas no se muestran en la demo web por decisión de diseño.

## Impacto y siguientes pasos
- **Usuarios:** familias campesinas de la sierra (Chimborazo, Cotopaxi, Tungurahua, Pichincha, Imbabura,
  Carchi, Bolívar, Cañar, Azuay, Loja). Funciona con celular básico y datos móviles; responde en audio.
- **Siguiente paso:** pasar de la maqueta a WhatsApp Business con técnicos del MAG o de juntas de riego,
  validar con 2–3 comunidades, agregar kichwa hablado y sustituir fuentes no NASA por SMAP/NASADEM donde
  la resolución lo permita.
- **Costo de operación:** función serverless gratuita, NASA POWER sin costo y modelos de lenguaje abiertos.

## Juego Astro Granja (niños de 8 a 12 años)

**Jugar:** https://pacha-chat.vercel.app/juego/ (en el celular; `?sin3d=1` fuerza el modo sin 3D)

Aplicación de granja casual, original, para aprender a sembrar y cuidar la tierra de la sierra con datos reales.
La guía **Pachita**, una granjera de la sierra (sombrero, poncho y anaco), con globos cortos y voz. La historia:

1. **Nombre de la granja:** Pachita, desde su cohete, pide el nombre de tu granja.
2. **Llegada:** el cohete aterriza junto al volcán, Pachita da la bienvenida y pide elegir la parcela en un mapa
   satelital con un punto y un círculo de radio variable (20–600 m).
3. **Así es tu tierra:** la parcela aparece en 3D con su relieve real (`/api/app/terreno`) y una ficha técnica con los
   datos que vienen solo de NASA POWER: lluvia de un año normal y seco, evaporación, temperatura y días de calor, sol (CERES),
   humedad del aire y viento, **humedad del suelo en las raíces mes a mes** (GWETROOT) y cambio de la última década
   (`/api/app/parcela`).
   Pachita lo explica con frases simples.
4. **Semillas por familia botánica:** los 13 cultivos como íconos animados, agrupados en leguminosas, solanáceas,
   gramíneas, amarantáceas, tubérculos andinos y pastos/cobertura, con el porqué de cada familia para rotar. Los que no
   sirven por altura aparecen con candado y su razón (`/api/app/semillas`).
5. **Calendario:** rueda de 12 meses con la época de siembra del cultivo en la zona (INIAP); fuera de época, Pachita avisa.
6. **Sembrar:** tocar las franjas de la parcela (o sembrar todo).
7. **¿Cuánta agua necesita?:** litros que bebe el cultivo en su ciclo (por metro cuadrado y en toda la parcela), lo que
   da la lluvia y lo que hay que regar en un año normal y en uno seco, con el semáforo mes a mes (`/api/app/ciclo`).
8. **Crecer:** el tiempo avanza con el clima real de un año de NASA POWER. Estrés por sequía (la planta se marchita),
   por calor (días sobre 25 °C) y aguaceros; regar descuenta litros del tanque y el servidor recalcula el ciclo.
9. **Cosecha:** puntaje calculado en el servidor según el agua que faltó y la época, con el veredicto del motor.
10. **Rotar:** Pachita explica por qué rotar evita la degradación del suelo y recomienda **3 rotaciones** calculadas
    para la parcela (`/api/app/cultivo`), más casos probados en campo (`/api/app/probadas`).
11. **Certificado de Granjero Cósmico:** con el nombre de la granja, cosechas, puntaje, rotación elegida y medallas;
    se puede descargar como imagen. Sin compras ni anuncios.

Los 18 íconos 3D de cultivos (`frontend/public/img/cultivos3d/`) se recortaron de la lámina del equipo con `scripts/recortar_cultivos.py`; los íconos de interfaz son SVG propios (`frontend/src/juego/ui.ts`), sin emojis. El cielo del mundo 3D pasa del día a la noche, el mapa muestra los nombres de pueblos y vías, y el botón de play termina el cultivo más largo en 10 segundos.

| Archivo | Qué hace |
|---|---|
| `frontend/src/pages/juego.astro` | Página del juego |
| `frontend/src/juego/` | Controlador, mundo 3D y 2D, mapa, Pachita y estado |
| `web/app_api.py` | `terreno`, `semillas` y `ciclo` (todo número sale de aquí) |
| `tests/test_juego.py` | Pruebas de `/api/app/terreno` sin red |

## Declaración de uso de inteligencia artificial
- **Desarrollo:** el código, la documentación y el análisis contaron con asistencia de **Claude Code (Anthropic)**.
  El equipo definió el problema, la metodología científica, los cultivos, el calendario y los casos de campo,
  y revisó cada cambio por Pull Request.
- **Dentro de la aplicación:** las preguntas libres se responden con modelos abiertos vía
  [OpenRouter](https://openrouter.ai/) (Gemma de Google, Nemotron de NVIDIA), limitados a los números
  calculados por el motor. La voz se genera con edge-tts / gTTS y las notas de voz se transcriben con el
  reconocimiento de voz del navegador.
- **Imágenes:** los dibujos de la app se generan por código a partir de los datos; las fotos de cultivos son de
  Wikimedia Commons con autor y licencia en [`app/imagenes/cultivos/README.md`](app/imagenes/cultivos/README.md).
  En el juego Astro Granja, las ilustraciones de Pachita (tres poses) y los 18 íconos 3D de cultivos, entregados por el equipo y
  generados con IA, llevan la marca "IA"; los modelos 3D se programaron con asistencia de IA. La voz de Pachita es edge-tts con tono de niña.
- No se usan logotipos de la NASA.

## Créditos y licencia
- Código bajo [licencia MIT](LICENSE). Las fotos conservan su propia licencia (CC BY-SA / CC0).
- *These data were obtained from the NASA Langley Research Center (LaRC) POWER Project funded through the
  NASA Earth Science/Applied Science Program.*
- FAO-56 (Allen et al., 1998) para evaporación y coeficientes de cultivo; INIAP para variedades y épocas de siembra.
- Antes de tu primer commit, lee [CONTRIBUTING.md](CONTRIBUTING.md).
