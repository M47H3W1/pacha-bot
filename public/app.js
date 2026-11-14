/* Pacha: chat de presentación. Pacha responde solo con imágenes y notas de voz. */
(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const chat = $("#chat");
  const lineaEstado = $("#estado-linea");
  const estado = {};          // lat, lon, radio, crop, mes… viaja en cada llamada; el servidor no guarda nada
  const historial = [];       // para las preguntas libres
  let ultimoLado = null;
  let ocupado = false;

  // ------------------------------------------------------------ audio: un solo reproductor para todo
  const reproductor = new Audio();
  reproductor.preload = "auto";
  let notaActual = null;      // {burbuja, pintar}
  const cola = [];            // notas esperando sonar en orden

  function desbloquearAudio() {
    // un mp3 silencioso en el primer toque: así el celular deja reproducir después sin otro toque
    const n = 1600, dv = new DataView(new ArrayBuffer(44 + n * 2));   // 0,1 s de silencio en WAV
    const w = (o, s) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
    w(0, "RIFF"); dv.setUint32(4, 36 + n * 2, true); w(8, "WAVEfmt "); dv.setUint32(16, 16, true);
    dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, 16000, true); dv.setUint32(28, 32000, true);
    dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); w(36, "data"); dv.setUint32(40, n * 2, true);
    reproductor.src = URL.createObjectURL(new Blob([dv.buffer], { type: "audio/wav" }));
    reproductor.play().catch(() => {});
  }

  function sonar(nota) {
    if (notaActual && notaActual !== nota) notaActual.parar();
    notaActual = nota;
    reproductor.src = nota.url;
    reproductor.playbackRate = nota.velocidad;
    reproductor.play().then(() => nota.marcar(true)).catch(() => nota.marcar(false));
  }
  reproductor.addEventListener("timeupdate", () => notaActual && notaActual.pintar(reproductor.currentTime / (reproductor.duration || 1)));
  reproductor.addEventListener("ended", () => {
    if (!notaActual) return;
    notaActual.terminar();
    notaActual = null;
    if (cola.length) sonar(cola.shift());
  });

  function encolar(nota) {
    if (!notaActual || reproductor.paused) sonar(nota); else cola.push(nota);
  }

  // ------------------------------------------------------------ utilidades de burbujas
  const hora = () => new Date().toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit", hour12: false });
  const CHECK = '<svg class="check" viewBox="0 0 16 11"><path d="M11 .6 4.9 7.4 2.3 4.8 1 6.1l3.9 3.9L12.3 1.9zM15 .6 8.9 7.4l-.9-.9-1.3 1.3 2.2 2.2L16.3 1.9z"/></svg>';
  const PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
  const PAUSA = '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6zm8-14v14h4V5z"/></svg>';
  const CARGA = '<svg viewBox="0 0 24 24"><path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/></svg>';
  const MIC = '<svg class="mic-mini" viewBox="0 0 24 24"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5.3-3a5.3 5.3 0 0 1-10.6 0H5a7 7 0 0 0 6 6.9V21h2v-3.1a7 7 0 0 0 6-6.9z"/></svg>';

  function fila(lado, clases = "") {
    const f = document.createElement("div");
    f.className = `fila ${lado === "yo" ? "yo" : ""} ${ultimoLado !== lado ? "nueva" : ""}`;
    ultimoLado = lado;
    const b = document.createElement("div");
    b.className = `burbuja ${clases}`;
    f.appendChild(b);
    chat.appendChild(f);
    bajar();
    return b;
  }
  const bajar = () => requestAnimationFrame(() => chat.scrollTo({ top: chat.scrollHeight, behavior: "smooth" }));
  const sello = (yo) => `<span class="hora">${hora()}${yo ? CHECK : ""}</span>`;

  function textoYo(t) {
    const b = fila("yo");
    b.textContent = t;
    b.insertAdjacentHTML("beforeend", sello(true));
    historial.push({ role: "user", content: t });
  }

  function textoPacha(t) {
    const b = fila("pacha");
    b.innerHTML = t.split(/\n/).map((l) => l.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))).join("<br>");
    b.insertAdjacentHTML("beforeend", sello(false));
  }

  function imagen(src) {
    const b = fila("pacha", "foto");
    const img = new Image();
    img.alt = "Dibujo de Pacha";
    img.src = src;
    img.onload = bajar;
    img.onclick = () => { $("#visor img").src = src; $("#visor").hidden = false; };
    b.appendChild(img);
    b.insertAdjacentHTML("beforeend", sello(false));
  }

  function semilla(t) { let h = 7; for (const c of t) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
  function ondas(n, base) {
    let h = base;
    return Array.from({ length: n }, () => { h = (h * 1103515245 + 12345) >>> 0; return 18 + (h % 82); });
  }
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  /** Nota de voz. Para Pacha: url se rellena cuando llega el mp3. Para "yo": blob local. */
  function notaDeVoz(lado, texto) {
    const yo = lado === "yo";
    const b = fila(lado, "voz voz-cargando");
    const alturas = ondas(32, semilla(texto || String(Date.now())));
    b.innerHTML = `
      <div class="voz-fila">
        <div class="voz-avatar"><img src="img/pacha.svg" alt="">${MIC}</div>
        <button class="voz-play" aria-label="Reproducir">${CARGA}</button>
        <div class="voz-cuerpo">
          <div class="ondas">${alturas.map((a) => `<i style="height:${a}%"></i>`).join("")}</div>
          <div class="voz-meta"><span class="dur">0:00</span><span>${hora()}${yo ? " " + CHECK : ""}</span></div>
        </div>
      </div>
`;
    if (yo) b.querySelector(".voz-avatar img").src = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="#dfe5e7"/><path fill="#fff" d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-3 0-8 1.5-8 4.5V22h16v-3.5c0-3-5-4.5-8-4.5z"/></svg>');
    const barras = [...b.querySelectorAll(".ondas i")];
    const boton = b.querySelector(".voz-play");
    const dur = b.querySelector(".dur");
    const nota = {
      url: null, velocidad: 1, duracion: 0,
      pintar(p) {
        const k = Math.round(p * barras.length);
        barras.forEach((x, i) => x.classList.toggle("on", i < k));
        if (nota.duracion) dur.textContent = mmss(p * nota.duracion);
      },
      marcar(sonando) { boton.innerHTML = sonando ? PAUSA : PLAY; },
      parar() { reproductor.pause(); nota.marcar(false); },
      terminar() { nota.marcar(false); nota.pintar(0); dur.textContent = mmss(nota.duracion); },
      listo(url) {
        nota.url = url;
        b.classList.remove("voz-cargando");
        boton.innerHTML = PLAY;
        const a = new Audio(url);
        a.addEventListener("loadedmetadata", () => {
          nota.duracion = isFinite(a.duration) ? a.duration : 0;
          dur.textContent = mmss(nota.duracion);
        });
      },
    };
    boton.onclick = () => {
      if (!nota.url) return;
      if (notaActual === nota && !reproductor.paused) { nota.parar(); return; }
      cola.length = 0;
      sonar(nota);
    };
    b.querySelector(".ondas").onclick = (ev) => {
      if (notaActual !== nota || !reproductor.duration) return;
      const r = ev.currentTarget.getBoundingClientRect();
      reproductor.currentTime = ((ev.clientX - r.left) / r.width) * reproductor.duration;
    };
    // texto debajo de la nota de voz (la transcripción de lo que dijo el agricultor)
    nota.escribir = (t) => {
      let d = b.querySelector(".transcripcion");
      if (!d) { d = document.createElement("div"); d.className = "transcripcion"; b.appendChild(d); }
      d.textContent = t;
      bajar();
    };
    return nota;
  }

  async function vozDePacha(texto) {
    lineaEstado.textContent = "grabando audio…";
    const nota = notaDeVoz("pacha", texto);
    historial.push({ role: "assistant", content: texto });
    try {
      const r = await fetch("api/voz", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texto }) });
      if (!r.ok) throw new Error("voz");
      nota.listo(URL.createObjectURL(await r.blob()));
      encolar(nota);
    } catch {
      // respaldo: la voz del propio teléfono
      nota.listo("data:,");
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = "es-ES";
      speechSynthesis.speak(u);
    }
  }

  function escribiendo(on) {
    let e = $("#escribiendo");
    if (on && !e) {
      e = document.createElement("div");
      e.id = "escribiendo";
      e.className = "fila escribiendo";
      e.innerHTML = '<div class="burbuja"><i></i><i></i><i></i></div>';
      chat.appendChild(e);
      bajar();
    } else if (!on && e) e.remove();
    lineaEstado.textContent = on ? "escribiendo…" : "en línea";
  }

  // ------------------------------------------------------------ botones interactivos
  function botones(lista) {
    if (!lista.length) return;
    const cont = document.createElement("div");
    cont.className = "botones";
    const elegir = (bt, el) => {
      cont.querySelectorAll("button").forEach((x) => (x.disabled = true));
      if (el) el.classList.add("elegido");
      pulsar(bt);
    };
    if (lista.length <= 4) {
      lista.forEach((bt) => {
        const el = document.createElement("button");
        el.textContent = bt.t;
        el.onclick = () => elegir(bt, el);
        cont.appendChild(el);
      });
    } else {
      const el = document.createElement("button");
      el.innerHTML = "☰&nbsp; Ver opciones";
      el.onclick = () => abrirLista(lista, (bt) => elegir(bt, el));
      cont.appendChild(el);
    }
    const f = document.createElement("div");
    f.className = "fila";
    f.appendChild(cont);
    chat.appendChild(f);
    bajar();
  }

  function abrirLista(lista, alElegir) {
    const items = $("#lista-items");
    items.innerHTML = "";
    lista.forEach((bt) => {
      const el = document.createElement("button");
      el.textContent = bt.t;
      el.onclick = () => { $("#hoja-lista").hidden = true; alElegir(bt); };
      items.appendChild(el);
    });
    $("#hoja-lista").hidden = false;
  }
  $("#cerrar-lista").onclick = () => ($("#hoja-lista").hidden = true);
  $("#hoja-lista").onclick = (e) => { if (e.target.id === "hoja-lista") e.currentTarget.hidden = true; };

  function pulsar(bt) {
    if (bt.accion === "mapa") { abrirMapa(); return; }
    cola.length = 0;                      // al pedir otra cosa se calla el audio anterior
    if (notaActual) { notaActual.parar(); notaActual = null; }
    textoYo(bt.t);
    const { t, accion, ...extra } = bt;
    llamar(accion, extra);
  }

  // ------------------------------------------------------------ servidor
  async function mostrar(res) {
    Object.assign(estado, res.estado || {});
    for (const m of res.mensajes) {
      if (m.tipo === "imagen") { imagen(m.src); await espera(350); }
      else if (m.tipo === "texto") textoPacha(m.texto);
      else if (m.tipo === "audio") await vozDePacha(m.texto);
    }
    lineaEstado.textContent = "en línea";
    botones(res.botones || []);
  }
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));

  async function llamar(accion, extra = {}) {
    if (ocupado) return;
    ocupado = true;
    Object.assign(estado, extra);
    escribiendo(true);
    try {
      const r = await fetch("api/accion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion, estado }) });
      const res = await r.json();
      escribiendo(false);
      await mostrar(res);
    } catch {
      escribiendo(false);
      await mostrar({ mensajes: [{ tipo: "texto", texto: "Perdón, se cortó la señal. Intente otra vez." }], botones: [] });
    } finally { ocupado = false; }
  }

  async function preguntar(cuerpo) {
    if (ocupado) return;
    ocupado = true;
    escribiendo(true);
    try {
      const r = await fetch("api/pregunta", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...cuerpo, estado, historial: historial.slice(-8) }) });
      const res = await r.json();
      escribiendo(false);
      await mostrar(res);
    } catch {
      escribiendo(false);
      await mostrar({ mensajes: [{ tipo: "texto", texto: "Perdón, se cortó la señal. Intente otra vez." }], botones: [] });
    } finally { ocupado = false; }
  }

  // ------------------------------------------------------------ escribir y grabar
  const entrada = $("#entrada");
  const btnEnviar = $("#enviar");
  entrada.addEventListener("input", () => btnEnviar.classList.toggle("texto", entrada.value.trim() !== ""));
  entrada.addEventListener("keydown", (e) => { if (e.key === "Enter") enviarTexto(); });
  function enviarTexto() {
    const t = entrada.value.trim();
    if (!t) return;
    entrada.value = "";
    btnEnviar.classList.remove("texto");
    textoYo(t);
    preguntar({ texto: t });
  }

  let grabador = null, trozos = [], inicioGrab = 0, reloj = null;
  btnEnviar.onclick = async () => {
    if (btnEnviar.classList.contains("texto")) { enviarTexto(); return; }
    if (grabador) { terminarGrabacion(true); return; }
    try {
      const flujo = await navigator.mediaDevices.getUserMedia({ audio: true });
      grabador = new MediaRecorder(flujo);
      trozos = [];
      grabador.ondataavailable = (e) => trozos.push(e.data);
      grabador.start();
      inicioGrab = Date.now();
      $("#grabando").hidden = false;
      btnEnviar.classList.add("grabando");
      reloj = setInterval(() => ($("#grab-tiempo").textContent = mmss((Date.now() - inicioGrab) / 1000)), 250);
    } catch {
      await mostrar({ mensajes: [{ tipo: "texto", texto: "No pude usar el micrófono. Puede escribirme o usar los botones." }], botones: [] });
    }
  };
  $("#cancelar-grab").onclick = () => terminarGrabacion(false);

  function terminarGrabacion(enviar) {
    const g = grabador;
    grabador = null;
    clearInterval(reloj);
    $("#grabando").hidden = true;
    btnEnviar.classList.remove("grabando");
    g.onstop = async () => {
      g.stream.getTracks().forEach((t) => t.stop());
      if (!enviar || Date.now() - inicioGrab < 700) return;
      const blob = new Blob(trozos, { type: g.mimeType });
      const nota = notaDeVoz("yo", "");
      nota.listo(URL.createObjectURL(blob));
      // 1) se transcribe la nota de voz, 2) el texto va al modelo como cualquier pregunta escrita
      nota.escribir("📝 Escuchando su audio…");
      lineaEstado.textContent = "escuchando audio…";
      let texto = null;
      try {
        const r = await fetch("api/transcribir", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audio: await aWav16k(blob) }) });
        texto = (await r.json()).texto;
      } catch { texto = null; }
      lineaEstado.textContent = "en línea";
      if (!texto) {
        nota.escribir("📝 No se entendió");
        await mostrar({ mensajes: [{ tipo: "texto", texto: "🙉 No le entendí bien. ¿Puede repetir o escribir?" },
          { tipo: "audio", texto: "No le entendí bien. ¿Puede repetir o escribir?" }], botones: [] });
        return;
      }
      nota.escribir("📝 " + texto);
      historial.push({ role: "user", content: texto });
      preguntar({ texto });
    };
    g.stop();
  }

  /** Convierte la grabación a WAV mono de 16 kHz en base64 (formato que aceptan los modelos con audio). */
  async function aWav16k(blob) {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    const n = Math.ceil(buf.duration * 16000);
    const off = new OfflineAudioContext(1, n, 16000);
    const src = off.createBufferSource();
    src.buffer = buf;
    src.connect(off.destination);
    src.start();
    const pcm = (await off.startRendering()).getChannelData(0);
    const dv = new DataView(new ArrayBuffer(44 + pcm.length * 2));
    const w = (o, s) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
    w(0, "RIFF"); dv.setUint32(4, 36 + pcm.length * 2, true); w(8, "WAVEfmt ");
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, 16000, true); dv.setUint32(28, 32000, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
    w(36, "data"); dv.setUint32(40, pcm.length * 2, true);
    pcm.forEach((x, i) => dv.setInt16(44 + i * 2, Math.max(-1, Math.min(1, x)) * 0x7fff, true));
    const bytes = new Uint8Array(dv.buffer);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    ctx.close();
    return btoa(bin);
  }

  // ------------------------------------------------------------ adjuntos y mapa
  $("#adjuntar").onclick = () => ($("#hoja-adjuntos").hidden = false);
  $("#camara").onclick = () => abrirMapa();
  $("#hoja-adjuntos").onclick = (e) => {
    const b = e.target.closest("button");
    if (e.target.id === "hoja-adjuntos" || b) $("#hoja-adjuntos").hidden = true;
    if (b && b.dataset.adj === "ubicacion") abrirMapa();
  };

  let mapa = null, circulo = null, capaCalle = null, capaSat = null, satelite = true;
  const radioIn = $("#radio");
  function textoArea(r) {
    const m2 = Math.PI * r * r, ha = m2 / 10000;
    const area = ha < 0.5 ? `${Math.round(m2 / 10) * 10} m²` : `${ha < 10 ? ha.toFixed(1).replace(".", ",") : Math.round(ha)} ha`;
    return area;
  }
  const centroCirculo = () => mapa.getCenter();   // la punta del pin está en el centro del mapa
  function actualizarCirculo() {
    const r = +radioIn.value;
    circulo.setLatLng(centroCirculo()).setRadius(r);
    $("#area").textContent = textoArea(r);
  }
  function abrirMapa() {
    $("#mapa-modal").hidden = false;
    if (!mapa) {
      mapa = L.map("mapa", { zoomControl: false, attributionControl: true }).setView([estado.lat ?? -1.6, estado.lon ?? -78.63], 15);
      capaSat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, attribution: "Imagen © Esri" }).addTo(mapa);
      capaCalle = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" });
      circulo = L.circle(mapa.getCenter(), { radius: +radioIn.value, color: "#ffeb3b", weight: 3, fillColor: "#ffeb3b", fillOpacity: 0.18 }).addTo(mapa);
      mapa.on("move zoom", actualizarCirculo);
    }
    setTimeout(() => { mapa.invalidateSize(); actualizarCirculo(); }, 50);
  }
  radioIn.addEventListener("input", actualizarCirculo);
  $("#cerrar-mapa").onclick = () => ($("#mapa-modal").hidden = true);
  $("#capa").onclick = () => {
    satelite = !satelite;
    if (satelite) { mapa.removeLayer(capaCalle); capaSat.addTo(mapa); } else { mapa.removeLayer(capaSat); capaCalle.addTo(mapa); }
  };
  document.querySelectorAll(".demo button[data-lat]").forEach((b) => (b.onclick = () => {
    mapa.setView([+b.dataset.lat, +b.dataset.lon], 15);
  }));
  $("#gps").onclick = () => navigator.geolocation?.getCurrentPosition(
    (p) => { mapa.setView([p.coords.latitude, p.coords.longitude], 16); },
    () => alert("No pude leer su ubicación. Mueva el mapa a mano."), { enableHighAccuracy: true, timeout: 10000 });

  $("#enviar-ubicacion").onclick = () => {
    const c = centroCirculo(), r = +radioIn.value;
    $("#mapa-modal").hidden = true;
    cola.length = 0;
    if (notaActual) { notaActual.parar(); notaActual = null; }
    try { burbujaUbicacion(c.lat, c.lng, r); } catch (e) { console.warn(e); }
    for (const k of ["crop", "mes", "dias", "i"]) delete estado[k];
    llamar("chakra", { lat: +c.lat.toFixed(5), lon: +c.lng.toFixed(5), radio: r });
  };

  function burbujaUbicacion(lat, lon, r) {
    const b = fila("yo", "ubic");
    b.innerHTML = `<div class="mini-mapa"></div><div class="ubic-texto">📍 Mi tierra<small>${textoArea(r)} · radio ${r} m</small>${sello(true)}</div>`;
    const mm = L.map(b.querySelector(".mini-mapa"), { zoomControl: false, attributionControl: false, dragging: false,
      scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false });
    mm.fitBounds(L.latLng(lat, lon).toBounds(r * 2.4));   // primero la vista, luego las capas
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19 }).addTo(mm);
    L.circle([lat, lon], { radius: r, color: "#ffeb3b", weight: 2, fillOpacity: 0.15 }).addTo(mm);
    L.circleMarker([lat, lon], { radius: 4, color: "#e53935", fillOpacity: 1 }).addTo(mm);
    historial.push({ role: "user", content: `(envió su tierra: radio ${r} m)` });
  }

  $("#visor").onclick = () => ($("#visor").hidden = true);

  // ------------------------------------------------------------ inicio
  $("#abrir").onclick = () => {
    desbloquearAudio();
    $("#portada").hidden = true;
    llamar("inicio");
  };
})();
