"""ECO opening classification from SAN prefix. Longest-prefix match wins.
Small honest book (~30 lines); unknown lines report as A00."""
from __future__ import annotations

# (ECO, name, san-prefix)
BOOK: list[tuple[str, str, tuple[str, ...]]] = [
    ("B90", "Sicilian Defense: Najdorf", ("e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6")),
    ("B97", "Sicilian Defense: Najdorf, Poisoned Pawn", ("e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6", "Bg5", "e6", "f4", "Qb6")),
    ("B70", "Sicilian Defense: Dragon", ("e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "g6")),
    ("B40", "Sicilian Defense: Kan", ("e4", "c5", "Nf3", "e6", "d4", "cxd4", "Nxd4", "a6")),
    ("B27", "Sicilian Defense: Alapin", ("e4", "c5", "c3")),
    ("B20", "Sicilian Defense: Grand Prix", ("e4", "c5", "Nc3", "Nc6", "f4")),
    ("B00", "Sicilian Defense", ("e4", "c5")),
    ("C00", "French Defense", ("e4", "e6")),
    ("C11", "French Defense: Steinitz", ("e4", "e6", "d4", "d5", "Nc3", "Nf6")),
    ("B12", "Caro-Kann Defense", ("e4", "c6")),
    ("B01", "Scandinavian Defense", ("e4", "d5")),
    ("B07", "Pirc Defense", ("e4", "d6", "d4", "Nf6", "Nc3", "g6")),
    ("C42", "Petrov's Defense", ("e4", "e5", "Nf3", "Nf6")),
    ("C41", "Philidor Defense", ("e4", "e5", "Nf3", "d6")),
    ("C25", "Vienna Game", ("e4", "e5", "Nc3")),
    ("C45", "Scotch Game", ("e4", "e5", "Nf3", "Nc6", "d4")),
    ("C44", "King's Pawn Game", ("e4", "e5", "Nf3")),
    ("C49", "Four Knights Game", ("e4", "e5", "Nf3", "Nc6", "Nc3", "Nf6")),
    ("C55", "Italian Game: Two Knights", ("e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6")),
    ("C50", "Italian Game: Giuoco Piano", ("e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5")),
    ("C51", "Italian Game: Evans Gambit", ("e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "b4")),
    ("C60", "Ruy Lopez", ("e4", "e5", "Nf3", "Nc6", "Bb5")),
    ("C70", "Ruy Lopez: Morphy Defense", ("e4", "e5", "Nf3", "Nc6", "Bb5", "a6")),
    ("C20", "King's Pawn Game", ("e4", "e5")),
    ("A10", "English Opening", ("c4",)),
    ("A09", "Réti Opening", ("Nf3", "d5", "c4")),
    ("D02", "Queen's Pawn Game: London System", ("d4", "d5", "Bf4")),
    ("D30", "Queen's Gambit Declined", ("d4", "d5", "c4", "e6")),
    ("D06", "Queen's Gambit", ("d4", "d5", "c4")),
    ("E90", "King's Indian Defense", ("d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "d6")),
    ("E00", "Queen's Pawn Game", ("d4", "Nf6")),
    ("A40", "Queen's Pawn Game", ("d4",)),
    ("A00", "Uncommon Opening", ()),
]


def classify(sans: list[str]) -> dict:
    best = BOOK[-1]
    best_len = -1
    for eco, name, prefix in BOOK:
        if not prefix:
            continue
        if len(sans) >= len(prefix) and tuple(sans[:len(prefix)]) == prefix:
            if len(prefix) > best_len:
                best, best_len = (eco, name, prefix), len(prefix)
    eco, name, _ = best
    return {"eco": eco, "name": name}


# Engine repertoire: main-line replies for the first moves. Even superhuman
# engines open from a book — it keeps the (possibly untrained) net out of
# trouble while the middlegame search takes over. Keys are SAN prefixes.
BOOK_REPERTOIRE: dict[tuple[str, ...], list[str]] = {
    (): ["e4", "d4"],
    ("e4",): ["e5", "c5", "e6", "c6"],
    ("d4",): ["d5", "Nf6"],
    ("c4",): ["e5", "c5"],
    ("Nf3",): ["d5", "Nf6"],
    ("e4", "e5"): ["Nf3"],
    ("e4", "c5"): ["Nf3"],
    ("e4", "e6"): ["d4"],
    ("e4", "c6"): ["d4"],
    ("d4", "d5"): ["c4"],
    ("d4", "Nf6"): ["c4", "Nf3"],
    ("e4", "e5", "Nf3"): ["Nc6", "Nf6"],
    ("e4", "e5", "Nf3", "Nc6"): ["Bb5", "Bc4"],
    ("e4", "c5", "Nf3"): ["d6", "Nc6", "e6"],
    ("e4", "e5", "Nf3", "Nc6", "Bb5"): ["a6", "Nf6"],
    ("e4", "e5", "Nf3", "Nc6", "Bc4"): ["Bc5", "Nf6"],
    ("e4", "e5", "Nf3", "Nc6", "Bb5", "a6"): ["Ba4"],
    ("d4", "d5", "c4"): ["e6", "c6"],
}

BOOK_MAX_PLY = 6


def book_reply(sans: list[str], choice=0) -> str | None:
    """SAN reply from the repertoire, or None once out of book.
    choice picks deterministically among alternatives (tests/d variety)."""
    if len(sans) > BOOK_MAX_PLY:
        return None
    for length in range(min(len(sans), BOOK_MAX_PLY), -1, -1):
        cands = BOOK_REPERTOIRE.get(tuple(sans[:length]))
        if cands:
            return cands[choice % len(cands)]
    return None


def choose_book(sans: list[str], history: dict | None = None, rng=None) -> str | None:
    """Book reply with optional learned weighting. history maps prefix tuple
    -> [(reply_san, engine_score)] as built by book_history_for."""
    import random as _r
    rng = rng or _r
    if len(sans) > BOOK_MAX_PLY:
        return None
    for length in range(min(len(sans), BOOK_MAX_PLY), -1, -1):
        key = tuple(sans[:length])
        cands = BOOK_REPERTOIRE.get(key)
        if cands:
            if history:
                w = learned_weights(sans, history.get(key, []))
                if w:
                    return rng.choices(cands, weights=w, k=1)[0]
            return rng.choice(cands)
    return None


def learned_weights(sans: list[str], history: list[tuple[str, float]]) -> list[float] | None:
    """Weight book candidates by how they scored for the ENGINE in past games.
    history: [(reply_san, engine_score)] at this exact prefix (1/0.5/0).
    Returns per-candidate multipliers, or None when no data. Slightly evil,
    fully disclosed in the UI: the book learns which lines trouble you."""
    cands = None
    for length in range(min(len(sans), BOOK_MAX_PLY), -1, -1):
        cands = BOOK_REPERTOIRE.get(tuple(sans[:length]))
        if cands:
            break
    if not cands:
        return None
    score = {c: 0.0 for c in cands}
    seen = {c: 0 for c in cands}
    for reply, s in history:
        if reply in score:
            score[reply] += s
            seen[reply] += 1
    if not any(seen.values()):
        return None
    return [1.0 + 2.0 * (score[c] / max(1, seen[c])) * (seen[c] / (seen[c] + 2.0)) for c in cands]


def book_history_for(games: list[dict], profile_id: str) -> dict[tuple, list[tuple[str, float]]]:
    """Fold finished games of one profile into {(prefix): [(reply, score)]}."""
    out: dict[tuple, list[tuple[str, float]]] = {}
    for g in games:
        if g.get("profile_id") != profile_id or g.get("status") == "ongoing":
            continue
        sans = g.get("sans", [])
        eng = g.get("engine_color")
        w = g.get("winner")
        s = 1.0 if w == eng else (0.5 if w == "draw" else 0.0)
        order = BOOK_REPERTOIRE
        for i in range(min(len(sans), BOOK_MAX_PLY)):
            prefix = tuple(sans[:i])
            if prefix not in order:
                continue
            mover_white = (i % 2 == 0)
            mover = "white" if mover_white else "black"
            if mover == eng and i < len(sans):
                out.setdefault(prefix, []).append((sans[i], s))
    return out
