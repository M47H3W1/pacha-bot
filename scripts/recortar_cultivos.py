"""Recorta los 18 íconos 3D de cultivos de la lámina del equipo (6 x 3, fondo ya transparente) y marca "IA"."""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ORDEN = ["papa", "haba", "cebada", "avena", "vicia", "trebol",
         "quinua", "chocho", "maiz", "frejol", "arveja", "trigo",
         "melloco", "oca", "alfalfa", "biomasa", "pasto", "fijadores"]
origen, destino = Path(sys.argv[1]), Path(sys.argv[2])
destino.mkdir(parents=True, exist_ok=True)
im = Image.open(origen).convert("RGBA")
W, H = im.size
cw, ch = W / 6, H / 3
try:
    fuente = ImageFont.truetype("arialbd.ttf", 15)
except OSError:
    fuente = ImageFont.load_default()
for k, nombre in enumerate(ORDEN):
    c, f = k % 6, k // 6
    celda = im.crop((round(c * cw), round(f * ch), round((c + 1) * cw), round((f + 1) * ch)))
    mascara = celda.getchannel("A").point(lambda v: 255 if v > 24 else 0)
    caja = mascara.getbbox()
    celda = celda.crop(caja)
    lado = int(max(celda.size) * 1.08)
    lienzo = Image.new("RGBA", (lado, lado), (0, 0, 0, 0))
    lienzo.paste(celda, ((lado - celda.width) // 2, (lado - celda.height) // 2), celda)
    lienzo = lienzo.resize((256, 256), Image.LANCZOS)
    d = ImageDraw.Draw(lienzo)
    d.text((256 - 22, 256 - 19), "IA", font=fuente, fill=(255, 255, 255, 200), stroke_width=2, stroke_fill=(60, 40, 30, 170))
    lienzo.save(destino / f"{nombre}.webp", "WEBP", quality=88, method=6)
    print(nombre, caja, (destino / f"{nombre}.webp").stat().st_size)
