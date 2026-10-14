"""Export: ONNX + dynamic int8 quant; verifies the <10MB on-device budget."""
from __future__ import annotations
import os
import torch

from .config import ModelConfig
from .model import ChessTransformer, count_parameters
from .tokenization import SEQ_LEN, uci_vocab


def export_onnx(checkpoint: str = "", out: str = "chess_fight_2m.onnx", opset: int = 17) -> str:
    cfg = ModelConfig()
    model = ChessTransformer(cfg, len(uci_vocab()))
    if checkpoint and os.path.exists(checkpoint):
        sd = torch.load(checkpoint, map_location="cpu", weights_only=True)
        model.load_state_dict(sd.get("model", sd))
    model.eval()
    dummy = torch.randint(0, cfg.tok_vocab, (1, SEQ_LEN), dtype=torch.long)
    torch.onnx.export(model, (dummy,), out, input_names=["tokens"],
                      output_names=["policy", "value"], opset_version=opset,
                      dynamic_axes={"tokens": {0: "batch"}})
    return out


def quantize_dynamic(model: ChessTransformer) -> ChessTransformer:
    return torch.quantization.quantize_dynamic(model, {torch.nn.Linear}, dtype=torch.qint8)


def size_report(model: ChessTransformer) -> dict:
    n = count_parameters(model)
    return {"params": n, "fp32_mb": n * 4 / 1e6, "int8_mb": n * 1 / 1e6,
            "under_10mb_int8": n * 1 / 1e6 < 10}
