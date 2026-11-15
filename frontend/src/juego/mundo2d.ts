// Mundo sin 3D (teléfonos sin WebGL o ?sin3d): la misma granja dibujada en 2D con el estilo del juego.
// Paisaje andino con cielo que pasa del día a la noche, volcanes, chacras en franjas, casa y árboles; las cuatro parcelas (2 x 2)
// se ven en perspectiva con tierra arada y 3 x 3 plantas de pie con las ilustraciones de cada cultivo.
import type { Mundo, VistaParcela } from "./mundo";
import { N_PARCELAS } from "./estado";
import { icono } from "./iconos";
import { t } from "./i18n";
import { ic } from "./ui";

const TAM = ["0px", "34%", "58%", "92%", "92%"];
const mezclar = (a: number[], b: number[], k: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(",")})`;
const escalon = (a: number, b: number, x: number) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

const PAISAJE2D = `
  <rect class="cielo2d" width="800" height="600" fill="#9fd0ee"/>
  <g class="estrellas2d" opacity="0">${Array.from({ length: 50 }, (_, k) => `<circle cx="${(k * 131) % 800}" cy="${(k * 47) % 260}" r="${k % 3 ? 1.2 : 2}" fill="#fff"/>`).join("")}</g>
  <circle class="sol2d" r="34" fill="#ffd84d"/><circle class="luna2d" r="24" fill="#fff3c2"/>
  <g class="nubes2d" fill="#fff" opacity=".95"><ellipse cx="150" cy="110" rx="60" ry="20"/><ellipse cx="185" cy="96" rx="38" ry="24"/><ellipse cx="560" cy="80" rx="52" ry="18"/><ellipse cx="590" cy="68" rx="30" ry="18"/></g>
  <path d="M150 330 L320 120 Q340 98 360 120 L540 330Z" fill="#8a99ad"/><path d="M292 156 L320 120 Q340 98 360 120 L388 156 Q374 166 362 159 Q350 172 338 162 Q324 170 312 162 Q302 167 292 156Z" fill="#fbfdff"/>
  <path d="M500 340 L640 190 Q654 178 668 190 L800 320 V350Z" fill="#7f90a6"/><path d="M618 214 L640 190 Q654 178 668 190 L690 214 Q676 222 664 216 Q652 226 640 218 Q630 224 618 214Z" fill="#fbfdff"/>
  <path d="M0 330 Q160 285 330 310 T640 300 T800 296 V600 H0Z" fill="#86bd52"/>
  <path d="M0 350 Q120 325 250 336 L242 362 Q120 354 0 380Z" fill="#c5d86d"/><path d="M250 336 Q420 318 590 330 L582 356 Q420 350 242 362Z" fill="#e9c46a"/>
  <path d="M590 330 Q700 320 800 324 V350 Q700 348 582 356Z" fill="#a7c957"/>
  <path d="M0 380 Q120 354 242 362 L232 392 Q120 388 0 412Z" fill="#6aa84f"/><path d="M242 362 Q420 350 582 356 L572 386 Q420 382 232 392Z" fill="#d4a373"/>
  <g transform="translate(640 300)"><rect width="74" height="42" rx="6" fill="#f1d9b5" stroke="#6e3f17" stroke-width="3"/>
    <path d="M-10 3 L37 -30 L84 3Z" fill="#c0533a" stroke="#6e3f17" stroke-width="3" stroke-linejoin="round"/><rect x="28" y="16" width="16" height="26" rx="2" fill="#8a5a33"/><rect x="52" y="12" width="13" height="11" fill="#5aa9d6" class="ventana2d"/></g>
  ${[[70, 330, 1], [120, 318, 0.8], [740, 330, 1], [600, 334, 0.75], [30, 360, 0.9]].map(([x, y, e]) => `<g transform="translate(${x} ${y}) scale(${e})"><rect x="-4" y="-6" width="8" height="26" rx="3" fill="#8d5a2b"/><circle cy="-18" r="22" fill="#4caf50"/><circle cx="-8" cy="-24" r="10" fill="#66bb6a"/></g>`).join("")}
  <rect class="noche2d" width="800" height="600" fill="#101c3f" opacity="0" pointer-events="none"/>`;

export function crearMundo2D(cont: HTMLElement, desnivel: number): Mundo {
  void desnivel;
  const caja = document.createElement("div");
  caja.className = "mundo2d";
  caja.innerHTML = `
    <svg class="fondo2d" viewBox="0 0 800 600" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${PAISAJE2D}</svg>
    <div class="campo2d"><div class="franjas2d">${Array.from({ length: N_PARCELAS }, (_, i) =>
      `<button class="franja2d" data-i="${i}" aria-label="${t("Parcela", "Plot")} ${i + 1}"><span class="plantas2d">${Array.from({ length: 9 }, () => `<span class="planta2d-hueco"></span>`).join("")}</span></button>`).join("")}</div></div>`;
  cont.appendChild(caja);
  let alTocar: (i: number) => void = () => {};
  const botones = [...caja.querySelectorAll<HTMLButtonElement>(".franja2d")];
  botones.forEach((b) => b.addEventListener("click", () => alTocar(Number(b.dataset.i))));
  const cielo = caja.querySelector<SVGRectElement>(".cielo2d")!, noche = caja.querySelector<SVGRectElement>(".noche2d")!;
  const solC = caja.querySelector<SVGCircleElement>(".sol2d")!, lunaC = caja.querySelector<SVGCircleElement>(".luna2d")!;
  const estrellas = caja.querySelector<SVGGElement>(".estrellas2d")!, ventana = caja.querySelector<SVGRectElement>(".ventana2d")!;
  let fase = 0.3, meta = 0.3, antes = performance.now(), vivo = true;
  const claves: string[] = [];
  const cuadro = (ahora: number) => {
    if (!vivo) return;
    const dt = Math.min(0.05, (ahora - antes) / 1000);
    antes = ahora;
    const falta = meta - fase;
    fase += falta > 0 ? Math.min(falta, dt * 0.6) : dt / 90;
    if (meta < fase) meta = fase;
    const th = (fase - 0.25) * Math.PI * 2, alto = Math.sin(th), dia = escalon(-0.12, 0.25, alto);
    solC.setAttribute("cx", String(400 + Math.cos(th) * 360)); solC.setAttribute("cy", String(320 - alto * 270));
    lunaC.setAttribute("cx", String(400 - Math.cos(th) * 360)); lunaC.setAttribute("cy", String(320 + alto * 270));
    const ocaso = Math.exp(-Math.pow(alto / 0.18, 2));
    const base = [16, 28, 63].map((v, k) => v + ([159, 208, 238][k] - v) * dia);
    cielo.setAttribute("fill", mezclar(base, [244, 162, 107], ocaso * 0.5));
    noche.setAttribute("opacity", String(0.5 * (1 - dia)));
    estrellas.setAttribute("opacity", String(1 - dia));
    ventana.setAttribute("fill", dia < 0.4 ? "#ffd166" : "#5aa9d6");
    requestAnimationFrame(cuadro);
  };
  requestAnimationFrame(cuadro);
  return {
    actualizar(vista: VistaParcela[], colorSuelo: string, lloviendo: boolean) {
      caja.classList.toggle("lloviendo", lloviendo);
      vista.forEach((v, i) => {
        const b = botones[i];
        b.style.setProperty("--tierra", colorSuelo);
        b.classList.toggle("lista", v.lista);
        b.classList.toggle("marchita", v.marchita);
        const clave = `${v.crop}|${v.etapa}`;
        if (claves[i] === clave) return;
        claves[i] = clave;
        const una = v.crop && v.etapa > 0 ? (v.etapa <= 1 ? ic("brote", "planta2d") : icono(v.crop, "planta2d")) : "";
        b.querySelectorAll<HTMLElement>(".planta2d-hueco").forEach((h, k) => {
          h.innerHTML = una;
          h.style.setProperty("--tam", TAM[v.etapa] || "0px");
          h.style.setProperty("--retraso", `${k * 40}ms`);
        });
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
