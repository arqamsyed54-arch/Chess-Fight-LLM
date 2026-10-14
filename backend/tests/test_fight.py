"""Fight-mode proof tests: takes mates, never hangs mate-in-1, opens from book,
and honestly reports its untrained state."""
import chess
import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend import store
from backend.openings import book_reply

client = TestClient(app)


@pytest.fixture(autouse=True)
def _clean():
    store.clear_all()
    yield
    store.clear_all()


def test_25_fight_takes_mate_in_one():
    from backend.engine_service import get_engine
    from chess_fight_llm.search import fight_move
    eng = get_engine()
    fen = "6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1"  # Re8#
    assert chess.Board(fen).parse_uci("e1e8") in chess.Board(fen).legal_moves
    uci, val, nodes, depth = fight_move(eng, fen, max_depth=2, time_limit=1.5)
    assert uci == "e1e8"


def test_26_fight_never_hangs_mate_in_one():
    from backend.engine_service import get_engine
    from chess_fight_llm.search import fight_move, allows_mate_in_one
    eng = get_engine()
    # sanity on the helper itself: Kh8 hangs Re8#, Kf8 does not
    b = chess.Board("6k1/5ppp/8/8/8/8/5PPP/4R1K1 b - - 0 1")
    b.push_uci("g8h8")
    assert allows_mate_in_one(b) is True
    b.pop()
    b.push_uci("g8f8")
    assert allows_mate_in_one(b) is False
    b.pop()
    # end to end: only Kh8 loses immediately; the engine must pick something else
    uci, _, _, _ = fight_move(eng, b.fen(), max_depth=2, time_limit=2.0)
    assert uci != "g8h8"
    b.push_uci(uci)
    assert allows_mate_in_one(b) is False


def test_27_engine_opens_from_book():
    assert book_reply([]) == "e4"
    assert book_reply(["e4"], 1) == "c5"
    assert book_reply(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O"]) is None  # out of book
    from backend.engine_service import engine_reply
    uci, _, _, depth, nodes = engine_reply(
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "fight", ())
    assert uci in ("e2e4", "d2d4")
    assert (depth, nodes) == (0, 0)


def test_28_fight_game_uses_book_then_tactics():
    r = client.post("/api/games", json={"player_color": "white", "level": "fight"})
    assert r.status_code == 200
    gid = r.json()["id"]
    r = client.post(f"/api/games/{gid}/move", json={"uci": "e2e4"})
    assert r.json()["moves"][0] == "e2e4"
    assert r.json()["moves"][1].startswith("c7") or r.json()["moves"][1].startswith("e7") \
        or r.json()["moves"][1].startswith("c6") or r.json()["moves"][1].startswith("e6")


def test_29_untrained_state_reported_honestly():
    from backend.engine_service import get_engine
    assert get_engine().trained is False
    assert client.get("/api/health").json()["trained"] is False
    g = client.post("/api/games", json={}).json()
    a = client.get(f"/api/games/{g['id']}/analysis").json()
    assert "untrained" in a["note"]


def test_31_pst_eval_scales_sensibly():
    import chess
    from chess_fight_llm.search import static_pawns, _static
    assert static_pawns(chess.Board()) == 0.0
    assert _static(chess.Board()) == 0.0
    # development is rewarded: knight developed > knight home, all else equal
    a = static_pawns(chess.Board("rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R w KQkq - 0 1"))
    assert a > 0.1, a
    # hanging rim knight is punished next to a developed central knight
    b = static_pawns(chess.Board("rnbqkbnr/pppppppp/8/7N/8/8/PPPPPPPP/RNBQKB1R w KQkq - 0 1"))
    assert b < a, (a, b)
    # material dominates: queen up is nearly won
    c = _static(chess.Board("6k1/8/8/8/8/8/8/Q5K1 w - - 0 1"))
    assert c > 0.9, c


def test_32_batch_eval_matches_single_and_fight_reaches_depth2():
    import time
    from backend.engine_service import get_engine
    from chess_fight_llm.search import fight_move
    eng = get_engine()
    fens = ["rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
            "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1"]
    single = [eng.evaluate(f) for f in fens]
    batch = eng.evaluate_batch(fens)
    assert len(batch) == 2
    for s, v in zip(single, batch):
        assert abs(s - v) < 1e-5
    assert eng.evaluate_batch([]) == []
    t0 = time.perf_counter()
    uci, _, nodes, depth = fight_move(eng, fens[0], max_depth=3, time_limit=2.5)
    dt = time.perf_counter() - t0
    assert uci in [m.uci() for m in chess.Board(fens[0]).legal_moves]
    assert depth >= 1 and nodes > 0
    assert dt < 3.0


def test_33_ladder_every_level_legal_fast_and_guarded():
    import chess
    from backend.engine_service import engine_reply
    fen = "r1bqkbnr/ppp2ppp/2np4/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1"
    legal = {m.uci() for m in chess.Board(fen).legal_moves}
    budgets = {"beginner": 900, "casual": 1200, "club": 1500, "strong": 2200, "fight": 3000}
    for lv, budget in budgets.items():
        uci, _, ms, depth, _ = engine_reply(fen, lv, ("e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6"))
        assert uci in legal, (lv, uci)
        assert ms < budget, (lv, ms)
    # mate guard holds even for the noisiest level: 20 beginner replies,
    # none may hang mate-in-1 in the losing-only-Kh8 position
    from chess_fight_llm.search import fight_move
    from backend.engine_service import get_engine
    eng = get_engine()
    bad = "6k1/5ppp/8/8/8/8/5PPP/4R1K1 b - - 0 1"
    for _ in range(20):
        u, _, _, _ = fight_move(eng, bad, max_depth=1, time_limit=0.3, topk=6, blunder_rate=0.25, avoid_repeat=False)
        assert u != "g8h8", u
