"""Study systems: puzzles from your blunders, repertoire drills, post-game
candidate moves, adaptive level suggestion, stats, daily mates, endgame drills.
All chess truth comes from the rules engine + model; this module only organizes.
Fairness: candidates are post-game ONLY (refused while ongoing)."""
from __future__ import annotations
import datetime
import chess

from .openings import BOOK


# ---------- blunder puzzles ----------
def puzzles_for_game(game, analysis: dict, fens: list[str], limit: int = 5) -> list[dict]:
    ev = analysis.get("evals", [])
    scored = []
    for i in range(len(game.moves)):
        white_moved = (i % 2 == 0)
        mover_is_player = (white_moved and game.player_color == "white") or \
                          (not white_moved and game.player_color == "black")
        if not mover_is_player or i + 1 >= len(ev):
            continue
        before = ev[i] if white_moved else -ev[i]
        after = ev[i + 1] if white_moved else -ev[i + 1]
        loss = before - after
        if loss > 0.12:
            scored.append((loss, i))
    scored.sort(reverse=True)
    out = []
    for loss, i in scored[:limit]:
        out.append({"ply": i + 1, "played": game.sans[i], "fen_before": fens[i],
                    "swing": round(-loss, 3)})
    return out


_solution_cache: dict[str, str] = {}


def solve_puzzle(fen: str) -> str:
    """Best move by depth-2 search. Cached per fen."""
    if fen in _solution_cache:
        return _solution_cache[fen]
    from backend.engine_service import get_engine
    from chess_fight_llm.search import fight_move
    u, _, _, _ = fight_move(get_engine(), fen, max_depth=2, time_limit=0.8)
    _solution_cache[fen] = u
    return u


# ---------- repertoire ----------
def repertoire_lines() -> list[dict]:
    """Drill lines derived from the ECO book prefixes (real main lines).
    Each line is drillable from either side."""
    lines = []
    for eco, name, prefix in BOOK:
        if len(prefix) >= 4:
            lines.append({"id": eco, "eco": eco, "name": name, "moves": list(prefix)})
    # dedupe by id keeping longest
    best: dict[str, dict] = {}
    for ln in lines:
        if ln["id"] not in best or len(ln["moves"]) > len(best[ln["id"]]["moves"]):
            best[ln["id"]] = ln
    return sorted(best.values(), key=lambda l: l["eco"])


def repertoire_try(line_id: str, ply: int, uci: str) -> dict:
    line = next((l for l in repertoire_lines() if l["id"] == line_id), None)
    if line is None:
        raise ValueError("unknown line")
    if ply < 0 or ply >= len(line["moves"]):
        raise ValueError("ply out of range")
    board = chess.Board()
    try:
        for s in line["moves"][:ply]:
            board.push_san(s)
        expected = board.parse_san(line["moves"][ply]).uci()
    except ValueError:
        raise ValueError("line broken")
    given = None
    for parser in (lambda t: board.parse_uci(t).uci(),
                   lambda t: board.parse_san(t).uci()):
        try:
            cand = parser(uci.strip())
            if cand in [m.uci() for m in board.legal_moves]:
                given = cand
                break
        except ValueError:
            continue
    return {"correct": bool(given is not None and given == expected),
            "expected": expected, "fen": board.fen()}


# ---------- post-game candidates (refused while ongoing) ----------
_candidate_cache: dict[tuple, list] = {}


def candidates_for(game, ply: int) -> list[dict]:
    from backend.engine_service import get_engine
    key = (game.id, ply, len(game.moves))
    if key in _candidate_cache:
        return _candidate_cache[key]
    fens = game.replay()
    if ply < 0 or ply >= len(game.moves):
        raise ValueError("ply out of range")
    board = chess.Board(fens[ply])
    legal = list(board.legal_moves)
    eng = get_engine()
    fens_after = []
    ucis = []
    for mv in legal:
        board.push(mv)
        fens_after.append(board.fen())
        ucis.append(mv.uci())
        board.pop()
    try:
        vals = eng.evaluate_batch(fens_after)
    except Exception:
        vals = [0.0] * len(fens_after)
    from chess_fight_llm.search import _static
    import math
    scored = []
    w = 0.5 if getattr(eng, "trained", False) else 0.08
    for mv, f, v in zip(legal, fens_after, vals):
        b = chess.Board(f)
        s = _static(b)
        blend = w * (v if b.turn == chess.WHITE else -v) + (1 - w) * (s if b.turn == chess.WHITE else -s)
        # from the MOVER's perspective (negate: side to move is the opponent)
        scored.append((-blend, mv.uci(), board.san(mv)))
    scored.sort()
    out = [{"uci": u, "san": s, "score": round(-v, 3)} for v, u, s in scored[:3]]
    _candidate_cache[key] = out
    return out


# ---------- adaptive sparring ----------
LEVEL_ORDER = ["beginner", "casual", "club", "strong", "fight"]


def suggest_level(games: list[dict], default: str = "club") -> dict:
    """2 wins in a row -> step up; 2 losses in a row -> step down.
    Finished games only, most recent first."""
    done = [g for g in games if g.get("status") != "ongoing"][:10]
    if not done:
        return {"suggested": default, "reason": "no finished games yet — starting at Club", "table": {}}
    table: dict[str, dict] = {}
    for g in done:
        lv = g.get("level", "?")
        t = table.setdefault(lv, {"w": 0, "d": 0, "l": 0})
        w = g.get("winner")
        if w == "draw" or not w:
            t["d"] += 1
        elif w == g.get("player_color"):
            t["w"] += 1
        else:
            t["l"] += 1
    cur = done[0].get("level", default)
    if cur not in LEVEL_ORDER:
        cur = default
    streak_w = streak_l = 0
    for g in done:
        if g.get("level") != cur:
            break
        w = g.get("winner")
        if w == g.get("player_color"):
            if streak_l:
                break
            streak_w += 1
        elif w and w != "draw":
            if streak_w:
                break
            streak_l += 1
        else:
            break
    idx = LEVEL_ORDER.index(cur)
    if streak_w >= 2 and idx < len(LEVEL_ORDER) - 1:
        return {"suggested": LEVEL_ORDER[idx + 1], "reason": f"2 straight wins at {cur} — stepping up", "table": table}
    if streak_l >= 2 and idx > 0:
        return {"suggested": LEVEL_ORDER[idx - 1], "reason": f"2 straight losses at {cur} — stepping down", "table": table}
    return {"suggested": cur, "reason": f"holding at {cur} (streak {streak_w}W/{streak_l}L)", "table": table}


# ---------- stats dashboard ----------
def stats_for(games: list[dict], analyses: dict) -> dict:
    """games: to_dicts (finished, newest first, cap 10). analyses: gid -> analysis dict."""
    rows = []
    openings: dict[str, dict] = {}
    phases = {"opening": [], "middlegame": [], "endgame": []}
    for g in games[:10]:
        a = analyses.get(g["id"])
        if not a:
            continue
        eco = (g.get("opening") or {}).get("eco", "?")
        o = openings.setdefault(eco, {"eco": eco, "w": 0, "d": 0, "l": 0, "n": 0})
        o["n"] += 1
        w = g.get("winner")
        if w == "draw":
            o["d"] += 1
        elif w == g.get("player_color"):
            o["w"] += 1
        else:
            o["l"] += 1
        ev = a.get("evals", [])
        sans = a.get("sans", [])
        pc = g.get("player_color")
        for i in range(len(sans)):
            wm = (i % 2 == 0)
            mine = (wm and pc == "white") or (not wm and pc == "black")
            if not mine or i + 1 >= len(ev):
                continue
            before = ev[i] if wm else -ev[i]
            after = ev[i + 1] if wm else -ev[i + 1]
            loss = max(0.0, before - after)
            band = "opening" if i < 12 else ("middlegame" if i < 40 else "endgame")
            phases[band].append(loss)
        rows.append({"id": g["id"][:6], "level": g.get("level"), "winner": w,
                     "player_color": pc, "plies": len(sans),
                     "player_accuracy": a.get("player_accuracy"), "eco": eco,
                     "created_at": g.get("created_at")})
    avg = lambda xs: round(sum(xs) / len(xs), 4) if xs else 0.0
    return {"games": rows, "count": len(rows),
            "openings": sorted(openings.values(), key=lambda o: -o["n"])[:12],
            "phases": {k: {"avg_loss": avg(v), "moves": len(v)} for k, v in phases.items()}}


# ---------- daily mates (rules-verified at test time) ----------
# fen, side-to-move label, solution uci. Difficulty rises through the list.
DAILIES = [
    {"fen": "6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1", "solution": "e1e8", "goal": "Mate in 1", "name": "Back rank basics"},
    {"fen": "7k/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1", "solution": "a1a8", "goal": "Mate in 1", "name": "Cornered"},
    {"fen": "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 1", "solution": "h5f7", "goal": "Mate in 1", "name": "Scholar's finish"},
    {"fen": "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 1", "solution": "d8h4", "goal": "Mate in 1", "name": "Fool's mate"},
    {"fen": "7k/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1", "solution": "e1e8", "goal": "Mate in 1", "name": "File the eighth"},
    {"fen": "6k1/5ppp/8/8/8/8/5PPP/2R3K1 w - - 0 1", "solution": "c1c8", "goal": "Mate in 1", "name": "Second rank"},
    {"fen": "6k1/5ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 1", "solution": "d1d8", "goal": "Mate in 1", "name": "Queen takes the file"},
    {"fen": "6k1/5ppp/8/8/8/8/1PP3PP/R5K1 w - - 0 1", "solution": "a1a8", "goal": "Mate in 1", "name": "Quiet corner"},
]


def daily_for(date_str: str) -> dict:
    y, m, d = (int(x) for x in date_str.split("-"))
    idx = (datetime.date(y, m, d) - datetime.date(2026, 1, 1)).days % len(DAILIES)
    dz = DAILIES[idx]
    return {"date": date_str, "index": idx, "total": len(DAILIES), **{k: v for k, v in dz.items() if k != "solution"}}


def daily_try(date_str: str, uci: str) -> dict:
    dz = daily_for(date_str)
    full = next(x for x in DAILIES if x["fen"] == dz["fen"])
    try:
        mv = chess.Board(dz["fen"]).parse_uci(uci)
        legal = mv in chess.Board(dz["fen"]).legal_moves
    except ValueError:
        return {"correct": False, "legal": False}
    return {"correct": bool(legal and uci == full["solution"]), "legal": bool(legal)}


# ---------- endgame drills ----------
DRILLS = {
    "kqk": {"name": "Queen vs King", "fen": "6k1/8/8/8/8/8/8/4KQ2 w - - 0 1", "goal": "mate", "goal_text": "Checkmate Black"},
    "krk": {"name": "Rook vs King", "fen": "6k1/8/8/8/8/8/8/R3K3 w - - 0 1", "goal": "mate", "goal_text": "Checkmate Black"},
    "kpk": {"name": "King + Pawn vs King", "fen": "6k1/8/8/8/8/8/4P3/4K3 w - - 0 1", "goal": "promote", "goal_text": "Queen the pawn"},
}


def drill_status(game) -> dict:
    """Client-polled goal check for drills. Mate -> winner; promote -> any player promotion."""
    if game.drill not in DRILLS:
        return {"drill": game.drill, "done": False}
    if game.status == "checkmate" and game.winner == game.player_color:
        return {"drill": game.drill, "done": True, "how": "checkmate"}
    if DRILLS[game.drill]["goal"] == "promote":
        for i, u in enumerate(game.moves):
            mover_white = (i % 2 == 0)
            mine = (mover_white and game.player_color == "white") or (not mover_white and game.player_color == "black")
            if mine and len(u) == 5:
                return {"drill": game.drill, "done": True, "how": "promotion"}
    if game.status != "ongoing":
        return {"drill": game.drill, "done": False, "how": "game over without goal"}
    return {"drill": game.drill, "done": False}
