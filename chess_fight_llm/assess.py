"""Strength & weakness assessment: rated matches vs anchors, tactics exam, speed.

Anchors (rough, stated in report): random ~400 Elo, greedy 1-ply ~900 Elo.
Run: py -m chess_fight_llm.assess [--games N]  (default 4 per pairing)
Output: printed report + assessments/report_<ts>.json
"""
from __future__ import annotations
import argparse, json, math, os, random, time

import chess

from backend import engine_service
from chess_fight_llm.search import static_pawns

OPENINGS_WHITE = ["e2e4", "d2d4", "c2c4", "g1f3"]
OPENINGS_BLACK = ["e7e5", "c7c5", "e7e6", "c7c6", "d7d5", "g8f6"]
ANCHOR_ELO = {"random": 400, "greedy": 900}
MAX_PLY = 140


def random_move(board: chess.Board, rng: random.Random, sans: list) -> str:
    return rng.choice(list(board.legal_moves)).uci()


def greedy_move(board: chess.Board, rng: random.Random, sans: list) -> str:
    best, best_s = [], -10**9
    for mv in board.legal_moves:
        board.push(mv)
        try:
            if board.is_checkmate():
                s = 10**6
            else:
                mat = static_pawns(board) * (-1 if board.turn == chess.WHITE else 1)
                s = mat + (0.5 if board.is_check() else 0.0) + rng.random() * 0.05
        finally:
            board.pop()
        if s > best_s + 1e-9:
            best, best_s = [mv], s
        elif abs(s - best_s) <= 1e-9:
            best.append(mv)
    return rng.choice(best).uci()


def level_move(level: str):
    def fn(board: chess.Board, rng: random.Random, sans: list) -> str:
        uci, _, _, _, _ = engine_service.engine_reply(board.fen(), level, tuple(sans))
        return uci
    return fn


def play_game(white_fn, black_fn, seed: int, white_open: str) -> str:
    """Returns 'white' | 'black' | 'draw'. Illegal/crash = loss (counted)."""
    rng = random.Random(seed)
    board = chess.Board()
    sans: list[str] = []
    mv = chess.Move.from_uci(white_open)
    sans.append(board.san(mv))
    board.push(mv)
    cands = [m for u in OPENINGS_BLACK if (m := chess.Move.from_uci(u)) in board.legal_moves]
    bm = rng.choice(cands)
    sans.append(board.san(bm))
    board.push(bm)
    while not board.is_game_over() and board.ply() < MAX_PLY:
        fn = white_fn if board.turn == chess.WHITE else black_fn
        try:
            uci = fn(board, rng, sans)
            san = board.san(chess.Move.from_uci(uci))
        except Exception:
            return "black" if board.turn == chess.WHITE else "white"
        sans.append(san)
        board.push_uci(uci)
    if board.is_checkmate():
        return "black" if board.turn == chess.WHITE else "white"
    if board.is_game_over():
        return "draw"
    p = static_pawns(board)
    if p > 2.0:
        return "white"
    if p < -2.0:
        return "black"
    return "draw"


def run_matches(games: int) -> dict:
    engine_service.get_engine()
    out = {}
    gid = 0
    for lv in ["beginner", "casual", "club", "strong", "fight"]:
        out[lv] = {}
        for an, afn in (("random", random_move), ("greedy", greedy_move)):
            w = d = l = 0
            for i in range(games):
                wo = OPENINGS_WHITE[i % len(OPENINGS_WHITE)]
                if i % 2 == 0:
                    res = play_game(level_move(lv), afn, 1000 + gid, wo)
                    if res == "white":
                        w += 1
                    elif res == "draw":
                        d += 1
                    else:
                        l += 1
                else:
                    res = play_game(afn, level_move(lv), 1000 + gid, wo)
                    if res == "black":
                        w += 1
                    elif res == "draw":
                        d += 1
                    else:
                        l += 1
                gid += 1
            out[lv][an] = {"w": w, "d": d, "l": l}
    return out


def elo_off(score: float) -> float:
    if score <= 0:
        return -800.0
    if score >= 1:
        return 800.0
    return 400.0 * math.log10(score / (1.0 - score))


def tactics_exam() -> list[dict]:
    res = []

    def t(name, fen, level, sans, cond):
        try:
            u, _, _, _, _ = engine_service.engine_reply(fen, level, tuple(sans))
            ok, got = cond(u), u
        except Exception as e:
            ok, got = False, "EXC " + str(e)[:60]
        res.append({"test": name, "pass": bool(ok), "move": got})
    t("mate-in-1 take (fight)", "6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1", "fight", [], lambda u: u == "e1e8")
    t("mate-in-1 avoid (fight)", "6k1/5ppp/8/8/8/8/5PPP/4R1K1 b - - 0 1", "fight", [], lambda u: u != "g8h8")
    t("hanging queen punish (fight)", "r1bqkbnr/pppp1ppp/2n5/4Q3/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 0 1", "fight", [], lambda u: u == "c6e5")
    t("promotion to queen (fight)", "8/2P5/8/8/8/1k6/8/4K3 w - - 0 1", "fight", [], lambda u: u == "c7c8q")
    b = chess.Board()
    sans: list[str] = []
    try:
        for u in ["e2e4", "e7e5", "d1h5"]:
            sans.append(b.san(chess.Move.from_uci(u)))
            b.push_uci(u)
        mated = False
        for _ in range(6):
            if b.is_game_over():
                mated = b.is_checkmate() and b.turn == chess.BLACK
                break
            u, _, _, _, _ = engine_service.engine_reply(b.fen(), "fight", tuple(sans))
            sans.append(b.san(chess.Move.from_uci(u)))
            b.push_uci(u)
            if b.is_game_over():
                mated = b.is_checkmate() and b.turn == chess.BLACK
                break
            if chess.Move.from_uci("h5f7") in b.legal_moves:
                sans.append(b.san(chess.Move.from_uci("h5f7")))
                b.push_uci("h5f7")
            else:
                mv = greedy_move(b, random.Random(7), sans)
                sans.append(b.san(chess.Move.from_uci(mv)))
                b.push_uci(mv)
        res.append({"test": "scholar's survival (fight)", "pass": not mated, "move": sans[-1] if sans else "-"})
    except Exception as e:
        res.append({"test": "scholar's survival (fight)", "pass": False, "move": "EXC", "detail": str(e)[:80]})
    return res


def speed_profile() -> dict:
    out = {}
    start = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    mid = "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 5"
    for lv in ["beginner", "casual", "club", "strong"]:
        ts = []
        for f in (start, mid):
            t0 = time.perf_counter()
            engine_service.engine_reply(f, lv, ())
            ts.append((time.perf_counter() - t0) * 1000)
        out[lv] = {"ms_avg": round(sum(ts) / len(ts), 1)}
    ts, depths, nodes = [], [], []
    openings = [(), ("e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4")]
    for f, sans in ((start, openings[0]), (mid, openings[1])):
        t0 = time.perf_counter()
        _, _, ms, d, n = engine_service.engine_reply(f, "fight", sans)
        ts.append(ms)
        depths.append(d)
        nodes.append(n)
    out["fight"] = {"ms_avg": round(sum(ts) / len(ts), 1), "depth_avg": round(sum(depths) / len(depths), 2),
                    "nodes_avg": int(sum(nodes) / len(nodes))}
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--games", type=int, default=4)
    a = ap.parse_args()
    t0 = time.perf_counter()
    print("warming engine + running matches ...", flush=True)
    matches = run_matches(a.games)
    print("tactics exam ...", flush=True)
    tactics = tactics_exam()
    print("speed profile ...", flush=True)
    speed = speed_profile()
    elos = {}
    for lv, vs in matches.items():
        est = []
        for an, r in vs.items():
            n = r["w"] + r["d"] + r["l"]
            s = (r["w"] + 0.5 * r["d"]) / max(1, n)
            est.append(ANCHOR_ELO[an] + elo_off(s))
        elos[lv] = round(sum(est) / len(est)) if est else None
    report = {"matches": matches, "elo_est": elos, "anchors": ANCHOR_ELO,
              "tactics": tactics, "speed": speed,
              "seconds": round(time.perf_counter() - t0, 1)}
    os.makedirs("assessments", exist_ok=True)
    path = f"assessments/report_{time.strftime('%Y%m%d_%H%M%S')}.json"
    with open(path, "w") as f:
        json.dump(report, f, indent=1)
    # retention: keep the last 5 reports, assessments pile up otherwise
    reps = sorted(__import__("glob").glob("assessments/report_*.json"))
    for old in reps[:-5]:
        try:
            os.remove(old)
        except OSError:
            pass
    print(json.dumps(report, indent=1))
    print("saved", path)


if __name__ == "__main__":
    main()
