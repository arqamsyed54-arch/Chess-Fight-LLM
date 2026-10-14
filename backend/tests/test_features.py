"""Feature tests for the Stitch-UI functions: undo, keyboard moves, analysis,
ECO openings, batch export, engine telemetry. Runs against the live API."""
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


def test_19_undo_allowed_on_casual_levels_only():
    g = new_game(player_color="white", level="beginner")
    r = client.post(f"/api/games/{g['id']}/move", json={"uci": "e2e4"})
    assert len(r.json()["moves"]) == 2
    u = client.post(f"/api/games/{g['id']}/undo")
    assert u.status_code == 200
    assert u.json()["moves"] == []  # both plies taken back
    assert u.json()["status"] == "ongoing"
    # club/strong/fight: one takeback token per game (free on beginner/casual)
    for lvl in ("club", "strong", "fight"):
        g2 = new_game(player_color="white", level=lvl)
        client.post(f"/api/games/{g2['id']}/move", json={"uci": "e2e4"})
        u2 = client.post(f"/api/games/{g2['id']}/undo")
        assert u2.status_code == 200, (lvl, u2.text)
        assert u2.json()["takebacks_left"] == 0
        assert client.post(f"/api/games/{g2['id']}/undo").status_code == 403  # token spent


def test_20_keyboard_move_text_uci_and_san():
    g = new_game(player_color="white", level="casual")
    r = client.post(f"/api/games/{g['id']}/move-text", json={"text": "e2e4"})
    assert r.status_code == 200 and r.json()["moves"][0] == "e2e4"
    # find a SAN for the player: play on until player to move, use first legal as SAN via board
    st = r.json()
    gid = st["id"]
    for _ in range(4):
        st = client.get(f"/api/games/{gid}").json()
        if st["status"] != "ongoing":
            break
        if st["turn"] != st["player_color"]:
            break
        b = chess.Board(st["fen"])
        san = b.san(next(iter(b.legal_moves)))
        r2 = client.post(f"/api/games/{gid}/move-text", json={"text": san})
        assert r2.status_code == 200, (san, r2.text)
    bad = client.post(f"/api/games/{gid}/move-text", json={"text": "banana"})
    assert bad.status_code in (400,)


def test_21_analysis_endpoint_shape_and_accuracy():
    g = new_game(player_color="white", level="beginner")
    gid = g["id"]
    a = client.get(f"/api/games/{gid}/analysis").json()
    assert a["plies"] == 0 and a["player_accuracy"] == 100.0
    assert a["eco"]["eco"] == "A00"
    client.post(f"/api/games/{gid}/move", json={"uci": "e2e4"})
    a2 = client.get(f"/api/games/{gid}/analysis").json()
    assert a2["plies"] == 2
    assert len(a2["evals"]) == 3 and all(-1.0 <= v <= 1.0 for v in a2["evals"])
    assert 0 <= a2["player_accuracy"] <= 100 and 0 <= a2["engine_accuracy"] <= 100
    assert "note" in a2  # honesty label present
    assert "insights" in a2 and "blunders" in a2["insights"] and "best_move" in a2["insights"]


def test_22_eco_classification_najdorf_and_french():
    from backend.openings import classify
    naj = ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"]
    assert classify(naj)["eco"] == "B90"
    assert classify(["e4", "e6", "d4"])["eco"] == "C00"
    assert classify([])["eco"] == "A00"
    # served inside game state too
    g = new_game(player_color="white", level="casual")
    assert g["opening"]["eco"] == "A00"
    client.post(f"/api/games/{g['id']}/move", json={"uci": "e2e4"})
    st = client.get(f"/api/games/{g['id']}").json()
    assert st["opening"]["eco"] in ("B00", "B12", "B20", "B27", "C00", "C20", "A00")


def test_24_analysis_incremental_and_fight_faster():
    import time
    g = new_game(player_color="white", level="fight")
    gid = g["id"]
    r = client.post(f"/api/games/{gid}/move", json={"uci": "e2e4"})
    assert r.status_code == 200
    assert r.json()["engine_telemetry"]["ms"] < 3000  # PRD move budget
    a1 = client.get(f"/api/games/{gid}/analysis").json()
    assert len(a1["evals"]) == 3
    # second move, then incremental analysis must reuse the prefix, not recompute
    st = client.get(f"/api/games/{gid}").json()
    if st["status"] == "ongoing" and st["turn"] == st["player_color"] and st["legal_moves"]:
        client.post(f"/api/games/{gid}/move", json={"uci": st["legal_moves"][0]})
        t0 = time.perf_counter()
        a2 = client.get(f"/api/games/{gid}/analysis").json()
        dt = time.perf_counter() - t0
        assert a2["evals"][:3] == a1["evals"]  # prefix preserved
        assert len(a2["evals"]) == len(client.get(f"/api/games/{gid}").json()["moves"]) + 1
        assert dt < 5.0  # only new positions evaluated


def test_23_batch_pgn_export_and_telemetry_fields():
    g = new_game(player_color="white", level="strong")
    client.post(f"/api/games/{g['id']}/move", json={"uci": "d2d4"})
    st = client.get(f"/api/games/{g['id']}").json()
    assert "engine_telemetry" in st and st["engine_telemetry"]["ms"] < 3000
    assert "duration_s" in st and st["duration_s"] >= 0
    r = client.get("/api/games/export")
    assert r.status_code == 200 and "White" in r.text
    assert "attachment" in r.headers.get("content-disposition", "")


def test_30_stateless_move_and_legal_contracts():
    import chess as _ch
    start = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    lg = client.post("/api/legal", json={"fen": start}).json()
    assert len(lg["moves"]) == 20 and lg["turn"] == "white"
    assert client.post("/api/legal", json={"fen": "nope"}).status_code == 400
    for lvl in ("beginner", "casual", "club", "strong", "fight"):
        r = client.post("/api/move", json={"fen": start, "level": lvl, "sans": []})
        assert r.status_code == 200, (lvl, r.text)
        uci = r.json()["move"]
        assert _ch.Move.from_uci(uci) in _ch.Board(start).legal_moves, (lvl, uci)
        assert r.json()["ms"] < 3000
    bad = client.post("/api/move", json={"fen": start, "level": "gm"})
    assert bad.status_code == 400
