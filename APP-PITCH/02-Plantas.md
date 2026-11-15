# 2 · Las plantas del juego

El juego trae **13 cultivos sembrables** (todos de la sierra ecuatoriana) y **4 fichas de solo información**. Los datos viven en `app/crops.csv` y `app/calendario.csv`; el juego no tiene números propios.

## 2.1 Los 13 cultivos sembrables

| Cultivo | Familia | Fija N | Altura (m) | Ciclo (días) | Kc ini / medio / final | Raíz (m) | Helada | Ingreso | Lluvia ref. ciclo (mm) | Siembra (zona) | Para qué |
|---|---|:-:|---|:-:|---|:-:|---|---|---|---|---|
| **Papa** | Solanáceas | no | 2.800–3.500 | 196 | 0.50 / 1.15 / 0.75 | 0.50 | alta | alto | 700–1200 | ene, may y de jul a dic | alimento y venta |
| **Haba** | Leguminosas | sí | 2.600–3.400 | 220 | 0.50 / 1.15 / 0.30 | 0.60 | media | medio | 700+ | may y de sep a ene | grano y verde |
| **Cebada** | Gramíneas | no | 2.400–3.200 | 175 | 0.30 / 1.15 / 0.25 | 1.25 | baja | bajo | 500–1000 | de nov a ene | grano y máchica |
| **Avena con vicia** | Gramíneas | sí | 2.500–3.300 | 90 | 0.30 / 1.15 / 1.15 | 0.8 | baja | bajo | 600–1000 | después de la cosecha, con humedad | forraje para animales |
| **Quinua** | Amarantáceas | no | 2.400–3.400 | 180 | 0.52 / 1.00 / 0.70 | 0.53 | media | alto | 500–800 | de oct a feb | grano andino |
| **Chocho** | Leguminosas | sí | 2.800–3.400 | 210 | 0.51 / 1.05 / 0.88 | 0.50 | media | medio | 300–600 | de oct a mar | grano andino |
| **Maíz suave** | Gramíneas | no | 2.200–3.000 | 242 | 0.30 / 1.20 / 0.35 | 1.35 | alta | medio | 600+ | de sep a ene | choclo y grano |
| **Fréjol** | Leguminosas | sí | 1.500–2.400 | 120 | 0.40 / 1.15 / 0.35 | 0.75 | alta | medio | 300–700 | de feb a may y de jul a sep | grano |
| **Arveja** | Leguminosas | sí | 1.600–3.100 | 125 | 0.50 / 1.15 / 0.30 | 0.80 | media | medio | 300–400 | de feb a ago | verde y grano |
| **Trigo** | Gramíneas | no | 2.800–3.200 | 180 | 0.30 / 1.15 / 0.25 | 1.25 | baja | bajo | 750–900 | de nov a ene | grano y harina |
| **Melloco** | Tubérculos andinos | no | 3.000–3.600 | 210 | 0.51 / 1.05 / 0.92 | 0.25 | media | medio | 600–1000 | de ago a dic | tubérculo andino |
| **Oca** | Tubérculos andinos | no | 3.000–3.800 | 210 | 0.50 / 1.00 / 0.70 | 0.60 | media | bajo | 800–1300 | de sep a nov | tubérculo andino |
| **Pastura mixta** | Pastos y cobertura | sí | 2.400–3.800 | 365 | 0.40 / 0.95 / 0.85 | 1.00 | baja | medio | — | al inicio de las lluvias | pastoreo y leche |

**Cómo leer las columnas**
- **Altura:** rango donde el cultivo se da bien. Fuera de él, la semilla aparece con candado y Pachita dice por qué (por ejemplo "quiere más altura, desde 2.800 m").
- **Kc (coeficiente de cultivo, FAO-56):** cuánta agua pide la planta respecto a la evaporación del día. Sube del Kc inicial al medio y baja al final.
- **Raíz:** profundidad de suelo que alcanza; con la textura da la reserva de agua del suelo (ver el [banco de agua](04-Banco-de-Agua-y-Rotacion.md)).
- **Helada:** sensibilidad al frío (el juego solo muestra el efecto como ¡Achachay!).
- **Ingreso:** referencia relativa para puntuar rotaciones; es por validar con técnicos.
- **Siembra:** meses de siembra de la zona centro (INIAP y estudios del equipo, `app/calendario.csv`). Si el jugador siembra fuera de época, Pachita avisa.

## 2.2 Familias botánicas (para rotar)

| Familia | Cultivos | Qué le hace al suelo |
|---|---|---|
| **Leguminosas** | haba, arveja, chocho, fréjol (y avena con vicia) | Fijan nitrógeno con bacterias en sus raíces: abonan el suelo gratis |
| **Solanáceas** | papa | Cultivo comercial que más agota el suelo; repetirla multiplica plagas (lancha, gusano blanco) |
| **Gramíneas** | cebada, avena, trigo, maíz | Raíz fibrosa que protege y deja rastrojo |
| **Amarantáceas** | quinua | Grano andino que diversifica la familia |
| **Tubérculos andinos** | melloco, oca | Diversifican y aprovechan alturas mayores |
| **Pastos y cobertura** | pastura mixta | Cubre el suelo, evita la erosión, da forraje y leche |

## 2.3 Las cuatro fichas de solo información

Vicia, trébol, alfalfa y biomasa tienen su semilla y su ícono, pero **no se siembran solas** en la parcela del juego: son cobertura, abono verde o parte de mezclas (la avena se siembra *con vicia*; la pastura mixta lleva trébol). Cuando el jugador las toca, Pachita explica por qué y a qué familia ayudan. Así el juego enseña que no toda planta es "una cosecha".

## 2.4 Datos curiosos para el pitch
- **Quinua**: de 2.400 a 3.400 m, ciclo de 180 días, ingreso alto y helada media. Variedad de referencia: Tunkahuan.
- **Papa** (variedad Superchola): ingreso alto y mucho riesgo: helada alta, y necesita agua en floración y tuberización.
- **Arveja** y **chocho**: las leguminosas que menos lluvia piden por ciclo (300–400 y 300–600 mm); la arveja crece en el rango de altura más amplio (1.600–3.100 m).
- **Melloco** y **oca**: Kc estimados (son los menos estudiados); se declaran como límite en la presentación.
- **Maíz suave**: el de mayor Kc medio (1,20) y de menor altura (2.200–3.000 m).

## 2.5 Íconos
Los 18 íconos 3D (13 cultivos + vicia, trébol, alfalfa, biomasa, fijadores) están en `frontend/public/img/cultivos3d/`. Fueron generados con IA a partir de la lámina del equipo y llevan la marca "IA".
