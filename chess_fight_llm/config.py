"""Static configs. Keeps the 'about 2M params, <10MB, <3s' contract in one place."""
from dataclasses import dataclass, field


@dataclass
class ModelConfig:
    d_model: int = 448
    n_layer: int = 12
    n_head: int = 8
    d_ff: int = 1792
    dropout: float = 0.1
    seq_len: int = 70          # 64 squares + side + 4 castling + ep
    tok_vocab: int = 17        # 0-12 pieces, 13/14 side, 15/16 castling flag, 0-8 ep (shared ids)
    # move_vocab is set at runtime from tokenization.build_uci_vocab() (~1968)
    # NOTE: ~30M params. Quantized int8 is ~30MB, so the old <10MB on-device
    # budget no longer holds — see README. FP32 is ~120MB.

@dataclass
class TrainConfig:
    epochs: int = 3
    batch_size: int = 128
    lr: float = 3e-4
    weight_decay: float = 0.01
    value_weight: float = 0.3
    seed: int = 0
    synthetic_games: int = 200  # default so pipeline runs offline with no downloads
    pgn_path: str = ""          # optional real data; if set, mixed with synthetic
    max_pgn_games: int = 2000
    out_dir: str = "checkpoints"


# Handicap levels are honest labels: weaker levels search shallower with
# human-like noise (top-k sampling + blunder rate), never by hanging mates.
# Fight mode = full depth-3 search + book. Strength comes from depth +
# knowledge, not from sampling an untrained policy (measured below random).
LEVELS: dict = {
    "beginner": {"temperature": 1.6, "top_k": 30, "search_depth": 1, "search_time": 0.4},
    "casual":   {"temperature": 1.0, "top_k": 10, "search_depth": 1, "search_time": 0.6},
    "club":     {"temperature": 0.5, "top_k": 5,  "search_depth": 2, "search_time": 0.8},
    "strong":   {"temperature": 0.2, "top_k": 3,  "search_depth": 2, "search_time": 1.5},
    "fight":    {"temperature": 0.0, "top_k": 1,  "search_depth": 3, "search_time": 2.5},
}
