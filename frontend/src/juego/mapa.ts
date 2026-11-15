// Mapa para elegir la chacra: pin fijo al centro y un círculo con el tamaño de la tierra (20–600 m).
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface Lugar { lat: number; lon: number; radio: number; nombre: string }

export const DEMOS = [
  { nombre: "Calpi", lat: -1.6466, lon: -78.7437 },
  { nombre: "Guano", lat: -1.6, lon: -78.63 },
  { nombre: "Cayambe", lat: 0.04, lon: -78.14 },
  { nombre: "Saquisilí", lat: -0.84, lon: -78.67 },
];
export const RADIO_DEMO = 80;

export function areaTexto(r: number) {
  const m2 = Math.PI * r * r;
  return m2 < 10000 ? `${Math.round(m2 / 10) * 10} m²` : `${(m2 / 10000).toFixed(1).replace(".", ",")} hectáreas`;
}

export function crearMapa(cont: HTMLElement, inicial: { lat: number; lon: number; radio: number },
                          alConfirmar: (l: Lugar) => void) {
  cont.innerHTML = `
    <div class="mapa-caja"><div class="mapa-leaflet"></div>
      <div class="mapa-pin" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 2a7 7 0 0 0-7 7c0 5.3 7 13 7 13s7-7.7 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg></div>
    </div>
    <div class="mapa-panel">
      <div class="demos">${DEMOS.map((d, i) => `<button type="button" class="chip" data-demo="${i}">${d.nombre}</button>`).join("")}
        <button type="button" class="chip" data-gps>◎ Aquí</button></div>
      <label class="deslizador"><span>Tamaño de la chacra</span>
        <input type="range" min="20" max="600" step="5" value="${inicial.radio}" aria-label="Radio de la chacra en metros">
        <output></output></label>
      <button type="button" class="btn-juego grande" data-confirmar>✅ Esta es mi chacra</button>
    </div>`;
  const mapa = L.map(cont.querySelector<HTMLElement>(".mapa-leaflet")!, { zoomControl: false, attributionControl: true })
    .setView([inicial.lat, inicial.lon], 16);
  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 19, attribution: "Imágenes © Esri",
  }).addTo(mapa);
  const rango = cont.querySelector<HTMLInputElement>("input[type=range]")!;
  const salida = cont.querySelector<HTMLOutputElement>("output")!;
  const circulo = L.circle(mapa.getCenter(), { radius: inicial.radio, color: "#ffd34d", weight: 3, fillOpacity: 0.15 }).addTo(mapa);
  let nombre = "Mi chacra";
  const pintar = () => {
    const r = Number(rango.value);
    circulo.setLatLng(mapa.getCenter()).setRadius(r);
    salida.textContent = `${areaTexto(r)} · radio ${r} m`;
  };
  mapa.on("move", pintar);
  rango.addEventListener("input", pintar);
  pintar();
  cont.querySelectorAll<HTMLButtonElement>("[data-demo]").forEach((b) => b.addEventListener("click", () => {
    const d = DEMOS[Number(b.dataset.demo)];
    nombre = d.nombre;
    rango.value = String(RADIO_DEMO);
    mapa.setView([d.lat, d.lon], 16);
    pintar();
  }));
  cont.querySelector("[data-gps]")!.addEventListener("click", () => {
    navigator.geolocation?.getCurrentPosition((p) => { nombre = "Mi chacra"; mapa.setView([p.coords.latitude, p.coords.longitude], 17); },
      () => {}, { enableHighAccuracy: true, timeout: 10000 });
  });
  mapa.on("dragstart", () => { nombre = "Mi chacra"; });
  cont.querySelector("[data-confirmar]")!.addEventListener("click", () => {
    const c = mapa.getCenter();
    const demo = DEMOS.find((d) => d.nombre === nombre);
    // los sitios de demostración usan sus coordenadas exactas (sus datos vienen guardados para jugar sin señal)
    alConfirmar(demo && Number(rango.value) === RADIO_DEMO
      ? { lat: demo.lat, lon: demo.lon, radio: RADIO_DEMO, nombre }
      : { lat: +c.lat.toFixed(5), lon: +c.lng.toFixed(5), radio: Number(rango.value), nombre });
  });
  setTimeout(() => mapa.invalidateSize(), 50);
  return { destruir: () => mapa.remove() };
}
