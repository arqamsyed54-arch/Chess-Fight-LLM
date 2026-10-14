"""FastAPI app: game API + static frontend. No chat/hint endpoints by design (R2)."""
from __future__ import annotations
import os
import random
import time
from fastapi import FastAPI, HTTPException
from fastapi.responses import PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .game import ChessGame, GameError
from . import store
from . import engine_service

app = FastAPI(title="Chess Fight LLM")


class NewGameReq(BaseModel):
    player_color: str = "white"  # white | black | random
    level: str = "club"          # beginner|casual|club|strong|fight
    time_control: str = "none"   # none|bullet|blitz|rapid|custom
    custom_ms: int = Field(default=0, ge=0, le=86_400_000)
    custom_inc_ms: int = Field(default=0, ge=0, le=3_600_000)
    custom_ms_engine: int = Field(default=0, ge=0, le=86_400_000)  # time odds: engine clock (0 = same as player)
    fen: str = ""              # drills / custom positions (validated)
    drill: str = ""            # "", "kqk", "krk", "kpk"
    adaptive_book: bool = True  # book learns your weak lines (disclosed)
    engine_opponent: bool = True  # False = referee mode (MCP LLM-vs-LLM)
    profile_id: str = ""


class MoveReq(BaseModel):
    uci: str
    engine_reply: bool = True  # 3D client sets False: it drives the AI worker itself


class ProfileReq(BaseModel):
    name: str = "Player"


def _maybe_engine_move(game: ChessGame):
    """After a player move (or at game start), let the engine reply if it is
    its turn. Honest R5: resigns instead of stalling when truly lost."""
    if game.status != "ongoing":
        return
    if game._mover_color() != game.engine_color:
        return
    if engine_service.should_engine_resign(game.board.fen()):
        game.resign(by="engine")
        store.save_game(game)
        return
    uci, val, ms, depth, nodes = engine_service.engine_reply(
        game.board.fen(), game.level, tuple(game.sans),
        profile_id=game.profile_id, adaptive_book=game.adaptive_book)
    if game.has_clock:
        game._apply_clock(game.engine_color, ms)
        if game.status != "ongoing":
            store.save_game(game)
            return
    game.apply_uci(uci, by="engine")
    game.engine_value = val
    game.last_ms["engine"] = ms
    game.engine_telemetry = {"ms": ms, "depth": depth, "nodes": nodes,
                             "kns": int(nodes / max(ms / 1000, 1e-3))}
    store.save_game(game)


def _do_player_move(game: ChessGame, uci: str, with_engine: bool = True) -> dict:
    elapsed = game._consume_tick()
    if game.has_clock:
        game._apply_clock(game._mover_color(), elapsed)
        if game.status != "ongoing":
            store.save_game(game)
            return game.to_dict()
    t0 = time.perf_counter()
    try:
        if game.referee:
            # MCP referee mode (LLM-vs-LLM): either side may move, clocks run,
            # no auto engine reply.
            mover = game._mover_color()
            by = "player" if mover == game.player_color else "engine"
            with_engine = False
        else:
            by = "player"
        game.apply_uci(uci.strip(), by=by)
    except GameError as e:
        raise HTTPException(400, str(e))
    game.last_ms["player"] = int((time.perf_counter() - t0) * 1000)
    if game.has_clock:  # increment for the player's move
        game.clocks_ms[game.player_color] = game.clocks_ms.get(game.player_color, 0) + game.inc_ms
    store.save_game(game)
    if with_engine:
        _maybe_engine_move(game)
    return game.to_dict()


@app.get("/api/health")
def health():
    return {"status": "ok", **engine_service.model_info()}


@app.post("/api/profiles")
def new_profile(req: ProfileReq):
    return store.create_profile(req.name)


@app.get("/api/profiles/{pid}/games")
def profile_games(pid: str):
    if not store.get_profile(pid):
        raise HTTPException(404, "unknown profile")
    return store.list_games(profile_id=pid)


@app.post("/api/games")
def new_game(req: NewGameReq):
    color = req.player_color
    if color == "random":
        color = random.choice(["white", "black"])
    try:
        game = ChessGame(player_color=color, level=req.level,
                         time_control=req.time_control, profile_id=req.profile_id,
                         custom_ms=req.custom_ms, custom_inc_ms=req.custom_inc_ms,
                         custom_ms_engine=req.custom_ms_engine, fen=req.fen,
                         drill=req.drill, adaptive_book=req.adaptive_book,
                         referee=not req.engine_opponent)
    except GameError as e:
        raise HTTPException(400, str(e))
    store.save_game(game)
    if req.engine_opponent:
        _maybe_engine_move(game)  # engine opens if player is black
    return game.to_dict()


@app.get("/api/games")
def games(profile_id: str = ""):
    return store.list_games(profile_id=profile_id)


@app.get("/api/games/export", response_class=PlainTextResponse)
def export_all(profile_id: str = ""):
    """Batch PGN archive download (history screen)."""
    from fastapi.responses import PlainTextResponse as _PTR
    out = []
    for d in store.list_games(profile_id=profile_id):
        g = store.get_game(d["id"])
        if g:
            out.append(g.to_pgn())
    resp = _PTR("\n".join(out) if out else "% empty archive\n")
    resp.headers["Content-Disposition"] = "attachment; filename=chess-fight-archive.pgn"
    return resp


@app.get("/api/games/{gid}")
def get_game(gid: str):
    g = store.get_game(gid)
    if not g:
        raise HTTPException(404, "unknown game")
    return g.to_dict()


@app.get("/api/games/{gid}/legal-moves")
def legal_moves(gid: str, square: str = ""):
    g = store.get_game(gid)
    if not g:
        raise HTTPException(404, "unknown game")
    moves = g.legal_moves()
    if square:
        moves = [u for u in moves if u.startswith(square)]
    return {"moves": moves}


@app.post("/api/games/{gid}/move")
def play_move(gid: str, req: MoveReq):
    g = store.get_game(gid)
    if not g:
        raise HTTPException(404, "unknown game")
    if g.status != "ongoing":
        raise HTTPException(400, f"game already over ({g.status})")
    return _do_player_move(g, req.uci, req.engine_reply)


class MoveTextReq(BaseModel):
    text: str
    engine_reply: bool = True


class AiMoveReq(BaseModel):
    """Stateless AI contract: getMove(fen, level, timeBudgetMs) -> uciMove.
    Rules engine stays the source of truth; this only proposes the move."""
    fen: str
    level: str = "club"
    sans: list[str] = []
    profile_id: str = ""
    adaptive_book: bool = True


@app.post("/api/move")
def ai_move(req: AiMoveReq):
    import chess as _ch
    try:
        board = _ch.Board(req.fen)
    except ValueError:
        raise HTTPException(400, "invalid FEN")
    if board.is_game_over():
        raise HTTPException(400, "game already over")
    if req.level not in ("beginner", "casual", "club", "strong", "fight"):
        raise HTTPException(400, f"unknown level {req.level}")
    uci, val, ms, depth, nodes = engine_service.engine_reply(
        req.fen, req.level, tuple(req.sans),
        profile_id=req.profile_id, adaptive_book=req.adaptive_book)
    if uci not in [m.uci() for m in board.legal_moves]:
        raise HTTPException(500, "engine produced an illegal move (rejected)")
    return {"move": uci, "ms": ms, "depth": depth, "nodes": nodes}


class LegalReq(BaseModel):
    fen: str


@app.post("/api/legal")
def legal_moves_for_fen(req: LegalReq):
    """Stateless legal-move list for the mock engine. Rules decided server-side."""
    import chess as _ch
    try:
        board = _ch.Board(req.fen)
    except ValueError:
        raise HTTPException(400, "invalid FEN")
    return {"moves": [m.uci() for m in board.legal_moves], "turn": "white" if board.turn == _ch.WHITE else "black"}


@app.post("/api/games/{gid}/move-text")
def play_move_text(gid: str, req: MoveTextReq):
    """Keyboard console: accepts UCI (e2e4, e7e8q) or SAN (Nf3, O-O)."""
    import chess as _ch
    g = store.get_game(gid)
    if not g:
        raise HTTPException(404, "unknown game")
    if g.status != "ongoing":
        raise HTTPException(400, f"game already over ({g.status})")
    t = (req.text or "").strip().replace("0-0", "O-O").replace("0–0", "O-O")
    uci = None
    try:
        mv = g.board.parse_uci(t.lower())
        if mv in g.board.legal_moves:
            uci = mv.uci()
    except ValueError:
        pass
    if uci is None:
        try:
            uci = g.board.parse_san(t).uci()
        except ValueError:
            raise HTTPException(400, f"cannot parse move: {req.text!r}")
    return _do_player_move(g, uci, req.engine_reply)


class EngineMoveReq(BaseModel):
    uci: str


@app.post("/api/games/{gid}/engine-move")
def play_engine_move(gid: str, req: EngineMoveReq):
    """Apply the worker's move. Validated by the rules engine like any move;
    the 3D client calls this after getMove resolves."""
    import time as _t
    g = store.get_game(gid)
    if not g:
        raise HTTPException(404, "unknown game")
    if g.status != "ongoing":
        raise HTTPException(400, f"game already over ({g.status})")
    t0 = _t.perf_counter()
    try:
        g.apply_uci(req.uci.strip(), by="engine")
    except GameError as e:
        raise HTTPException(400, "engine move rejected: " + str(e))
    ms = int((_t.perf_counter() - t0) * 1000)
    if g.has_clock:
        g._apply_clock(g.engine_color, ms)
    try:
        from . import engine_service as _es
        g.engine_value = _es.get_engine().evaluate(g.board.fen())
    except Exception:
        pass
    g.last_ms["engine"] = ms
    store.save_game(g)
    return g.to_dict()


@app.post("/api/games/{gid}/undo")
def undo(gid: str):
    """Take back the last round (player + engine reply). Free on
    beginner/casual; costs the game's single takeback token elsewhere.
    Clocks are never refunded. Token balance is shown in game state."""
    g = store.get_game(gid)
    if not g:
        raise HTTPException(404, "unknown game")
    if g.level not in ("beginner", "casual"):
        if g.takebacks_left <= 0:
            raise HTTPException(403, "no takeback tokens left (1 per game)")
    try:
        popped = g.undo_plies(2)
    except GameError as e:
        raise HTTPException(400, str(e))
    if g.level not in ("beginner", "casual"):
        g.takebacks_left -= 1  # charged only on success
    store.save_game(g)
    _maybe_engine_move(g)  # in case undo left the engine to move (e.g. player is black)
    return g.to_dict()


@app.post("/api/games/{gid}/resign")
def resign(gid: str):
    g = store.get_game(gid)
    if not g:
        raise HTTPException(404, "unknown game")
    try:
        g.resign(by="player")
    except GameError as e:
        raise HTTPException(400, str(e))
    store.save_game(g)
    return g.to_dict()


@app.post("/api/games/{gid}/draw-offer")
def draw_offer(gid: str):
    """Player offers a draw; engine accepts ONLY if objectively fair (R5)."""
    g = store.get_game(gid)
    if not g:
        raise HTTPException(404, "unknown game")
    if g.status != "ongoing":
        raise HTTPException(400, "game already over")
    accepted = engine_service.engine_accepts_draw(g.board.fen())
    if accepted:
        g._finish("draw", "draw")
        store.save_game(g)
    return {**g.to_dict(), "draw_accepted": accepted}


@app.get("/api/games/{gid}/pgn", response_class=PlainTextResponse)
def pgn(gid: str):
    g = store.get_game(gid)
    if not g:
        raise HTTPException(404, "unknown game")
    return g.to_pgn()


@app.get("/api/games/{gid}/replay")
def replay(gid: str):
    """FEN after every ply (index 0 = startpos) for the replay slider (R7)."""
    g = store.get_game(gid)
    if not g:
        raise HTTPException(404, "unknown game")
    return {"fens": g.replay(), "sans": g.sans}


_analysis_cache: dict[str, dict] = {}


@app.on_event("startup")
def _warm_engine():
    """Load the net + run one position BEFORE serving, so the first visitor
    never pays the ~6s cold-start inside their first move."""
    try:
        eng = engine_service.get_engine()
        eng.evaluate("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")
    except Exception:
        pass


@app.get("/api/games/{gid}/analysis")
def analysis(gid: str):
    """Post-game (or live) telemetry: per-ply model evals, model-judged
    accuracy for both sides, ECO opening, result text. Evals are cached per
    game and EXTENDED incrementally, so each new move costs one eval (~70ms),
    not a full recompute."""
    g = store.get_game(gid)
    if not g:
        raise HTTPException(404, "unknown game")
    return build_analysis(g)


def build_analysis(g) -> dict:
    """Shared by the endpoint, puzzles, stats and candidates."""
    eng = engine_service.get_engine()
    gid = g.id
    entry = _analysis_cache.get(gid)
    moves = list(g.moves)
    if entry and entry.get("moves") == moves[:len(entry.get("moves", []))] and len(moves) >= len(entry.get("moves", [])):
        evals = list(entry["evals"])
    else:
        evals = []
    if not evals:
        fens = g.replay()
        evals = [round(eng.evaluate(f), 4) for f in fens]
    else:
        tail = g.replay()[len(evals):]
        evals.extend(round(eng.evaluate(f), 4) for f in tail)
    _analysis_cache[gid] = {"moves": moves, "evals": evals}
    ploss, eloss = [], []
    swings = []  # per-ply mover-perspective deltas for insights
    for i in range(len(g.moves)):
        white_moved = (i % 2 == 0)
        before = evals[i] if white_moved else -evals[i]
        after = evals[i + 1] if white_moved else -evals[i + 1]
        loss = max(0.0, before - after)
        mover_is_player = (white_moved and g.player_color == "white") or \
                          (not white_moved and g.player_color == "black")
        (ploss if mover_is_player else eloss).append(loss)
        swings.append({"ply": i + 1, "san": g.sans[i],
                       "mover": "player" if mover_is_player else "engine",
                       "delta": round(after - before, 4)})

    def acc(losses: list[float]) -> float:
        if not losses:
            return 100.0
        return round(100.0 / (1.0 + 3.0 * (sum(losses) / len(losses))), 1)

    mine = [s for s in swings if s["mover"] == "player"]
    blunders = sorted([s for s in mine if s["delta"] < -0.08], key=lambda s: s["delta"])[:3]
    best = max(mine, key=lambda s: s["delta"]) if mine and max(s["delta"] for s in mine) > 0.08 else None
    insights = {
        "blunders": [{"ply": s["ply"], "san": s["san"], "swing": s["delta"]} for s in blunders],
        "best_move": {"ply": best["ply"], "san": best["san"], "swing": best["delta"]} if best else None,
    }

    names = {"white": "White", "black": "Black", "draw": "Draw"}
    w = g.winner
    reason = {"checkmate": "checkmate", "resign": "resignation",
              "timeout": "flag fall", "stalemate": "stalemate",
              "insufficient": "insufficient material", "fifty": "fifty-move rule",
              "repetition": "threefold repetition", "draw": "agreement"}.get(g.status, g.status)
    if g.status == "ongoing":
        result_text = f"Game in progress — {len(g.moves)} plies played"
    elif w == "draw":
        result_text = f"Draw by {reason}"
    else:
        result_text = f"{names.get(w, w)} wins by {reason}"
    out = {
        "sans": list(g.sans), "evals": evals,
        "player_accuracy": acc(ploss), "engine_accuracy": acc(eloss),
        "player_loss_avg": round(sum(ploss) / len(ploss), 4) if ploss else 0.0,
        "insights": insights,
        "result_text": result_text,
        "eco": g.to_dict()["opening"],
        "plies": len(g.moves), "duration_s": round(g.duration_s(), 1),
        "note": "Accuracy is judged by the same model that plays (value-drop method), not an external engine."
        + ("" if getattr(engine_service.get_engine(), "trained", False)
           else " Model weights are untrained — evals and accuracy are provisional, not real strength."),
    }
    return out


# ---------------- study endpoints ----------------
from . import study as _study


@app.get("/api/games/{gid}/puzzles")
def game_puzzles(gid: str, limit: int = 5):
    """Your blunders as tactics: positions before your biggest eval drops.
    Solutions via POST /api/puzzles/solve (depth-2 search, cached)."""
    g = store.get_game(gid)
    if not g:
        raise HTTPException(404, "unknown game")
    a = build_analysis(g)
    fens = g.replay()
    return _study.puzzles_for_game(g, a, fens, max(1, min(limit, 8)))


class PuzzleSolveReq(BaseModel):
    fen: str
    uci: str = ""
    san: str = ""


@app.post("/api/puzzles/solve")
def puzzle_solve(req: PuzzleSolveReq):
    import chess as _ch
    try:
        board = _ch.Board(req.fen)
    except ValueError:
        raise HTTPException(400, "invalid FEN")
    sol = _study.solve_puzzle(req.fen)
    given = (req.uci or "").strip().lower()
    if not given and req.san:
        try:
            given = board.parse_san(req.san.strip()).uci()
        except ValueError:
            pass
    try:
        legal = board.parse_uci(given).uci() in [m.uci() for m in board.legal_moves] if given else False
    except ValueError:
        legal = False
    return {"correct": bool(legal and given == sol), "legal": bool(legal), "solution": sol}


@app.get("/api/repertoire")
def repertoire():
    """ECO drill lines (real main lines from the book). SRS state lives in
    the browser; correctness checked by POST /api/repertoire/try."""
    return _study.repertoire_lines()


class RepertoireTryReq(BaseModel):
    line_id: str
    ply: int
    uci: str


@app.post("/api/repertoire/try")
def repertoire_try(req: RepertoireTryReq):
    try:
        return _study.repertoire_try(req.line_id, req.ply, req.uci.strip().lower())
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.get("/api/games/{gid}/candidates")
def move_candidates(gid: str, ply: int = -1):
    """Top-3 engine candidates with evals at a finished game's ply.
    REFUSED while ongoing: no mid-game hints, ever (fair play)."""
    g = store.get_game(gid)
    if not g:
        raise HTTPException(404, "unknown game")
    if g.status == "ongoing":
        raise HTTPException(403, "candidates unlock after the game — no mid-game hints")
    if ply < 0:
        ply = len(g.moves) - 1
    try:
        return _study.candidates_for(g, ply)
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.get("/api/profiles/{pid}/suggest")
def suggest(pid: str):
    """Adaptive sparring: 2 straight wins -> step up, 2 losses -> step down."""
    if not store.get_profile(pid):
        raise HTTPException(404, "unknown profile")
    return _study.suggest_level(store.list_games(profile_id=pid))


@app.get("/api/stats")
def stats(profile_id: str = ""):
    """Dashboard data: recent accuracy trend, ECO table, phase weaknesses.
    Capped at 10 finished games; analyses are cached so repeats are instant."""
    games = [store.get_game(d["id"]) for d in store.list_games(profile_id=profile_id)]
    games = [g for g in games if g and g.status != "ongoing"][:10]
    analyses = {g.id: build_analysis(g) for g in games}
    return _study.stats_for([g.to_dict() for g in games], analyses)


@app.get("/api/daily")
def daily(date: str = ""):
    import datetime as _dt
    date = date or _dt.date.today().isoformat()
    try:
        return _study.daily_for(date)
    except (ValueError, AttributeError):
        raise HTTPException(400, "date must be YYYY-MM-DD")


class DailyTryReq(BaseModel):
    date: str = ""
    uci: str = ""
    san: str = ""


@app.post("/api/daily/try")
def daily_try(req: DailyTryReq):
    import datetime as _dt
    date = req.date or _dt.date.today().isoformat()
    uci = (req.uci or "").strip().lower()
    if not uci and req.san:
        try:
            import chess as _ch2
            dz = _study.daily_for(date)
            uci = _ch2.Board(dz["fen"]).parse_san(req.san.strip()).uci()
        except ValueError:
            pass
    try:
        return _study.daily_try(date, uci)
    except (ValueError, StopIteration, AttributeError):
        raise HTTPException(400, "bad date or move")


@app.get("/api/drills")
def drills():
    return _study.DRILLS


@app.get("/api/games/{gid}/drill")
def drill_state(gid: str):
    g = store.get_game(gid)
    if not g:
        raise HTTPException(404, "unknown game")
    return _study.drill_status(g)


_STATIC = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(_STATIC, exist_ok=True)
_mcp_session_manager = None
try:
    from .mcp_server import mcp as _mcp
    # stateless: our tools keep all state in the game store.
    app.mount("/mcp", _mcp.streamable_http_app(streamable_http_path="/", stateless_http=True))
    _mcp_session_manager = _mcp._lowlevel_server._session_manager
except Exception:
    pass  # MCP optional; game API unaffected


from contextlib import asynccontextmanager as _acm


@_acm
async def _combined_lifespan(app_instance):
    """Default FastAPI startup/shutdown (model warmup) PLUS the MCP session
    manager. Mounted sub-app lifespans do not run on their own, so without
    this the /mcp endpoint 500s on every call."""
    import inspect as _inspect

    async def _run(handlers):
        for handler in handlers:
            res = handler()
            if _inspect.isawaitable(res):
                await res

    await _run(app_instance.router.on_startup)
    try:
        if _mcp_session_manager is not None:
            async with _mcp_session_manager.run():
                yield
        else:
            yield
    finally:
        await _run(app_instance.router.on_shutdown)


app.router.lifespan_context = _combined_lifespan
app.mount("/", StaticFiles(directory=_STATIC, html=True), name="static")
