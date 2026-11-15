# APP-PITCH · Astro Granja

**NASA Space Apps Challenge 2026 · Sede Sangolquí (ESPE) · Reto "Field Shift: Adapting Farms with NASA Data"**
Juego en vivo: https://pacha-chat.vercel.app · Código: este repositorio (MIT)

> **En una frase:** un juego de granja donde niñas y niños de 8 a 12 años siembran, riegan y rotan cultivos en **su propia parcela real** de la sierra ecuatoriana, y el clima que viven en el juego es el **clima real de la NASA** de ese punto.

| # | Documento | Qué responde |
|---|---|---|
| 1 | [01-Arquitectura.md](01-Arquitectura.md) | Backend, frontend, extracción de datos, limpieza, stack y cómo los datos llegan al juego (con diagramas) |
| 2 | [02-Plantas.md](02-Plantas.md) | Los 13 cultivos (+ 4 de información): altura, ciclo, Kc, raíz, familia, helada, época |
| 3 | [03-Idea-y-Mensaje.md](03-Idea-y-Mensaje.md) | La idea, el problema, qué se quiere demostrar y por qué un juego |
| 4 | [04-Banco-de-Agua-y-Rotacion.md](04-Banco-de-Agua-y-Rotacion.md) | Cómo funciona el banco de agua y cómo puntúa y sigue la rotación |
| 5 | [05-Evidencia-y-Demo.md](05-Evidencia-y-Demo.md) | Guion de demo de 3 minutos, cifras reales, pruebas, capturas, límites honestos y preguntas probables |
| 6 | [06-Investigacion.md](06-Investigacion.md) | Toda la investigación NASA + Ecuador: validación con 85 estaciones INAMHI, suelo GAEZ vs MAG, 15 parámetros, modelado, rúbrica; qué ya está en el juego y qué es hoja de ruta |
| 7 | [07-Funcionalidades-y-Proceso.md](07-Funcionalidades-y-Proceso.md) | Recorrido completo del juego, Pachita, funciones, bot de Telegram, línea de tiempo, calidad, entregables y equipo |

## Las cifras para recordar
- **24 años** de clima diario de NASA POWER (2001–2024), ≈ 8.700 días por parcela.
- **6 variables NASA** por día: temperatura máx./mín., lluvia, humedad relativa, viento y radiación solar; más humedad del suelo en raíces (GWETROOT).
- **~23 años simulados** por cultivo para decir "en cuántos años la lluvia alcanza".
- **13 cultivos** sembrables, 4 de solo información y 6 familias botánicas.
- **85 estaciones del INAMHI**, **24 de 24 endpoints** verificados y **2.340 puntos** de suelo (GAEZ vs MAG) respaldan las decisiones de datos.
- **0 modelos de lenguaje dentro del juego**: todo número sale del motor agro-físico (FAO-56), reproducible y con 20 pruebas automáticas.

## Imágenes listas para usar
Capturas reales (ES/EN) en [`../docs/entregables/capturas/`](../docs/entregables/capturas/) y presentaciones en [`../docs/entregables/`](../docs/entregables/).
