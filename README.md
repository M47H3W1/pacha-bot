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
