"""Fight mode: time-managed alpha-beta with a real chess brain.

Honest labeling: strength here comes from MODEL + SEARCH (per PRD). The net
alone is strong-club level; search is what makes Fight mode superhuman on
ordinary hardware. No system is unbeatable vs engines; the shipped claim is
'beats every human', measured, not promised.

What makes it strong (all standard, all tested):
- piece-square tables + logistic material scale, so development, center and
  king safety matter even where the net is unsure;
- batched leaf evaluation (one forward pass per fan-out, not one per leaf);
- null-move pruning + killer moves + captures-first ordering;
- quiescence on captures (static, zero model calls);
- mate-in-1 delivery, mate-in-1 guard, no-repeat-when-winning.
"""
from __future__ import annotations
import math, time
import chess

from .data import PIECE_VALUES


# Piece-square tables, middlegame, centipawns, White perspective.
# Rows run rank 8 -> rank 1 (standard presentation); index with [7 - rank].
_PAWN = [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0,
]
_KNIGHT = [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50,
]
_BISHOP = [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5, 10, 10,  5,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -20,-10,-10,-10,-10,-10,-10,-20,
]
_ROOK = [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0,
]
_QUEEN = [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5,  5,  5,  5,  0,-10,
     -5,  0,  5,  5,  5,  5,  0, -5,
      0,  0,  5,  5,  5,  5,  0, -5,
    -10,  5,  5,  5,  5,  5,  0,-10,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20,
]
_KING = [
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -10,-20,-20,-20,-20,-20,-20,-10,
     20, 20,  0,  0,  0,  0, 20, 20,
     20, 30, 10,  0,  0, 10, 30, 20,
]
_PST = {chess.PAWN: _PAWN, chess.KNIGHT: _KNIGHT, chess.BISHOP: _BISHOP,
        chess.ROOK: _ROOK, chess.QUEEN: _QUEEN, chess.KING: _KING}


def _pst_cp(board: chess.Board) -> int:
    total = 0
    for pt, table in _PST.items():
        for sq in board.pieces(pt, chess.WHITE):
            f, r = chess.square_file(sq), chess.square_rank(sq)
            total += table[(7 - r) * 8 + f]
        for sq in board.pieces(pt, chess.BLACK):
            f, r = chess.square_file(sq), chess.square_rank(sq)
            total -= table[r * 8 + f]  # mirror vertically
    return total


def _material_pawns(board: chess.Board) -> float:
    s = 0
    for pt, v in PIECE_VALUES.items():
        s += v * (len(board.pieces(pt, chess.WHITE)) - len(board.pieces(pt, chess.BLACK)))
    return float(s)


def static_pawns(board: chess.Board) -> float:
    """White-pov position value in pawns: material + piece-square knowledge."""
    return _material_pawns(board) + _pst_cp(board) / 100.0


def _static(board: chess.Board) -> float:
    """White-pov score in [-1, 1]. Logistic scale: 1 pawn ~ 0.27, 3 ~ 0.68."""
    p = static_pawns(board)
    return 2.0 / (1.0 + math.exp(-0.6 * p)) - 1.0


def _tt_key(board: chess.Board):
    try:
        return board.transposition_key()
    except Exception:
        return board.fen()


def _capture_score(board: chess.Board, mv: chess.Move) -> float:
    if not board.is_capture(mv):
        return 0.0
    vic = board.piece_at(mv.to_square)
    atk = board.piece_at(mv.from_square)
    vv = PIECE_VALUES.get(vic.piece_type, 0) if vic else 0
    av = PIECE_VALUES.get(atk.piece_type, 0) if atk else 0
    return vv * 10 - av * 0.1 + (1.0 if mv.promotion else 0.0)


def allows_mate_in_one(board: chess.Board) -> bool:
    """Call on the position AFTER our move: can the opponent (to move) mate
    immediately? Pure rules check, no model involved."""
    for reply in list(board.legal_moves):
        board.push(reply)
        try:
            mate = board.is_checkmate()
        finally:
            board.pop()
        if mate:
            return True
    return False


def _is_tactical(board: chess.Board, mv: chess.Move) -> bool:
    """Checks, captures and promotions are never pruned from the root width,
    no matter what the (possibly untrained) policy thinks of them."""
    if board.is_capture(mv) or mv.promotion:
        return True
    board.push(mv)
    try:
        return board.is_check() or board.is_checkmate()
    finally:
        board.pop()


def ordered_moves(board: chess.Board, policy_order: list[str] | None, width: int = 10,
                  killers: list | None = None) -> list[chess.Move]:
    """Policy order at the root; captures-first + killers deeper. Cheap."""
    legal = list(board.legal_moves)
    if policy_order:
        rank = {u: i for i, u in enumerate(policy_order)}
        legal.sort(key=lambda m: rank.get(m.uci(), 10**9))
    else:
        legal.sort(key=lambda m: _capture_score(board, m), reverse=True)
    if killers:
        ks = {k.uci() for k in killers if k is not None}
        legal.sort(key=lambda m: 0 if m.uci() in ks else 1)
    return legal[:width]


# Breadth caps: one leaf eval costs ~70ms on CPU. Top-N by policy (root) and
# captures-first (deeper) spends the budget where it matters.
WIDTH_ROOT = 10
WIDTH = 6


def fight_move(engine, fen: str, max_depth: int = 3, time_limit: float = 2.5,
               topk: int = 1, blunder_rate: float = 0.0, avoid_repeat: bool = True) -> tuple[str, float, int, int]:
    """Negamax alpha-beta with batch leaves, null-move pruning, killers,
    quiescence, mate delivery/guard and no-repeat-when-winning.
    Returns (uci, value, model_evals, depth_reached). Time-capped: always
    returns the best move found so far, so callers stay within budget.
    Handicap interface (replaces sampling an untrained policy, which plays
    below random): depth caps strength, topk/blunder_rate add human-like
    noise. The mate-in-1 guard stays on at every level: handicaps play
    worse openly, never by hanging mates on purpose."""
    board = chess.Board(fen)
    if board.is_game_over():
        raise ValueError("game already over")
    try:
        logits, _v0 = engine._raw(fen)
        import torch
        order_idx = torch.argsort(logits.squeeze(0), descending=True).tolist()
        from .tokenization import uci_vocab
        policy_order = [uci_vocab()[i] for i in order_idx[:64]]
    except Exception:
        policy_order = None

    t_end = time.perf_counter() + time_limit
    best, best_v = None, -math.inf
    nodes = 0
    depth_reached = 0
    tt: dict = {}  # transposition table: repeated positions are free
    killers: list[list] = [[None, None] for _ in range(16)]
    # Honest blend: a trained net earns half the vote; random weights get a
    # whisper (0.08) so piece-square knowledge + tactics drive instead.
    model_w = 0.5 if getattr(engine, "trained", False) else 0.08

    def stm_white(v_white: float, b: chess.Board) -> float:
        """White-pov eval -> side-to-move perspective. Negamax leaf contract."""
        return v_white if b.turn == chess.WHITE else -v_white

    def qsearch(b: chess.Board, alpha: float, beta: float, qd: int) -> float:
        """Captures-only extension on the static eval: cures hanging-piece
        blindness for zero model calls. Side-to-move perspective."""
        stand = stm_white(_static(b), b)
        if stand >= beta:
            return beta
        if stand > alpha:
            alpha = stand
        if qd <= 0:
            return alpha
        for mv in ordered_moves(b, None, 12):
            if not b.is_capture(mv) and not mv.promotion:
                continue
            b.push(mv)
            try:
                s = -qsearch(b, -beta, -alpha, qd - 1)
            finally:
                b.pop()
            if s >= beta:
                return beta
            if s > alpha:
                alpha = s
            if time.perf_counter() > t_end:
                break
        return alpha

    def batch_leaves(b: chess.Board, moves: list[chess.Move]) -> dict[str, float]:
        """One forward pass for a whole fan-out. Values are side-to-move
        relative (the opponent just moved... i.e. the position after OUR move,
        opponent to move); the caller negates. Terminals scored exactly."""
        nonlocal nodes
        if time.perf_counter() > t_end:
            raise TimeoutError
        out: dict[str, float] = {}
        todo: list[tuple[str, str]] = []
        for mv in moves:
            b.push(mv)
            try:
                if b.is_checkmate():
                    out[mv.uci()] = -1.0  # side to move (opponent) is mated
                    continue
                if b.is_stalemate() or b.is_insufficient_material() or b.is_fifty_moves():
                    out[mv.uci()] = 0.0
                    continue
                key = _tt_key(b)
                hit = tt.get(key)
                if hit is not None:
                    out[mv.uci()] = hit
                    continue
                todo.append((mv.uci(), b.fen()))
            finally:
                b.pop()
        if todo:
            try:
                vals = engine.evaluate_batch([f for _, f in todo])
            except Exception:
                vals = [0.0] * len(todo)
            tmp_boards = {}
            for (uci, f), v in zip(todo, vals):
                nodes += 1
                bb = tmp_boards.get(f)
                if bb is None:
                    bb = chess.Board(f)
                    tmp_boards[f] = bb
                q = qsearch(bb, -math.inf, math.inf, 1)
                out[uci] = model_w * stm_white(v, bb) + (1.0 - model_w) * q
        return out

    def leaf(b: chess.Board) -> float:
        nonlocal nodes
        if b.is_checkmate():
            return -1.0
        if b.is_stalemate() or b.is_insufficient_material() or b.is_fifty_moves():
            return 0.0
        key = _tt_key(b)
        hit = tt.get(key)
        if hit is not None:
            return hit
        nodes += 1
        try:
            m = stm_white(engine.evaluate(b.fen()), b)
        except Exception:
            m = stm_white(_static(b), b)
        v = model_w * m + (1.0 - model_w) * qsearch(b, -math.inf, math.inf, 2)
        tt[key] = v
        return v

    def search(b: chess.Board, depth: int, alpha: float, beta: float, use_policy: bool, ply: int) -> float:
        if time.perf_counter() > t_end:
            raise TimeoutError
        if depth <= 0 or b.is_game_over():
            return leaf(b)
        # null-move pruning: passing must not refute us (skip in check / bare positions)
        if depth >= 3 and not b.is_check() and any(
                b.pieces(pt, b.turn) for pt in (chess.KNIGHT, chess.BISHOP, chess.ROOK, chess.QUEEN)):
            b.push(chess.Move.null())
            try:
                s = -search(b, depth - 3, -beta, -beta + 0.005, False, ply + 1)
            finally:
                b.pop()
            if s >= beta:
                return beta
        if depth == 1:
            moves = ordered_moves(b, policy_order if use_policy else None, WIDTH, killers[ply] if ply < 16 else None)
            scored = batch_leaves(b, moves)
            val = -math.inf
            for mv in moves:
                s = scored.get(mv.uci())
                if s is None:
                    continue
                val = max(val, -s)
                alpha = max(alpha, val)
                if alpha >= beta:
                    if ply < 16 and not b.is_capture(mv):
                        k = killers[ply]
                        if k[0] != mv:
                            k[1] = k[0]
                            k[0] = mv
                    break
            return val
        val = -math.inf
        moves = ordered_moves(b, policy_order if use_policy else None, WIDTH, killers[ply] if ply < 16 else None)
        for mv in moves:
            cap = b.is_capture(mv)
            b.push(mv)
            try:
                val = max(val, -search(b, depth - 1, -beta, -alpha, False, ply + 1))
            finally:
                b.pop()
            alpha = max(alpha, val)
            if alpha >= beta:
                if not cap and ply < 16:
                    k = killers[ply]
                    if k[0] != mv:
                        k[1] = k[0]
                        k[0] = mv
                break
            if time.perf_counter() > t_end:
                break
        return val

    # Root: policy top-N PLUS every tactical move (never prune a check,
    # capture or promotion on a possibly-untrained policy's say-so).
    root = ordered_moves(board, policy_order, WIDTH_ROOT)
    seen = {m.uci() for m in root}
    for mv in list(board.legal_moves):
        if mv.uci() not in seen and _is_tactical(board, mv):
            root.append(mv)
            seen.add(mv.uci())
    # Instant mate delivery needs no search.
    for mv in root:
        board.push(mv)
        try:
            mate_now = board.is_checkmate()
        finally:
            board.pop()
        if mate_now:
            return mv.uci(), 1.0, nodes + 1, 0
    timed_out = False
    scores: dict[str, float] = {}
    for depth in range(1, max_depth + 1):  # iterative deepening respects the clock
        try:
            if depth == 1:
                # whole first ply in batches: one forward pass per fan-out
                scored_d = batch_leaves(board, root)
                scored = [(-s, mv) for mv in root for s in [scored_d.get(mv.uci(), -math.inf)]]
            else:
                scored = []
                for mv in root:
                    board.push(mv)
                    try:
                        s = -search(board, depth - 1, -math.inf, math.inf, False, 1)
                    finally:
                        board.pop()
                    scored.append((s, mv))
            scored.sort(key=lambda x: x[0], reverse=True)
            # commit only completed depths: a timeout mid-pass must never mix
            # partial deeper scores with finished shallower ones
            for s, mv in scored:
                scores[mv.uci()] = s
            best_v, best = scored[0][0], scored[0][1]
            root = [m for _, m in scored]
            depth_reached = depth
        except TimeoutError:
            timed_out = True
            break
        if time.perf_counter() > t_end:
            break
    if best is None:  # clock ran out instantly; fall back to model-only top move
        uci, v = engine.predict(fen, level="strong")
        return uci, v, 1, 0
    # Final selection: blunder roll, then mate-in-1 guard (+ optional
    # no-repeat-when-winning), then top-k sampling. Guard is universal.
    import random as _rng
    ordered = sorted(root, key=lambda m: scores.get(m.uci(), -math.inf), reverse=True)
    if blunder_rate > 0 and _rng.random() < blunder_rate:
        cands = []
        for mv in list(board.legal_moves):
            board.push(mv)
            try:
                bad = allows_mate_in_one(board)
            finally:
                board.pop()
            if not bad:
                cands.append(mv)
        mv = _rng.choice(cands or list(board.legal_moves))
        return mv.uci(), float(scores.get(mv.uci(), 0.0)), nodes, depth_reached

    def safe_pool(skip_repeats: bool):
        pool = []
        for mv in ordered:
            board.push(mv)
            try:
                bad = allows_mate_in_one(board)
                rep = board.is_repetition(2)
            finally:
                board.pop()
            if bad:
                continue
            if skip_repeats and rep and scores.get(mv.uci(), 0) > 0.15:
                continue
            pool.append(mv)
        return pool

    pool = safe_pool(avoid_repeat) or safe_pool(False)
    _ = timed_out
    if not pool:
        return best.uci(), float(best_v), nodes, depth_reached
    chosen = _rng.choice(pool[:max(1, topk)])
    return chosen.uci(), float(scores.get(chosen.uci(), best_v)), nodes, depth_reached
