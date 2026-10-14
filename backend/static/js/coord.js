/* Pure chess<->3D helpers. No three.js import: unit-testable in node. */
export const SQ = 1.25; // world units per square
export function sqToPos(sq) {
  const f = sq.charCodeAt(0) - 97, r = sq.charCodeAt(1) - 49;
  return { x: (f - 3.5) * SQ, z: (3.5 - r) * SQ };
}
export function posToSq(x, z) {
  const f = Math.round(x / SQ + 3.5), r = Math.round(3.5 - z / SQ);
  if (f < 0 || f > 7 || r < 0 || r > 7) return null;
  return 'abcdefgh'[f] + (r + 1);
}
export function parsePlacement(fen) {
  const m = {};
  const rows = fen.split(' ')[0].split('/');
  for (let r = 0; r < 8; r++) {
    let f = 0;
    for (const ch of rows[7 - r]) {
      if (/\d/.test(ch)) f += +ch;
      else { m['abcdefgh'[f] + (r + 1)] = ch; f++; }
    }
  }
  return m;
}
/* Diff two placements -> animation facts. Never decides legality. */
export function diffPositions(prev, next) {
  const facts = { from: null, to: null, moved: null, captured: null, captureSq: null, promotion: null, castle: null, ep: false };
  const gone = [], appeared = [];
  for (const [sq, p] of Object.entries(prev)) if (next[sq] !== p) gone.push([sq, p]);
  for (const [sq, p] of Object.entries(next)) if (prev[sq] !== p) appeared.push([sq, p]);
  // normal move: one piece relocated (to-square may hold a captured piece: 1 gone at from + 1 gone at to)
  const byPiece = {};
  for (const [sq, p] of gone) { (byPiece[p] = byPiece[p] || []).push(sq); }
  outer: for (const [sq, p] of appeared) {
    const cands = (byPiece[p] || []).filter(s => s !== sq);
    if (cands.length === 1 && gone.length <= 2) {
      facts.from = cands[0]; facts.to = sq; facts.moved = p;
      const other = gone.find(([s]) => s !== facts.from);
      if (other) { facts.captured = other[1]; facts.captureSq = other[0]; }
      break outer;
    }
  }
  // promotion: pawn gone, new piece appeared
  if (!facts.from) {
    const pw = gone.find(([s, p]) => p === 'P' || p === 'p');
    const np = appeared.find(([s, p]) => 'QRBNqrbn'.includes(p));
    if (pw && np) {
      facts.from = pw[0]; facts.to = np[0]; facts.moved = pw[1];
      facts.promotion = np[1]; facts.ep = false;
      const other = gone.find(([s]) => s !== facts.from && s !== facts.to);
      if (other) { facts.captured = other[1]; facts.captureSq = other[0]; }
    }
  }
  // en passant: pawn steps diagonally and the victim is beside the destination
  if (facts.from && facts.to && (facts.moved === 'P' || facts.moved === 'p')) {
    const df = Math.abs(facts.from.charCodeAt(0) - facts.to.charCodeAt(0));
    const dr = Math.abs(+facts.from[1] - +facts.to[1]);
    if (df === 1 && dr === 1 && facts.captureSq === facts.to[0] + facts.from[1]) facts.ep = true;
  }
  // castling: king moved two files
  if (facts.moved && facts.moved.toUpperCase() === 'K' && facts.from && facts.to &&
      Math.abs(facts.from.charCodeAt(0) - facts.to.charCodeAt(0)) === 2) {
    const rank = facts.from[1];
    const short = facts.to[0] > facts.from[0];
    facts.castle = { rookFrom: (short ? 'h' : 'a') + rank, rookTo: (short ? 'f' : 'd') + rank };
  }
  return facts;
}
