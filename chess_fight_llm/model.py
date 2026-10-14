"""2M-param transformer: board tokens in, policy + value out."""
from __future__ import annotations
import torch
import torch.nn as nn

from .config import ModelConfig
from .tokenization import uci_vocab


class ChessTransformer(nn.Module):
    def __init__(self, cfg: ModelConfig | None = None, move_vocab: int = 0):
        super().__init__()
        self.cfg = cfg or ModelConfig()
        c = self.cfg
        self.move_vocab = move_vocab or len(uci_vocab())
        self.tok_emb = nn.Embedding(c.tok_vocab, c.d_model)
        self.pos_emb = nn.Embedding(c.seq_len, c.d_model)
        layer = nn.TransformerEncoderLayer(
            d_model=c.d_model, nhead=c.n_head, dim_feedforward=c.d_ff,
            dropout=c.dropout, activation="gelu", batch_first=True,
        )
        self.encoder = nn.TransformerEncoder(layer, num_layers=c.n_layer)
        self.norm = nn.LayerNorm(c.d_model)
        self.policy_head = nn.Linear(c.d_model, self.move_vocab)
        self.value_head = nn.Sequential(
            nn.Linear(c.d_model, 64), nn.ReLU(),
            nn.Linear(64, 1), nn.Tanh(),  # white-perspective score in [-1, 1]
        )
        self.drop = nn.Dropout(c.dropout)

    def forward(self, tokens: torch.Tensor):
        b, t = tokens.shape
        pos = torch.arange(t, device=tokens.device).unsqueeze(0).expand(b, t)
        h = self.drop(self.tok_emb(tokens) + self.pos_emb(pos))
        h = self.norm(self.encoder(h))
        pooled = h.mean(dim=1)  # order-invariant pool; position info already fused
        return self.policy_head(pooled), self.value_head(pooled).squeeze(-1)


def count_parameters(model: nn.Module) -> int:
    return sum(p.numel() for p in model.parameters())


def model_size_mb(model: nn.Module, bytes_per_param: float = 4.0) -> float:
    return count_parameters(model) * bytes_per_param / 1e6
