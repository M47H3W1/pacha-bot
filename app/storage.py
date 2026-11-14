"""Persistencia por agricultor. Supabase (PostgREST) si hay credenciales; si no, SQLite local."""
import json
import logging
import os
import sqlite3
import threading
from datetime import datetime, timezone

import httpx

from .clients import CACHE

log = logging.getLogger(__name__)


def _now():
    return datetime.now(timezone.utc).isoformat()


class SQLiteStorage:
    nombre = "SQLite local"

    def __init__(self, path=CACHE / "pacha.db"):
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.lock = threading.Lock()
        self.db.executescript("""
            create table if not exists farmers (telegram_id integer primary key, nombre text,
              state text not null default '{}', created_at text, updated_at text);
            create table if not exists parcels (id integer primary key autoincrement, telegram_id integer,
              provincia text, lat real, lon real, elevacion real, suelo text, created_at text);
            create table if not exists history (id integer primary key autoincrement, telegram_id integer,
              kind text, summary text, payload text, created_at text);
            create table if not exists messages (id integer primary key autoincrement, telegram_id integer,
              role text, content text, created_at text);
        """)

    def _x(self, sql, args=()):
        with self.lock:
            cur = self.db.execute(sql, args)
            self.db.commit()
            return cur.fetchall()

    def upsert_farmer(self, tid, nombre, state):
        self._x("""insert into farmers (telegram_id, nombre, state, created_at, updated_at) values (?,?,?,?,?)
                   on conflict(telegram_id) do update set nombre=excluded.nombre, state=excluded.state,
                   updated_at=excluded.updated_at""", (tid, nombre, json.dumps(state), _now(), _now()))

    def get_state(self, tid):
        r = self._x("select state from farmers where telegram_id=?", (tid,))
        return json.loads(r[0][0]) if r else None

    def add_parcel(self, tid, p):
        self._x("insert into parcels (telegram_id, provincia, lat, lon, elevacion, suelo, created_at) values (?,?,?,?,?,?,?)",
                (tid, p["provincia"], p["lat"], p["lon"], p["elev"], json.dumps(p.get("suelo")), _now()))

    def add_history(self, tid, kind, summary, payload=None):
        self._x("insert into history (telegram_id, kind, summary, payload, created_at) values (?,?,?,?,?)",
                (tid, kind, summary, json.dumps(payload or {}), _now()))

    def list_history(self, tid, n=10):
        r = self._x("select kind, summary, created_at from history where telegram_id=? order by id desc limit ?", (tid, n))
        return [dict(kind=a, summary=b, created_at=c) for a, b, c in r]

    def add_message(self, tid, role, content):
        self._x("insert into messages (telegram_id, role, content, created_at) values (?,?,?,?)",
                (tid, role, content, _now()))

    def recent_messages(self, tid, n=10):
        r = self._x("select role, content from messages where telegram_id=? order by id desc limit ?", (tid, n))
        return [dict(role=a, content=b) for a, b in reversed(r)]

    def delete_farmer(self, tid):
        for t in ("messages", "history", "parcels", "farmers"):
            self._x(f"delete from {t} where telegram_id=?", (tid,))


class SupabaseStorage:
    nombre = "Supabase"

    def __init__(self, url, key):
        self.base = url.rstrip("/") + "/rest/v1"
        self.h = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
        self.c = httpx.Client(timeout=15, headers=self.h)
        self.c.get(f"{self.base}/farmers", params={"select": "telegram_id", "limit": 1}).raise_for_status()

    def _post(self, table, row, **params):
        r = self.c.post(f"{self.base}/{table}", json=row, params=params,
                        headers={"Prefer": "resolution=merge-duplicates,return=minimal"})
        r.raise_for_status()

    def _get(self, table, **params):
        r = self.c.get(f"{self.base}/{table}", params=params)
        r.raise_for_status()
        return r.json()

    def upsert_farmer(self, tid, nombre, state):
        self._post("farmers", {"telegram_id": tid, "nombre": nombre, "state": state, "updated_at": _now()},
                   on_conflict="telegram_id")

    def get_state(self, tid):
        r = self._get("farmers", telegram_id=f"eq.{tid}", select="state")
        return r[0]["state"] if r else None

    def add_parcel(self, tid, p):
        self._post("parcels", {"telegram_id": tid, "provincia": p["provincia"], "lat": p["lat"],
                               "lon": p["lon"], "elevacion": p["elev"], "suelo": p.get("suelo")})

    def add_history(self, tid, kind, summary, payload=None):
        self._post("history", {"telegram_id": tid, "kind": kind, "summary": summary, "payload": payload or {}})

    def list_history(self, tid, n=10):
        return self._get("history", telegram_id=f"eq.{tid}", select="kind,summary,created_at",
                         order="created_at.desc", limit=n)

    def add_message(self, tid, role, content):
        self._post("messages", {"telegram_id": tid, "role": role, "content": content})

    def recent_messages(self, tid, n=10):
        r = self._get("messages", telegram_id=f"eq.{tid}", select="role,content", order="created_at.desc", limit=n)
        return list(reversed(r))

    def delete_farmer(self, tid):
        r = self.c.delete(f"{self.base}/farmers", params={"telegram_id": f"eq.{tid}"})
        r.raise_for_status()


def crear_storage():
    url, key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY")
    if url and key:
        try:
            s = SupabaseStorage(url, key)
            log.info("Persistencia: Supabase")
            return s
        except Exception as e:
            log.error("Supabase no disponible (%s); uso SQLite local", e)
    log.info("Persistencia: SQLite local")
    return SQLiteStorage()
