# Pacha · @Pacha_EC_Bot

Bot de Telegram para agricultores de la sierra del Ecuador. NASA Space Apps Challenge 2026, reto
"Field Shift: Adapting Farms with NASA Data".

## Qué hace
1. **Mi terreno**: ubicación GPS o provincia de la sierra. Muestra altura, suelo, lluvia, evaporación y heladas.
2. **Mi cultivo y rotación**: dos caminos.
   - *Ya tengo un cultivo*: compara tu rotación con dos alternativas.
   - *Quiero empezar*: recomienda los 3 mejores cultivos para el mes de siembra y arma rotaciones.
   Cada opción tiene una tarjeta con por qué, evidencia, beneficios, lo que no sabemos y riesgos.
3. **Banco de agua** (se abre tras elegir cultivo): lluvia útil que entra menos gasto del cultivo que sale.
   La diferencia, dividida por la eficiencia del riego, son los litros por m² que hay que poner.
   Incluye año normal, año seco y cuánto regar esta semana con pronóstico.

Extras: escenarios de clima, alerta de helada a 7 días, preguntas libres con Gemini, historial por agricultor,
glosario y explicación de los datos.

## Modo campo (por defecto)
Pensado para agricultores con poca lectura o que hablan poco español:
- Menú de 6 botones: Mi chakra, Qué sembrar, Cuánto regar, ¿Viene helada?, Preguntar y Más.
- Cada respuesta tiene máximo 4 líneas, trato de usted y un dibujo (meses, semana o cultivos).
- Nada de mm, puntajes ni porcentajes. Se habla de veces por semana, días, baldes por cuadro de 3 por 3 pasos
  y la prueba del dedo en la tierra.
- Botón 🔊 Escuchar en cada pantalla (voz en español). Se puede activar el audio automático en Más.
- Notas de voz del agricultor: se responden con Gemini cuando haya clave.
- Botones en kichwa y español. **Las palabras en kichwa están por validar con hablantes nativos** (app/kichwa.py).
- Los números completos siguen detrás de 📊 Ver los números y en Más → Modo técnico, para técnicos y jurado.

## Ciencia
- ET0 diaria FAO-56 Penman-Monteith con NASA POWER 2001–2024.
- Lluvia y temperatura de POWER corregidas mes a mes con ECMWF IFS de 9 km (Open-Meteo), que ya está a la
  altura real. Sin esa corrección POWER duplica la lluvia en los Andes (≈1.650 mm frente a ≈800 mm en Chimborazo).
- Balance diario de agua en el suelo (modelo del notebook AgroBot v2 del equipo): reserva = raíz × agua útil del
  suelo, arranca a la mitad, lluvia efectiva 85 %, escenario seco con 20 % menos lluvia. Se simula el ciclo en cada
  uno de los ~23 años de NASA POWER y se da un veredicto (sí / con riego de apoyo / no) y un semáforo por mes.
- Kc por etapas FAO-56; ciclos de variedades INIAP (Superchola, Sultana, Tunkahuan). Chocho, melloco y oca con Kc estimado.
- Rotaciones de referencia del equipo: R0 papa-papa-barbecho, R1 Illangama y R2 granos andinos (app/rotaciones_ref.csv).
- Fuente complementaria: Open-Meteo/ERA5 (la del notebook) solo para validar lluvia y ET0 y decir qué tan seguros estamos.
- Helada: probabilidad de aire a 2 m ≤ 4 °C, porque las hojas se enfrían 3–5 °C más en noches despejadas.
- Suelo: SoilGrids (ISRIC). Si no responde, se usa "franco" y se avisa.

## Ejecutar con Docker
```bash
cp .env.example .env   # y pon TELEGRAM_BOT_TOKEN
docker compose up -d --build
docker compose logs -f
```

## Variables
| Variable | Uso |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Obligatoria |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | Persistencia en Supabase. Sin ellas se usa SQLite en el volumen |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Explicaciones y preguntas libres. Sin clave se usan textos fijos |

Antes de usar Supabase, aplica `supabase/migrations/001_init.sql` en el proyecto.

## Pruebas
```bash
python -m pytest -q tests
python scripts/dry_run.py
```

## Equipo
Lee [CONTRIBUTING.md](CONTRIBUTING.md) antes de tu primer commit: ramas, Pull Requests y manejo de credenciales.

## Aplicación web y móvil (Astro, Vercel)

App instalable en el celular (PWA) hecha con **Astro** a partir del mock (`Mocks/`). Es la entrada principal; el chat
anterior sigue disponible en `/chat/` como "Preguntar a Pacha".

| Pantalla | Ruta | Qué muestra |
|---|---|---|
| Bienvenida | `/` | "Planifique su próxima siembra": probar con el ejemplo de Calpi o consultar su parcela |
| Ubicación | `/ubicacion` | Elegir parroquia (59 de la sierra), usar el GPS del teléfono y el tamaño de la parcela |
| Mi parcela | `/parcela` | Altura, temperatura, suelo, lluvia contra evaporación por mes, humedad del suelo y tendencia |
| Qué sembrar | `/sembrar` | Los 3 mejores cultivos para el mes, **en cuántos de cada 10 años gana cada uno**, semáforo mes a mes y rotaciones |
| Riego | `/riego` | Cuántas veces y cuánta agua regar esta semana, con el pronóstico |
| Datos | `/datos` | Fuentes NASA y de Ecuador, validación con el INAMHI, créditos y declaración de IA |

Cada cifra lleva una chapita con su fuente. Botón 🔊 para escuchar (voz del teléfono). Funciona en celular y
escritorio, y la interfaz queda guardada para usarla sin señal.

**API JSON** (`api/index.py` → `web/app_api.py`): `GET /api/parroquias`, `GET /api/fuentes` y
`POST /api/app/{parcela|recomendacion|cultivo|riego|probadas}` con `{"estado": {"lat", "lon", "radio", "mes", "crop", "dias"}}`.
Calpi (el ejemplo del mock) trae datos guardados en `app/semillas/` para que la demo no dependa de la red.

En local:

```bash
pip install -r requirements.txt uvicorn
cd frontend && npm install && npm run build && cd ..
uvicorn api.index:app --port 8765          # sirve la app compilada y la API en http://localhost:8765
# o, para editar la interfaz con recarga: (cd frontend && npm run dev)  → http://localhost:4321 (usa la API del 8765)
```

Vercel compila `frontend/` (`vercel.json` → `frontend/dist`) y publica la API de Python en `/api`.

## Chat "Preguntar a Pacha" (`/chat/`)

Página para celular que simula una conversación de mensajería con Pacha. Pacha responde **solo con imágenes y
notas de voz**, calculadas con los datos reales (NASA POWER corregido con ECMWF, FAO-56, balance de suelo).

- El agricultor envía su terreno desde el clip → **Ubicación**: un punto y un **círculo** con el área (se puede marcar
  desde cualquier lugar). El área se usa para contar el agua en baldes, tanques o tanqueros; el clima sigue siendo
  el de la celda de NASA corregida a la altura del punto.
- Preguntas escritas o por nota de voz: **OpenRouter** con modelos abiertos gratuitos en cascada.
- Sitios de demostración (Guano, Cayambe, Saquisilí) vienen con datos guardados en `app/semillas/` para no
  depender de la red durante la presentación.

| Archivo | Qué hace |
|---|---|
| `frontend/public/chat/` | Página del chat (HTML, CSS, JS sin compilación, mapa Leaflet) |
| `api/index.py` | API FastAPI (función Python de Vercel) |
| `web/servicio.py` | Arma cada respuesta: imagen + guion de audio |
| `web/openrouter.py` | Preguntas libres con OpenRouter |

Variables de entorno (en Vercel → Settings → Environment Variables, o en `.env` local; **nunca en el código**):

| Variable | Para qué |
|---|---|
| `OPENROUTER_API_KEY` | Activa las preguntas libres. Sin ella, la maqueta funciona solo con botones |
| `OPENROUTER_MODELS` | Opcional. Modelos de texto separados por coma (los gratuitos cambian seguido) |
| `OPENROUTER_AUDIO_MODELS` | Opcional. Modelos que entienden notas de voz |

En local:

```bash
pip install -r requirements.txt uvicorn
uvicorn api.index:app --port 8765
```

Las fotos de los cultivos están en `app/imagenes/cultivos/` (ver su README). Al cambiar una foto, se ve en la web
después del siguiente despliegue.
