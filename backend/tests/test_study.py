"""Study systems + new game options: puzzles, repertoire, candidates, adaptive,
stats, daily mates (ALL verified mate by rules), drills, takebacks, odds, book learning."""
import chess
import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend import store

client = TestClient(app)


@pytest.fixture(autouse=True)
def _clean():
    store.clear_all()
    yield
    store.clear_all()


def new_game(**kw):
    r = client.post("/api/games", json=kw)
    assert r.status_code == 200, r.text
    return r.json()


def test_34_puzzles_list_and_solve_flow():
    g = new_game(player_color="white", level="beginner")
    client.post(f"/api/games/{g['id']}/move", json={"uci": "g1h3"})
    st = client.get(f"/api/games/{g['id']}").json()
    if st["status"] == "ongoing" and st["turn"] == st["player_color"] and st["legal_moves"]:
        client.post(f"/api/games/{g['id']}/move", json={"uci": st["legal_moves"][0]})
    client.post(f"/api/games/{g['id']}/resign")
    pz = client.get(f"/api/games/{g['id']}/puzzles").json()
    assert isinstance(pz, list)
    if pz:
        p = pz[0]
        assert {"ply", "played", "fen_before", "swing"} <= set(p)
        r = client.post("/api/puzzles/solve", json={"fen": p["fen_before"], "uci": "a2a3"}).json()
        assert "solution" in r and isinstance(r["correct"], bool)
        r2 = client.post("/api/puzzles/solve", json={"fen": p["fen_before"], "uci": r["solution"]}).json()
        assert r2["correct"] is True
    # startpos solve works standalone
    s = client.post("/api/puzzles/solve", json={"fen": chess.STARTING_FEN, "uci": "e2e4"}).json()
    assert "solution" in s


def test_35_repertoire_lines_and_try():
    lines = client.get("/api/repertoire").json()
    assert len(lines) >= 10 and all({"id", "eco", "name", "moves"} <= set(l) for l in lines)
    naj = next(l for l in lines if l["id"] == "B90")
    assert naj["moves"][:3] == ["e4", "c5", "Nf3"]
    ok = client.post("/api/repertoire/try", json={"line_id": "B90", "ply": 0, "uci": "e2e4"}).json()
    assert ok["correct"] is True
    bad = client.post("/api/repertoire/try", json={"line_id": "B90", "ply": 0, "uci": "a2a3"}).json()
    assert bad["correct"] is False and bad["expected"] == "e2e4"
    assert client.post("/api/repertoire/try", json={"line_id": "ZZZ", "ply": 0, "uci": "e2e4"}).status_code == 400


def test_36_candidates_gated_and_shaped():
    g = new_game()
    assert client.get(f"/api/games/{g['id']}/candidates").status_code == 403  # no mid-game hints
    client.post(f"/api/games/{g['id']}/move", json={"uci": "e2e4"})
    client.post(f"/api/games/{g['id']}/resign")
    cs = client.get(f"/api/games/{g['id']}/candidates?ply=0").json()
    assert len(cs) == 3 and all({"uci", "san", "score"} <= set(c) for c in cs)
    assert client.get(f"/api/games/{g['id']}/candidates?ply=99").status_code == 400


def test_37_adaptive_suggest_steps_down_after_losses():
    p = client.post("/api/profiles", json={"name": "ada"}).json()
    assert client.get(f"/api/profiles/{p['id']}/suggest").json()["suggested"] == "club"
    for _ in range(2):
        g = new_game(profile_id=p["id"], level="club")
        client.post(f"/api/games/{g['id']}/resign")
    s = client.get(f"/api/profiles/{p['id']}/suggest").json()
    assert s["suggested"] == "casual" and "table" in s


def test_38_stats_shape_and_phases():
    p = client.post("/api/profiles", json={"name": "stat"}).json()
    g = new_game(profile_id=p["id"])
    client.post(f"/api/games/{g['id']}/move", json={"uci": "e2e4"})
    client.post(f"/api/games/{g['id']}/resign")
    st = client.get(f"/api/stats?profile_id={p['id']}").json()
    assert st["count"] == 1 and len(st["games"]) == 1
    assert set(st["phases"]) == {"opening", "middlegame", "endgame"}
    assert isinstance(st["openings"], list)


def test_39_every_daily_mates_by_rules():
    from backend.study import DAILIES, daily_for, daily_try
    assert len(DAILIES) >= 8
    for dz in DAILIES:
        b = chess.Board(dz["fen"])
        mv = b.parse_uci(dz["solution"])
        assert mv in b.legal_moves, (dz["name"], "illegal solution")
        b.push(mv)
        assert b.is_checkmate(), (dz["name"], "solution does not mate")
    d1 = daily_for("2026-10-14")
    assert daily_for("2026-10-14")["index"] == d1["index"]  # deterministic
    assert "solution" not in d1  # never leak the answer
    full = next(x for x in DAILIES if x["fen"] == d1["fen"])
    assert daily_try("2026-10-14", full["solution"])["correct"] is True
    assert daily_try("2026-10-14", "a2a3")["correct"] is False


def test_40_drills_from_fen_and_goal_tracking():
    ds = client.get("/api/drills").json()
    assert set(ds) == {"kqk", "krk", "kpk"}
    g = new_game(player_color="white", level="beginner", fen=ds["kpk"]["fen"], drill="kpk")
    assert g["drill"] == "kpk"
    st = client.get(f"/api/games/{g['id']}/drill").json()
    assert st == {"drill": "kpk", "done": False}
    assert client.post("/api/games", json={"fen": "nope"}).status_code == 400
    assert client.post("/api/games", json={"fen": "7k/8/8/8/8/8/8/6K1 w - - 0 1"}).status_code == 400  # lone kings: over? (valid draw pos -> rejected as game-over)


def test_41_takeback_token_and_time_odds():
    g = new_game(level="club")
    assert g["takebacks_left"] == 1
    assert client.post(f"/api/games/{g['id']}/undo").status_code == 400  # nothing to undo
    assert client.get(f"/api/games/{g['id']}").json()["takebacks_left"] == 1  # not charged on failure
    client.post(f"/api/games/{g['id']}/move", json={"uci": "e2e4"})
    u1 = client.post(f"/api/games/{g['id']}/undo")
    assert u1.status_code == 200 and u1.json()["takebacks_left"] == 0
    assert client.post(f"/api/games/{g['id']}/undo").status_code == 403  # token spent
    o = new_game(time_control="custom", custom_ms=300000, custom_ms_engine=60000)
    assert o["clocks_ms"]["white"] == 300000 and o["clocks_ms"]["black"] == 60000
    assert client.post("/api/games", json={"time_control": "custom", "custom_ms": -5}).status_code == 422


def test_42_book_learning_weights():
    from backend.openings import learned_weights, book_history_for, choose_book
    assert learned_weights(["e4"], []) is None  # no data, no opinion
    assert choose_book(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O"]) is None  # out of book
    hist = book_history_for([
        {"profile_id": "p", "status": "resign", "winner": "black", "engine_color": "black",
         "player_color": "white", "sans": ["e4", "c5", "Nf3"]},
        {"profile_id": "p", "status": "resign", "winner": "black", "engine_color": "black",
         "player_color": "white", "sans": ["e4", "c5", "Nf3"]},
        {"profile_id": "q", "status": "resign", "winner": "white", "engine_color": "black",
         "player_color": "white", "sans": ["e4", "c5", "Nf3"]},
    ], "p")
    w = learned_weights(["e4"], hist.get(("e4",), []))
    assert w is not None
    assert w[["e5", "c5", "e6", "c6"].index("c5")] == max(w)  # 2-0 in the Sicilian
    assert choose_book(["e4"], hist, __import__("random").Random(0)) in ("e5", "c5", "e6", "c6")
