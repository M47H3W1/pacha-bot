// Mundo 3D estilo "casual cute" con identidad andina: sombreado toon suave, sombras, chacras en franjas,
// casa de adobe con teja, cerco de madera, árboles redondos, nubes y volcán nevado. Escala real en metros.
// El sol y la luna cruzan el cielo: el día pasa a la noche poco a poco y se acelera cuando avanza el tiempo del juego.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Mundo, Terreno, VistaParcela } from "./mundo";
import { N_PARCELAS } from "./estado";
import { urlIcono } from "./iconos";

const EXAG_MAX = 1.6; // relieve un poco más marcado en terrenos planos para que se lea en pantalla
const POR_PARCELA = 9;  // 3 x 3 plantas en cada parcela cuadrada
const ESCALA = [0, 0.32, 0.62, 1, 0.96];


export function hayWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch {
    return false;
  }
}

/** Rampa de 4 tonos para el sombreado toon, con filtro lineal: bandas suaves en lugar de facetas duras. */
function rampaToon(): THREE.DataTexture {
  const d = new Uint8Array([125, 125, 125, 255, 178, 178, 178, 255, 226, 226, 226, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

const suave = (k: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);              // ease-out cúbico
const rebote = (k: number) => { k = Math.min(1, k); return 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2); }; // ease-out back
const escalon = (a: number, b: number, x: number) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
// spline de Catmull-Rom: el relieve pasa por los puntos reales sin quiebres entre celdas de la grilla
const cr = (p0: number, p1: number, p2: number, p3: number, x: number) =>
  p1 + 0.5 * x * (p2 - p0 + x * (2 * p0 - 5 * p1 + 4 * p2 - p3 + x * (3 * (p1 - p2) + p3 - p0)));

export function crearMundo3D(cont: HTMLElement, t: Terreno, elev: number): Mundo {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(cont.clientWidth, cont.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  cont.appendChild(renderer.domElement);
  renderer.domElement.classList.add("lienzo3d");

  const escena = new THREE.Scene();
  const matVentana = new THREE.MeshToonMaterial({ color: 0x5aa9d6, emissive: 0xffc24a, emissiveIntensity: 0 });
  const alto = Math.max(0, Math.min(1, (elev - 2400) / 1400));
  const cielo = new THREE.Color().lerpColors(new THREE.Color(0xa8dcf5), new THREE.Color(0x6ab4ea), alto);
  escena.background = cielo.clone();
  const L = t.lado_m;
  const S = Math.max(14, Math.min(48, L * 0.34));   // tamaño de la zona de chacras
  escena.fog = new THREE.Fog(cielo.clone(), S * 4, S * 14);

  const gradiente = rampaToon();
  const cache = new Map<number, THREE.MeshToonMaterial>();
  const toon = (color: number) => {
    if (!cache.has(color)) cache.set(color, new THREE.MeshToonMaterial({ color, gradientMap: gradiente }));
    return cache.get(color)!;
  };

  // --- altura del terreno (bilineal sobre la grilla real) ---
  // la exageración solo ayuda en terrenos planos; en laderas fuertes se usa la altura real
  const EXAGERACION = Math.min(EXAG_MAX, Math.max(1, (S * 0.6) / Math.max(t.desnivel_m, 1)));
  const n = t.n, paso = L / (n - 1);
  const A = (i: number, j: number) => t.alturas[Math.max(0, Math.min(n - 1, i))][Math.max(0, Math.min(n - 1, j))];
  const H = (x: number, z: number) => {
    const fx = Math.max(0, Math.min(n - 1.0001, (x + L / 2) / paso));
    const fz = Math.max(0, Math.min(n - 1.0001, (z + L / 2) / paso));
    const j = Math.floor(fx), i = Math.floor(fz), dx = fx - j, dz = fz - i;
    const fila = (ii: number) => cr(A(ii, j - 1), A(ii, j), A(ii, j + 1), A(ii, j + 2), dx);
    return (cr(fila(i - 1), fila(i), fila(i + 1), fila(i + 2), dz) - t.centro) * EXAGERACION;
  };

  // --- terreno con chacras en franjas (colores cálidos andinos) ---
  const ancho = L * 1.7, seg = 160;
  const geo = new THREE.PlaneGeometry(ancho, ancho, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let k = 0; k < pos.count; k++) pos.setY(k, H(pos.getX(k), pos.getZ(k)));
  geo.computeVertexNormals();
  // Textura nítida de 2048 px: pasto con detalle fuera, y dentro de la parcela franjas de chacra con bordes limpios y surcos.
  // (Antes eran colores por vértice que se mezclaban y la parcela se veía borrosa, como si no hubiera cargado.)
  const TX = 2048, px = TX / ancho;
  const lienzo = document.createElement("canvas");
  lienzo.width = lienzo.height = TX;
  const cx2 = lienzo.getContext("2d")!;
  cx2.fillStyle = "#7cb342";
  cx2.fillRect(0, 0, TX, TX);
  let semilla = 7;
  const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 9000; k++) {  // matitas de pasto
    cx2.fillStyle = azar() < 0.5 ? "rgba(70,120,40,.35)" : "rgba(170,210,110,.35)";
    const x = azar() * TX, y = azar() * TX;
    cx2.fillRect(x, y, 2 + azar() * 3, 5 + azar() * 7);
  }
  cx2.save();
  cx2.beginPath();
  cx2.arc(TX / 2, TX / 2, (L / 2) * px, 0, Math.PI * 2);
  cx2.clip();
  const colFranja = ["#8bc34a", "#c5d86d", "#e9c46a", "#6aa84f", "#d4a373", "#a7c957"];
  cx2.translate(TX / 2, TX / 2);
  cx2.rotate(Math.atan2(-0.3, 1));
  const banda = ((L / 8) / Math.hypot(1, 0.3)) * px;
  for (let b = -12; b <= 12; b++) {
    const y0 = b * banda;
    cx2.fillStyle = colFranja[((b % 6) + 6) % 6];
    cx2.fillRect(-TX, y0, TX * 2, banda + 1);
    cx2.strokeStyle = "rgba(60,40,20,.16)";  // surcos finos dentro de cada franja
    cx2.lineWidth = 2;
    for (let f = 1; f < 7; f++) { cx2.beginPath(); cx2.moveTo(-TX, y0 + (f * banda) / 7); cx2.lineTo(TX, y0 + (f * banda) / 7); cx2.stroke(); }
    cx2.fillStyle = "rgba(60,40,20,.35)";  // linde entre franjas
    cx2.fillRect(-TX, y0, TX * 2, 3);
  }
  cx2.restore();
  cx2.strokeStyle = "rgba(90,60,30,.45)";  // borde de la parcela
  cx2.lineWidth = 6;
  cx2.beginPath();
  cx2.arc(TX / 2, TX / 2, (L / 2) * px, 0, Math.PI * 2);
  cx2.stroke();
  const texSuelo = new THREE.CanvasTexture(lienzo);
  texSuelo.colorSpace = THREE.SRGBColorSpace;
  texSuelo.anisotropy = renderer.capabilities.getMaxAnisotropy();
  texSuelo.generateMipmaps = true;
  texSuelo.minFilter = THREE.LinearMipmapLinearFilter;
  const suelo = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ map: texSuelo, gradientMap: gradiente }));
  suelo.receiveShadow = true;
  escena.add(suelo);

  // borde de su tierra: cinta blanca punteada
  const borde: THREE.Vector3[] = [];
  for (let a = 0; a <= 96; a++) {
    const x = Math.cos((a / 96) * Math.PI * 2) * L / 2, z = Math.sin((a / 96) * Math.PI * 2) * L / 2;
    borde.push(new THREE.Vector3(x, H(x, z) + 0.3, z));
  }
  const linea = new THREE.Line(new THREE.BufferGeometry().setFromPoints(borde),
    new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: L / 60, gapSize: L / 90 }));
  linea.computeLineDistances();
  escena.add(linea);

  // --- fondo: llanura lejana, volcán nevado y montañas ---
  const base = Math.min(H(-L * 0.8, -L * 0.8), H(L * 0.8, L * 0.8), H(0, 0)) - 1;
  const lejos = new THREE.Mesh(new THREE.CircleGeometry(S * 16, 96), toon(0x8fbf5a));
  lejos.rotation.x = -Math.PI / 2;
  lejos.position.y = base - 1;
  lejos.receiveShadow = true;
  escena.add(lejos);
  // volcanes con perfil curvo y cumbre redondeada (torno), no conos de pocas caras
  const perfil = (r: number, h: number, desde = 0, crece = 1) => Array.from({ length: 25 }, (_, k) => {
    const q = desde + (1 - desde) * (k / 24);
    return new THREE.Vector2(r * crece * Math.pow(1 - q, 1.5) * (1 - 0.18 * Math.pow(q, 6)), h * q);
  });
  const montana = (x: number, z: number, r: number, h: number, nieve: boolean, color = 0x8d9aa8) => {
    const m = new THREE.Mesh(new THREE.LatheGeometry(perfil(r, h), 48), toon(color));
    m.position.set(x, base - 1, z);
    escena.add(m);
    if (nieve) {
      const c = new THREE.Mesh(new THREE.LatheGeometry(perfil(r, h, 0.68, 1.03), 48), toon(0xffffff));
      c.position.set(x, base - 1 + 0.002 * h, z);
      escena.add(c);
    }
  };
  montana(S * 2, -S * 9, S * 3.4, S * 3.2, true);
  montana(-S * 5, -S * 10, S * 2.6, S * 2.2, true, 0x95a3b0);
  montana(S * 7, -S * 8, S * 2.2, S * 1.6, false, 0x7f9f6a);
  montana(-S * 9, -S * 6, S * 2.4, S * 1.5, false, 0x8aa66f);

  // --- luces: cielo + sol con sombras suaves (más intensas a mayor altura) + luna de noche ---
  const hemi = new THREE.HemisphereLight(0xeaf6ff, 0x6b8f3a, 1.4 + alto * 0.3);
  escena.add(hemi);
  const sol = new THREE.DirectionalLight(0xfff1d0, 2.4 + alto * 0.6);
  sol.position.set(S * 1.2, S * 2, S * 0.9);
  const luzLuna = new THREE.DirectionalLight(0x9db8ff, 0);
  escena.add(luzLuna);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  const cam = sol.shadow.camera as THREE.OrthographicCamera;
  cam.left = cam.bottom = -S * 1.3; cam.right = cam.top = S * 1.3; cam.near = 1; cam.far = S * 6;
  sol.shadow.bias = -0.0005;
  escena.add(sol);

  // --- cielo animado: sol, luna y estrellas ---
  const R = S * 9;
  const disco = (radio: number, color: number) => new THREE.Mesh(new THREE.SphereGeometry(radio, 32, 16), new THREE.MeshBasicMaterial({ color, fog: false }));
  const astroSol = disco(S * 0.55, 0xffd84d);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(S * 0.95, 32, 16), new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.35, fog: false, depthWrite: false }));
  astroSol.add(halo);
  const astroLuna = disco(S * 0.38, 0xfff3c2);
  escena.add(astroSol, astroLuna);
  const nE = 260, pe = new Float32Array(nE * 3);
  for (let k = 0; k < nE; k++) {
    const a = Math.random() * Math.PI * 2, e = 0.12 + Math.random() * 1.3;
    pe.set([Math.cos(a) * Math.cos(e) * R * 1.4, Math.sin(e) * R * 1.4, Math.sin(a) * Math.cos(e) * R * 1.4], k * 3);
  }
  const geoEstrellas = new THREE.BufferGeometry();
  geoEstrellas.setAttribute("position", new THREE.BufferAttribute(pe, 3));
  const matEstrellas = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
  escena.add(new THREE.Points(geoEstrellas, matEstrellas));
  const C_NOCHE = new THREE.Color(0x101c3f), C_OCASO = new THREE.Color(0xf4a26b), C_GRIS = new THREE.Color(0x9aa7b4);
  const C_SOL_BAJO = new THREE.Color(0xffb36b), C_SOL_ALTO = new THREE.Color(0xfff1d0);
  const colorCielo = new THREE.Color();
  // fase del día: 0 medianoche · 0,25 amanecer · 0,5 mediodía · 0,75 atardecer
  let fase = 0.3, meta = 0.3, lloviendoAhora = false;
  function pintarCielo() {
    const th = (fase - 0.25) * Math.PI * 2, alto2 = Math.sin(th);
    const dia = escalon(-0.12, 0.25, alto2), ocaso = Math.exp(-Math.pow(alto2 / 0.18, 2));
    astroSol.position.set(Math.cos(th) * R, alto2 * R * 0.75, -R * 0.35);
    astroLuna.position.set(-Math.cos(th) * R, -alto2 * R * 0.75, -R * 0.35);
    astroSol.visible = alto2 > -0.15;
    astroLuna.visible = alto2 < 0.15;
    const elev = Math.max(alto2, 0.62);
    sol.position.set(Math.cos(th) * Math.sqrt(1 - elev * elev) * R * 0.3, elev * R * 0.3, -R * 0.08);
    sol.intensity = (2.4 + alto * 0.6) * escalon(-0.04, 0.3, alto2) * (lloviendoAhora ? 0.55 : 1);
    sol.color.lerpColors(C_SOL_BAJO, C_SOL_ALTO, escalon(0, 0.45, alto2));
    luzLuna.position.copy(astroLuna.position).multiplyScalar(0.3);
    luzLuna.intensity = 0.55 * (1 - dia);
    hemi.intensity = 0.45 + (0.95 + alto * 0.3) * dia;
    colorCielo.lerpColors(C_NOCHE, cielo, dia).lerp(C_OCASO, ocaso * 0.55);
    if (lloviendoAhora) colorCielo.lerp(C_GRIS, 0.45 * dia);
    (escena.background as THREE.Color).copy(colorCielo);
    escena.fog!.color.copy(colorCielo);
    matEstrellas.opacity = 0.9 * (1 - escalon(-0.2, 0.05, alto2));
    renderer.toneMappingExposure = 0.8 + 0.25 * dia;
    matVentana.emissiveIntensity = 1.4 * (1 - dia);
  }

  // textura de tierra arada para las camas (gris claro con surcos: se multiplica por el color de la tierra)
  const lienzoCama = document.createElement("canvas");
  lienzoCama.width = lienzoCama.height = 512;
  const cc = lienzoCama.getContext("2d")!;
  cc.fillStyle = "#ffffff";
  cc.fillRect(0, 0, 512, 512);
  for (let f = 0; f < 12; f++) {
    const y = (f + 0.5) * (512 / 12);
    const gr = cc.createLinearGradient(0, y - 21, 0, y + 21);
    gr.addColorStop(0, "rgba(0,0,0,.22)"); gr.addColorStop(0.5, "rgba(255,255,255,0)"); gr.addColorStop(1, "rgba(0,0,0,.22)");
    cc.fillStyle = gr;
    cc.fillRect(0, y - 21, 512, 42);
  }
  let sem2 = 11;
  const az2 = () => ((sem2 = (sem2 * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 1500; k++) {
    cc.fillStyle = az2() < 0.5 ? "rgba(0,0,0,.18)" : "rgba(255,255,255,.25)";
    cc.beginPath();
    cc.arc(az2() * 512, az2() * 512, 1 + az2() * 2.5, 0, Math.PI * 2);
    cc.fill();
  }
  const texCama = new THREE.CanvasTexture(lienzoCama);
  texCama.colorSpace = THREE.SRGBColorSpace;
  texCama.anisotropy = renderer.capabilities.getMaxAnisotropy();

  // --- cuatro parcelas cuadradas (2 x 2) con surcos y bordes redondeados ---
  const Q = (S / 2) * 0.84;                  // lado de cada parcela
  const parcelas: THREE.Mesh[] = [];
  const matSuelo: THREE.MeshToonMaterial[] = [];
  const plantas: THREE.Group[][] = [];
  const anillos: THREE.Mesh[] = [];
  const centros: [number, number][] = [];
  const tam = S / 13;
  for (let i = 0; i < N_PARCELAS; i++) {
    const xc = (i % 2 === 0 ? -1 : 1) * (S / 4), zc = (i < 2 ? -1 : 1) * (S / 4);
    centros.push([xc, zc]);
    const g = new THREE.PlaneGeometry(Q, Q, 48, 48);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k), z = p.getZ(k);
      const surco = Math.cos((z / Q) * Math.PI * 6) * 0.1 * tam;                      // tres lomos de tierra
      const orilla = (1 - Math.pow(Math.abs(x) / (Q / 2), 8)) * (1 - Math.pow(Math.abs(z) / (Q / 2), 8));  // esquinas redondeadas
      p.setY(k, H(x + xc, z + zc) + (0.25 * tam + surco) * Math.max(0, orilla));
    }
    g.computeVertexNormals();
    const m = new THREE.MeshToonMaterial({ color: 0x8a5a33, gradientMap: gradiente, map: texCama });
    const malla = new THREE.Mesh(g, m);
    malla.position.set(xc, 0, zc);
    malla.userData.i = i;
    malla.receiveShadow = true;
    escena.add(malla);
    parcelas.push(malla);
    matSuelo.push(m);
    // anillo dorado sobre la parcela lista para cosechar o elegida
    const anillo = new THREE.Mesh(new THREE.TorusGeometry(Q * 0.13, Q * 0.028, 16, 48), new THREE.MeshBasicMaterial({ color: 0xffd34d }));
    anillo.rotation.x = -Math.PI / 2;
    anillo.position.set(xc, 0, zc);
    anillo.visible = false;
    escena.add(anillo);
    anillos.push(anillo);
    const grupo: THREE.Group[] = [];
    for (let k = 0; k < POR_PARCELA; k++) {
      const x = xc - Q / 2 + ((k % 3) + 0.5) * (Q / 3), z = zc - Q / 2 + (Math.floor(k / 3) + 0.5) * (Q / 3);
      const planta = new THREE.Group();
      planta.position.set(x, H(x, z) + 0.3 * tam, z);
      planta.rotation.y = k * 1.7;
      planta.visible = false;
      planta.userData = { k, nace: -1, fase: k * 0.7, i };
      escena.add(planta);
      grupo.push(planta);
    }
    plantas.push(grupo);
  }

  const madera = toon(0x8d5a2b);
  const borde2 = S / 2 + tam * 2.2;          // orilla de la zona sembrada (para ubicar casa y árboles)

  // --- sombra de contacto: mancha suave bajo árboles y casa, siempre pegada al suelo ---
  const lienzoSombra = document.createElement("canvas");
  lienzoSombra.width = lienzoSombra.height = 64;
  const cs = lienzoSombra.getContext("2d")!;
  const gr = cs.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, "rgba(30,20,10,.55)"); gr.addColorStop(0.6, "rgba(30,20,10,.28)"); gr.addColorStop(1, "rgba(30,20,10,0)");
  cs.fillStyle = gr; cs.fillRect(0, 0, 64, 64);
  const texSombra = new THREE.CanvasTexture(lienzoSombra);
  const matSombra = new THREE.MeshBasicMaterial({ map: texSombra, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
  const geoSombra = new THREE.PlaneGeometry(1, 1, 6, 6);
  geoSombra.rotateX(-Math.PI / 2);
  /** Mancha de sombra que sigue la forma del terreno (cada vértice a la altura del suelo). */
  function sombraEn(x: number, z: number, radio: number) {
    const g = geoSombra.clone();
    const pp = g.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < pp.count; k++) {
      const vx = x + pp.getX(k) * radio * 2, vz = z + pp.getZ(k) * radio * 2;
      pp.setXYZ(k, vx, H(vx, vz) + tam * 0.04, vz);
    }
    const m = new THREE.Mesh(g, matSombra);
    m.renderOrder = 1;
    escena.add(m);
  }

  // --- casa de adobe con techo de teja ---
  const casa = new THREE.Group();
  const paredes = new THREE.Mesh(new RoundedBoxGeometry(tam * 3, tam * 1.8, tam * 2.2, 3, tam * 0.15), toon(0xf1d9b5));
  paredes.position.y = tam * 0.9;
  const techo = new THREE.Mesh(new THREE.ConeGeometry(tam * 2.3, tam * 1.3, 4, 1), toon(0xc0533a));
  techo.rotation.y = Math.PI / 4;
  techo.scale.set(1.15, 1, 0.85);
  techo.position.y = tam * 2.4;
  const puerta = new THREE.Mesh(new RoundedBoxGeometry(tam * 0.7, tam * 1.1, tam * 0.1, 2, tam * 0.05), toon(0x6d4c2f));
  puerta.position.set(0, tam * 0.55, tam * 1.11);
  const ventana = new THREE.Mesh(new THREE.BoxGeometry(tam * 0.55, tam * 0.5, tam * 0.08), matVentana);  // se enciende de noche
  ventana.position.set(tam * 0.9, tam * 1.05, tam * 1.11);
  casa.add(paredes, techo, puerta, ventana);
  casa.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.receiveShadow = true; });
  const cx = -borde2 - tam * 3.2, cz = -borde2 * 0.2;
  casa.position.set(cx, Math.min(H(cx - tam * 1.5, cz), H(cx + tam * 1.5, cz), H(cx, cz - tam), H(cx, cz + tam)), cz);  // apoyada, sin flotar
  sombraEn(cx, cz, tam * 2.2);
  casa.rotation.y = Math.PI / 5;
  escena.add(casa);

  // --- árboles redondos ---
  const tronco = new THREE.CylinderGeometry(tam * 0.12, tam * 0.18, tam * 1.2, 12);
  const copa = new THREE.IcosahedronGeometry(tam * 0.8, 4);
  const verdes = [0x4caf50, 0x66bb6a, 0x388e3c];
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2 + 0.3 * Math.sin(k * 3), r = borde2 * (1.6 + 0.5 * ((k * 37) % 7) / 7);
    const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.9;
    if (Math.hypot(x - cx, z - cz) < tam * 4) continue;
    const arbol = new THREE.Group();
    const tr = new THREE.Mesh(tronco, madera); tr.position.y = tam * 0.6;
    const cp = new THREE.Mesh(copa, toon(verdes[k % 3])); cp.position.y = tam * 1.6; cp.scale.setScalar(0.85 + (k % 4) * 0.12);
    arbol.add(tr, cp);
    arbol.position.set(x, H(x, z) - tam * 0.05, z);
    sombraEn(x, z, tam * 0.95 * cp.scale.x);
    escena.add(arbol);
  }

  // --- nubes esponjosas ---
  const nubes: THREE.Group[] = [];
  const bola = new THREE.SphereGeometry(1, 24, 16);
  for (let k = 0; k < 6; k++) {
    const nube = new THREE.Group();
    for (let b = 0; b < 4; b++) {
      const m = new THREE.Mesh(bola, toon(0xffffff));
      m.position.set((b - 1.5) * S * 0.18, Math.sin(b * 2) * S * 0.05, (b % 2) * S * 0.06);
      m.scale.setScalar(S * (0.16 + (b % 2) * 0.06));
      nube.add(m);
    }
    nube.position.set(-S * 6 + k * S * 2.4, S * (1.6 + (k % 3) * 0.35), -S * (2 + (k % 3) * 1.5));
    nubes.push(nube);
    escena.add(nube);
  }

  // --- plantas: geometrías compartidas ---
  const geoTallo = new THREE.CylinderGeometry(0.05, 0.08, 1, 8);
  // Las plantas que crecen usan la misma ilustración 3D del cultivo que el jugador ve en las semillas
  // (sprite que mira a la cámara, con sombra de contacto); el brote recién sembrado es un modelo 3D pequeño.
  const cargador = new THREE.TextureLoader();
  const texturas = new Map<string, THREE.Texture>();
  const matsPlanta = new Map<string, THREE.SpriteMaterial>();
  function matCultivo(id: string, estado: "bien" | "seca" | "madura") {
    const clave = `${id}|${estado}`;
    if (!matsPlanta.has(clave)) {
      if (!texturas.has(id)) {
        const tx = cargador.load(urlIcono(id));
        tx.colorSpace = THREE.SRGBColorSpace;
        tx.anisotropy = 4;
        texturas.set(id, tx);
      }
      matsPlanta.set(clave, new THREE.SpriteMaterial({
        map: texturas.get(id)!, transparent: true, alphaTest: 0.25,
        color: estado === "seca" ? 0xc9a46a : estado === "madura" ? 0xfff1c4 : 0xffffff,
      }));
    }
    return matsPlanta.get(clave)!;
  }
  const geoHojita = new THREE.SphereGeometry(0.22, 16, 10);
  function armarPlanta(g: THREE.Group, v: VistaParcela) {
    g.clear();
    g.userData.sprite = null;
    const sombra = new THREE.Mesh(geoSombra, matSombra);
    sombra.position.y = 0.02;
    if (v.etapa <= 1 || !v.crop) {
      // brote: tallito con dos hojas redondas
      const verde = toon(v.marchita ? 0xb08a4a : 0x6fb43f);
      const tallo = new THREE.Mesh(geoTallo, toon(v.marchita ? 0xa0804a : 0x3d8a2e));
      tallo.scale.set(1, 0.6, 1);
      tallo.position.y = 0.3;
      const h1 = new THREE.Mesh(geoHojita, verde), h2 = new THREE.Mesh(geoHojita, verde);
      h1.scale.set(1.3, 0.45, 0.8); h2.scale.set(1.3, 0.45, 0.8);
      h1.position.set(-0.2, 0.6, 0); h2.position.set(0.2, 0.62, 0);
      h1.rotation.z = 0.5; h2.rotation.z = -0.5;
      g.add(tallo, h1, h2);
      g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
      sombra.scale.setScalar(0.9);
    } else {
      const sp = new THREE.Sprite(matCultivo(v.crop, v.marchita ? "seca" : v.etapa >= 4 ? "madura" : "bien"));
      sp.center.set(0.5, 0.06);  // la base del dibujo toca la tierra
      const alto = v.etapa === 2 ? 1.7 : 2.7;
      sp.scale.set(alto, alto * (v.marchita ? 0.82 : 1), 1);
      g.add(sp);
      g.userData.sprite = sp;
      g.userData.alto = sp.scale.y;
      sombra.scale.setScalar(alto * 0.75);
    }
    g.add(sombra);
    g.userData.marchita = v.marchita;
  }

  // --- lluvia y gotas de riego ---
  const nG = 600, pg = new Float32Array(nG * 3);
  for (let k = 0; k < nG; k++) pg.set([(Math.random() - 0.5) * S * 2, Math.random() * S * 1.2, (Math.random() - 0.5) * S * 2], k * 3);
  const gotas = new THREE.BufferGeometry();
  gotas.setAttribute("position", new THREE.BufferAttribute(pg, 3));
  const lluvia = new THREE.Points(gotas, new THREE.PointsMaterial({ color: 0xd6ecff, size: S / 140, transparent: true, opacity: 0.85 }));
  lluvia.visible = false;
  escena.add(lluvia);
  const chorros: { p: THREE.Points; t0: number }[] = [];
  const geoChorro = new THREE.BufferGeometry();
  const pc = new Float32Array(120 * 3);
  for (let k = 0; k < 120; k++) pc.set([(Math.random() - 0.5) * Q, Math.random() * tam * 3, (Math.random() - 0.5) * Q], k * 3);
  geoChorro.setAttribute("position", new THREE.BufferAttribute(pc, 3));
  const matChorro = new THREE.PointsMaterial({ color: 0x4fc3f7, size: tam * 0.18, transparent: true, opacity: 0.9 });

  // --- cámara con vuelo de entrada ---
  const vertical = cont.clientWidth < cont.clientHeight ? 1.6 : 1;
  const camara = new THREE.PerspectiveCamera(42, cont.clientWidth / cont.clientHeight, 0.5, S * 40);
  const destino = new THREE.Vector3(S * 1.15 * vertical, S * 1.1 * vertical, S * 1.75 * vertical);
  const inicio = destino.clone().multiplyScalar(2.6).add(new THREE.Vector3(0, S * 2, 0));
  camara.position.copy(inicio);
  const ctrl = new OrbitControls(camara, renderer.domElement);
  ctrl.target.set(0, H(0, 0), 0);
  ctrl.enableDamping = true;
  ctrl.dampingFactor = 0.08;
  ctrl.maxPolarAngle = Math.PI * 0.43;
  ctrl.minDistance = S * 0.6;
  ctrl.maxDistance = S * 5;
  ctrl.enablePan = false;
  ctrl.enabled = false;

  // --- toques ---
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let alTocar: (i: number) => void = () => {};
  let inicioToque: [number, number] | null = null;
  function parcelaEn(px: number, py: number): number | null {
    const r = renderer.domElement.getBoundingClientRect();
    if (px < r.left || px > r.right || py < r.top || py > r.bottom) return null;
    ndc.set(((px - r.left) / r.width) * 2 - 1, -((py - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camara);
    const hit = ray.intersectObjects([...parcelas, ...plantas.flat()], true)[0];
    if (!hit) return null;
    let o: THREE.Object3D | null = hit.object;
    while (o && o.userData.i === undefined) o = o.parent;
    return o ? o.userData.i : null;
  }
  renderer.domElement.addEventListener("pointerdown", (e) => { inicioToque = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener("pointerup", (e) => {
    if (inicioToque && Math.hypot(e.clientX - inicioToque[0], e.clientY - inicioToque[1]) < 10) {
      const i = parcelaEn(e.clientX, e.clientY);
      if (i !== null) alTocar(i);
    }
    inicioToque = null;
  });

  // --- bucle de animación ---
  const cosechando = new Map<number, number>();
  const listas: boolean[] = Array(N_PARCELAS).fill(false);
  let resaltada: number | null = null;
  const reloj = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(reloj.getDelta(), 0.05), ahora = reloj.elapsedTime;
    if (!ctrl.enabled) {  // vuelo de entrada (2,2 s)
      const k = suave(ahora / 2.2);
      camara.position.lerpVectors(inicio, destino, k);
      camara.lookAt(ctrl.target);
      if (k >= 1) ctrl.enabled = true;
    }
    ctrl.update();
    anillos.forEach((a, i) => {
      if (!a.visible) return;
      a.rotation.z += dt * 2;
      a.position.y = H(a.position.x, a.position.z) + tam * 3.4 + Math.sin(ahora * 4 + i) * tam * 0.15;
    });
    for (const fila of plantas) for (const g of fila) {
      if (!g.visible || cosechando.has(g.userData.i)) continue;
      const u = g.userData;
      const crecer = u.nace >= 0 ? rebote(Math.max(0, ahora - u.nace) / 0.7) : 1;
      g.scale.setScalar((u.objetivo ?? 1) * crecer);
      if (u.sprite) {  // brisa: la planta se estira y se mece apenas
        u.sprite.scale.y = u.alto * (1 + (u.marchita ? 0 : 0.035 * Math.sin(ahora * 1.6 + u.fase)));
        u.sprite.material.rotation = 0;
        g.rotation.z = 0;
      } else g.rotation.z = u.marchita ? 0.45 : Math.sin(ahora * 1.6 + u.fase) * 0.06;
    }
    // el sol camina despacio solo; cuando el juego avanza días, alcanza la meta a paso rápido pero continuo
    const falta = meta - fase;
    fase += falta > 0 ? Math.min(falta, dt * 0.6) : dt / 90;
    if (meta < fase) meta = fase;
    pintarCielo();
    nubes.forEach((nube, k) => { nube.position.x += dt * S * 0.03 * (1 + k * 0.1); if (nube.position.x > S * 8) nube.position.x = -S * 8; });
    if (lluvia.visible) {
      const p = gotas.attributes.position as THREE.BufferAttribute;
      for (let k = 0; k < nG; k++) { let y = p.getY(k) - dt * S * 1.1; if (y < 0) y = S * 1.2; p.setY(k, y); }
      p.needsUpdate = true;
    }
    for (let c = chorros.length - 1; c >= 0; c--) {
      const ch = chorros[c], k = (ahora - ch.t0) / 1.4;
      ch.p.position.y -= dt * tam * 2;
      (ch.p.material as THREE.PointsMaterial).opacity = 0.9 * (1 - k);
      if (k >= 1) { escena.remove(ch.p); (ch.p.material as THREE.Material).dispose(); chorros.splice(c, 1); }
    }
    for (const [i, t0] of cosechando) {
      const k = (ahora - t0) / 0.9;
      plantas[i].forEach((g, j) => { g.position.y += dt * tam * (2 + (j % 3)); g.scale.multiplyScalar(0.93); });
      if (k >= 1) { plantas[i].forEach((g) => { g.visible = false; g.position.y = H(g.position.x, g.position.z) + 0.3 * tam; }); cosechando.delete(i); }
    }
    renderer.render(escena, camara);
  });
  const alRedimensionar = () => {
    renderer.setSize(cont.clientWidth, cont.clientHeight);
    camara.aspect = cont.clientWidth / cont.clientHeight;
    camara.updateProjectionMatrix();
  };
  // el mundo ocupa solo el hueco bajo la barra de arriba: se redibuja cuando esa caja cambia de tamaño
  const vigia = new ResizeObserver(alRedimensionar);
  vigia.observe(cont);
  window.addEventListener("resize", alRedimensionar);

  return {
    actualizar(vista, colorSuelo, lloviendo) {
      const c = new THREE.Color(colorSuelo);
      matSuelo.forEach((m) => m.color.copy(c));
      lluvia.visible = lloviendo;
      lloviendoAhora = lloviendo;
      vista.forEach((v, i) => {
        plantas[i].forEach((g, k) => {
          if (cosechando.has(i)) return;
          const ver = !!v.crop && v.etapa > 0;
          g.visible = ver;
          if (!ver) { g.userData.clave = ""; g.userData.etapa = 0; return; }
          const clave = `${v.familia}|${v.etapa}|${v.marchita}`;
          if (g.userData.clave !== clave) {
            const cambioEtapa = g.userData.etapa !== v.etapa;
            armarPlanta(g, v);
            g.userData.clave = clave;
            g.userData.etapa = v.etapa;
            if (cambioEtapa) g.userData.nace = reloj.elapsedTime + k * 0.04;  // aparecen con un saltito, una tras otra
          }
          g.userData.objetivo = tam * ESCALA[v.etapa] * (0.85 + (k % 3) * 0.08);
        });
        listas[i] = v.lista;
        anillos[i].visible = v.lista || resaltada === i;
      });
    },
    alTocar(cb) { alTocar = cb; },
    pasarTiempo(dias) { meta = Math.min(meta + Math.min(dias, 1), fase + 1.2); },
    parcelaEn,
    resaltar(i) {
      resaltada = i;
      anillos.forEach((a, k) => (a.visible = k === i || listas[k]));
    },
    cosechar(i) { cosechando.set(i, reloj.elapsedTime); anillos[i].visible = false; },
    posicion(i) {
      const [xc, zc] = centros[i];
      const v = new THREE.Vector3(xc, H(xc, zc) + tam * 1.5, zc).project(camara);
      const r = renderer.domElement.getBoundingClientRect();
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
    },
    regar(i) {
      const p = new THREE.Points(geoChorro, matChorro.clone());
      const [xc, zc] = centros[i];
      p.position.set(xc, H(xc, zc) + tam * 3, zc);
      escena.add(p);
      chorros.push({ p, t0: reloj.elapsedTime });
    },
    destruir() {
      renderer.setAnimationLoop(null);
      window.removeEventListener("resize", alRedimensionar);
      vigia.disconnect();
      ctrl.dispose();
      escena.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        mats.forEach((x) => x.dispose());
      });
      gradiente.dispose();
      texSombra.dispose();
      texSuelo.dispose();
      texCama.dispose();
      texturas.forEach((tx) => tx.dispose());
      matsPlanta.forEach((m) => m.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
