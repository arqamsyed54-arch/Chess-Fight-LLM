"""Engine singleton: wraps ChessFightEngine + Fight-mode search.

R2: the model speaks ONLY moves — this module exposes no text/chat API.
R4: every call is timed; Fight mode is capped so replies stay under 3 s.
R5: honest resign/draw helpers live here and are called by the API layer.
"""
from __future__ import annotations
import threading
import time
import chess

_lock = threading.Lock()
_engine = None

try:
    # The browser tab (especially software WebGL) shares the CPU with us.
    # Capping torch threads avoids oversubscription thrash and keeps
    # single-move latency predictable on ordinary laptops.
    import os as _os
    import torch as _torch
    _torch.set_num_threads(max(1, min(4, _os.cpu_count() or 4)))
except Exception:
    pass


def get_engine():
    global _engine
    with _lock:
        if _engine is None:
            from chess_fight_llm.infer import ChessFightEngine
            _engine = ChessFightEngine(level="club", seed=7)
        return _engine


def engine_reply(fen: str, level: str, sans: tuple = (), profile_id: str = "",
                 adaptive_book: bool = True) -> tuple[str, float, int, int, int]:
    """Returns (uci, value_white_pov, elapsed_ms, depth, nodes). Always legal.
    Book lines first (all levels), then the search ladder. Handicaps come
    from depth + noise, never from sampling an untrained policy (which was
    measured playing below random-mover strength)."""
    import random as _random
    eng = get_engine()
    t0 = time.perf_counter()
    san = None
    try:
        from .openings import choose_book, book_history_for
        hist = None
        if profile_id and adaptive_book:
            from . import store as _store
            hist = book_history_for(_store.list_games(profile_id=profile_id), profile_id)
        san = choose_book(list(sans), hist)
    except Exception:
        san = None
    if san:
        try:
            uci = chess.Board(fen).parse_san(san).uci()
            ms = int((time.perf_counter() - t0) * 1000)
            return uci, eng.evaluate(fen), ms, 0, 0
        except ValueError:
            pass
    from chess_fight_llm.search import fight_move
    board = chess.Board(fen)
    if level == "fight":
        # time management: full budget for complex positions, quick replies
        # for quiet ones. Cap stays inside the PRD's 3s budget.
        complex_pos = board.is_check() or len(list(board.legal_moves)) > 24
        cfg = dict(max_depth=3, time_limit=2.5 if complex_pos else 1.2)
    elif level == "strong":
        cfg = dict(max_depth=2, time_limit=1.5)
    elif level == "club":
        cfg = dict(max_depth=2, time_limit=0.8, topk=2)
    elif level == "casual":
        cfg = dict(max_depth=1, time_limit=0.6, topk=3, blunder_rate=0.08, avoid_repeat=False)
    else:  # beginner
        cfg = dict(max_depth=1, time_limit=0.4, topk=6, blunder_rate=0.25, avoid_repeat=False)
    uci, val, nodes, depth = fight_move(eng, fen, **cfg)
    assert uci in [m.uci() for m in board.legal_moves], "search returned illegal move"
    ms = int((time.perf_counter() - t0) * 1000)
    return uci, float(val), ms, depth, nodes


def should_engine_resign(fen: str) -> bool:
    return get_engine().should_resign(fen)


def engine_accepts_draw(fen: str) -> bool:
    return get_engine().should_accept_draw(fen)


def model_info() -> dict:
    from chess_fight_llm.model import count_parameters
    from chess_fight_llm.config import LEVELS
    eng = get_engine()
    n = count_parameters(eng.model)
    return {"params": n, "levels": list(LEVELS.keys()),
            "int8_mb": round(n / 1e6, 2), "trained": bool(getattr(eng, "trained", False))}
