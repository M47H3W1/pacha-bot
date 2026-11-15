# Validación de la temperatura mínima frente al INAMHI (heladas)

**Pregunta:** ¿qué tan bien estiman NASA POWER y ERA5 las noches más frías del mes en la sierra? ¿Ayuda la corrección por
altura de 6,5 °C/km que el bot usa como respaldo?

## Método
- **Observado:** temperatura mínima absoluta de cada mes en 2013, del CSV del INAMHI. Es el único año abierto.
- **Estaciones:** 24 a 2.000 m o más con al menos 8 meses válidos.
- **Modelos:** el mínimo diario del mes en:
  - POWER `T2M_MIN` sin corregir;
  - POWER corregido por altura: `T + (altura de la celda − altura de la estación) × 0,0065`, igual que `engine.py` cuando falla IFS;
  - ERA5 (Open-Meteo), que ya viene ajustado a la altura del punto.
- **Sesgo** = modelo − observado, en °C, promediado sobre los meses. Un valor positivo significa que el modelo es más cálido y **subestima las heladas**.
- Script: [scripts/tmin.py](scripts/tmin.py). Resultados: [resultados/validacion_tmin.json](resultados/validacion_tmin.json).

## Resultados

| Fuente | Sesgo mediano | Meses con mínima ≤ 0 °C detectados |
|---|---|---|
| Observado (INAMHI) | — | **2** (Olmedo-Pichincha, 3.120 m) |
| POWER sin corregir | **+0,15 °C** | 0 |
| POWER + corrección de 6,5 °C/km | +1,45 °C | 0 |
| ERA5 | +2,75 °C | 0 |

Casos destacados:

| Estación | Altura de la estación | Altura de la celda POWER | Sesgo POWER | Sesgo POWER corregido | Sesgo ERA5 |
|---|---|---|---|---|---|
| Patate (valle) | 2.220 | 3.003 | +0,5 | **+5,6** | +5,0 |
| Otavalo | 2.550 | 3.141 | −0,4 | +3,5 | +4,7 |
| Chunchi | 2.177 | 2.844 | −0,8 | +3,5 | +3,6 |
| Izobamba (ladera alta) | 3.058 | 2.501 | +5,0 | +1,4 | +2,8 |
| Olmedo (helada real de −0,5 °C) | 3.120 | 3.141 | +2,1 | +2,3 | +2,9 |

## Interpretación
1. **En los valles, la corrección por altura empeora la mínima.** Las estaciones de valle están por debajo de la celda, así que la
   fórmula las calienta. Pero de noche el aire frío baja y se estanca en el fondo del valle (inversión térmica). El gradiente
   nocturno real es mucho menor que 6,5 °C/km, y a veces es invertido.
2. **Ningún modelo detectó los dos meses de helada observados.** Esto respalda la decisión del bot de usar un umbral de 4 °C en el
   aire, no de 0 °C. Pero el margen de error es de ±2–5 °C según el sitio.
3. Una mejor señal de helada es la **temperatura de superficie nocturna**:
   - MODIS `LST_Night_1km`, a 1 km, que ve la inversión;
   - POWER `TS_MIN`;
   - el punto de rocío `T2MDEW`, porque las noches secas y despejadas son las de helada radiativa.

   Ver [../04-Recomendaciones/01-top5-parametros.md](../04-Recomendaciones/01-top5-parametros.md).

## Limitaciones
- Solo hay un año (2013) y 24 estaciones, con mínimas absolutas mensuales y no diarias. Es una señal, no una calibración.
- No se pudo validar ECMWF IFS para Tmin porque el archivo de IFS en Open-Meteo empieza en 2017.
