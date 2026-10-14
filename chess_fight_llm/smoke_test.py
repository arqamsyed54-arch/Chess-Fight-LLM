"""Smoke test: param budget, vocab coverage, tiny train, 0-illegal, latency, resign/draw."""
import random, time
import chess

from .tokenization import uci_vocab, legal_uci_list, encode_board, SEQ_LEN
from .config import ModelConfig, TrainConfig
from .model import ChessTransformer, count_parameters
from .data import generate_synthetic_games, ChessDataset
from .train import train_model
from .infer import ChessFightEngine
from .evaluate import illegal_move_rate, latency_ms, size_report
from .search import fight_move


def main():
    vocab = uci_vocab()
    print(f"move_vocab={len(vocab)} (target ~1968)")
    # 1. every legal move in random play must be in vocab
    rng = random.Random(0)
    fens = []
    for _ in range(30):
        b = chess.Board()
        for _ in range(rng.randint(0, 60)):
            if b.is_game_over():
                break
            mv = rng.choice(list(b.legal_moves))
            b.push(mv)
        fens.append(b.fen())
        missing = [u for u in legal_uci_list(b.fen()) if u not in set(vocab)]
        assert not missing, f"vocab gap: {missing}"
    assert len(encode_board(chess.STARTING_FEN)) == SEQ_LEN

    # 2. param budget ~30M
    model = ChessTransformer(ModelConfig(), len(vocab))
    n = count_parameters(model)
    print(f"params={n:,}")
    assert 25_000_000 <= n <= 35_000_000, f"param budget violated: {n}"

    # 3. tiny train runs (kept small: the 30M net trains slowly on CPU;
    # full training belongs on a GPU box — this only proves the loop works)
    samples = generate_synthetic_games(5, seed=1)
    assert len(samples) > 50
    train_model(TrainConfig(epochs=1, synthetic_games=5, out_dir="checkpoints_smoke"))

    # 4. inference: always legal, fast, sized right
    eng = ChessFightEngine(level="club", seed=0)
    rate = illegal_move_rate(eng, fens)
    print(f"illegal_rate={rate}")
    assert rate == 0.0
    lat = latency_ms(eng, reps=10)
    print(f"latency={lat['mean_ms']:.1f}ms")
    assert lat["ok"]
    rep = size_report(eng)
    print(rep)
    assert rep["int8_mb"] < 35  # ~30MB at 30M params; old <10MB budget was for the 2M net

    # 5. honest resign/draw: no early resign, no fantasy draws
    assert eng.should_resign(chess.STARTING_FEN, 0.0) is False
    assert eng.should_accept_draw(chess.STARTING_FEN, 2.0) is False
    assert eng.should_accept_draw("k7/8/8/8/8/8/8/K7 w - - 0 1", 0.0) is True  # K vs K

    # 6. fight-mode search returns a legal move within budget
    t0 = time.perf_counter()
    uci, _, nodes, depth = fight_move(eng, chess.STARTING_FEN, max_depth=2, time_limit=1.0)
    dt = time.perf_counter() - t0
    assert uci in legal_uci_list(chess.STARTING_FEN), uci
    print(f"fight_move={uci} in {dt:.2f}s nodes={nodes} depth={depth}")
    assert dt < 3.0
    print("SMOKE OK")


if __name__ == "__main__":
    main()
