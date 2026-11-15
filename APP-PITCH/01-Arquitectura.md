# 1 · Arquitectura, datos y stack

## 1.1 Vista general

```mermaid
flowchart LR
  subgraph FUENTES["Fuentes de datos (APIs abiertas)"]
    N1["NASA POWER diario<br/>T2M_MAX/MIN, PRECTOTCORR,<br/>RH2M, WS2M, ALLSKY_SFC_SW_DWN<br/>2001-2024"]
    N2["NASA POWER climatología<br/>GWETROOT / GWETTOP<br/>humedad del suelo"]
    O1["Open-Meteo<br/>elevación Copernicus DEM<br/>+ ECMWF IFS 9 km"]
    S1["ISRIC SoilGrids<br/>textura y materia orgánica"]
    C1["Catálogo del equipo<br/>crops.csv, calendario.csv<br/>casos.csv (INIAP, estudios)"]
  end

  subgraph BACK["Backend · FastAPI en Vercel (Python 3.12)"]
    CL["app/clients.py<br/>descarga + caché gzip"]
    LIM["Limpieza y corrección<br/>-999 a media del mes<br/>ajuste por altura"]
    ENG["app/engine.py<br/>ET0 FAO-56 · balance de suelo<br/>banco de agua · rotaciones"]
    API["web/app_api.py<br/>parcela · terreno · semillas<br/>ciclo · cultivo"]
    VOZ["app/voz.py<br/>edge-tts / gTTS"]
  end

  subgraph FRONT["Frontend · Astro 5 + TypeScript (PWA estática)"]
    MAP["Mapa Leaflet<br/>elige tu parcela"]
    W3D["Mundo 3D three.js<br/>(+ respaldo 2D)"]
    UI["Pachita · HUD · cronología<br/>cosecha · certificado"]
    SND["Sonidos Web Audio<br/>(sintetizados)"]
  end

  N1 & N2 & O1 & S1 --> CL --> LIM --> ENG
  C1 --> ENG
  ENG --> API
  API -- "JSON" --> UI
  API -- "relieve" --> W3D
  MAP -- "lat, lon, radio" --> API
  UI -- "texto" --> VOZ -- "audio mp3" --> UI
  UI --- W3D
  UI --- SND
```

## 1.2 De la API al juego, paso a paso

```mermaid
flowchart TD
  A["1 · El jugador marca un punto y un círculo en el mapa"] --> B["2 · POST /api/app/parcela y /terreno"]
  B --> C["3 · Descarga en paralelo:<br/>NASA POWER (24 años) · SoilGrids · elevación"]
  C --> D["4 · Limpieza: -999 a promedio del mes;<br/>corrección por altura con ECMWF IFS<br/>(o 6,5 °C/km si falta)"]
  D --> E["5 · ET0 diaria FAO-56 Penman-Monteith"]
  E --> F["6 · Balance de agua del suelo día a día<br/>(el banco de agua)"]
  F --> G["7 · Reglas agronómicas:<br/>altitud, época INIAP, familia, leguminosa"]
  G --> H["8 · JSON simple al navegador"]
  H --> I["9 · El juego dibuja: relieve 3D, ficha, semillas,<br/>cronología, sequía, aguacero, puntaje"]
```

## 1.3 Extracción de datos de la API

| Dato | Servicio | Cómo se pide | Para qué |
|---|---|---|---|
| Clima diario 2001–2024 | **NASA POWER** `temporal/daily/point`, comunidad `AG` | `parameters=T2M_MAX,T2M_MIN,PRECTOTCORR,RH2M,WS2M,ALLSKY_SFC_SW_DWN` | Lluvia, evaporación, calor, año seco |
| Humedad de suelo en raíces | **NASA POWER** `temporal/climatology/point` | `GWETROOT,GWETTOP` (0–1, mes a mes) | Ficha "Así es tu tierra" |
| Altura y relieve | **Open-Meteo** (Copernicus DEM) | hasta 100 puntos por consulta | Malla 3D de la parcela, pendiente |
| Corrección de lluvia y temperatura | **ECMWF IFS 9 km** vía Open-Meteo | serie diaria del punto | Desfase de la celda NASA (≈ 55 × 70 km) |
| Textura del suelo | **ISRIC SoilGrids** | arcilla, arena, limo, materia orgánica | Agua útil del suelo (mm por metro de raíz) |

**Caché y velocidad:** cada respuesta válida se guarda en `cache/*.json.gz` (nunca una respuesta fallida). Cuatro sitios de demostración van en `app/semillas/` para que el juego funcione sin red. En producción, un punto nuevo tarda ≈ 12 s la primera vez (NASA POWER) y la pantalla de carga cubre la espera.

## 1.4 Limpieza y transformación de datos

| Paso | Qué se hace | Por qué |
|---|---|---|
| Faltantes | `-999` (valor "sin dato" de POWER) → promedio del mismo mes | Evitar lluvias o temperaturas absurdas |
| Escala espacial | La celda de POWER (0,5° × 0,625°) mezcla valles y páramos; se corrige mes a mes con ECMWF IFS 9 km (razón en lluvia, diferencia en temperatura). Respaldo: 6,5 °C por km de desnivel | En los Andes la celda llega a duplicar la lluvia |
| Unidades | mm, °C, MJ/m²/día → litros por parcela (÷ eficiencia 0,75), baldes, tanques, tanqueros | Quien más lo necesita no lee unidades técnicas |
| ET0 | FAO-56 Penman-Monteith con T, RH, viento y radiación | Estándar mundial de evaporación |
| Lluvia efectiva | 85 % de la lluvia diaria llega a la raíz | Escorrentía y pérdidas |
| Escenario seco | 20 % menos lluvia | "¿Y si el año es malo?" |
| Contadores del juego | calor ≥ 25 °C, aguacero ≥ 10 mm por día | Eventos visibles: ¡Arrarray! (calor, sequía) y ¡Achachay! (frío, aguacero) |

## 1.5 Stack

| Capa | Tecnología | Nota |
|---|---|---|
| Frontend | **Astro 5**, TypeScript, **three.js 0.170**, **Leaflet** | Sitio estático, instalable (PWA); `?sin3d=1` para equipos modestos |
| Animación y sonido | CSS/SVG por capas, Web Animations, **Web Audio** | Sin archivos de audio; modo económico en equipos lentos |
| Idioma | Español / English | La voz de Pachita cambia con el idioma |
| Backend | **FastAPI** (Python 3.12), NumPy | Función serverless; no guarda datos del jugador |
| Motor | `app/engine.py` (FAO-56, balance de suelo, rotaciones) | Un solo motor para el juego y el bot de Telegram |
| Voz | `edge-tts` (es-EC / `en-US-AnaNeural`), respaldo `gTTS` | Voz de niña, texto corto |
| Despliegue | **Vercel** con CI (pruebas, secretos, preview por PR) | `develop` publica en pacha-chat.vercel.app |
| Calidad | pytest (20 pruebas), Playwright para recorridos | El servidor decide los números; el navegador solo dibuja |

## 1.6 Qué manda el servidor y qué dibuja el juego

| Endpoint | Entrega | Lo que se ve |
|---|---|---|
| `POST /api/app/terreno` | Altura de una malla de puntos | Relieve 3D, pendiente |
| `POST /api/app/parcela` | Ficha NASA del punto (lluvia, ET0, temperatura, sol, humedad, década) | Tarjeta "Así es tu tierra" |
| `POST /api/app/semillas` | Los 13 cultivos: ¿se pueden sembrar aquí y ahora?, época, razón | Cartas de semillas con candado |
| `POST /api/app/ciclo` | Un ciclo día a día con clima real, riegos del jugador, humedad, estrés y puntaje | Cronología, sequía, tanque, estrellas |
| `POST /api/app/cultivo` | Veredicto de agua por mes y 3 rotaciones calculadas | Calendario de agua y rotación |
| `POST /api/voz` | mp3 de Pachita (`lang` es/en) | Voz del globo |

Regla de diseño: **todo número sale del servidor**; el juego no inventa datos.
