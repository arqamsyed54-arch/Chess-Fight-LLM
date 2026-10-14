# Chess Fight LLM — model + training pipeline (v1)

Made by Ahmad Syed.

30M-param transformer whose **entire vocabulary is chess moves**. It never chats:
FEN in, legal UCI out. Legality is enforced by a rules engine (`python-chess`),
never trusted to the network — illegal-move rate is 0 by construction and test.

## Honest strength statement (per PRD)

- **Model-only** (policy net, no search): currently *untrained (random
  weights)* — measured playing below random-mover strength. A Stockfish
  distillation run is in progress (`pipeline.py`); until its gate passes,
  all strength comes from search + knowledge, and the app labels evals and
  accuracy "provisional" everywhere. Target once trained: strong-club
  (~1800+ Elo vs calibrated refs). No net alone is *ever* called unbeatable.
- **Fight mode** = model + time-limited guided alpha-beta (`search.py`, 1–3 s/move).
  That pairing is what makes full strength practically unbeatable by humans on
  ordinary hardware. No claim of literal unbeatability vs engines.

Open questions answered: **30M = parameters** (this pipeline); **Fight mode is
allowed search** — required, since model-alone cannot carry the claim.

## Layout

- `tokenization.py` — 70-token board encoding, ~1968-move UCI vocab, legal mask
- `model.py` — transformer d448 × 12 layers × 8 heads, ff 1792 (~30M params) + policy/value heads
- `data.py` — PGN ingestion + offline synthetic generator (capture-biased pseudo-labels)
- `train.py` — policy CE + value MSE, AdamW
- `infer.py` — legal-only `predict()`, handicap levels, honest resign/draw
- `search.py` — Fight-mode guided alpha-beta with iterative deepening + clock
- `evaluate.py` / `export.py` — accuracy, 0-illegal test, latency, ONNX/int8 size

## Quickstart

```bash
py -m pip install -r chess_fight_llm/requirements.txt
py -m chess_fight_llm.train --epochs 3 --synthetic-games 200
py -m chess_fight_llm.smoke_test
```

With real data (engine-labeled PGNs recommended for strength):

```bash
py -m chess_fight_llm.train --pgn data/engine_games.pgn --epochs 10 --synthetic-games 500
```

## Design notes

- Input: 64 squares (13 ids) + side + 4 castling flags + ep file = 70 tokens.
- Output: policy over UCI vocab + scalar value (white pov, tanh).
- Levels (`config.LEVELS`): temperature/top-k handicaps, openly labeled;
  `fight` routes through `search.fight_move`.
- Resign: only value < −0.95 sustained 3 checks after ply 30. Draw: only even
  eval *and* a real drawing mechanism (repetition/50-move/insufficient/dead ending).
- Budgets: ~30M params, ~30 MB int8 (~120 MB fp32), median move <1.5 s, p99 <3 s (Fight mode).
