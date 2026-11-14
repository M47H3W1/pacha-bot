"""Recorre todos los menús con un agricultor simulado, sin conectarse a Telegram.
Verifica que cada pantalla responda, que los botones existan y que callback_data quepa en 64 bytes."""
import asyncio
import sys
import tempfile
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app import bot  # noqa: E402
from app.llm import Gemini  # noqa: E402
from app.storage import SQLiteStorage  # noqa: E402

SALIDAS = []


class Chat:
    id = 1

    async def send_message(self, text, parse_mode=None, reply_markup=None, **kw):
        SALIDAS.append(("msg", text, reply_markup))
        return Msg(text)

    async def send_photo(self, photo, caption=None, parse_mode=None, reply_markup=None, **kw):
        assert isinstance(photo, (bytes, bytearray)) and len(photo) > 5000, "imagen vacía"
        assert caption is None or len(caption) <= 1024, f"caption larga: {len(caption)}"
        SALIDAS.append(("foto", caption or "", reply_markup))
        return Msg(caption)

    async def send_action(self, *a, **kw):
        pass


class Msg:
    def __init__(self, text=None):
        self.text = text

    async def delete(self):
        pass

    async def edit_text(self, *a, **kw):
        pass

    async def reply_text(self, text, reply_markup=None, **kw):
        SALIDAS.append(("msg", text, reply_markup))


class Query:
    def __init__(self, data):
        self.data = data
        self.message = Msg(None)  # fuerza mensaje nuevo

    async def answer(self, *a, **kw):
        pass


def update(data=None, text=None, loc=None):
    m = Msg(None)
    m.text = text
    m.location = loc
    return SimpleNamespace(effective_user=SimpleNamespace(id=42, first_name="María"),
                           effective_chat=Chat(), callback_query=Query(data) if data else None, message=m)


def botones(markup):
    if markup is None or not hasattr(markup, "inline_keyboard"):
        return []
    return [b.callback_data for row in markup.inline_keyboard for b in row]


async def main():
    tmp = Path(tempfile.mkdtemp())
    bot.STORE, bot.LLM = SQLiteStorage(tmp / "t.db"), Gemini()
    bot.LLM.activo = False
    ctx = SimpleNamespace(user_data={})
    pasos = ["m", "t", "t:prov", "t:p:CHI", "c", "c:ya", "c:s:papa", "c:m:10", "r:1:haba", "r:2:cebada",
             "r:k:0", "r:k:1", "r:pr", "r:pp:agua", "r:ok:1", "b", "b:a:1000", "b:e:a", "b:w",
             "s", "s:p:-0.1", "s:t:2.0", "s:go", "a", "x:bank", "x:rot", "c:new", "n:m:12", "n:p:haba",
             "r:k:2", "n:all", "g", "g:et", "i", "h", "q", "b:reset", "b:aw"]
    todos = set()
    for p in pasos:
        n0 = len(SALIDAS)
        await bot.cmd_start(update(), ctx) if p == "start" else await bot.boton(update(p), ctx)
        nuevas = SALIDAS[n0:]
        assert nuevas, f"{p}: sin respuesta"
        for _, txt, mk in nuevas:
            for cb in botones(mk):
                assert len(cb.encode()) <= 64, cb
                todos.add(cb)
        print(f"OK {p:12s} → {len(nuevas)} mensaje(s): {nuevas[-1][1][:70]!r}".replace("\n", " "))
    n0 = len(SALIDAS)
    await bot.texto_libre(update(text="media hectárea"), ctx)
    assert ctx.user_data["st"]["area"] == 5000, "área no leída"
    print("OK texto área → 5000 m²")
    await bot.texto_libre(update(text="¿Cuándo siembro haba?"), ctx)
    await bot.ubicacion(update(loc=SimpleNamespace(latitude=-2.19, longitude=-79.89)), ctx)
    assert "sierra" in SALIDAS[-1][1], "no rechazó la costa"
    print("OK ubicación en la costa rechazada")
    await bot.cmd_start(update(), ctx)
    print("OK /start con banner")
    print("historial:", [h["summary"][:40] for h in bot.STORE.list_history(42, 30)][:6])
    print(f"\nTodo bien: {len(pasos)} pasos, {len(todos)} botones distintos verificados.")


asyncio.run(main())
