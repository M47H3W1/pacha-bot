# ¿Modelo determinista o probabilístico?

Pregunta: con **NASA como núcleo de datos** y las fuentes de Ecuador como contraste, ¿qué tan viable es un modelo determinista y
uno probabilístico para recomendar cultivos y rotaciones?

**Respuesta corta:** lo viable y recomendable es un **híbrido**: el núcleo físico determinista que ya existe (FAO-56) se corre
sobre un **conjunto de escenarios** (años históricos de NASA × error medido contra el INAMHI), y la recomendación sale como
**probabilidad**. Un modelo totalmente determinista ya existe, pero esconde errores que medimos. Un modelo probabilístico
"puro" (bayesiano jerárquico o machine learning entrenado con rendimientos) **no es viable hoy**, porque no hay datos de
resultado por parcela para entrenarlo ni validarlo.

## 1. Rol de cada fuente de datos

| Rol | Fuente | Uso en el modelo |
|---|---|---|
| **Núcleo (entrada del modelo)** | NASA POWER: lluvia (`PRECTOTCORR` y luego `IMERG_PRECTOT`), temperaturas, humedad, viento y radiación; después `GWETROOT`, `TS_MIN`, MODIS y SRTM | Mueve todo el cálculo: ET0, banco de agua, helada |
| **Contraste y calibración** | INAMHI: lluvia de 85 estaciones de sierra y Tmin 2013 | Mide el error de NASA y define cuánta incertidumbre agregar. Factores locales de corrección |
| **Contraste de resultado** | MAG: riesgos agroclimáticos, ZAE por cultivo; INEC ESPAC | Verifica que lo que dice el modelo coincida con el criterio oficial (por ejemplo, ¿el bot recomienda papa donde el MAG dice "no apto"?) |
| **Contexto no climático** | MAG/SIPA: precios; FAO GAEZ v4 y geopedológico del MAG: suelo | Datos que NASA no da. Entran como parámetros, no como fuente climática |

Así NASA sigue siendo la fuente principal, y Ecuador se usa para medir y acotar su error, no para reemplazarla.

## 2. Qué es hoy el motor de Pacha

`app/engine.py` ya es mitad y mitad:

- **Determinista:** ET0 Penman-Monteith, coeficientes Kc, lluvia útil USDA-SCS y puntaje ponderado (`PESOS`). Con las mismas
  entradas, siempre da la misma salida.
- **Probabilístico empírico:** corre el balance para cada año de 2001 a 2024 y resume con percentiles:
  - `total_falta` es la mediana de los años;
  - `total_falta_seco` es el percentil 80;
  - `prob_helada` es la fracción de años con al menos un día con Tmin ≤ 4 °C en ese mes.
- **Lo que falta:** la decisión final es determinista. `recomendar_para_empezar` ordena cultivos con la **mediana**, y en ningún
  lado entra el **error de los datos NASA** frente a la realidad.

## 3. Las dos fuentes de incertidumbre, medidas

### 3.1 Error de los datos NASA (medido contra el INAMHI)

| Variable | Error crudo | Después de calibrar con INAMHI | Fuente |
|---|---|---|---|
| Lluvia anual, IMERG | Error absoluto mediano 40 %, sesgo +39 % | **15 %**, sesgo +2 %. Intervalo 80 %: ×0,74 a ×1,40 | Validación cruzada dejando una estación fuera (`scripts/loo_calibracion.py`) |
| Lluvia anual, MERRA-2 | 35 %, sesgo +21 % | **16 %**, sesgo −5 %. Intervalo 80 %: ×0,77 a ×1,44 | Igual |
| Estaciones dentro de ±25 % | 34–35 de 85 | **55–57 de 85** | Igual |
| Tmin mínima anual, POWER | Sesgo +0,4 °C, desvío entre estaciones 2,2 °C (p10 −2,0, p90 +3,4) | Sin calibrar todavía | `resultados/validacion_tmin.json` |
| Meses con helada ≤ 0 °C | 0 de 2 detectados | — | Igual |

La calibración: para cada estación se calculó un factor `observado / NASA` con sus 5 vecinas más parecidas (ponderadas por
distancia y diferencia de altura), **sin usar la propia estación**. Así se simula un punto donde el bot no tiene estación.

Conclusión: **contrastar con el INAMHI reduce el error de lluvia a menos de la mitad**, pero queda un ±25–40 % que no se puede
eliminar. Ese resto es la incertidumbre que un modelo honesto debería mostrar.

### 3.2 Variabilidad entre años (clima)

Aunque los datos fueran perfectos, cada año es distinto.

## 4. Experimento: ¿cambia la recomendación?

Se corrió el motor actual en 3 sitios de la sierra centro y 3 meses de siembra (octubre, noviembre y enero). Script:
`scripts/sensibilidad.py`. Resultado: `resultados/sensibilidad_recomendacion.json`.

**A. Con el error de datos medido.** Se usaron 7 escenarios: lluvia −50 %, −33 %, 0 y +25 %; temperatura −1,5 °C y +1 °C; y una
combinación.

| Sitio | Mes | Cultivo #1 base | Mismo #1 en los escenarios |
|---|---|---|---|
| Guamote (3.056 m) | oct | avena | **2 de 7** |
| Guamote | nov | chocho | 7 de 7 |
| Guamote | ene | arveja | 5 de 7 |
| San Juan (3.219 m) | oct | chocho | 6 de 7 |
| San Juan | nov | chocho | 6 de 7 |
| San Juan | ene | avena | 7 de 7 |
| Patate (2.200 m) | oct, nov, ene | fréjol | 7 de 7 en los tres |
| **Total** | | | **54 de 63 (86 %)** |

El grupo de los 3 primeros casi nunca cambia; lo que cambia es el orden. **Cuando dos cultivos están cerca, el error de los datos
decide cuál sale primero.**

**B. Año por año.** Se corrió la recomendación con un solo año a la vez (23 años) y se contó cuántas veces gana cada cultivo.

| Sitio | Mes | Respuesta actual (mediana) | Frecuencia como #1 por año |
|---|---|---|---|
| Guamote | oct | **avena** | chocho 70 %, **avena 22 %**, haba 9 % |
| Guamote | nov | chocho | chocho 52 %, haba 39 %, arveja 9 % |
| Guamote | ene | arveja | arveja 70 %, haba 26 % |
| San Juan | oct | chocho | chocho 83 % |
| San Juan | nov | chocho | chocho 78 % |
| San Juan | ene | avena | avena 52 %, haba 48 % |
| Patate | todos | fréjol | fréjol 100 % |

**Hallazgo clave:** en Guamote, con siembra en octubre, el modelo determinista recomienda **avena**, pero avena gana solo en
**2 de cada 10 años**, y chocho en 7 de 10. La mediana de cada componente no da el cultivo que gana más seguido. Un modelo
probabilístico corrige esto, porque responde "¿qué cultivo gana más años?" y no "¿qué gana en un año promedio que no existe?".

Precaución: con un solo año, la helada queda como 0 o 1, lo que exagera el peso de ese componente. El resultado es indicativo,
no definitivo.

## 5. Viabilidad de cada opción

| Criterio | Determinista (actual) | **Híbrido: física + conjunto de escenarios** | Probabilístico puro (bayesiano o ML) |
|---|---|---|---|
| Datos necesarios | Los que ya hay | Los que ya hay más el error medido contra el INAMHI (ya calculado) | Rendimientos o resultados **por parcela y año**, que no existen abiertos. ESPAC es por provincia |
| Validación posible | Parcial | **Sí**: cobertura de intervalos con estaciones INAMHI de prueba | No hay contra qué validar |
| Esfuerzo | 0 | **2–4 días** sobre `engine.py` | Semanas o meses, más recolección de datos |
| Costo de cómputo | ~0,04 s `recomendar`, ~0,17 s `comparar_rotaciones` | 50 miembros ≈ 2 s en recomendar y ≈ 9 s en rotaciones sin optimizar. Con NumPy vectorizado, menos | Entrenamiento aparte |
| Mensaje al agricultor | "Siembre avena" | "**Chocho rinde mejor en 7 de cada 10 años**; en años secos, cebada" | Igual que el híbrido |
| Riesgo | Da seguridad falsa en casos ajustados | Hay que explicar bien las frecuencias | Sobreajuste con pocos datos |
| **Veredicto** | Viable, pero engañoso en 1 de cada 7 casos | **Viable y recomendado** | **No viable hoy** |

Los tiempos son de una corrida en esta máquina con caché caliente.

## 6. Diseño propuesto del modelo híbrido

1. **Núcleo determinista sin cambios:** `et0_penman_monteith`, `curva_kc`, `lluvia_util_mensual`, `banco_de_agua` y el puntaje.
2. **Conjunto de escenarios (Monte Carlo):** para cada miembro `k` de 1 a 50:
   - lluvia: `p × f_INAMHI × exp(ε)`, con `ε ~ Normal(0; 0,28)`, el desvío logarítmico medido en la validación cruzada;
   - Tmin: `tmin + δ`, con `δ ~ Normal(sesgo_local; 2,0 °C)`, a recalibrar cuando haya más años de Tmin del INAMHI;
   - años: los 23–24 años históricos de NASA, que ya están en `Clima`.

   Total: unos 50 × 23 ≈ 1.150 combinaciones por cultivo. Se pueden vectorizar sobre el eje de años, que ya existe.
3. **Salidas probabilísticas:**
   - `P(cultivo es #1)` y `P(cultivo está en el top 3)`;
   - lluvia útil y riego como rango p20–p80 ("necesitará entre 120 y 210 mm de riego");
   - `P(helada en el ciclo)` con intervalo;
   - regla de decisión: recomendar el cultivo con mayor `P(top 3)` y, si el #1 tiene menos de 50 %, decir "depende del año"
     y nombrar la alternativa segura.
4. **Contraste con Ecuador en cada respuesta:**
   - si el MAG marca el cultivo como "no apto" en la ZAE, o el riesgo de helada de la parroquia es "alto" y el modelo dice "bajo",
     mostrar la discrepancia;
   - indicar el método: "lluvia NASA IMERG calibrada con 5 estaciones INAMHI cercanas".

## 7. Cómo validar que el modelo probabilístico es bueno

- **Lluvia:** separar las 85 estaciones INAMHI en 70 % de calibración y 30 % de prueba. El intervalo 80 % debe contener lo
  observado en alrededor del 80 % de las estaciones de prueba. Si es mucho menos, el modelo está sobreconfiado.
- **Helada:** puntaje de Brier de `P(helada en el mes)` frente a los meses observados ≤ 0 °C. Limitación: los datos abiertos de
  Tmin del INAMHI solo tienen 2013 completo, así que hace falta pedir más series al INAMHI.
- **Resultado agronómico:** comparar las recomendaciones con la ZAE del MAG y con la superficie sembrada por cantón (ESPAC). No
  valida el rendimiento, pero detecta recomendaciones absurdas.

## 8. Limitaciones

- El error modelado solo cubre los datos de clima. Falta la incertidumbre de los parámetros de cultivo (Kc, duración del ciclo
  en `crops.csv`) y de suelo.
- El error de lluvia se calibró con totales anuales. El error mensual es mayor (MAE de 46 mm) y no es uniforme en el año.
- Solo hay una estación INAMHI cerca de una parte de la sierra. Lejos de las 85 estaciones, el intervalo debe ser más ancho.
- El experimento de sensibilidad usa el motor actual, que todavía lee `PRECTOTCORR` y corrige con IFS.

## Archivos
- Scripts: [../03-Verificacion-Endpoints/scripts/loo_calibracion.py](../03-Verificacion-Endpoints/scripts/loo_calibracion.py),
  [../03-Verificacion-Endpoints/scripts/sensibilidad.py](../03-Verificacion-Endpoints/scripts/sensibilidad.py)
- Resultados: [../03-Verificacion-Endpoints/resultados/calibracion_loo_lluvia.json](../03-Verificacion-Endpoints/resultados/calibracion_loo_lluvia.json),
  [../03-Verificacion-Endpoints/resultados/sensibilidad_recomendacion.json](../03-Verificacion-Endpoints/resultados/sensibilidad_recomendacion.json)
