"""MCP mode: outside chatbots/LLMs play chess through the same fair rules engine.

Mounts at /mcp (Streamable HTTP). Any MCP-compatible client (Claude Code,
Claude Desktop, Cursor, custom agents) can list tools and play.

Fairness contract (same as humans):
- legality enforced server-side; illegal agent moves are rejected, never applied
- the agent is an ordinary player side; our engine replies at the stated level
- no chat/hints/commentary exist anywhere in this interface either
- referee mode (engine_opponent=false): pure arbiter for LLM-vs-LLM games,
  either side may move, no engine interference
"""
from __future__ import annotations
import random

from mcp.server.mcpserver import MCPServer

from backend.game import ChessGame, GameError
from backend import store
from backend import engine_service

mcp = MCPServer("chess-fight-llm")


def _state(g) -> dict:
    d = g.to_dict()
    return {"game_id": d["id"], "fen": d["fen"], "turn": d["turn"],
            "status": d["status"], "winner": d["winner"],
            "player_color": d["player_color"], "engine_color": d["engine_color"],
            "level": d["level"], "moves": d["moves"], "sans": d["sans"],
            "opening": d["opening"], "check": d["check"],
            "clocks_ms": d["clocks_ms"], "has_clock": d["has_clock"],
            "referee": d.get("referee", False), "drill": d.get("drill", "")}


@mcp.tool()
def new_game(side: str = "white", level: str = "club", time_control: str = "none",
             engine_opponent: bool = True, profile_id: str = "") -> dict:
    """Start a game. You play `side` (white|black|random); the house engine
    replies at `level` unless engine_opponent=false (referee mode: you drive
    both sides, e.g. LLM-vs-LLM). Returns game_id + starting state."""
    if side == "random":
        side = random.choice(["white", "black"])
    try:
        g = ChessGame(player_color=side, level=level, time_control=time_control,
                      profile_id=profile_id, source="mcp", referee=not engine_opponent)
    except GameError as e:
        return {"error": str(e)}
    store.save_game(g)
    if engine_opponent:
        from backend.app import _maybe_engine_move
        _maybe_engine_move(g)
    return _state(g)


@mcp.tool()
def get_state(game_id: str) -> dict:
    """Full public state of a game: fen, turn, status, clocks, move history."""
    g = store.get_game(game_id)
    if not g:
        return {"error": "unknown game"}
    return _state(g)


@mcp.tool()
def legal_moves(game_id: str, square: str = "") -> dict:
    """Legal UCI moves now (optionally filtered to one origin square)."""
    g = store.get_game(game_id)
    if not g:
        return {"error": "unknown game"}
    moves = g.legal_moves()
    if square:
        moves = [u for u in moves if u.startswith(square)]
    return {"moves": moves, "turn": g._mover_color()}


@mcp.tool()
def play_move(game_id: str, move: str) -> dict:
    """Play your move (UCI like e2e4/e7e8q, or SAN like Nf3). In normal mode
    you must move your own side; the house engine then replies automatically
    and the returned state includes both plies. In referee mode either side
    may move and nothing replies. Illegal moves are rejected with an error."""
    g = store.get_game(game_id)
    if not g:
        return {"error": "unknown game"}
    if g.status != "ongoing":
        return {"error": f"game already over ({g.status})"}
    t = (move or "").strip()
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
            return {"error": f"cannot parse move: {move!r}"}
    from backend.app import _do_player_move
    try:
        st = _do_player_move(g, uci)
        return _state(store.get_game(g.id))
    except Exception as e:
        status = getattr(e, "status_code", None)
        detail = getattr(e, "detail", str(e))
        return {"error": str(detail), "status": status or 400}


@mcp.tool()
def resign(game_id: str) -> dict:
    """Resign your side (normal mode) or the side to move (referee mode)."""
    g = store.get_game(game_id)
    if not g:
        return {"error": "unknown game"}
    try:
        if g.referee:
            g._finish("resign", "black" if g._mover_color() == "white" else "white")
        else:
            g.resign(by="player")
    except GameError as e:
        return {"error": str(e)}
    store.save_game(g)
    return _state(g)


@mcp.tool()
def offer_draw(game_id: str) -> dict:
    """Offer a draw. The house engine accepts ONLY objectively fair draws
    (even eval + real drawing mechanism). Referee mode cannot agree draws."""
    g = store.get_game(game_id)
    if not g:
        return {"error": "unknown game"}
    if g.referee:
        return {**_state(g), "draw_accepted": False,
                "note": "referee mode: draws need both agents to agree out of band"}
    if g.status != "ongoing":
        return {"error": "game already over"}
    accepted = engine_service.engine_accepts_draw(g.board.fen())
    if accepted:
        g._finish("draw", "draw")
        store.save_game(g)
    return {**_state(g), "draw_accepted": accepted}


@mcp.tool()
def get_pgn(game_id: str) -> dict:
    """Export the game as PGN text."""
    g = store.get_game(game_id)
    if not g:
        return {"error": "unknown game"}
    return {"pgn": g.to_pgn()}
