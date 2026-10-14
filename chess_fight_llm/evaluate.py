"""Honest eval: accuracy, masked-illegal rate (=0 by construction), speed, size."""
from __future__ import annotations
import time
import chess
import torch
from torch.utils.data import DataLoader

from .data import ChessDataset
from .infer import ChessFightEngine
from .model import count_parameters, model_size_mb


def accuracy(model, dataset, batch_size: int = 256) -> dict:
    loader = DataLoader(dataset, batch_size=batch_size)
    model.eval()
    top1 = top3 = n = 0
    with torch.no_grad():
        for toks, pol, _ in loader:
            logits, _ = model(toks)
            top1 += (logits.argmax(-1) == pol).sum().item()
            top3 += (logits.topk(3, dim=-1).indices == pol.unsqueeze(-1)).any(-1).sum().item()
            n += len(toks)
    return {"top1": top1 / n, "top3": top3 / n, "n": n}


def illegal_move_rate(engine: ChessFightEngine, fens: list[str]) -> float:
    """Every reply must survive the rules engine. Masking makes this 0; the test
    proves it instead of trusting the network."""
    bad = 0
    for fen in fens:
        uci = engine.predict(fen)[0]
        try:
            mv = chess.Board(fen).parse_uci(uci)
            if mv not in chess.Board(fen).legal_moves:
                bad += 1
        except ValueError:
            bad += 1
    return bad / max(1, len(fens))


def latency_ms(engine: ChessFightEngine, fen: str = chess.STARTING_FEN, reps: int = 30) -> dict:
    engine.predict(fen)  # warmup
    t0 = time.perf_counter()
    for _ in range(reps):
        engine.predict(fen)
    dt = (time.perf_counter() - t0) / reps * 1000
    return {"mean_ms": dt, "budget_ms": 3000, "ok": dt < 3000}


def size_report(engine: ChessFightEngine) -> dict:
    n = count_parameters(engine.model)
    return {"params": n, "fp32_mb": model_size_mb(engine.model, 4.0),
            "int8_mb": model_size_mb(engine.model, 1.0), "under_10mb_int8": model_size_mb(engine.model, 1.0) < 10}
