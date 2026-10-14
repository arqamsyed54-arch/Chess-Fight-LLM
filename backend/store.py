"""Persistence: local play needs no account (R6); optional profile saves games.
Thread-safe in-memory store with JSON snapshot on every mutation."""
from __future__ import annotations
import json
import os
import threading
import time
import uuid

_lock = threading.Lock()
_games: dict[str, object] = {}
_profiles: dict[str, dict] = {}
_SNAP = os.path.join(os.path.dirname(__file__), "store.json")


def _snapshot():
    try:
        data = {
            "games": {gid: g.to_dict() for gid, g in _games.items()},
            "profiles": _profiles,
        }
        tmp = _SNAP + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f)
        os.replace(tmp, _SNAP)
    except OSError:
        pass  # persistence is best-effort; games still live in memory


def save_game(game) -> None:
    with _lock:
        _games[game.id] = game
    _snapshot()


def get_game(gid: str):
    with _lock:
        return _games.get(gid)


def list_games(profile_id: str = "") -> list[dict]:
    with _lock:
        gs = list(_games.values())
    out = [g.to_dict() for g in gs if not profile_id or g.profile_id == profile_id]
    out.sort(key=lambda d: d["created_at"], reverse=True)
    return out


def create_profile(name: str) -> dict:
    name = (name or "").strip()[:40] or "Player"
    pid = uuid.uuid4().hex[:10]
    prof = {"id": pid, "name": name, "created_at": time.time()}
    with _lock:
        _profiles[pid] = prof
    _snapshot()
    return prof


def get_profile(pid: str) -> dict | None:
    with _lock:
        return _profiles.get(pid)


def clear_all() -> None:
    """Tests only."""
    with _lock:
        _games.clear()
        _profiles.clear()
