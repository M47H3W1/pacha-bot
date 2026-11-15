# Cómo trabajar en Astro Granja

## Primera vez
```bash
git clone https://github.com/M47H3W1/pacha-bot.git
cd pacha-bot
git config core.hooksPath .githooks   # activa el bloqueo de secretos antes de cada commit
python -m venv .venv
.venv/Scripts/activate                # en Linux o Mac: source .venv/bin/activate
pip install -r requirements.txt pytest uvicorn
cd frontend && npm install && npm run build && cd ..   # compila el juego en frontend/dist
uvicorn api.index:app --port 8765                      # juego + API en http://localhost:8765
```
El juego no necesita claves ni archivo `.env`: usa NASA POWER, Open-Meteo y SoilGrids, que son abiertos.
Para editar con recarga: `cd frontend && npm run dev` (http://localhost:4321, usa la API del 8765).

## Ramas
| Rama | Para qué | Cómo entra el código |
|---|---|---|
| `develop` | Integración diaria (rama por defecto); cada fusión se publica en https://pacha-chat.vercel.app | PR desde `feat/…`, `fix/…`, `docs/…`. Se fusiona solo cuando CI pasa |
| `main` | Solo versiones estables | PR de `develop` a `main` con una aprobación del equipo, y luego etiqueta `vX.Y.Z` |

## Flujo de trabajo
1. Actualiza `develop`: `git checkout develop && git pull`.
2. Crea una rama por tarea: `git checkout -b feat/nombre-corto` (o `fix/…`, `docs/…`).
3. Haz commits pequeños con mensajes claros en español.
4. Corre las pruebas: `python -m pytest -q` y, si tocaste el juego, `cd frontend && npm run build`.
   Prueba el recorrido completo en el navegador, en celular y en escritorio, en español y en inglés (`?sin3d=1` para el modo 2D).
5. Sube la rama y abre un PR hacia `develop`. Si quieres revisión antes del merge, ábrelo como borrador.
6. Nadie hace push directo a `develop` ni a `main`.

## Reglas del juego (para no romper nada)
- **Todo número sale del servidor** (`web/app_api.py` y `app/engine.py`). El navegador solo dibuja; no inventes cifras en `frontend/`.
- **Todo texto va en español e inglés**: usa `t("español", "english")` y, para nombres de cultivos y meses, `frontend/src/juego/textos.ts`.
- **Lo que no es de la NASA se rotula como tal** (relieve, suelo, ECMWF).
- Sin modelos de lenguaje dentro del juego, sin compras ni anuncios.
- Las ilustraciones de Pachita y los íconos 3D generados con IA llevan la marca "IA".

## Publicar una versión estable
1. Abre un PR de `develop` a `main` titulado `Versión X.Y.Z` con la lista de cambios.
2. Otra persona del equipo lo aprueba y se fusiona con merge commit.
3. Etiqueta: `git checkout main && git pull && git tag vX.Y.Z && git push origin vX.Y.Z`.

## Reglas de credenciales
- Los secretos viven **solo** en variables de entorno o gestores de contraseñas, nunca en el código, el README, los issues ni el chat.
- El hook `.githooks/pre-commit` y la tarea `gitleaks` de CI bloquean tokens y claves filtradas.
- Si un secreto se filtra: revócalo de inmediato, genera uno nuevo y avisa al equipo. Borrarlo del historial no basta.
