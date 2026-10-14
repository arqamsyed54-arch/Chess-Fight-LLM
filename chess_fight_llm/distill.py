"""Distill Stockfish into the 30M net: policy CE on SF bestmove + value MSE.
Run: py -m chess_fight_llm.distill --data data/sf_labels.jsonl --epochs 5 --out checkpoints/distilled
Gate: ships checkpoints/distilled/best.pt only if val top-1 improves over the
random-weight baseline measured at start. Progress -> checkpoints/distilled/progress.jsonl
"""
from __future__ import annotations
import argparse, json, os, random, time
import torch
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader, random_split

from .config import ModelConfig
from .model import ChessTransformer, count_parameters
from .tokenization import encode_board, encode_move, uci_vocab


class SFDistillDataset(Dataset):
    def __init__(self, path: str):
        self.rows = [json.loads(l) for l in open(path, encoding="utf-8") if l.strip()]
        self.toks = [encode_board(r["fen"]) for r in self.rows]
        self.pol = [encode_move(r["best"]) for r in self.rows]
        self.val = [float(r["value"]) for r in self.rows]

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, i):
        return (torch.tensor(self.toks[i], dtype=torch.long),
                torch.tensor(self.pol[i], dtype=torch.long),
                torch.tensor(self.val[i], dtype=torch.float32))


def evaluate(model, loader, value_weight: float):
    model.eval()
    tot, top1, n = 0.0, 0, 0
    with torch.no_grad():
        for toks, pol, val in loader:
            logits, pv = model(toks)
            tot += (F.cross_entropy(logits, pol, reduction="sum")
                    + value_weight * F.mse_loss(pv, val, reduction="sum")).item()
            top1 += (logits.argmax(-1) == pol).sum().item()
            n += len(toks)
    return tot / n, top1 / n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=str, default="data/sf_labels.jsonl")
    ap.add_argument("--epochs", type=int, default=5)
    ap.add_argument("--batch", type=int, default=32)
    ap.add_argument("--lr", type=float, default=2e-4)
    ap.add_argument("--value-weight", type=float, default=0.3)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--out", type=str, default="checkpoints/distilled")
    ap.add_argument("--resume", action="store_true", help="continue from last.pt if present")
    a = ap.parse_args()
    random.seed(a.seed)
    torch.manual_seed(a.seed)
    t0 = time.perf_counter()
    ds = SFDistillDataset(a.data)
    assert len(ds) > 100, "need labeled data first: py -m chess_fight_llm.label"
    n_val = max(64, int(0.08 * len(ds)))
    tr, va = random_split(ds, [len(ds) - n_val, n_val], generator=torch.Generator().manual_seed(a.seed))
    tr_loader = DataLoader(tr, batch_size=a.batch, shuffle=True)
    va_loader = DataLoader(va, batch_size=a.batch)
    cfg = ModelConfig()
    model = ChessTransformer(cfg, len(uci_vocab()))
    print(f"params={count_parameters(model):,} samples={len(ds)}", flush=True)
    base_loss, base_acc = evaluate(model, va_loader, a.value_weight)
    print(f"baseline val_loss={base_loss:.4f} top1={base_acc:.4f}", flush=True)
    opt = torch.optim.AdamW(model.parameters(), lr=a.lr)
    os.makedirs(a.out, exist_ok=True)
    start_ep = 1
    if a.resume:
        lp = os.path.join(a.out, "last.pt")
        if os.path.exists(lp):
            try:
                model.load_state_dict(torch.load(lp, map_location="cpu", weights_only=True)["model"])
                start_ep = 2  # approx: continue schedule; progress log stays append-only
                print("resumed from last.pt", flush=True)
            except Exception as e:
                print("resume failed, from scratch:", e, flush=True)
    log = open(os.path.join(a.out, "progress.jsonl"), "a")
    best, best_acc = float("inf"), base_acc
    for ep in range(start_ep, a.epochs + 1):
        model.train()
        for toks, pol, val in tr_loader:
            logits, pv = model(toks)
            loss = F.cross_entropy(logits, pol) + a.value_weight * F.mse_loss(pv, val)
            opt.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
        vloss, vacc = evaluate(model, va_loader, a.value_weight)
        row = {"epoch": ep, "val_loss": round(vloss, 4), "val_top1": round(vacc, 4),
               "minutes": round((time.perf_counter() - t0) / 60, 1)}
        log.write(json.dumps(row) + "\n")
        log.flush()
        print(row, flush=True)
        if vloss < best:
            best = vloss
            torch.save({"model": model.state_dict(), "val_top1": vacc}, os.path.join(a.out, "best.pt"))
        torch.save({"model": model.state_dict(), "epoch": ep}, os.path.join(a.out, "last.pt"))
        if vacc > best_acc:
            best_acc = vacc
    log.close()
    gate = {"baseline_top1": round(base_acc, 4), "best_top1": round(best_acc, 4),
            "ship": bool(best_acc > base_acc + 0.02)}
    json.dump(gate, open(os.path.join(a.out, "gate.json"), "w"), indent=1)
    print("GATE:", gate, flush=True)


if __name__ == "__main__":
    main()
