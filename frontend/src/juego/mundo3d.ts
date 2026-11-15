// Mundo 3D low-poly con three.js (se carga solo cuando hace falta). Escala real en metros.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Mundo, Terreno, VistaParcela } from "./mundo";
import { N_PARCELAS } from "./estado";

const EXAGERACION = 1.6; // relieve un poco más marcado para que se lea en pantalla

const FAMILIA: Record<string, { hoja: number; flor: number; fruto: number; forma: "mata" | "espiga" | "rastrera" }> = {
  solanacea: { hoja: 0x3f8f3a, flor: 0xf3e9ff, fruto: 0x9b6b3d, forma: "mata" },
  poacea: { hoja: 0x8fbf4a, flor: 0xe8c547, fruto: 0xe2b33a, forma: "espiga" },
  fabacea: { hoja: 0x3d9b4f, flor: 0xffffff, fruto: 0x6fbf5a, forma: "mata" },
  amarantacea: { hoja: 0x5b9b3a, flor: 0xe8573a, fruto: 0xd8442b, forma: "espiga" },
  basellacea: { hoja: 0x4aa04a, flor: 0xf7d54a, fruto: 0xf2c230, forma: "rastrera" },
  oxalidacea: { hoja: 0x4f9a3d, flor: 0xf7e05a, fruto: 0xef7d2c, forma: "rastrera" },
  pasto: { hoja: 0x58b04f, flor: 0xffffff, fruto: 0x58b04f, forma: "rastrera" },
  ninguna: { hoja: 0x7fb85a, flor: 0xffffff, fruto: 0x7fb85a, forma: "rastrera" },
};
const ESCALA = [0, 0.28, 0.6, 1, 0.95];
const POR_FRANJA = 12;

export function hayWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch {
    return false;
  }
}

export function crearMundo3D(cont: HTMLElement, t: Terreno, elev: number): Mundo {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(cont.clientWidth, cont.clientHeight);
  cont.appendChild(renderer.domElement);
  renderer.domElement.classList.add("lienzo3d");

  const escena = new THREE.Scene();
  const alto = Math.max(0, Math.min(1, (elev - 2400) / 1400));
  const cielo = new THREE.Color().lerpColors(new THREE.Color(0x9fd0ee), new THREE.Color(0x3f7fc8), alto);
  escena.background = cielo;
  const L = t.lado_m;
  escena.fog = new THREE.Fog(cielo, L * 1.4, L * 5);

  // --- altura del terreno (bilineal sobre la grilla real) ---
  const n = t.n, paso = L / (n - 1);
  const H = (x: number, z: number) => {
    const fx = Math.max(0, Math.min(n - 1.0001, (x + L / 2) / paso));
    const fz = Math.max(0, Math.min(n - 1.0001, (z + L / 2) / paso));
    const j = Math.floor(fx), i = Math.floor(fz), dx = fx - j, dz = fz - i;
    const a = t.alturas[i][j], b = t.alturas[i][j + 1], c = t.alturas[i + 1][j], d = t.alturas[i + 1][j + 1];
    const h = a * (1 - dx) * (1 - dz) + b * dx * (1 - dz) + c * (1 - dx) * dz + d * dx * dz;
    return (h - t.centro) * EXAGERACION;
  };

  // --- terreno: chacras en franjas dentro del círculo, páramo afuera ---
  const seg = 72;
  const geo = new THREE.PlaneGeometry(L * 1.6, L * 1.6, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colores = new Float32Array(pos.count * 3);
  const franjas = [0x7fae4a, 0xa9c45a, 0xc9b257, 0x6f9a3e, 0xb08a52, 0x8fbf5c].map((c) => new THREE.Color(c));
  const paramo = new THREE.Color(0x8d9f6a), tmp = new THREE.Color();
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k), z = pos.getZ(k);
    pos.setY(k, H(x, z));
    const r = Math.hypot(x, z);
    if (r <= L / 2) tmp.copy(franjas[Math.abs(Math.floor((z + x * 0.25) / (L / 9))) % franjas.length]);
    else tmp.copy(paramo).offsetHSL(0, 0, ((Math.sin(x * 0.07) + Math.cos(z * 0.05)) * 0.03));
    colores.set([tmp.r, tmp.g, tmp.b], k * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colores, 3));
  geo.computeVertexNormals();
  escena.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));

  // borde de su tierra
  const borde: THREE.Vector3[] = [];
  for (let a = 0; a <= 64; a++) {
    const x = Math.cos((a / 64) * Math.PI * 2) * L / 2, z = Math.sin((a / 64) * Math.PI * 2) * L / 2;
    borde.push(new THREE.Vector3(x, H(x, z) + 0.4, z));
  }
  escena.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(borde),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })));

  // suelo lejano y volcán nevado (decorativos)
  const lejos = new THREE.Mesh(new THREE.CircleGeometry(L * 6, 24), new THREE.MeshLambertMaterial({ color: 0x7f9a5e }));
  lejos.rotation.x = -Math.PI / 2;
  lejos.position.y = Math.min(...[H(-L * 0.8, -L * 0.8), H(L * 0.8, L * 0.8), H(0, 0)]) - 2;
  escena.add(lejos);
  const volcan = new THREE.Mesh(new THREE.ConeGeometry(L * 1.1, L * 1.0, 9), new THREE.MeshLambertMaterial({ color: 0x7d8a9a, flatShading: true }));
  volcan.position.set(L * 0.6, lejos.position.y + L * 0.5, -L * 3);
  const nieve = new THREE.Mesh(new THREE.ConeGeometry(L * 0.38, L * 0.35, 9), new THREE.MeshLambertMaterial({ color: 0xf6f8fb, flatShading: true }));
  nieve.position.set(L * 0.6, lejos.position.y + L * 0.83, -L * 3);
  escena.add(volcan, nieve);

  // luces (más intensas a mayor altura)
  escena.add(new THREE.HemisphereLight(0xdff1ff, 0x5b4a2f, 1.1 + alto * 0.3));
  const sol = new THREE.DirectionalLight(0xfff2d6, 1.6 + alto * 0.6);
  sol.position.set(L, L * 1.4, L * 0.6);
  escena.add(sol);

  // --- franjas de cultivo (parcelas del juego) ---
  const S = Math.max(14, Math.min(48, L * 0.34));
  const ancho = (S / N_PARCELAS) * 0.78;
  const parcelas: THREE.Mesh[] = [];
  const materialesSuelo: THREE.MeshLambertMaterial[] = [];
  const plantas: THREE.Group[][] = [];
  const resalte: THREE.Mesh[] = [];
  const geoTallo = new THREE.CylinderGeometry(0.05, 0.07, 1, 5);
  const geoMata = new THREE.IcosahedronGeometry(0.55, 0);
  const geoEspiga = new THREE.ConeGeometry(0.28, 1.4, 5);
  const geoRastrera = new THREE.SphereGeometry(0.5, 6, 4);
  const geoFlor = new THREE.SphereGeometry(0.13, 5, 4);
  const tam = S / 14;
  for (let i = 0; i < N_PARCELAS; i++) {
    const zc = -S / 2 + (i + 0.5) * (S / N_PARCELAS);
    const g = new THREE.PlaneGeometry(S, ancho, 24, 2);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < p.count; k++) p.setY(k, H(p.getX(k), p.getZ(k) + zc) + 0.12);
    g.computeVertexNormals();
    const m = new THREE.MeshLambertMaterial({ color: 0x8a5a33, flatShading: true });
    const malla = new THREE.Mesh(g, m);
    malla.position.z = zc;
    malla.userData.i = i;
    escena.add(malla);
    parcelas.push(malla);
    materialesSuelo.push(m);
    // anillo que indica dónde sembrar o cosechar
    const anillo = new THREE.Mesh(new THREE.TorusGeometry(ancho * 0.35, ancho * 0.06, 6, 20),
      new THREE.MeshBasicMaterial({ color: 0xffd34d }));
    anillo.rotation.x = -Math.PI / 2;
    anillo.position.set(S / 2 + ancho * 0.6, H(S / 2 + ancho * 0.6, zc) + 0.6, zc);
    anillo.visible = false;
    escena.add(anillo);
    resalte.push(anillo);
    const fila: THREE.Group[] = [];
    for (let k = 0; k < POR_FRANJA; k++) {
      const x = -S / 2 + (k % 6 + 0.5) * (S / 6), z = zc + (k < 6 ? -ancho * 0.22 : ancho * 0.22);
      const planta = new THREE.Group();
      planta.position.set(x, H(x, z) + 0.12, z);
      planta.rotation.y = k * 1.7;
      planta.visible = false;
      escena.add(planta);
      fila.push(planta);
    }
    plantas.push(fila);
  }

  const mats = new Map<number, THREE.MeshLambertMaterial>();
  const mat = (c: number) => {
    if (!mats.has(c)) mats.set(c, new THREE.MeshLambertMaterial({ color: c, flatShading: true }));
    return mats.get(c)!;
  };
  const SECA = 0x9b7a45, MADURA = 0xc9b04a;

  function armarPlanta(g: THREE.Group, v: VistaParcela) {
    g.clear();
    const f = FAMILIA[v.familia || "ninguna"] || FAMILIA.ninguna;
    const hoja = v.marchita ? SECA : v.etapa >= 4 ? MADURA : f.hoja;
    const tallo = new THREE.Mesh(geoTallo, mat(v.marchita ? SECA : 0x4f7f2f));
    tallo.position.y = 0.5;
    g.add(tallo);
    const copa = new THREE.Mesh(f.forma === "espiga" ? geoEspiga : f.forma === "mata" ? geoMata : geoRastrera, mat(hoja));
    copa.position.y = f.forma === "rastrera" ? 0.3 : 1.05;
    if (f.forma === "rastrera") copa.scale.set(1.3, 0.55, 1.3);
    g.add(copa);
    if (v.etapa === 3 && !v.marchita) {
      for (let k = 0; k < 3; k++) {
        const flor = new THREE.Mesh(geoFlor, mat(f.flor));
        flor.position.set(Math.cos(k * 2.1) * 0.4, 1.3, Math.sin(k * 2.1) * 0.4);
        g.add(flor);
      }
    }
    if (v.etapa >= 4 && !v.marchita) {
      const fruto = new THREE.Mesh(geoFlor, mat(f.fruto));
      fruto.scale.setScalar(2.2);
      fruto.position.set(0.35, f.forma === "espiga" ? 1.6 : 0.35, 0);
      g.add(fruto);
    }
    g.rotation.z = v.marchita ? 0.5 : 0;
  }

  // --- lluvia ---
  const gotas = new THREE.BufferGeometry();
  const nG = 500, pg = new Float32Array(nG * 3);
  for (let k = 0; k < nG; k++) pg.set([(Math.random() - 0.5) * S * 1.6, Math.random() * S, (Math.random() - 0.5) * S * 1.6], k * 3);
  gotas.setAttribute("position", new THREE.BufferAttribute(pg, 3));
  const lluvia = new THREE.Points(gotas, new THREE.PointsMaterial({ color: 0xcfe6ff, size: S / 160, transparent: true, opacity: 0.8 }));
  lluvia.visible = false;
  escena.add(lluvia);

  // --- cámara ---
  const camara = new THREE.PerspectiveCamera(45, cont.clientWidth / cont.clientHeight, 0.5, L * 12);
  const lejania = cont.clientWidth < cont.clientHeight ? 1.7 : 1; // en vertical se ve menos ancho
  camara.position.set(S * 1.25 * lejania, S * 1.15 * lejania, S * 1.9 * lejania);
  const ctrl = new OrbitControls(camara, renderer.domElement);
  ctrl.target.set(0, H(0, 0), 0);
  ctrl.enableDamping = true;
  ctrl.maxPolarAngle = Math.PI * 0.44;
  ctrl.minDistance = S * 0.5;
  ctrl.maxDistance = Math.max(S * 3, L * 1.3);
  ctrl.enablePan = false;

  // --- toques ---
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let alTocar: (i: number) => void = () => {};
  let inicio: [number, number] | null = null;
  function parcelaEn(cx: number, cy: number): number | null {
    const r = renderer.domElement.getBoundingClientRect();
    if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) return null;
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camara);
    const hit = ray.intersectObjects([...parcelas, ...plantas.flat()], true)[0];
    if (!hit) return null;
    let o: THREE.Object3D | null = hit.object;
    while (o && o.userData.i === undefined && !parcelas.includes(o as THREE.Mesh)) o = o.parent;
    if (o && o.userData.i !== undefined) return o.userData.i;
    // planta: buscar su franja
    for (let i = 0; i < plantas.length; i++) if (plantas[i].some((g) => g === hit.object.parent || g === hit.object)) return i;
    return null;
  }
  renderer.domElement.addEventListener("pointerdown", (e) => { inicio = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener("pointerup", (e) => {
    if (inicio && Math.hypot(e.clientX - inicio[0], e.clientY - inicio[1]) < 10) {
      const i = parcelaEn(e.clientX, e.clientY);
      if (i !== null) alTocar(i);
    }
    inicio = null;
  });

  // --- animación ---
  const cosechando = new Map<number, number>();
  const reloj = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(reloj.getDelta(), 0.05), ahora = reloj.elapsedTime;
    ctrl.update();
    resalte.forEach((a, i) => { if (a.visible) { a.rotation.z += dt * 2; a.position.y = H(a.position.x, a.position.z) + 0.6 + Math.sin(ahora * 4 + i) * 0.15; } });
    if (lluvia.visible) {
      const p = gotas.attributes.position as THREE.BufferAttribute;
      for (let k = 0; k < nG; k++) { let y = p.getY(k) - dt * S * 0.9; if (y < 0) y = S; p.setY(k, y); }
      p.needsUpdate = true;
    }
    for (const [i, t0] of cosechando) {
      const k = (ahora - t0) / 0.8;
      plantas[i].forEach((g, j) => { g.position.y += dt * tam * 3; g.scale.multiplyScalar(0.9 + j * 0.001); });
      if (k >= 1) { plantas[i].forEach((g) => (g.visible = false)); cosechando.delete(i); }
    }
    renderer.render(escena, camara);
  });
  const alRedimensionar = () => {
    renderer.setSize(cont.clientWidth, cont.clientHeight);
    camara.aspect = cont.clientWidth / cont.clientHeight;
    camara.updateProjectionMatrix();
  };
  window.addEventListener("resize", alRedimensionar);
  let resaltada: number | null = null;
  const listas: boolean[] = Array(N_PARCELAS).fill(false);

  return {
    actualizar(vista, colorSuelo, lloviendo) {
      const suelo = new THREE.Color(colorSuelo);
      materialesSuelo.forEach((m) => m.color.copy(suelo));
      lluvia.visible = lloviendo;
      vista.forEach((v, i) => {
        plantas[i].forEach((g, k) => {
          if (cosechando.has(i)) return;
          const ver = !!v.crop && v.etapa > 0;
          g.visible = ver;
          if (!ver) return;
          const clave = `${v.familia}|${v.etapa}|${v.marchita}`;
          if (g.userData.clave !== clave) { armarPlanta(g, v); g.userData.clave = clave; }
          const base = H(g.position.x, g.position.z) + 0.12;
          g.position.y = base;
          g.scale.setScalar(tam * ESCALA[v.etapa] * (0.85 + (k % 3) * 0.08));
        });
        listas[i] = v.lista;
        resalte[i].visible = v.lista || resaltada === i;
      });
    },
    alTocar(cb) { alTocar = cb; },
    parcelaEn,
    resaltar(i) {
      resaltada = i;
      resalte.forEach((a, k) => (a.visible = k === i || listas[k]));
    },
    cosechar(i) { cosechando.set(i, reloj.elapsedTime); resalte[i].visible = false; },
    destruir() {
      renderer.setAnimationLoop(null);
      window.removeEventListener("resize", alRedimensionar);
      ctrl.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
