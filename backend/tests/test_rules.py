"""Rules tests (R1 full legality + R5 honest resign/draw). Pure logic, no network."""
import chess
from backend.game import ChessGame, GameError


def play(game: ChessGame, ucis: list[str]):
    for u in ucis:
        by = "player" if game._mover_color() == game.player_color else "engine"
        game.apply_uci(u, by=by)


def test_1_startpos_20_legal_moves():
    g = ChessGame()
    assert g.board.fen().startswith("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR")
    assert len(g.legal_moves()) == 20


def test_2_scholars_mate_is_checkmate():
    g = ChessGame()
    play(g, ["e2e4", "e7e5", "d1h5", "b8c6", "f1c4", "g8f6", "h5f7"])
    assert g.status == "checkmate" and g.winner == "white"


def test_3_kingside_castling_legal():
    g = ChessGame()
    play(g, ["e2e4", "e7e5", "g1f3", "b8c6", "f1e2", "g8f6"])
    g.apply_uci("e1g1", by="player" if g._mover_color() == g.player_color else "engine")
    assert g.board.piece_at(chess.G1).symbol() == "K"
    assert g.board.piece_at(chess.F1).symbol() == "R"


def test_4_en_passant_legal():
    g = ChessGame()
    play(g, ["e2e4", "a7a6", "e4e5", "d7d5", "e5d6"])  # ep capture
    assert g.board.piece_at(chess.D6).symbol() == "P"
    assert g.board.piece_at(chess.D5) is None


def test_5_promotion_legal():
    g = ChessGame(player_color="white")
    g.board.set_fen("8/2P5/8/8/8/1k6/8/4K3 w - - 0 1")
    g.apply_uci("c7c8q", by="player")
    assert g.board.piece_at(chess.C8).symbol() == "Q"


def test_6_repetition_draw():
    g = ChessGame()
    play(g, ["g1f3", "g8f6", "f3g1", "f6g8"] * 2)  # 3x startpos
    assert g.status == "repetition" and g.winner == "draw"


def test_7_fifty_move_draw():
    g = ChessGame()
    g.board.set_fen("k7/8/8/8/8/8/8/K6R w - - 99 60")
    g.apply_uci("h1h2", by="player")
    assert g.status == "fifty" and g.winner == "draw"


def test_8_insufficient_material_draw():
    g = ChessGame()
    g.board.set_fen("k7/8/8/8/8/8/8/KB6 w - - 0 1")
    g.board.push_uci("b1c2")
    g._refresh_terminal()
    assert g.status == "insufficient" and g.winner == "draw"


def test_9_illegal_move_rejected():
    g = ChessGame()
    try:
        g.apply_uci("e2e5", by="player")  # pawn cannot jump 3
        assert False, "should have raised"
    except GameError:
        pass
    assert len(g.moves) == 0  # board untouched


def test_10_no_early_resign_and_no_fantasy_draw():
    from backend.engine_service import get_engine
    eng = get_engine()
    assert eng.should_resign(chess.STARTING_FEN, 0.0) is False
    assert eng.should_accept_draw(chess.STARTING_FEN, 2.0) is False
    assert eng.should_accept_draw("k7/8/8/8/8/8/8/K7 w - - 0 1", 0.0) is True
