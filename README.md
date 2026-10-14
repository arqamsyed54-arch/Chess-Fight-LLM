# ♞ Chess Fight LLM

**Made by Ahmad Syed** · MIT licensed — free for anyone to run, study, and modify.

A silent neural chess opponent. It never chats, never taunts, never hints, never
commentates — **its entire vocabulary is chess moves**. You open the game, pick a
side, and play. Every reply it gives is a legal move on the board, played the way
a strong, honest opponent would play it.

This repository is the complete product: the game server, a 30M-parameter
move-only transformer, the guided-search engine, two playable arenas (2D and 3D),
a study room, an MCP interface so *other* chatbots can play too, a marketing
website, and the harnesses that measure everything it claims.

---

## What you get the moment you start it

**🎮 Two arenas.** A fast 2D board (click or drag, legal dots, promotion picker,
clocks, move ledger with live evals, keyboard console) and a full 3D arena
(Three.js: procedural Staunton pieces, orbit camera with presets, raycast
picking, drag-with-lift, animated moves/captures/castling, check glow, king
tip-over finales, quality presets, reduced-motion and high-contrast support,
and an automatic flat-2D fallback if WebGL is missing).

**⚡ Five honest opponents.** Beginner (~650) → Casual (~750) → Club (~1200+) →
Strong (~1350+) → **Fight mode, FULL STRENGTH (~1400–1800)**. Handicaps come
from search depth plus labeled noise — never from dice rolls, never by
humiliation. Fight mode is called full strength. It is never called unbeatable.

**📜 Complete rules.** Castling, en passant, promotion, threefold repetition,
fifty-move rule, insufficient material, stalemate, checkmate, flag fall — all
arbitrated by a rules engine that the neural net can never overrule. The
illegal-move rate is zero by construction, and a test proves it on every run.

**🧩 Study room.** Your blunders become puzzles (auto-generated with solutions
and spaced repetition), 18 ECO repertoire lines to drill as White or Black,
KQK/KRK/KPK endgame drills against the clock, a rules-verified mate-in-1 every
day with streaks, and a stats dashboard (accuracy trend, ECO record, weakest
phase: opening/middlegame/endgame).

**🔍 Analysis that shows its work.** Post-game eval chart with blunder/best-move
markers, model-judged accuracy for both sides, top-3 candidate moves per ply
(locked until the game ends — no mid-game hints, ever), turning-point insights,
one-click PGN and shareable game cards.

**🤖 MCP mode.** Any MCP-compatible chatbot (Claude Code, Claude Desktop,
Cursor, your own agent) plays through the same fair rules at `/mcp/` with
7 tools. Referee mode lets two outside LLMs play each other under full
arbitration. Bot games are badged in history.

**⏱ Tournament gear.** Clocks (untimed, bullet, blitz, rapid, classical,
custom, plus asymmetric time odds), takeback tokens, fight-night first-to-N
series, match archive with ECO search/filter and stepper replay, batch PGN
export, named profiles, adaptive sparring that picks your level from results,
and an opening book that learns which lines trouble *you* (disclosed, toggleable).

**📳 Installable.** PWA manifest + offline service worker + app icons. Runs
from your own machine; games never leave it unless you share them.

---

## How the engine thinks (three layers)

1. **Rules** — `python-chess` arbitrates legality, state and results. The model
   proposes; the rules dispose.
2. **Brain** — a 30M-param transformer (d448 × 12 layers × 8 heads). FEN in as
   70 tokens, policy over 1,968 UCI moves + a value score out. Currently
   distilling from Stockfish-labeled positions; until its quality gate passes,
   the app labels every eval "provisional" and strength comes from layer 3.
3. **Fight** — alpha-beta search with null-move pruning, killer moves, batched
   leaf evaluation, captures-only quiescence, piece-square knowledge, an ECO
   opening book, instant mate delivery, a mate-in-1 guard, and
   no-repeat-when-winning — all inside a 3-second budget.

`getMove(fen, level, timeBudgetMs) → uci` is the single AI contract
(`POST /api/move`), used by the arenas, the worker, and the tests.

## Measured, not promised

| Level | vs random | vs greedy 1-ply | Estimate |
|---|---|---|---|
| Beginner | 3–1–0 | 1–3 | ~724 |
| Casual | 4–0 | 0–4 | ~650 |
| Club | 4–0 | 3–1–0 | ≥1219 |
| Strong | 4–0 | 3–1–0 | ≥1219 |
| Fight | 4–0 | 3–1–0, tactics 5/5 | ~1400–1800 (lost 0–2 to Stockfish depth 4) |

Method: `py -m chess_fight_llm.assess` — 40 rated games, tactics exam, speed
profile. Anchors are rough (~400/~900), n=4 per pairing (±150), top tiers are
capped by weak anchors. Full tables, error bars and reproduce commands live on
the Benchmarks page. Provisional data always says "provisional".

---

## Run it on your machine

Requirements: Python 3.10+ (Windows, macOS, or Linux).

```bash
# 1. Install
py -m pip install -r backend/requirements.txt

# 2. Start the server
py -m uvicorn backend.app:app --port 8000

# 3. Open it
#    2D arena:  http://127.0.0.1:8000/#/setup
#    3D arena:  http://127.0.0.1:8000/3d.html#/home
```

No account needed. Beginner games need nothing; Fight mode wants a modern CPU.

## Test it

```bash
py -m pytest backend/tests -q        # full backend suite (45 tests)
node --test tests3d/coord.test.mjs   # 3D mapping unit tests
```

## Train your own net (optional, advanced)

The shipped engine plays from search + knowledge while its network is untrained.
To distill Stockfish into it:

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
| `backend/app.py` | FastAPI server: games, rules, clocks, study, MCP mount |
| `backend/game.py` | Rules core — the single source of truth |
| `backend/engine_service.py` | Model + search ladder wiring |
| `backend/study.py` | Puzzles, repertoire, stats, drills, dailies, candidates |
| `backend/openings.py` | ECO book + adaptive book learning |
| `backend/mcp_server.py` | 7 MCP tools + referee mode |
| `backend/static/` | 2D app, 3D arena, PWA shell |
| `chess_fight_llm/` | Transformer, training, search, labeling, assessment |
| `backend/tests/` + `tests3d/` | Test suites (everything above is asserted) |

## Fairness rules (product law, enforced in code and tests)

- No chat, hints, or commentary from the AI — moves only, including for bots
- Strength levels openly labeled; handicaps play worse openly, never by humiliation
- Resigns only when truly lost; draws only when objectively fair
- "Full strength", never "unbeatable"
- Player data stays minimal: games and settings only

## Honest limits

- The network is mid-distillation: model-only play is weak, search carries it
- Ratings carry ±150 error bars; the 1400–1800 Fight bracket is a floor and a probe, not a title
- Deep combinations (mate in 3+), technical endgames and fortresses are the
  known frontier — tablebases and the mate-2 exam are queued behind training
