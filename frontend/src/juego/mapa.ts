// Mapa para elegir la chacra: pin fijo al centro y un círculo con el tamaño de la tierra.
// El mapa se abre en la ubicación del jugador. El tamaño va de 0,1 a 10 hectáreas en el deslizador y se puede escribir uno mayor.
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { locale, t } from "./i18n";
import { ic } from "./ui";

export interface Lugar { lat: number; lon: number; radio: number; nombre: string }

export const RADIO_DEMO = 80;                 // radio de partida (unas 2 hectáreas)
const HA = 10000;                              // m² en una hectárea
export const AREA_MIN = 1000;                  // 0,1 ha
export const AREA_DESLIZADOR = 10 * HA;        // el deslizador llega a 10 ha
export const AREA_MAX = 100 * HA;              // se puede escribir hasta 100 ha
const CANCHA = 7140;                           // una cancha de fútbol (105 × 68 m)
const PASOS = 1000;                            // posiciones del deslizador (escala logarítmica: fino en lo pequeño)
const PRESETS = [0.25, 0.5, 1, 2, 5, 10];      // hectáreas
// Ecuador continental (la API solo responde dentro de este rectángulo)
const ECUADOR = { lat: [-5.1, 1.5], lon: [-81.1, -75.1] };

const radioDe = (area: number) => Math.sqrt(area / Math.PI);
const areaDe = (radio: number) => Math.PI * radio * radio;
const aPosicion = (area: number) => Math.round(PASOS * Math.log(Math.min(Math.max(area, AREA_MIN), AREA_DESLIZADOR) / AREA_MIN) / Math.log(AREA_DESLIZADOR / AREA_MIN));
const deSolicitud = (pos: number) => AREA_MIN * Math.pow(AREA_DESLIZADOR / AREA_MIN, pos / PASOS);
/** Redondea a números fáciles de leer: de a 100 m² en lo pequeño y de a 0,1 ha desde 1 ha. */
const bonito = (a: number) => (a < HA ? Math.round(a / 100) * 100 : Math.round(a / (HA / 10)) * (HA / 10));

export function areaTexto(areaM2: number) {
  const f = (x: number, d: number) => x.toLocaleString(locale(), { minimumFractionDigits: d, maximumFractionDigits: d });
  return areaM2 < HA ? `${f(Math.round(areaM2 / 10) * 10, 0)} m²` : t(`${f(areaM2 / HA, 1)} hectáreas`, `${f(areaM2 / HA, 1)} hectares`);
}

export function crearMapa(cont: HTMLElement, inicial: { lat: number; lon: number; radio: number },
                          alConfirmar: (l: Lugar) => void) {
  cont.innerHTML = `
    <div class="mapa-caja"><div class="mapa-leaflet"></div>
      <div class="mapa-pin" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 2a7 7 0 0 0-7 7c0 5.3 7 13 7 13s7-7.7 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg></div>
      <button type="button" class="mapa-gps" data-gps>${ic("gps", "ic-chip")}<span>${t("Mi ubicación", "My location")}</span></button>
      <p class="mapa-estado" role="status"></p>
    </div>
    <div class="mapa-panel">
      <div class="tam-cabeza">
        <div class="tam-titulos"><b>${t("Tamaño de tu chacra", "Size of your farm")}</b><span class="tam-comparar"></span></div>
        <label class="tam-valor"><input type="text" inputmode="decimal" autocomplete="off" aria-label="${t("Tamaño en hectáreas (puedes escribir más de 10)", "Size in hectares (you can type more than 10)")}"><span>ha</span></label>
      </div>
      <div class="tam-deslizador">
        <button type="button" class="tam-paso" data-menos aria-label="${t("Más pequeña", "Smaller")}">−</button>
        <input type="range" min="0" max="${PASOS}" step="1" aria-label="${t("Tamaño de la chacra", "Farm size")}">
        <button type="button" class="tam-paso" data-mas aria-label="${t("Más grande", "Bigger")}">+</button>
      </div>
      <div class="tam-marcas" aria-hidden="true"><span>${(0.1).toLocaleString(locale())} ha</span><span>1</span><span>10 ha</span></div>
      <div class="tam-chips">${PRESETS.map((h) => `<button type="button" class="chip" data-ha="${h}">${h.toLocaleString(locale())} ha</button>`).join("")}</div>
      <p class="tam-ayuda">${t("El deslizador llega a 10 hectáreas. ¿Tu chacra es más grande? Escribe el tamaño arriba.", "The slider goes up to 10 hectares. Is your farm bigger? Type the size above.")}</p>
      <p class="mapa-aviso" hidden></p>
      <button type="button" class="btn-juego grande" data-confirmar>${ic("check", "ic-btn")}<span>${t("Esta es mi chacra", "This is my farm")}</span></button>
    </div>`;
  const mapa = L.map(cont.querySelector<HTMLElement>(".mapa-leaflet")!, { zoomControl: false, attributionControl: true })
    .setView([inicial.lat, inicial.lon], 16);
  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 19, attribution: t("Imágenes © Esri", "Imagery © Esri"),
  }).addTo(mapa);
  // nombres de ciudades, pueblos, ríos y vías encima de la foto satelital (como en los mapas del celular)
  mapa.createPane("nombres");
  mapa.getPane("nombres")!.style.zIndex = "450";
  mapa.getPane("nombres")!.style.pointerEvents = "none";
  for (const capa of ["Reference/World_Transportation", "Reference/World_Boundaries_and_Places"]) {
    L.tileLayer(`https://server.arcgisonline.com/ArcGIS/rest/services/${capa}/MapServer/tile/{z}/{y}/{x}`, {
      maxZoom: 19, pane: "nombres", attribution: capa.endsWith("Places") ? t("Nombres © Esri", "Names © Esri") : "",
    }).addTo(mapa);
  }
  const rango = cont.querySelector<HTMLInputElement>("input[type=range]")!;
  const campo = cont.querySelector<HTMLInputElement>(".tam-valor input")!;
  const comparar = cont.querySelector<HTMLElement>(".tam-comparar")!;
  const estado = cont.querySelector<HTMLElement>(".mapa-estado")!;
  const aviso = cont.querySelector<HTMLElement>(".mapa-aviso")!;
  let area = Math.min(Math.max(bonito(areaDe(inicial.radio)), AREA_MIN), AREA_MAX);
  const circulo = L.circle(mapa.getCenter(), { radius: radioDe(area), color: "#ffd34d", weight: 3, fillOpacity: 0.15 }).addTo(mapa);

  const ha = (a: number) => (a / HA).toLocaleString(locale(), { minimumFractionDigits: a < 10 * HA ? 1 : 0, maximumFractionDigits: 1 });
  function comparacion(a: number) {
    const k = a / CANCHA;
    if (k < 0.5) return t("menos de media cancha de fútbol", "less than half a football field");
    const n = k < 10 ? Math.round(k * 2) / 2 : Math.round(k);
    const txt = n.toLocaleString(locale());
    return n === 1 ? t("como 1 cancha de fútbol", "like 1 football field") : t(`como ${txt} canchas de fútbol`, `like ${txt} football fields`);
  }
  function pintar(desdeCampo = false) {
    circulo.setLatLng(mapa.getCenter()).setRadius(radioDe(area));
    rango.value = String(aPosicion(area));
    rango.style.setProperty("--pct", `${(aPosicion(area) / PASOS) * 100}%`);
    if (!desdeCampo) campo.value = ha(area);
    comparar.textContent = `${areaTexto(area)} · ${comparacion(area)} · ${t("radio", "radius")} ${Math.round(radioDe(area))} m`;
    cont.querySelectorAll<HTMLButtonElement>("[data-ha]").forEach((b) => b.classList.toggle("elegido", Math.abs(Number(b.dataset.ha) * HA - area) < 1));
    aviso.hidden = true;
  }
  /** Acerca o aleja el mapa para que el círculo ocupe cerca de la mitad de la vista. */
  function ajustarZoom() {
    const caja = cont.querySelector<HTMLElement>(".mapa-caja")!;
    const lado = Math.min(caja.clientWidth, caja.clientHeight) * 0.45;
    const z = Math.log2((156543.03 * Math.cos((mapa.getCenter().lat * Math.PI) / 180) * lado) / (2 * radioDe(area)));
    mapa.setZoom(Math.max(12, Math.min(19, Math.round(z))));
  }
  const fijar = (a: number, zoom = true) => { area = Math.min(Math.max(a, AREA_MIN), AREA_MAX); pintar(); if (zoom) ajustarZoom(); };

  mapa.on("move", () => pintar(document.activeElement === campo));
  rango.addEventListener("input", () => { area = bonito(deSolicitud(Number(rango.value))); pintar(); });
  rango.addEventListener("change", ajustarZoom);
  cont.querySelector("[data-menos]")!.addEventListener("click", () => fijar(bonito(deSolicitud(Math.max(0, aPosicion(area) - 40)))));
  cont.querySelector("[data-mas]")!.addEventListener("click", () => fijar(area > AREA_DESLIZADOR ? area * 1.25 : bonito(deSolicitud(Math.min(PASOS, aPosicion(area) + 40)))));
  cont.querySelectorAll<HTMLButtonElement>("[data-ha]").forEach((b) => b.addEventListener("click", () => fijar(Number(b.dataset.ha) * HA)));
  campo.addEventListener("input", () => {
    const v = parseFloat(campo.value.replace(",", "."));
    if (Number.isFinite(v) && v > 0) { area = Math.min(Math.max(v * HA, AREA_MIN), AREA_MAX); pintar(true); }
  });
  campo.addEventListener("change", () => { pintar(); ajustarZoom(); });
  campo.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); campo.blur(); } });
  pintar();

  // ---- ubicación del jugador (se pide al abrir el mapa y con el botón)
  function ubicar() {
    if (!navigator.geolocation) { estado.textContent = t("Tu aparato no da la ubicación: mueve el mapa hasta tu chacra.", "Your device can't share its location: move the map to your farm."); return; }
    estado.textContent = t("Buscando tu ubicación…", "Finding your location…");
    navigator.geolocation.getCurrentPosition((p) => {
      mapa.setView([p.coords.latitude, p.coords.longitude], 17);
      estado.textContent = t("Estás aquí. Mueve el mapa si tu chacra queda en otro lado.", "You are here. Move the map if your farm is somewhere else.");
    }, () => {
      estado.textContent = t("No pude ver tu ubicación. Mueve el mapa hasta tu chacra.", "I couldn't get your location. Move the map to your farm.");
    }, { enableHighAccuracy: true, timeout: 10000 });
  }
  cont.querySelector("[data-gps]")!.addEventListener("click", ubicar);
  ubicar();

  cont.querySelector("[data-confirmar]")!.addEventListener("click", () => {
    const c = mapa.getCenter();
    if (c.lat < ECUADOR.lat[0] || c.lat > ECUADOR.lat[1] || c.lng < ECUADOR.lon[0] || c.lng > ECUADOR.lon[1]) {
      aviso.textContent = t("Esta ubicación está fuera del Ecuador. Astro Granja usa datos de la sierra ecuatoriana: mueve el mapa hasta tu chacra.",
        "This location is outside Ecuador. Astro Granja uses data from the Ecuadorian highlands: move the map to your farm.");
      aviso.hidden = false;
      return;
    }
    alConfirmar({ lat: +c.lat.toFixed(5), lon: +c.lng.toFixed(5), radio: radioDe(area), nombre: t("Mi chacra", "My farm") });
  });
  setTimeout(() => mapa.invalidateSize(), 50);
  return { destruir: () => mapa.remove(), radio: () => radioDe(area), centro: () => mapa.getCenter() };
}
