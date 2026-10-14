"""Training loop: policy CE + value MSE. CPU-friendly defaults."""
from __future__ import annotations
import argparse, os, random
import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader, random_split

from .config import ModelConfig, TrainConfig
from .data import ChessDataset, load_samples
from .model import ChessTransformer, count_parameters
from .tokenization import uci_vocab


def train_model(train_cfg: TrainConfig | None = None, model_cfg: ModelConfig | None = None):
    train_cfg = train_cfg or TrainConfig()
    model_cfg = model_cfg or ModelConfig()
    random.seed(train_cfg.seed)
    torch.manual_seed(train_cfg.seed)

    samples = load_samples(train_cfg.pgn_path, train_cfg.max_pgn_games,
                           train_cfg.synthetic_games, train_cfg.seed)
    assert samples, "no training samples (set synthetic_games>0 or give a PGN)"
    ds = ChessDataset(samples)
    n_val = max(1, int(0.05 * len(ds)))
    tr, va = random_split(ds, [len(ds) - n_val, n_val],
                          generator=torch.Generator().manual_seed(train_cfg.seed))
    tr_loader = DataLoader(tr, batch_size=train_cfg.batch_size, shuffle=True)
    va_loader = DataLoader(va, batch_size=train_cfg.batch_size)

    model = ChessTransformer(model_cfg, len(uci_vocab()))
    opt = torch.optim.AdamW(model.parameters(), lr=train_cfg.lr, weight_decay=train_cfg.weight_decay)
    print(f"params={count_parameters(model):,} move_vocab={len(uci_vocab())} samples={len(ds)}")

    best = float("inf")
    os.makedirs(train_cfg.out_dir, exist_ok=True)
    for ep in range(1, train_cfg.epochs + 1):
        model.train()
        tot = 0.0
        for toks, pol, val in tr_loader:
            logits, pred_v = model(toks)
            loss = F.cross_entropy(logits, pol) + train_cfg.value_weight * F.mse_loss(pred_v, val)
            opt.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
            tot += loss.item() * len(toks)
        model.eval()
        vtot, vacc, vn = 0.0, 0, 0
        with torch.no_grad():
            for toks, pol, val in va_loader:
                logits, pred_v = model(toks)
                vtot += (F.cross_entropy(logits, pol, reduction="sum")
                         + train_cfg.value_weight * F.mse_loss(pred_v, val, reduction="sum")).item()
                vacc += (logits.argmax(-1) == pol).sum().item()
                vn += len(toks)
        vloss = vtot / vn
        print(f"epoch {ep}: train_loss={tot/len(tr):.4f} val_loss={vloss:.4f} val_acc={vacc/vn:.3f}")
        if vloss < best:
            best = vloss
            torch.save({"model": model.state_dict(), "model_cfg": model_cfg.__dict__},
                       os.path.join(train_cfg.out_dir, "best.pt"))
    torch.save({"model": model.state_dict(), "model_cfg": model_cfg.__dict__},
               os.path.join(train_cfg.out_dir, "last.pt"))
    return model


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--epochs", type=int, default=3)
    ap.add_argument("--synthetic-games", type=int, default=200)
    ap.add_argument("--pgn", type=str, default="")
    ap.add_argument("--out-dir", type=str, default="checkpoints")
    a = ap.parse_args()
    train_model(TrainConfig(epochs=a.epochs, synthetic_games=a.synthetic_games,
                            pgn_path=a.pgn, out_dir=a.out_dir))
