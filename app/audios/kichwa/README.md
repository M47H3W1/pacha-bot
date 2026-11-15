# Audios en kichwa grabados por hablantes

No existe una voz sintética confiable en kichwa. Por eso las pantallas fijas del bot pueden usar grabaciones
hechas por una persona que hable kichwa de la sierra. Cuando el agricultor elige "Kichwa · Español" y toca
🔊 Escuchar, el bot busca aquí la grabación de esa pantalla. Si no existe, usa la voz en español.

## Cómo grabar
- Graba una nota de voz en WhatsApp o Telegram y guárdala, o usa la grabadora del celular.
- Formato `.ogg`, `.mp3` o `.m4a`. Que dure menos de 20 segundos, sin ruido de fondo.
- Nombra el archivo con la clave exacta de la tabla, por ejemplo `menu.ogg`.

## Pantallas y lo que debe decir cada audio
| Archivo | Qué dice en español (tradúcelo con sus propias palabras) |
|---|---|
| `menu` | Hola. ¿Qué necesita hoy? Mi chakra, qué sembrar, cuánto regar, si viene helada o preguntar. |
| `chakra_pedir` | ¿Dónde está su chakra? Párese en su terreno y toque «Enviar ubicación», o elija su provincia. |
| `sembrar_pregunta` | ¿Ya tiene algo sembrado? |
| `regar_pregunta` | ¿Cómo riega su chakra? Con balde, por surcos, con aspersor, con goteo o solo con lluvia. |
| `helada_no` | Esta semana no viene helada. |
| `rotacion_ok` | Listo, lo guardé. Ahora veamos cuánta agua necesita su cultivo. |

Las pantallas que cambian según el clima, como los días de riego, siguen en español por ahora.

## Cómo subirlos
Igual que las fotos: rama nueva, archivos en esta carpeta, PR a `develop`. Reinicia el bot después.
