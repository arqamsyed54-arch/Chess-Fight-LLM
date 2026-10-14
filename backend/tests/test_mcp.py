"""MCP mode: handshake, tools, referee LLM-vs-LLM game, fairness gates."""
import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend import store
from backend.mcp_server import new_game, get_state, legal_moves, play_move, resign, offer_draw, get_pgn

client = TestClient(app)


@pytest.fixture(autouse=True)
def _clean():
    store.clear_all()
    yield
    store.clear_all()


def test_43_mcp_handshake():
    # NOTE: the MCP transport rejects the TestClient's fake `testserver`
    # host (DNS-rebinding protection); a localhost Host header is required.
    # Live end-to-end is additionally proven by tmp/opencode/live_mcp.py.
    with TestClient(app, base_url="http://localhost:8000") as c:
        r = c.post("/mcp/", json={"jsonrpc": "2.0", "id": 1, "method": "initialize",
                                  "params": {"protocolVersion": "2025-03-26", "capabilities": {},
                                             "clientInfo": {"name": "t", "version": "1"}}},
                   headers={"Accept": "application/json, text/event-stream",
                            "Origin": "http://localhost:8000"})
    assert r.status_code == 200, r.text
    import json as _json
    body = None
    for line in r.text.splitlines():
        if line.startswith("data:"):
            body = _json.loads(line[5:].strip())
            break
    assert body is not None and "result" in body, r.text[:200]


def test_44_mcp_agent_vs_engine_flow():
    g = new_game("white", "beginner", "none", True, "")
    assert g["fen"].startswith("rnbqkbnr") and g.get("source") != "bogus"
    assert get_state(g["game_id"])["game_id"] == g["game_id"]
    lm = legal_moves(g["game_id"])
    assert len(lm["moves"]) == 20 and lm["turn"] == "white"
    st = play_move(g["game_id"], "e2e4")
    assert "error" not in st, st
    assert st["moves"][:2][0] == "e2e4" and len(st["moves"]) == 2  # engine replied
    assert legal_moves(g["game_id"], "xyz")["moves"] == []
    bad = play_move(g["game_id"], "e2e5")
    assert "error" in bad  # illegal rejected, board untouched
    assert len(get_state(g["game_id"])["moves"]) == 2
    pgn = get_pgn(g["game_id"])["pgn"]
    assert "e4" in pgn
    d = offer_draw(g["game_id"])
    assert d["draw_accepted"] is False  # startpos is no fair draw
    r = resign(g["game_id"])
    assert r["status"] == "resign" and r["winner"] == "black"
    assert get_state("nope").get("error")


def test_45_mcp_referee_llm_vs_llm():
    g = new_game("white", "club", "none", False, "")
    gid = g["game_id"]
    assert get_state(gid)["referee"] is True
    import chess
    b = chess.Board()
    for _ in range(6):
        got = legal_moves(gid)
        assert got["turn"] == ("white" if b.turn == chess.WHITE else "black")
        u = sorted(got["moves"])[0]  # deterministic "LLM A/B" stand-ins
        st = play_move(gid, u)
        assert "error" not in st, st
        b.push_uci(u)
    st = get_state(gid)
    assert len(st["moves"]) == 6 and st["status"] == "ongoing"
    assert st["fen"].split(" ")[0] == b.fen().split(" ")[0]  # server is source of truth
    d = offer_draw(gid)
    assert d["draw_accepted"] is False and "referee" in d.get("note", "")
