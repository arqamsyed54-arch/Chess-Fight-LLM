"""Inference: the model speaks only UCI moves. Legality enforced by python-chess,
never trusted to the network. Includes honest resign/draw + handicap levels."""
from __future__ import annotations
import random
import chess
import torch

from .config import LEVELS, ModelConfig
from .model import ChessTransformer
from .tokenization import encode_board, legal_mask, uci_vocab, legal_uci_list


class ChessFightEngine:
    def __init__(self, checkpoint: str = "", level: str = "club",
                 model_cfg: ModelConfig | None = None, device: str = "cpu", seed: int = 0):
        self.cfg = model_cfg or ModelConfig()
        self.model = ChessTransformer(self.cfg, len(uci_vocab()))
        if checkpoint:
            sd = torch.load(checkpoint, map_location=device, weights_only=True)
            state = sd.get("model", sd)
            self.model.load_state_dict(state)
        self.model.eval().to(device)
        self.device = device
        self.trained = bool(checkpoint)  # False = random weights: play is tactics+book, evals provisional
        self.rng = random.Random(seed)
        self.set_level(level)
        self._bad_streak = 0  # consecutive near-lost evaluations (for honest resign)

    def set_level(self, level: str):
        assert level in LEVELS, f"unknown level {level}"
        self.level = level
        self.lcfg = LEVELS[level]

    @torch.no_grad()
    def _raw(self, fen: str):
        toks = torch.tensor([encode_board(fen)], dtype=torch.long, device=self.device)
        return self.model(toks)

    def evaluate(self, fen: str) -> float:
        """White-perspective score in [-1, 1]."""
        _, v = self._raw(fen)
        return float(v.item())

    @torch.no_grad()
    def evaluate_batch(self, fens: list[str]) -> list[float]:
        """One forward pass for many positions: the search's batch lane."""
        if not fens:
            return []
        toks = torch.tensor([encode_board(f) for f in fens], dtype=torch.long, device=self.device)
        _, v = self.model(toks)
        return [float(x) for x in v.tolist()]

    def predict(self, fen: str, level: str = "") -> tuple[str, float]:
        """Returns (uci, value_white_pov). Always legal; raises if no legal moves."""
        if level:
            self.set_level(level)
        board = chess.Board(fen)
        legal = list(board.legal_moves)
        if not legal:
            raise ValueError("no legal moves in position " + fen)
        logits, value = self._raw(fen)
        logits = logits.squeeze(0)
        mask = torch.tensor(legal_mask(fen), device=logits.device)
        logits = torch.where(mask, logits, torch.tensor(float("-inf"), device=logits.device))
        t, k = self.lcfg["temperature"], self.lcfg["top_k"]
        order = torch.argsort(logits, descending=True).tolist()
        cands = [uci_vocab()[i] for i in order[:max(1, k)] if mask[i]]
        if not cands:
            cands = [m.uci() for m in legal]
        if t <= 0.0 or self.level in ("strong", "fight"):
            pick = cands[0]
        else:
            weights = [max(1e-6, float(logits[uci_vocab().index(u)] / max(t, 1e-6))) for u in cands]
            # softmax over scaled logits for handicap variety
            import math
            mx = max(weights)
            exps = [math.exp(w - mx) for w in weights]
            s = sum(exps)
            r = self.rng.random() * s
            acc, pick = 0.0, cands[0]
            for u, e in zip(cands, exps):
                acc += e
                if r <= acc:
                    pick = u
                    break
        # Final rules-engine gate: never emit anything illegal.
        if pick not in legal_uci_list(fen):
            pick = self.rng.choice(legal).uci()
        assert pick in legal_uci_list(fen), "legality gate failed"
        return pick, float(value.item())

    # ---- honest game management (R5) ----
    def should_resign(self, fen: str, value: float | None = None) -> bool:
        """Resign only when truly lost: near-certain loss sustained + game developed.
        Never resigns from draws, unclear positions, or early game."""
        board = chess.Board(fen)
        v = self.evaluate(fen) if value is None else value
        v_black_pov = -v if board.turn == chess.BLACK else v  # side-to-move perspective
        if v_black_pov < -0.95 and board.ply() >= 20 and not board.can_claim_draw():
            self._bad_streak += 1
        else:
            self._bad_streak = 0
        return self._bad_streak >= 3 and board.ply() >= 30

    def should_accept_draw(self, fen: str, value: float | None = None) -> bool:
        """Accepts only objectively fair draws: even eval AND a real drawing
        mechanism (repetition/50-move/insufficient/dead endgame)."""
        board = chess.Board(fen)
        v = self.evaluate(fen) if value is None else value
        if abs(v) > 0.15:
            return False
        if (board.is_insufficient_material() or board.can_claim_draw()
                or board.is_fifty_moves() or board.is_repetition(2)):
            return True
        # dead K+minor vs K+minor style endgames with no pawns/rooks/queens
        pieces = [p.symbol().upper() for p in board.piece_map().values() if p.symbol().upper() != "K"]
        if not pieces or set(pieces) <= {"B", "N"} and len(pieces) <= 2:
            return True
        return False
