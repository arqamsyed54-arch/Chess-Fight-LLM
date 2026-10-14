"""Distillation labels: positions -> Stockfish bestmove + value (white-pov [-1,1]).

Positions come from fast, diverse self-play (book openings + 1-ply PST search
with noise); the TRUTH comes from Stockfish. Output JSONL for train.py.
Run: py -m chess_fight_llm.label --games 150 --depth 10 --out data/sf_labels.jsonl
"""
from __future__ import annotations
import argparse, json, math, os, random

import chess
import chess.engine

SF_PATH = r"D:\tmp\opencode\engines\sf\stockfish\stockfish-windows-x86-64-universal.exe"
if not os.path.exists(SF_PATH):
    raise SystemExit(
        "Stockfish not found at " + SF_PATH + "\n"
        "Download stockfish-windows-x86-64-universal.zip from\n"
        "https://github.com/official-stockfish/Stockfish/releases and extract it there.")


def cp_to_value(cp: int | None, mate: int | None) -> float:
    if mate is not None:
        return 1.0 if mate > 0 else -1.0  # side-to-move mates -> converted by caller
    cp = max(-1500, min(1500, cp or 0))
    return 2.0 / (1.0 + math.exp(-0.004 * cp)) - 1.0


def gen_game(rng: random.Random, max_ply: int = 120) -> list[str]:
    """Fast weak-but-plausible game: book opening, then 1-ply material+PST with noise."""
    from chess_fight_llm.search import static_pawns
    from backend.openings import book_reply
    board = chess.Board()
    sans: list[str] = []
    while not board.is_game_over() and board.ply() < max_ply:
        mv = None
        if len(sans) <= 6:
            san = book_reply(sans, rng.randrange(1 << 20))
            if san:
                try:
                    mv = board.parse_san(san)
                except ValueError:
                    mv = None
        if mv is None:
            scored = []
            for m in board.legal_moves:
                board.push(m)
                try:
                    if board.is_checkmate():
                        s = 10**6
                    else:
                        s = static_pawns(board) * (-1 if board.turn == chess.WHITE else 1)
                        s += rng.random() * 3.0  # heavy noise -> diversity
                finally:
                    board.pop()
                scored.append((s, m))
            scored.sort(key=lambda x: x[0])
            mv = rng.choice(scored[-3:])[1]
        sans.append(board.san(mv))
        board.push(mv)
    # collect midgame-rich positions (skip first 4 plies of theory)
    fens = []
    b = chess.Board()
    for i, san in enumerate(sans):
        if i >= 4:
            fens.append(b.fen())
        b.push_san(san)
    return fens


def label_positions(fens: list[str], depth: int = 10, threads: int = 2) -> list[dict]:
    eng = chess.engine.SimpleEngine.popen_uci(SF_PATH)
    eng.configure({"Threads": threads, "Hash": 256})
    out = []
    try:
        for i, fen in enumerate(fens):
            board = chess.Board(fen)
            if board.is_game_over():
                continue
            try:
                res = eng.analyse(board, chess.engine.Limit(depth=depth))
            except chess.engine.EngineError:
                continue
            pv = res.get("pv") or []
            score = res.get("score")
            if not pv or score is None:
                continue
            stm = score.relative
            mate, cp = stm.mate(), stm.score()
            white = board.turn == chess.WHITE
            if mate is not None:
                v = 1.0 if (mate > 0) == white else -1.0
            else:
                v = cp_to_value(cp if white else -cp, None)
            out.append({"fen": fen, "best": pv[0].uci(), "value": round(v, 4)})
            if (i + 1) % 500 == 0:
                print(f"labeled {i + 1}/{len(fens)}", flush=True)
    finally:
        eng.quit()
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--games", type=int, default=150)
    ap.add_argument("--depth", type=int, default=10)
    ap.add_argument("--threads", type=int, default=2)
    ap.add_argument("--seed", type=int, default=11)
    ap.add_argument("--out", type=str, default="data/sf_labels.jsonl")
    a = ap.parse_args()
    rng = random.Random(a.seed)
    fens: list[str] = []
    for g in range(a.games):
        fens.extend(gen_game(rng))
        if (g + 1) % 25 == 0:
            print(f"generated {g + 1}/{a.games} games, {len(fens)} positions", flush=True)
    print(f"labeling {len(fens)} positions at depth {a.depth} ...", flush=True)
    rows = label_positions(fens, a.depth, a.threads)
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    with open(a.out, "w") as f:
        for r in rows:
            f.write(json.dumps(r) + "\n")
    print(f"wrote {len(rows)} labels -> {a.out}", flush=True)


if __name__ == "__main__":
    main()
