"""Ceiling probe: Fight vs Stockfish at fixed depth, both colors.
Usage: py -m chess_fight_llm.measure_ceiling [--depth 4] [--games 2]
Prints result + appends to assessments/ceiling.jsonl
"""
from __future__ import annotations
import argparse, json, os, time
import chess
import chess.engine

from backend import engine_service
from chess_fight_llm.label import SF_PATH

MAX_PLY = 160


def sf_move(eng, board, depth):
    res = eng.analyse(board, chess.engine.Limit(depth=depth))
    return res["pv"][0].uci()


def play_one(white_is_fight: bool, depth: int, seed: int) -> dict:
    eng = chess.engine.SimpleEngine.popen_uci(SF_PATH)
    eng.configure({"Threads": 2, "Hash": 128})
    try:
        board = chess.Board()
        sans: list[str] = []
        # neutral openings: alternate e4/d4
        first = "e2e4" if seed % 2 == 0 else "d2d4"
        sans.append(board.san(chess.Move.from_uci(first)))
        board.push_uci(first)
        t0 = time.perf_counter()
        while not board.is_game_over() and board.ply() < MAX_PLY:
            if (board.turn == chess.WHITE) == white_is_fight:
                u, _, ms, d, n = engine_service.engine_reply(board.fen(), "fight", tuple(sans))
            else:
                m0 = time.perf_counter()
                u = sf_move(eng, board, depth)
                ms, d, n = int((time.perf_counter() - m0) * 1000), depth, -1
            try:
                sans.append(board.san(chess.Move.from_uci(u)))
            except ValueError:
                return {"winner": "sf-crash" if (board.turn == chess.WHITE) == white_is_fight else "fight-crash",
                        "plies": board.ply(), "illegal": u}
            board.push_uci(u)
        if board.is_checkmate():
            w = "black" if board.turn == chess.WHITE else "white"
            winner = "fight" if (w == "white") == white_is_fight else "stockfish"
        else:
            winner = "draw"
        return {"winner": winner, "plies": board.ply(), "seconds": round(time.perf_counter() - t0, 1),
                "fen": board.fen(), "white_is_fight": white_is_fight}
    finally:
        eng.quit()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--depth", type=int, default=4)
    ap.add_argument("--games", type=int, default=2)
    a = ap.parse_args()
    engine_service.get_engine()
    rows = []
    for i in range(a.games):
        rows.append(play_one(i % 2 == 0, a.depth, 9000 + i))
        print(rows[-1], flush=True)
    os.makedirs("assessments", exist_ok=True)
    with open("assessments/ceiling.jsonl", "a") as f:
        for r in rows:
            f.write(json.dumps({"depth": a.depth, **r}) + "\n")
    print("done", rows)


if __name__ == "__main__":
    main()
