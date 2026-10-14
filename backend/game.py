"""Core game object: ONE source of truth for rules (R1), clocks (R8),
honest resign/draw (R5). The model only ever proposes a UCI string; this
module validates it against python-chess before it touches the board."""
from __future__ import annotations
import time
import uuid
import chess
import chess.pgn
import io

TIME_CONTROLS = {
    "none":   {"initial_ms": 0, "increment_ms": 0},
    "bullet": {"initial_ms": 60_000, "increment_ms": 0},
    "blitz":  {"initial_ms": 180_000, "increment_ms": 2_000},
    "rapid":  {"initial_ms": 600_000, "increment_ms": 0},
}

TERMINAL = ("checkmate", "stalemate", "resign", "draw", "timeout",
            "insufficient", "fifty", "repetition")


class GameError(ValueError):
    pass


class ChessGame:
    def __init__(self, player_color: str = "white", level: str = "club",
                 time_control: str = "none", profile_id: str = "",
                 custom_ms: int = 0, custom_inc_ms: int = 0,
                 custom_ms_engine: int = 0, fen: str = "", drill: str = "",
                 adaptive_book: bool = True, referee: bool = False, source: str = "web"):
        if player_color not in ("white", "black"):
            raise GameError("player_color must be white or black")
        from chess_fight_llm.config import LEVELS
        if level not in LEVELS:
            raise GameError(f"unknown level {level}")
        if time_control == "custom":
            tc = {"initial_ms": custom_ms, "increment_ms": custom_inc_ms}
        elif time_control in TIME_CONTROLS:
            tc = dict(TIME_CONTROLS[time_control])
        else:
            raise GameError(f"unknown time_control {time_control}")

        self.id = uuid.uuid4().hex[:12]
        try:
            self.board = chess.Board(fen) if fen else chess.Board()
        except ValueError:
            raise GameError("invalid FEN")
        if self.board.is_game_over():
            raise GameError("starting position is already over")
        self.initial_fen = self.board.fen()  # replay/PGN root (drills start mid-game)
        self.player_color = player_color
        self.engine_color = "black" if player_color == "white" else "white"
        self.level = level
        self.time_control = time_control
        self.profile_id = profile_id
        self.drill = drill  # "", "kqk", "krk", "kpk" (training goals, client-scored)
        self.adaptive_book = adaptive_book  # disclosed in setup UI
        self.referee = referee  # MCP referee mode: no auto engine, either side moves
        self.source = source  # "web" | "mcp" (shown in history)
        self.takebacks_left = 1  # one token per game, any level (R: fair & visible)
        self.moves: list[str] = []   # UCI
        self.sans: list[str] = []
        self.status = "ongoing"
        self.winner: str | None = None  # white | black | draw
        self.engine_value = 0.0
        self.engine_telemetry = {"ms": 0, "depth": 0, "nodes": 0, "kns": 0}
        self.last_ms = {"player": 0, "engine": 0}
        self.created_at = time.time()
        self.ended_at: float | None = None
        tc_ms = tc["initial_ms"]
        self.tc_init_ms = tc_ms
        self.tc_inc_ms = tc["increment_ms"]
        eng_ms = custom_ms_engine or tc_ms  # time odds: engine clock may differ
        self.clocks_ms = {"white": tc_ms, "black": tc_ms}
        self.clocks_ms[self.engine_color] = eng_ms
        self.inc_ms = tc["increment_ms"]
        self.has_clock = tc_ms > 0
        self._tick = time.monotonic()
        self.draw_offer_pending = False

    # ---- clock helpers ----
    def _side_key(self, color: str) -> str:
        return color

    def _apply_clock(self, mover: str, elapsed_ms: int):
        """Deduct think time from mover, add increment. Flag on expiry (honest)."""
        if not self.has_clock:
            return
        self.clocks_ms[mover] = self.clocks_ms.get(mover, 0) - elapsed_ms + self.inc_ms
        if self.clocks_ms[mover] <= 0:
            self.clocks_ms[mover] = 0
            self._finish("timeout", "black" if mover == "white" else "white")

    def _consume_tick(self) -> int:
        now = time.monotonic()
        el = int((now - self._tick) * 1000)
        self._tick = now
        return max(0, el)

    def _mover_color(self) -> str:
        return "white" if self.board.turn == chess.WHITE else "black"

    def _finish(self, status: str, winner: str | None):
        self.status = status
        self.winner = winner
        if self.ended_at is None:
            self.ended_at = time.time()

    def duration_s(self) -> float:
        end = self.ended_at or time.time()
        return max(0.0, end - self.created_at)

    # ---- rules ----
    def legal_moves(self) -> list[str]:
        return [m.uci() for m in self.board.legal_moves]

    def _refresh_terminal(self):
        b = self.board
        if self.status in TERMINAL and self.status not in ("ongoing",):
            return
        if b.is_checkmate():
            self._finish("checkmate", "black" if b.turn == chess.WHITE else "white")
        elif b.is_stalemate():
            self._finish("stalemate", "draw")
        elif b.is_insufficient_material():
            self._finish("insufficient", "draw")
        elif b.is_seventyfive_moves():
            self._finish("fifty", "draw")
        elif b.is_fivefold_repetition():
            self._finish("repetition", "draw")
        elif b.is_fifty_moves():
            self._finish("fifty", "draw")
        elif b.is_repetition(3):
            self._finish("repetition", "draw")

    def apply_uci(self, uci: str, by: str) -> str:
        """Apply a move for 'player' or 'engine'. Validates turn + legality.
        Returns the applied UCI. Raises GameError on any violation."""
        if self.status != "ongoing":
            raise GameError(f"game already over ({self.status})")
        want = self.player_color if by == "player" else self.engine_color
        if self._mover_color() != want:
            raise GameError(f"not {by}'s turn")
        try:
            mv = self.board.parse_uci(uci)
        except ValueError:
            raise GameError(f"illegal move string: {uci}")
        if mv not in self.board.legal_moves:
            raise GameError(f"illegal move: {uci}")
        san = self.board.san(mv)
        self.board.push(mv)
        self.moves.append(mv.uci())
        self.sans.append(san)
        self._refresh_terminal()
        return mv.uci()

    def resign(self, by: str):
        if self.status != "ongoing":
            raise GameError("game already over")
        if by == "player":
            self._finish("resign", self.engine_color)
        elif by == "engine":
            self._finish("resign", self.player_color)
        else:
            raise GameError("by must be player or engine")

    def undo_plies(self, n: int = 2) -> int:
        """Take back up to n plies so it is the player's turn again.
        Casual-level training aid only; the API gates fight/club/strong out.
        Clocks are NOT refunded (tournament honesty). Returns plies popped."""
        if self.status != "ongoing":
            raise GameError("cannot undo a finished game")
        popped = 0
        while self.moves and popped < n and (popped == 0 or self._mover_color() != self.player_color):
            self.board.pop()
            self.moves.pop()
            self.sans.pop()
            popped += 1
        if popped == 0:
            raise GameError("nothing to undo")
        self.draw_offer_pending = False
        return popped

    # ---- serialization / PGN / replay ----
    def to_dict(self) -> dict:
        b = self.board
        from .openings import classify
        return {
            "id": self.id,
            "fen": b.fen(),
            "turn": self._mover_color(),
            "player_color": self.player_color,
            "engine_color": self.engine_color,
            "level": self.level,
            "status": self.status,
            "winner": self.winner,
            "moves": list(self.moves),
            "sans": list(self.sans),
            "opening": classify(self.sans),
            "check": b.is_check(),
            "legal_moves": self.legal_moves() if self.status == "ongoing" else [],
            "clocks_ms": dict(self.clocks_ms),
            "has_clock": self.has_clock,
            "increment_ms": self.inc_ms,
            "time_control": self.time_control,
            "engine_value": self.engine_value,
            "engine_telemetry": dict(self.engine_telemetry),
            "last_ms": dict(self.last_ms),
            "profile_id": self.profile_id,
            "created_at": self.created_at,
            "duration_s": self.duration_s(),
            "tc_init_ms": self.tc_init_ms,
            "tc_inc_ms": self.tc_inc_ms,
            "drill": self.drill,
            "takebacks_left": self.takebacks_left,
            "adaptive_book": self.adaptive_book,
            "referee": self.referee,
            "source": self.source,
        }

    def to_pgn(self) -> str:
        game = chess.pgn.Game()
        game.headers["White"] = "Player" if self.player_color == "white" else "ChessFightLLM"
        game.headers["Black"] = "ChessFightLLM" if self.player_color == "white" else "Player"
        game.headers["Result"] = {"white": "1-0", "black": "0-1", "draw": "1/2-1/2"}.get(self.winner or "", "*")
        if self.initial_fen != chess.STARTING_FEN:
            game.headers["SetUp"] = "1"
            game.headers["FEN"] = self.initial_fen
        node = game
        board = chess.Board(self.initial_fen)
        for uci in self.moves:
            mv = board.parse_uci(uci)
            node = node.add_variation(mv)
            board.push(mv)
        buf = io.StringIO()
        print(game, file=buf, end="\n\n")
        return buf.getvalue()

    @staticmethod
    def replay_fens(moves: list[str]) -> list[str]:
        """Replay: fen after each ply (index 0 = startpos). Used by UI + tests."""
        b = chess.Board()
        fens = [b.fen()]
        for uci in moves:
            b.push_uci(uci)
            fens.append(b.fen())
        return fens

    def replay(self) -> list[str]:
        """Instance replay rooted at this game's initial FEN (drills!)."""
        b = chess.Board(self.initial_fen)
        fens = [b.fen()]
        for uci in self.moves:
            b.push_uci(uci)
            fens.append(b.fen())
        return fens
