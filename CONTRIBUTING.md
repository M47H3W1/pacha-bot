# Cómo trabajar en Pacha

## Primera vez
```bash
git clone https://github.com/M47H3W1/pacha-bot.git
cd pacha-bot
git config core.hooksPath .githooks   # activa el bloqueo de secretos antes de cada commit
cp .env.example .env                  # pide los valores al equipo por un canal seguro
python -m venv .venv
.venv/Scripts/activate                # en Linux o Mac: source .venv/bin/activate
pip install -r requirements.txt pytest
```

## Ramas
| Rama | Para qué | Cómo entra el código |
|---|---|---|
| `develop` | Integración diaria (rama por defecto) | PR desde `feat/…`, `fix/…`, `docs/…`. Se fusiona solo cuando CI pasa |
| `main` | Solo versiones estables | PR de `develop` a `main` con una aprobación del equipo, y luego etiqueta `vX.Y.Z` |

## Flujo de trabajo
1. Actualiza `develop`: `git checkout develop && git pull`.
2. Crea una rama por tarea: `git checkout -b feat/nombre-corto` (o `fix/…`, `docs/…`).
3. Haz commits pequeños con mensajes claros en español.
4. Corre las pruebas: `python -m pytest -q` y `python scripts/dry_run.py`.
5. Sube la rama y abre un PR hacia `develop`. Si quieres revisión antes del merge, ábrelo como borrador.
6. Nadie hace push directo a `develop` ni a `main`.

## Publicar una versión estable
1. Abre un PR de `develop` a `main` titulado `Versión X.Y.Z` con la lista de cambios.
2. Otra persona del equipo lo aprueba y se fusiona con merge commit.
3. Etiqueta: `git checkout main && git pull && git tag vX.Y.Z && git push origin vX.Y.Z`.

## Reglas de credenciales
- Los secretos viven **solo** en `.env`, que está en `.gitignore`. Nunca en el código, el README, los issues ni el chat.
- Comparte valores de `.env` por un gestor de contraseñas o un mensaje temporal, nunca en el repositorio.
- El hook `.githooks/pre-commit` y la tarea `gitleaks` de CI bloquean tokens de Telegram, Google, Supabase y GitHub.
- Para Supabase usa la clave `service_role` solo en el bot. Nunca la pongas en una app web o móvil.
- Si un secreto se filtra: revócalo de inmediato (BotFather `/revoke`, panel de Supabase, Google AI Studio),
  genera uno nuevo y avisa al equipo. Borrarlo del historial no basta.

## Un solo bot corriendo
Telegram permite una sola conexión por token. Si alguien corre el bot en su máquina, el contenedor de otra
persona dará error 409. Para desarrollar en paralelo, cada uno crea su propio bot de prueba con BotFather
y usa su token en su `.env`.
