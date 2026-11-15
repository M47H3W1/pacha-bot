// Mundo 2D de respaldo (sin WebGL): vista de lado con las cuatro franjas y plantas en emoji.
import type { Mundo, VistaParcela } from "./mundo";
import { N_PARCELAS } from "./estado";

const TAM = ["", "0.9rem", "1.5rem", "2.1rem", "2.3rem"];

export function crearMundo2D(cont: HTMLElement, desnivel: number): Mundo {
  const caja = document.createElement("div");
  caja.className = "mundo2d";
  caja.innerHTML = `
    <svg class="fondo2d" viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="400" height="220" fill="#9fd0ee"/>
      <path d="M220 120 L300 40 Q312 30 324 40 L400 110 L400 220 L160 220 Z" fill="#7d8a9a"/>
      <path d="M286 54 L300 40 Q312 30 324 40 L338 54 Q326 60 318 55 Q310 62 300 56 Q294 60 286 54 Z" fill="#f6f8fb"/>
      <path d="M0 ${150 - Math.min(desnivel, 40)} Q200 110 400 140 L400 220 L0 220 Z" fill="#7fae4a"/>
    </svg>
    <div class="franjas2d">${Array.from({ length: N_PARCELAS }, (_, i) =>
      `<button class="franja2d" data-i="${i}" aria-label="Parcela ${i + 1}"><span class="plantas2d"></span></button>`).join("")}</div>`;
  cont.appendChild(caja);
  let alTocar: (i: number) => void = () => {};
  const botones = [...caja.querySelectorAll<HTMLButtonElement>(".franja2d")];
  botones.forEach((b) => b.addEventListener("click", () => alTocar(Number(b.dataset.i))));
  return {
    actualizar(vista: VistaParcela[], colorSuelo: string, lloviendo: boolean) {
      caja.classList.toggle("lloviendo", lloviendo);
      vista.forEach((v, i) => {
        const b = botones[i];
        b.style.background = colorSuelo;
        b.classList.toggle("lista", v.lista);
        b.classList.toggle("marchita", v.marchita);
        const p = b.querySelector<HTMLElement>(".plantas2d")!;
        p.textContent = v.crop && v.etapa > 0 ? (v.etapa === 1 ? "🌱" : v.etapa === 2 ? "🌿" : v.emoji).repeat(6) : "";
        p.style.fontSize = TAM[v.etapa] || "1rem";
      });
    },
    alTocar(cb) { alTocar = cb; },
    parcelaEn(x, y) {
      const el = document.elementFromPoint(x, y)?.closest<HTMLElement>(".franja2d");
      return el ? Number(el.dataset.i) : null;
    },
    resaltar(i) { botones.forEach((b, k) => b.classList.toggle("resaltada", k === i)); },
    regar(i) { botones[i].classList.add("regando"); setTimeout(() => botones[i].classList.remove("regando"), 1200); },
    cosechar(i) { botones[i].classList.add("cosechando"); setTimeout(() => botones[i].classList.remove("cosechando"), 800); },
    destruir() { caja.remove(); },
  };
}
