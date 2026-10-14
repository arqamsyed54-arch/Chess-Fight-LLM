"""Chess Fight LLM: 30M-param move-only transformer + training pipeline."""
from .config import ModelConfig, TrainConfig, LEVELS
from .model import ChessTransformer, count_parameters
from .infer import ChessFightEngine

__all__ = ["ModelConfig", "TrainConfig", "LEVELS", "ChessTransformer", "count_parameters", "ChessFightEngine"]
