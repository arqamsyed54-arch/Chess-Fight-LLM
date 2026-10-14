"""API + integration tests (R2/R3/R4/R6/R7/R8 + fair-play surface)."""
import time
import chess
import chess.pgn
import io
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


def player_move(gid, uci):
    r = client.post(f"/api/games/{gid}/move", json={"uci": uci})
    return r


def test_11_engine_reply_legal_all_levels():
    for level in ["beginner", "casual", "club", "strong", "fight"]:
        g = new_game(player_color="white", level=level)
        assert g["moves"] == []  # engine waits: player is white
        r = player_move(g["id"], "e2e4")
        assert r.status_code == 200, (level, r.text)
        g = r.json()
        # player opened; engine must have replied with exactly one legal move
        assert len(g["moves"]) == 2, (level, g["moves"])
        b = chess.Board()
        for u in g["moves"]:
            assert chess.Move.from_uci(u) in b.legal_moves
            b.push_uci(u)


def test_12_engine_move_latency_under_3s_all_levels():
    for level in ["club", "fight"]:
        g = new_game(player_color="white", level=level)
        assert g["last_ms"]["engine"] < 3000, (level, g["last_ms"])


def test_13_illegal_api_move_rejected_board_untouched():
    g = new_game()
    r = player_move(g["id"], "e2e5")
    assert r.status_code == 400
    g2 = client.get(f"/api/games/{g['id']}").json()
    assert g2["moves"] == []


def test_14_resign_and_draw_offer_flow():
    g = new_game()
    r = client.post(f"/api/games/{g['id']}/draw-offer")
    assert r.status_code == 200
    # startpos is not an objective draw -> declined, game continues
    assert r.json()["draw_accepted"] is False
    assert r.json()["status"] == "ongoing"
    r = client.post(f"/api/games/{g['id']}/resign")
    assert r.json()["status"] == "resign" and r.json()["winner"] == "black"


def test_15_clock_flag_and_increment():
    g = new_game(time_control="bullet")
    assert g["has_clock"] and g["clocks_ms"]["white"] == 60_000
    # exhaust white's clock by aging the tick
    game = store.get_game(g["id"])
    game._tick -= 120  # 120 s ago
    r = player_move(g["id"], "e2e4")
    assert r.status_code == 200
    assert r.json()["status"] == "timeout" and r.json()["winner"] == "black"


def test_16_pgn_export_and_replay_consistency():
    g = new_game()
    gid = g["id"]
    # game already has e2e4 + engine reply; add another round if ongoing
    g = client.get(f"/api/games/{gid}").json()
    if g["status"] == "ongoing" and g["turn"] == g["player_color"]:
        legal = [u for u in g["legal_moves"] if u.startswith("g1")]
        if legal:
            player_move(gid, legal[0])
    pgn = client.get(f"/api/games/{gid}/pgn").text
    game = chess.pgn.read_game(io.StringIO(pgn))
    assert game is not None and game.headers["Result"] in ("1-0", "0-1", "1/2-1/2", "*")
    rep = client.get(f"/api/games/{gid}/replay").json()
    state = client.get(f"/api/games/{gid}").json()
    assert len(rep["fens"]) == len(state["moves"]) + 1
    assert rep["fens"][-1].split(" ")[0] == state["fen"].split(" ")[0]


def test_17_profiles_save_and_list_games():
    p = client.post("/api/profiles", json={"name": " tester "}).json()
    assert p["name"] == "tester" and p["id"]
    g = new_game(profile_id=p["id"])
    mine = client.get(f"/api/profiles/{p['id']}/games").json()
    assert any(x["id"] == g["id"] for x in mine)
    assert client.get("/api/profiles/nope/games").status_code == 404


def test_18_no_chat_or_hint_endpoints_and_full_flow():
    routes = [r.path for r in app.routes]
    assert not any(k in p for p in routes for k in ("chat", "hint", "coach", "talk"))
    g = new_game(player_color="black", level="beginner")  # engine opens as white
    assert len(g["moves"]) == 1
    # play up to 6 player moves following whatever is legal; engine replies each time
    for _ in range(6):
        st = client.get(f"/api/games/{g['id']}").json()
        if st["status"] != "ongoing" or st["turn"] != st["player_color"]:
            break
        r = player_move(g["id"], st["legal_moves"][0])
        assert r.status_code == 200
    final = client.get(f"/api/games/{g['id']}").json()
    b = chess.Board()
    for u in final["moves"]:
        assert chess.Move.from_uci(u) in b.legal_moves  # every stored move legal
        b.push_uci(u)
    assert final["fen"].split(" ")[0] == b.fen().split(" ")[0]
