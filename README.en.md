# Pacha 🌱 · NASA data for highland farmland

[Español](README.md) · **English**

NASA Space Apps Challenge 2026 · Sangolquí local event (ESPE) · Challenge **"Field Shift: Adapting Farms with NASA Data"**

| | |
|---|---|
| **Live game** | https://pacha-chat.vercel.app (Astro Granja, no account needed, built for phones) |
| **Telegram bot** | [@Pacha_EC_Bot](https://t.me/Pacha_EC_Bot) |
| **License** | [MIT](LICENSE) |
| **Core data** | [NASA POWER](https://power.larc.nasa.gov/) (AG community, daily, 2001–2024) |

## The problem
In the Ecuadorian Andes, above 2,500 m, most smallholder families farm without engineered irrigation and decide
what and when to plant by habit. Rainfall changes from year to year, and repeating potato drains the soil and
multiplies pests. Satellite data exist, but they come as tables, technical units and English; the people who need
them most (older farmers, people with low literacy or Kichwa speakers) cannot use them.

## The solution
**Astro Granja**, a casual farming game for browsers and phones (Astro + three.js, installable), where **Pachita**
teaches how to plant, water and rotate crops on a real highland plot with NASA data. The website is only the game; the
story and screens are in [Astro Granja game](#astro-granja-game-kids-aged-8-to-12). The game is in Spanish.

The **Telegram bot** ([@Pacha_EC_Bot](https://t.me/Pacha_EC_Bot)) uses the same engine for farming families: the
farmer sends **a point and a circle** with the size of their land and Pacha answers with drawings, short messages and audio:

1. **📋 See my land**: elevation, slope, soil, temperature, rainfall in a normal and a dry year, evaporation,
   **month-by-month soil moisture** and how much rainfall changed over the last decade.
2. **🌱 What to plant**: crops suited to the elevation that are in planting season for the zone, with a water
   verdict (✅ rain is enough · ⚠️ water sometimes · ❌ needs irrigation) and harvest month.
3. **🔁 What to plant next**: rotations that break pest cycles and feed the soil (legumes), plus
   **📚 field-proven rotations** in Ecuador (Sicalpa, Illangama, Paute River, Santa Catalina, Tumbaco).
4. **💧 How much to water**: which days this week to irrigate and how much water, counted in **buckets, tanks or
   water trucks** for the real area of the land.

## NASA data and how they are used
| Variable | Product | Use |
|---|---|---|
| Max and min temperature at 2 m (`T2M_MAX`, `T2M_MIN`) | [NASA POWER Daily API](https://power.larc.nasa.gov/docs/services/api/temporal/daily/) (MERRA-2) | Temperature range, hot days, evaporation |
| Corrected precipitation (`PRECTOTCORR`) | NASA POWER (MERRA-2 / GPM IMERG) | Monthly rain, dry year, heavy-rain days, water balance |
| Relative humidity (`RH2M`) and wind at 2 m (`WS2M`) | NASA POWER (MERRA-2) | FAO-56 Penman-Monteith evaporation |
| Solar radiation (`ALLSKY_SFC_SW_DWN`) | NASA POWER (CERES) | FAO-56 Penman-Monteith evaporation |

Request used: `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M_MAX,T2M_MIN,PRECTOTCORR,RH2M,WS2M,ALLSKY_SFC_SW_DWN&community=AG&start=20010101&end=20241231&latitude=…&longitude=…&format=JSON`
(see [`app/clients.py`](app/clients.py)).

**Complementary (non-NASA) sources:** ECMWF IFS 9 km via Open-Meteo (elevation correction of rain and temperature),
ISRIC [SoilGrids](https://soilgrids.org/) (soil texture and organic matter), Open-Meteo elevation model (elevation and
slope of the circle). Planting calendar, varieties and rotation cases: INIAP and field studies compiled by the team
([Documentacion-Investigacion/](Documentacion-Investigacion/), in Spanish).

## Processing (from raw data to answer)
1. **Download**: 2001–2024 daily NASA POWER series for the point (about 8,700 days), in parallel with soil and elevation. Cached.
2. **Cleaning**: missing values (`-999`) are filled with the mean of the same month.
3. **Elevation correction**: the POWER cell (0.5° × 0.625°, about 55 × 70 km) averages valleys and páramo and can double
   Andean rainfall. It is corrected month by month with ECMWF IFS 9 km (ratio for rain, difference for temperature);
   without it, temperature is adjusted by 6.5 °C per km of elevation difference.
4. **Evaporation (ET0)**: daily FAO-56 Penman-Monteith from temperature, humidity, wind and radiation.
5. **Soil water balance**: daily bucket with the soil reserve (root depth × available water by texture), 85 % effective
   rain and FAO-56 crop coefficients by stage. **Each of the ~23 years** is simulated to give the probability of success
   and monthly irrigation; the dry year uses 20 % less rain.
6. **Land traits**: days above 25 °C, days above 10 mm, monthly soil moisture and the 2013–2024 vs 2001–2012 comparison.
7. **Agronomic rules**: suitable elevation per crop, planting windows per zone (INIAP), botanical families for rotation
   and nitrogen-fixing legumes.
8. **Answer**: in the game, JSON that the browser draws in 3D; in the bot, a matplotlib image, short text and audio
   (Ecuadorian Spanish neural voice).

## Architecture
```
Astro Granja game (frontend/, Astro + three.js + Leaflet, static PWA)
   │  POST /api/app/{parcela|terreno|semillas|cultivo|ciclo} · POST /api/voz
   ▼
FastAPI on Vercel (Python 3.12)
   ├─ web/app_api.py    JSON answers for the game (relief, land sheet, seeds, daily cycle, rotations)
   ├─ web/servicio.py   cached site and climate, areas and water wording
   ├─ app/engine.py     site, corrected climate, FAO-56, soil balance, rotations
   ├─ app/clients.py    NASA POWER, ECMWF IFS, SoilGrids, elevation (cached)
   └─ app/voz.py        text to speech (edge-tts, gTTS fallback)
```
The server stores no player data: the browser sends the location on every call. The Telegram bot
([`app/bot.py`](app/bot.py)) uses the same engine and draws with `app/charts.py`.

## Run and reproduce
```bash
pip install -r requirements.txt uvicorn
cd frontend && npm install && npm run build && cd ..   # builds the game into frontend/dist
uvicorn api.index:app --port 8765        # open http://localhost:8765 (game)
python -m pytest -q tests                # engine and API tests
```
To edit the game with live reload: `cd frontend && npm run dev` (http://localhost:4321, uses the API on 8765).
Vercel builds `frontend/` as set in `vercel.json` and serves the Python API at `/api`.
Demo sites ship with stored data in `app/semillas/` so the game does not depend on the network.
The Telegram bot needs `TELEGRAM_BOT_TOKEN` in `.env` (never in code; see [`.env.example`](.env.example) and
`docker compose up -d --build`).

## Known limitations
- The NASA POWER cell is coarse; the ECMWF correction reduces the error but does not replace a weather station.
  Validation against INAMHI stations is in [Documentacion-Investigacion/03-Verificacion-Endpoints](Documentacion-Investigacion/03-Verificacion-Endpoints/).
- Soil moisture is a water-balance model, not a satellite measurement (SMAP cannot resolve small plots).
- Crop coefficients for lupin (chocho), melloco and oca are estimates. The bot's Kichwa words still need validation by native speakers.
- Frost is not shown in the web demo by design choice.

## Impact and next steps
- **Users:** smallholder families in the Ecuadorian highlands (Chimborazo, Cotopaxi, Tungurahua, Pichincha, Imbabura,
  Carchi, Bolívar, Cañar, Azuay, Loja). Works on basic phones with mobile data and answers in audio.
- **Next:** move from the mock-up to WhatsApp Business with extension officers from the Ministry of Agriculture (MAG) or
  irrigation boards, pilot with 2–3 communities, add spoken Kichwa, and replace non-NASA sources with SMAP/NASADEM where
  resolution allows.
- **Running cost:** free serverless function, free NASA POWER access and open language models.

## Astro Granja game (kids aged 8 to 12)

**Play:** https://pacha-chat.vercel.app (on a phone; `?sin3d=1` forces the non-3D mode). **Spanish and English:** the ES/EN button is in the menu, on the map and in the top bar; Pachita's voice changes with the language.

An original casual farming app to learn how to plant and care for highland soil with real data, in Spanish. It is guided
by **Pachita**, a farmer from the Andes (felt hat, poncho and anaco skirt), with short speech bubbles and voice. The story:

1. **Farm name:** from her rocket, Pachita asks for the name of your farm.
2. **Arrival:** the rocket comes down with fire and sound, lands on the field and Pachita welcomes you. Then she asks you
   to pick your plot on a satellite map that **opens at your location** (no example sites): a circle whose size goes from
   0.1 to 10 hectares with the slider, and you can type a larger one (up to 100 ha).
3. **This is your land:** the plot appears in 3D with its real relief (`/api/app/terreno`) and a technical sheet with the
   NASA data only: normal and dry-year rain, evaporation, temperature and hot days, sun (CERES), air humidity and
   wind, **monthly root-zone soil moisture** (GWETROOT) and last-decade change (`/api/app/parcela`), plus the **slope of
   the land** with the plot's profile (Copernicus DEM relief from Open-Meteo, which is not NASA data and is labeled as such).
   Pachita explains it in simple sentences.
4. **Seeds by botanical family:** the 13 crops as animated icons grouped into legumes, nightshades, grasses, amaranths,
   Andean tubers and pasture/cover, with why each family matters for rotation. Each seed opens a card with its cycle, the
   altitude where it grows, what it is used for and its planting months. Crops unsuitable for the altitude are locked with
   the reason (`/api/app/semillas`); vetch, clover, alfalfa and biomass are "information only": Pachita explains why they
   can't be planted on their own.
5. **Calendar:** 12-month wheel with the crop's planting window for the zone (INIAP); Pachita warns when out of season.
6. **Planting:** tap the plots (or "Plant all"). When the four are filled, **time runs by itself**.
7. **How much water?:** litres the crop drinks over its cycle (per square metre and for the whole plot), what rain
   provides and what must be irrigated in a normal and a dry year, with the monthly traffic light (`/api/app/ciclo`).
8. **Growing:** time advances with the real weather of one NASA POWER year. A **timeline** shows the crop's stages and
   the days left until harvest. Drought and heat stress (Arrarray!), and heavy rain (Achachay!); watering uses liters from
   the tank and the server recomputes the cycle.
9. **Harvest:** "Harvest all" with an animated hoe; a single card per seed (average of its plots), with the score computed
   on the server from the water deficit and the season.
10. **Rotate:** Pachita explains why rotation prevents soil degradation and recommends **3 rotations** computed for the
    plot (`/api/app/cultivo`). **The app follows the chosen rotation step by step** (for example pea → potato → mixed
    pasture) and always shows it in the top bar, until it is complete.
11. **Cosmic Farmer certificate:** full screen (landscape on desktop, portrait on phones), with the farm name, harvests,
    score, chosen rotation and medals; downloadable as an image. No purchases or ads.

The 18 3D crop icons (`frontend/public/img/cultivos3d/`) were cut from the team's sheet with `scripts/recortar_cultivos.py`; interface icons are custom SVGs (`frontend/src/juego/ui.ts`), no emojis. The 3D sky moves from day to night, the map shows town and road names, and the play button finishes the longest crop in 10 seconds.

| File | Purpose |
|---|---|
| `frontend/src/pages/index.astro` | Game page (site home) |
| `frontend/src/juego/` | Controller, 3D and 2D worlds, map, Pachita, sounds (Web Audio), ES/EN language and state |
| `web/app_api.py` | `parcela`, `terreno`, `semillas`, `cultivo` and `ciclo` (every number comes from here) |
| `tests/test_juego.py` | Offline tests for `/api/app/terreno` |

## AI use statement
- **Development:** code, documentation and analysis were assisted by **Claude Code (Anthropic)**. The team defined the
  problem, scientific method, crops, calendar and field cases, and reviewed every change through Pull Requests.
- **Inside the game:** no language models; every number comes from the engine. Pachita's voice is generated with
  edge-tts / gTTS (in English, the child-like voice `en-US-AnaNeural`); the rocket sounds are synthesized in the browser. The Telegram bot uses Gemini (Google AI Studio) to explain results and answer free questions.
- **Images:** the bot's drawings are generated by code from the data; its crop photos come from Wikimedia Commons with
  author and license in [`app/imagenes/cultivos/README.md`](app/imagenes/cultivos/README.md). In the Astro Granja
  game, Pachita's illustrations (three poses) and the 18 3D crop icons, provided by the team and AI-generated, carry an "IA" mark; the 3D models were
  coded with AI assistance. Pachita's voice is edge-tts with a child-like pitch.
- No NASA logos are used.

## Credits and license
- Code under the [MIT license](LICENSE). Photos keep their own licenses (CC BY-SA / CC0).
- *These data were obtained from the NASA Langley Research Center (LaRC) POWER Project funded through the NASA Earth
  Science/Applied Science Program.*
- FAO-56 (Allen et al., 1998) for evaporation and crop coefficients; INIAP for varieties and planting windows.
- Read [CONTRIBUTING.md](CONTRIBUTING.md) before your first commit.
