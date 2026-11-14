"""Imágenes PNG grandes y legibles en celular."""
import io

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from matplotlib.patches import Polygon, Circle  # noqa: E402

from .catalog import MESES  # noqa: E402

VERDE, TIERRA, AZUL, CIELO, NIEVE = "#3a7d44", "#a0522d", "#2b6cb0", "#e8f1f8", "#9ec5e8"
plt.rcParams.update({"font.size": 15, "axes.titlesize": 19, "axes.titleweight": "bold",
                     "axes.spines.top": False, "axes.spines.right": False})


def _png(fig) -> bytes:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=110, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
    return buf.getvalue()


def banner() -> bytes:
    fig = plt.figure(figsize=(10, 5), facecolor="#fdf6e3")
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 5)
    ax.axis("off")
    ax.add_patch(Polygon([[0, 5], [10, 5], [10, 2.2], [0, 2.2]], color="#cfe8f5"))
    ax.add_patch(Circle((9.2, 4.3), 0.45, color="#f6b93b"))
    ax.add_patch(Polygon([[4.4, 2.2], [6.6, 4.3], [8.8, 2.2]], color="#7b8d93"))
    ax.add_patch(Polygon([[6.0, 3.73], [6.6, 4.3], [7.2, 3.73], [6.8, 3.83], [6.4, 3.68]], color="white"))
    ax.add_patch(Polygon([[7.0, 2.2], [8.6, 3.4], [10.4, 2.2]], color="#94a5aa"))
    colores = ["#6a994e", "#a7c957", "#bc6c25", "#dda15e", "#386641", "#90a955"]
    for i, c in enumerate(colores):  # chacras en franjas
        ax.add_patch(Polygon([[0, 2.2 - i * 0.37], [10, 2.2 - i * 0.37 + 0.15],
                              [10, 2.2 - (i + 1) * 0.37 + 0.15], [0, 2.2 - (i + 1) * 0.37]], color=c))
    ax.text(0.4, 4.25, "Pacha", fontsize=54, fontweight="bold", color="#3d2b1f")
    ax.text(0.45, 3.65, "Tu chacra con datos de la NASA", fontsize=20, color="#3d2b1f")
    ax.text(0.45, 3.25, "Sierra del Ecuador", fontsize=16, color="#5b4636", style="italic")
    return _png(fig)


def climograma(res: dict, titulo: str) -> bytes:
    fig, ax = plt.subplots(figsize=(10, 5.6), facecolor="white")
    x = np.arange(12)
    ax.bar(x, res["lluvia_mes"], color=AZUL, alpha=0.85, label="Lluvia (mm)")
    ax.plot(x, res["et0_mes"], color=TIERRA, lw=4, marker="o", label="Agua que se evapora (mm)")
    top = max(max(res["lluvia_mes"]), max(res["et0_mes"])) * 1.25
    for i, p in enumerate(res["prob_helada"]):
        if p >= 0.15:
            ax.text(i, top * 0.93, "❄" if p < 0.3 else "❄❄", ha="center", fontsize=18, color=NIEVE,
                    fontfamily="DejaVu Sans")
    ax.set_ylim(0, top)
    ax.set_xticks(x, [m.capitalize() for m in MESES])
    ax.set_ylabel("milímetros al mes")
    ax.set_title(titulo)
    ax.legend(loc="upper left", frameon=False, fontsize=13)
    ax.text(0.99, -0.16, "❄ = riesgo de helada   ·   Datos: NASA POWER corregido", transform=ax.transAxes,
            ha="right", fontsize=11, color="gray")
    return _png(fig)


def banco(b: dict, titulo: str, eficiencia: float) -> bytes:
    fig, ax = plt.subplots(figsize=(10, 5.8), facecolor="white")
    x = np.arange(len(b["meses"]))
    w = 0.38
    ax.bar(x - w / 2, b["lluvia_util"], w, color=VERDE, label="Entra: lluvia útil")
    ax.bar(x + w / 2, b["gasto"], w, color=TIERRA, label="Sale: gasto del cultivo")
    riego = [f / eficiencia for f in b["falta"]]
    for i, r in enumerate(riego):
        if r >= 1:
            ax.annotate(f"Riega\n{r:.0f} L/m²", (x[i] + w / 2, b["gasto"][i]), xytext=(0, 8),
                        textcoords="offset points", ha="center", fontsize=12, color=AZUL, fontweight="bold")
    ax.set_xticks(x, [m.capitalize() for m in b["meses"]])
    ax.set_ylabel("litros por m² al mes")
    ax.set_ylim(0, max(max(b["lluvia_util"]), max(b["gasto"])) * 1.35)
    ax.set_title(titulo)
    ax.legend(loc="upper left", frameon=False, fontsize=13)
    return _png(fig)


def rotaciones(res: list[dict]) -> bytes:
    fig, ax = plt.subplots(figsize=(10, 5.4), facecolor="white")
    nombres = [f"{e['nombre']}\n{' → '.join(c.nombre for c in e['crops'])}" for e in res]
    y = np.arange(len(res))[::-1]
    colores = ["#9e9e9e" if e["nombre"] == "Tu rotación" else VERDE for e in res]
    ax.barh(y, [e["puntaje"] for e in res], color=colores, height=0.55)
    for yi, e in zip(y, res):
        ax.text(e["puntaje"] + 1.5, yi, f"{e['puntaje']}", va="center", fontsize=18, fontweight="bold")
        ax.text(2, yi - 0.38, f"riego {e['falta_anual']:.0f} L/m² al año · suelo cubierto "
                f"{e['cubierto'] * 100:.0f} %", fontsize=11, color="#333")
    ax.set_yticks(y, nombres, fontsize=13)
    ax.set_xlim(0, 110)
    ax.set_xlabel("Puntaje (agua, suelo, helada e ingreso)")
    ax.set_title("¿Qué rotación cuida mejor tu terreno?")
    return _png(fig)


def recomendados(filas: list[dict], mes: str) -> bytes:
    fig, ax = plt.subplots(figsize=(10, 4.6), facecolor="white")
    y = np.arange(len(filas))[::-1]
    ax.barh(y, [f["puntaje"] for f in filas], color=VERDE, height=0.55)
    for yi, f in zip(y, filas):
        ax.text(f["puntaje"] + 1.5, yi, str(f["puntaje"]), va="center", fontsize=18, fontweight="bold")
        ax.text(2, yi, f"riego {f['falta']:.0f} L/m² en el ciclo", va="center", fontsize=13, color="white",
                fontweight="bold")
    ax.set_yticks(y, [f["crop"].nombre for f in filas], fontsize=16)
    ax.set_xlim(0, 110)
    ax.set_title(f"Mejores cultivos para sembrar en {mes}")
    return _png(fig)


# ---------------------------------------------------------------- pictogramas para el modo campo
def _gota(ax, x, y, s=1.0, color=AZUL):
    t = np.linspace(0, 2 * np.pi, 60)
    xs = x + 0.36 * s * np.sin(t) * np.sin(t / 2)  # gota clásica: punta arriba, base redonda
    ys = y + 0.38 * s * np.cos(t)
    ax.fill(xs, ys, color=color, zorder=3)


def _sol(ax, x, y, s=1.0):
    for a in np.linspace(0, 2 * np.pi, 9)[:-1]:
        ax.plot([x + 0.28 * s * np.cos(a), x + 0.42 * s * np.cos(a)],
                [y + 0.28 * s * np.sin(a), y + 0.42 * s * np.sin(a)], color="#f6b93b", lw=3, zorder=3)
    ax.add_patch(Circle((x, y), 0.22 * s, color="#f6b93b", zorder=4))


def _nube(ax, x, y, s=1.0, color="#b0bec5"):
    for dx, dy, r in ((-0.18, 0, 0.16), (0.0, 0.08, 0.2), (0.2, 0, 0.15)):
        ax.add_patch(Circle((x + dx * s, y + dy * s), r * s, color=color, zorder=3))


def _copo(ax, x, y, s=1.0):
    ax.text(x, y, "❄", ha="center", va="center", fontsize=30 * s, color="#4fa3e0", zorder=5,
            fontfamily="DejaVu Sans")


def tira_meses(tipos: list[str], heladas: list[int], titulo: str) -> bytes:
    """12 meses con un dibujo cada uno: gota (llueve), sol (seco), nube (medio) y copo (helada)."""
    fig = plt.figure(figsize=(12, 3.6), facecolor="white")
    ax = fig.add_axes([0, 0, 1, 0.84])
    ax.set_xlim(-0.6, 11.6)
    ax.set_ylim(-0.9, 1.5)
    ax.axis("off")
    for i, t in enumerate(tipos):
        ax.add_patch(plt.Rectangle((i - 0.46, -0.85), 0.92, 2.25, color="#f4f8fb" if t != "seco" else "#fff7e6",
                                   zorder=1))
        if t == "lluvia":
            _gota(ax, i, 0.45)
        elif t == "seco":
            _sol(ax, i, 0.45)
        else:
            _nube(ax, i, 0.45)
        if i in heladas:
            _copo(ax, i, 1.15, 0.8)
        ax.text(i, -0.55, MESES[i].capitalize(), ha="center", fontsize=17, fontweight="bold", color="#333")
    fig.suptitle(titulo, fontsize=20, fontweight="bold", y=0.98)
    return _png(fig)


def tira_semana(dias: list[dict], titulo: str) -> bytes:
    """7 días: gota grande = regar, copo = helada, nube = lluvia. dias: {fecha, regar, helada, lluvia}."""
    nombres = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
    fig = plt.figure(figsize=(11, 3.8), facecolor="white")
    ax = fig.add_axes([0, 0, 1, 0.84])
    ax.set_xlim(-0.6, len(dias) - 0.4)
    ax.set_ylim(-1.0, 1.6)
    ax.axis("off")
    for i, d in enumerate(dias):
        ax.add_patch(plt.Rectangle((i - 0.46, -0.95), 0.92, 2.45, color="#e3f2fd" if d["regar"] else "#f5f5f5",
                                   zorder=1))
        if d["regar"]:
            _gota(ax, i, 0.45, 1.25)
            ax.text(i, -0.3, "Regar", ha="center", fontsize=14, fontweight="bold", color=AZUL)
        elif d["lluvia"] >= 5:
            _nube(ax, i, 0.5)
            ax.text(i, -0.3, "Lluvia", ha="center", fontsize=13, color="#607d8b")
        if d["helada"]:
            _copo(ax, i, 1.2, 0.85)
        f = d["fecha"]
        ax.text(i, -0.75, f"{nombres[f.weekday()]} {f.day}", ha="center", fontsize=16, fontweight="bold", color="#333")
    fig.suptitle(titulo, fontsize=20, fontweight="bold", y=0.98)
    return _png(fig)


COLOR_CULTIVO = {"solanacea": "#8d6e63", "poacea": "#d4a017", "fabacea": "#43a047", "amarantacea": "#e65100",
                 "basellacea": "#f9a825", "oxalidacea": "#ef6c00", "pasto": "#2e7d32", "ninguna": "#a1887f"}


def tarjeta_cultivos(crops: list, titulo: str, flechas: bool = True) -> bytes:
    """Cajas grandes con el nombre de cada cultivo; con flechas si es una rotación, con números si es una lista."""
    n = len(crops)
    fig = plt.figure(figsize=(3.6 * n + 0.6, 3.4), facecolor="white")
    ax = fig.add_axes([0, 0, 1, 0.8])
    ax.set_xlim(0, 3.6 * n + 0.6)
    ax.set_ylim(0, 2)
    ax.axis("off")
    for i, c in enumerate(crops):
        x0 = 0.4 + i * 3.6
        ax.add_patch(matplotlib.patches.FancyBboxPatch((x0, 0.25), 2.7, 1.5, boxstyle="round,pad=0.08",
                                                       color=COLOR_CULTIVO.get(c.familia, VERDE)))
        ax.text(x0 + 1.35, 1.0, c.nombre, ha="center", va="center", fontsize=24 if len(c.nombre) < 9 else 19,
                fontweight="bold", color="white")
        if not flechas:
            ax.text(x0 + 0.25, 1.55, str(i + 1), fontsize=18, fontweight="bold", color="white", va="center")
        if flechas and i < n - 1:
            ax.annotate("", xy=(x0 + 3.45, 1.0), xytext=(x0 + 2.85, 1.0),
                        arrowprops=dict(arrowstyle="-|>", lw=4, color="#555", mutation_scale=28))
    fig.suptitle(titulo, fontsize=20, fontweight="bold", y=0.97)
    return _png(fig)
