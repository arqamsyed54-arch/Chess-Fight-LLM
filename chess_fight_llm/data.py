"""Data: PGN ingestion + offline synthetic generator + torch Dataset."""
from __future__ import annotations
import random
import chess
import chess.pgn
import torch
from torch.utils.data import Dataset

from .tokenization import encode_board, encode_move

PIECE_VALUES = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9, chess.KING: 0}


def result_to_value(result: str) -> float | None:
    return {"1-0": 1.0, "0-1": -1.0, "1/2-1/2": 0.0}.get(result)


def material_score(board: chess.Board) -> int:
    s = 0
    for pt, v in PIECE_VALUES.items():
        s += v * (len(board.pieces(pt, chess.WHITE)) - len(board.pieces(pt, chess.BLACK)))
    return s


def parse_pgn(path: str, max_games: int = 2000) -> list[tuple[str, str, float]]:
    """PGN -> (fen_before_move, uci, game_value_white_pov). Skips unfinished games."""
    out: list[tuple[str, str, float]] = []
    with open(path, encoding="utf-8", errors="ignore") as f:
        for _ in range(max_games):
            game = chess.pgn.read_game(f)
            if game is None:
                break
            v = result_to_value(game.headers.get("Result", "*"))
            if v is None:
                continue
            board = game.board()
            for mv in game.mainline_moves():
                out.append((board.fen(), mv.uci(), v))
                board.push(mv)
    return out


def _biased_random_move(board: chess.Board, rng: random.Random) -> chess.Move:
    """Pseudo-engine label: prefer captures/checks/mate, else random. Keeps pipeline
    runnable with zero downloads; replace with Stockfish labels for real strength."""
    legal = list(board.legal_moves)
    scored: list[tuple[float, chess.Move]] = []
    for mv in legal:
        board.push(mv)
        s = material_score(board) * (-1 if board.turn == chess.BLACK else 1)
        # score from mover's perspective: material swing + check/mate bonus + noise
        mover_white = not board.turn
        swing = s if mover_white else -s
        bonus = 0.0
        if board.is_checkmate():
            bonus = 100.0
        elif board.is_check():
            bonus = 1.5
        scored.append((swing + bonus + rng.random(), mv))
        board.pop()
    scored.sort(key=lambda x: x[0])
    # sample near the top so labels are strong-ish but not deterministic
    top = scored[-min(3, len(scored)):]
    return rng.choice(top)[1]


def generate_synthetic_games(n_games: int = 200, seed: int = 0, max_ply: int = 160) -> list[tuple[str, str, float]]:
    rng = random.Random(seed)
    out: list[tuple[str, str, float]] = []
    for _ in range(n_games):
        board = chess.Board()
        fens: list[str] = []
        ucis: list[str] = []
        while not board.is_game_over() and board.ply() < max_ply:
            fens.append(board.fen())
            mv = _biased_random_move(board, rng)
            ucis.append(mv.uci())
            board.push(mv)
        res = board.result()
        v = result_to_value(res)
        if v is None:
            v = 0.0 if board.is_insufficient_material() else (0.0 if board.can_claim_draw() else 0.0)
        # white-pov value already matches result_to_value convention
        out.extend((f, u, v) for f, u in zip(fens, ucis))
    return out


class ChessDataset(Dataset):
    def __init__(self, samples: list[tuple[str, str, float]]):
        self.toks = [encode_board(f) for f, _, _ in samples]
        self.pol = [encode_move(u) for _, u, _ in samples]
        self.val = [float(v) for _, _, v in samples]

    def __len__(self):
        return len(self.pol)

    def __getitem__(self, i):
        return (
            torch.tensor(self.toks[i], dtype=torch.long),
            torch.tensor(self.pol[i], dtype=torch.long),
            torch.tensor(self.val[i], dtype=torch.float32),
        )


def load_samples(pgn_path: str = "", max_pgn_games: int = 2000,
                 synthetic_games: int = 200, seed: int = 0):
    samples = generate_synthetic_games(synthetic_games, seed) if synthetic_games > 0 else []
    if pgn_path:
        samples = parse_pgn(pgn_path, max_pgn_games) + samples
    return samples
