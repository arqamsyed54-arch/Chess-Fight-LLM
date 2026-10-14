"""Board <-> tokens and move <-> index. The model's entire vocabulary is moves."""
from __future__ import annotations
import chess

SEQ_LEN = 70
TOK_VOCAB = 17

PIECE_TO_ID = {
    None: 0,
    "P": 1, "N": 2, "B": 3, "R": 4, "Q": 5, "K": 6,
    "p": 7, "n": 8, "b": 9, "r": 10, "q": 11, "k": 12,
}
SIDE_WHITE, SIDE_BLACK = 13, 14
CASTLE_YES, CASTLE_NO = 15, 16


def encode_board(fen: str) -> list[int]:
    """FEN -> 70 token ids. Pure rules engine input; no learned shortcuts."""
    board = chess.Board(fen)
    toks: list[int] = [0] * SEQ_LEN
    for sq in range(64):
        piece = board.piece_at(sq)
        toks[sq] = PIECE_TO_ID[None if piece is None else piece.symbol()]
    toks[64] = SIDE_WHITE if board.turn == chess.WHITE else SIDE_BLACK
    toks[65] = CASTLE_YES if board.has_kingside_castling_rights(chess.WHITE) else CASTLE_NO
    toks[66] = CASTLE_YES if board.has_queenside_castling_rights(chess.WHITE) else CASTLE_NO
    toks[67] = CASTLE_YES if board.has_kingside_castling_rights(chess.BLACK) else CASTLE_NO
    toks[68] = CASTLE_YES if board.has_queenside_castling_rights(chess.BLACK) else CASTLE_NO
    toks[69] = 8 if board.ep_square is None else chess.square_file(board.ep_square)
    return toks


def _uci_variants(from_sq: int, to_sq: int, promo_rank: bool) -> list[str]:
    f = chess.square_name(from_sq) + chess.square_name(to_sq)
    if promo_rank:
        return [f + p for p in ("q", "r", "b", "n")]
    return [f]


def build_uci_vocab() -> list[str]:
    """Enumerate every geometrically possible UCI string.

    Covers king steps (+ explicit castling targets), knight jumps, all sliding
    destinations along rays, and pawn forward/double/capture patterns for both
    colors with full promotion expansion. Sorted for determinism.
    Real legal moves are always a subset, so coverage is enforced by test.
    """
    moves: set[str] = set()
    knight_d = [(1, 2), (2, 1), (2, -1), (1, -2), (-1, -2), (-2, -1), (-2, 1), (-1, 2)]
    ray_d = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]
    for fr in range(64):
        ff, rf = chess.square_file(fr), chess.square_rank(fr)
        # king one-steps
        for dx, dy in ray_d:
            tf, tr = ff + dx, rf + dy
            if 0 <= tf < 8 and 0 <= tr < 8:
                moves.add(chess.square_name(fr) + chess.square_name(chess.square(tf, tr)))
        # sliding destinations
        for dx, dy in ray_d:
            tf, tr = ff + dx, rf + dy
            while 0 <= tf < 8 and 0 <= tr < 8:
                moves.add(chess.square_name(fr) + chess.square_name(chess.square(tf, tr)))
                tf, tr = tf + dx, tr + dy
        # knights
        for dx, dy in knight_d:
            tf, tr = ff + dx, rf + dy
            if 0 <= tf < 8 and 0 <= tr < 8:
                moves.add(chess.square_name(fr) + chess.square_name(chess.square(tf, tr)))
        # pawn patterns for both colors from every square
        for direction, start_rank, promo_rank in ((1, 1, 7), (-1, 6, 0)):
            # single push
            tr = rf + direction
            if 0 <= tr < 8:
                promo = (tr == promo_rank)
                moves.update(_uci_variants(fr, chess.square(ff, tr), promo))
                # double push
                if rf == start_rank:
                    tr2 = rf + 2 * direction
                    moves.add(chess.square_name(fr) + chess.square_name(chess.square(ff, tr2)))
                # captures
                for df in (-1, 1):
                    tf = ff + df
                    if 0 <= tf < 8:
                        moves.update(_uci_variants(fr, chess.square(tf, tr), promo))
    # explicit castling UCI (also reachable as king 2-steps, kept for clarity)
    moves.update(["e1g1", "e1c1", "e8g8", "e8c8"])
    # en-passant target squares are pawn captures to empty squares: already covered
    return sorted(moves)


_UCI_VOCAB: list[str] | None = None
_MOVE_TO_IDX: dict[str, int] | None = None


def uci_vocab() -> list[str]:
    global _UCI_VOCAB
    if _UCI_VOCAB is None:
        _UCI_VOCAB = build_uci_vocab()
    return _UCI_VOCAB


def move_to_index() -> dict[str, int]:
    global _MOVE_TO_IDX
    if _MOVE_TO_IDX is None:
        _MOVE_TO_IDX = {m: i for i, m in enumerate(uci_vocab())}
    return _MOVE_TO_IDX


def encode_move(uci: str) -> int:
    return move_to_index()[uci]


def legal_mask(fen: str) -> list[bool]:
    """Boolean mask over vocab; True only for rules-engine legal moves."""
    board = chess.Board(fen)
    mask = [False] * len(uci_vocab())
    lut = move_to_index()
    for mv in board.legal_moves:
        u = mv.uci()
        if u not in lut:
            raise ValueError(f"legal move {u} missing from vocab — enumeration gap")
        mask[lut[u]] = True
    return mask


def legal_uci_list(fen: str) -> list[str]:
    return [m.uci() for m in chess.Board(fen).legal_moves]
