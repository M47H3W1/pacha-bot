// Mundo 2D de respaldo (sin WebGL): vista de lado con las cuatro parcelas (2 x 2), plantas en SVG y el mismo paso del día a la noche.
import type { Mundo, VistaParcela } from "./mundo";
import { N_PARCELAS } from "./estado";
import { icono } from "./iconos";
import { ic } from "./ui";

const TAM = ["", "26px", "34px", "44px", "48px"];
const mezclar = (a: number[], b: number[], k: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(",")})`;
const escalon = (a: number, b: number, x: number) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

export function crearMundo2D(cont: HTMLElement, desnivel: number): Mundo {
  const caja = document.createElement("div");
  caja.className = "mundo2d";
  caja.innerHTML = `
    <svg class="fondo2d" viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect class="cielo2d" width="400" height="220" fill="#9fd0ee"/>
      <g class="estrellas2d" opacity="0">${Array.from({ length: 30 }, (_, k) => `<circle cx="${(k * 131) % 400}" cy="${(k * 47) % 110}" r="${k % 3 ? 0.8 : 1.3}" fill="#fff"/>`).join("")}</g>
      <circle class="sol2d" r="14" fill="#ffd84d"/><circle class="luna2d" r="10" fill="#fff3c2"/>
      <path d="M220 120 L300 40 Q312 30 324 40 L400 110 L400 220 L160 220 Z" fill="#7d8a9a"/>
      <path d="M286 54 L300 40 Q312 30 324 40 L338 54 Q326 60 318 55 Q310 62 300 56 Q294 60 286 54 Z" fill="#f6f8fb"/>
      <path d="M0 ${150 - Math.min(desnivel, 40)} Q200 110 400 140 L400 220 L0 220 Z" fill="#7fae4a"/>
      <rect class="noche2d" width="400" height="220" fill="#101c3f" opacity="0" pointer-events="none"/>
    </svg>
    <div class="franjas2d">${Array.from({ length: N_PARCELAS }, (_, i) =>
      `<button class="franja2d" data-i="${i}" aria-label="Parcela ${i + 1}"><span class="plantas2d"></span></button>`).join("")}</div>`;
  cont.appendChild(caja);
  let alTocar: (i: number) => void = () => {};
  const botones = [...caja.querySelectorAll<HTMLButtonElement>(".franja2d")];
  botones.forEach((b) => b.addEventListener("click", () => alTocar(Number(b.dataset.i))));
  const cielo = caja.querySelector<SVGRectElement>(".cielo2d")!, noche = caja.querySelector<SVGRectElement>(".noche2d")!;
  const solC = caja.querySelector<SVGCircleElement>(".sol2d")!, lunaC = caja.querySelector<SVGCircleElement>(".luna2d")!;
  const estrellas = caja.querySelector<SVGGElement>(".estrellas2d")!;
  let fase = 0.3, meta = 0.3, antes = performance.now(), vivo = true, claves: string[] = [];
  const cuadro = (ahora: number) => {
    if (!vivo) return;
    const dt = Math.min(0.05, (ahora - antes) / 1000);
    antes = ahora;
    const falta = meta - fase;
    fase += falta > 0 ? Math.min(falta, dt * 0.6) : dt / 90;
    if (meta < fase) meta = fase;
    const th = (fase - 0.25) * Math.PI * 2, alto = Math.sin(th), dia = escalon(-0.12, 0.25, alto);
    solC.setAttribute("cx", String(200 + Math.cos(th) * 180)); solC.setAttribute("cy", String(150 - alto * 120));
    lunaC.setAttribute("cx", String(200 - Math.cos(th) * 180)); lunaC.setAttribute("cy", String(150 + alto * 120));
    const ocaso = Math.exp(-Math.pow(alto / 0.18, 2));
    const base = [16, 28, 63].map((v, k) => v + ([159, 208, 238][k] - v) * dia);
    cielo.setAttribute("fill", mezclar(base, [244, 162, 107], ocaso * 0.5));
    noche.setAttribute("opacity", String(0.45 * (1 - dia)));
    estrellas.setAttribute("opacity", String(1 - dia));
    requestAnimationFrame(cuadro);
  };
  requestAnimationFrame(cuadro);
  return {
    actualizar(vista: VistaParcela[], colorSuelo: string, lloviendo: boolean) {
      caja.classList.toggle("lloviendo", lloviendo);
      vista.forEach((v, i) => {
        const b = botones[i];
        b.style.background = colorSuelo;
        b.classList.toggle("lista", v.lista);
        b.classList.toggle("marchita", v.marchita);
        const clave = `${v.crop}|${v.etapa}`;
        if (claves[i] === clave) return;
        claves[i] = clave;
        const p = b.querySelector<HTMLElement>(".plantas2d")!;
        const una = v.crop && v.etapa > 0 ? (v.etapa <= 2 ? ic("brote", "planta2d") : icono(v.crop, "planta2d")) : "";
        p.innerHTML = una.repeat(una ? 6 : 0);
        p.style.setProperty("--tam", TAM[v.etapa] || "26px");
      });
    },
    alTocar(cb) { alTocar = cb; },
    pasarTiempo(dias) { meta = Math.min(meta + Math.min(dias, 1), fase + 1.2); },
    parcelaEn(x, y) {
      const el = document.elementFromPoint(x, y)?.closest<HTMLElement>(".franja2d");
      return el ? Number(el.dataset.i) : null;
    },
    resaltar(i) { botones.forEach((b, k) => b.classList.toggle("resaltada", k === i)); },
    regar(i) { botones[i].classList.add("regando"); setTimeout(() => botones[i].classList.remove("regando"), 1200); },
    posicion(i) { const r = botones[i].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; },
    cosechar(i) { botones[i].classList.add("cosechando"); setTimeout(() => botones[i].classList.remove("cosechando"), 800); },
    destruir() { vivo = false; caja.remove(); },
  };
}
