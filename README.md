# ♞ Chess Fight LLM

**Made by Ahmad Syed** · MIT licensed — free for anyone to run, study, and modify.

A silent neural chess opponent. It never chats, never taunts, never hints — **its entire vocabulary is chess moves**. You play; it answers only by moving pieces.

- 🎮 Playable now: 2D arena + 3D arena (Three.js), 5 honest strength levels, clocks, PGN, history, analysis, study room, puzzles, drills
- 🧠 30M-param move-only transformer + guided search (Fight mode), opening book, piece-square knowledge, quiescence, mate guards
- 📏 Measured, not promised: rated ladder, tactics exams, published benchmarks in `site/benchmark.html`

## Run it on your machine

Requirements: Python 3.10+ (Windows, macOS, or Linux).

```bash
# 1. Install
py -m pip install -r backend/requirements.txt

# 2. Start the server
py -m uvicorn backend.app:app --port 8000

# 3. Play:  http://127.0.0.1:8000/#/setup
#    3D:     http://127.0.0.1:8000/3d.html#/home
#    Site:   http://127.0.0.1:8000/site/index.html
```

No account needed. Games save locally in your browser + on the server.

## Test it

```bash
py -m pytest backend/tests -q        # full backend suite (45 tests)
node --test tests3d/coord.test.mjs   # 3D mapping unit tests
```

## Train your own net (optional, advanced)

The shipped engine plays from search + knowledge while its network is untrained
(the app labels evals "provisional" until then). To distill Stockfish into it:

1. Get a Stockfish binary, set `SF_PATH` in `chess_fight_llm/label.py`
2. `py -m chess_fight_llm.label --games 150 --depth 10` → `data/sf_labels.jsonl`
3. `py -m chess_fight_llm.distill --data data/sf_labels.jsonl --epochs 5` → `checkpoints/distilled/best.pt`
4. Point the engine at the checkpoint — `trained` flips automatically and every
   provisional label disappears.

Needs patience: ~30M params on CPU trains over hours, not minutes.

## Measure it yourself

```bash
py -m chess_fight_llm.assess --games 4   # rated matches + tactics + speed → assessments/
```

## Let other AIs play (MCP mode)

Any MCP-compatible chatbot plays through the same fair rules engine:

- Endpoint: `http://127.0.0.1:8000/mcp/` (Streamable HTTP)
- Claude Code: `claude mcp add chess-fight --transport http http://127.0.0.1:8000/mcp/`
- Tools: `new_game` · `get_state` · `legal_moves` · `play_move` · `resign` · `offer_draw` · `get_pgn`
- `new_game(engine_opponent=false)` = referee mode for LLM-vs-LLM games

## Project layout

| Path | What |
|---|---|
| `backend/app.py` | FastAPI server: games, rules, clocks, study, API |
| `backend/game.py` | Rules core (single source of truth) |
| `backend/engine_service.py` | Model + search ladder wiring |
| `backend/study.py` | Puzzles, repertoire, stats, drills, dailies |
| `backend/openings.py` | ECO book + adaptive book learning |
| `backend/static/` | 2D app, 3D arena, PWA, this website (`site/`) |
| `chess_fight_llm/` | 30M transformer, training, search, assessment |
| `backend/tests/` + `tests3d/` | Test suites |

## Fairness rules (product law)

- No chat, hints, or commentary from the AI — moves only
- Strength levels openly labeled; handicaps play worse openly, never by humiliation
- Resigns only when truly lost; draws only when objectively fair
- "Full strength", never "unbeatable"
