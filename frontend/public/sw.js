// Service worker de Pacha: la interfaz funciona sin señal y la última respuesta de cada consulta queda guardada.
const VERSION = "pacha-v1";
const BASICO = ["/", "/ubicacion/", "/parcela/", "/sembrar/", "/riego/", "/datos/", "/manifest.webmanifest", "/icono.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(BASICO)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // la API la guarda la app en sessionStorage
  // Páginas y recursos: primero la red, si no hay señal, la copia guardada
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok && e.request.method === "GET") { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copia)); }
    return r;
  }).catch(() => caches.match(e.request).then((r) => r || caches.match("/"))));
});
