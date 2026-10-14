/* AI worker: getMove(fen, level, timeBudgetMs) -> uciMove.
   MODE 'mock' (default): legal moves from server (/api/legal) + greedy-random
   pick, all client-side. MODE 'real': server model via POST /api/move.
   Contract: posts {id, ok, move} or {id, ok:false, error}. Never throws out. */
let MODE = 'mock';
async function postJSON(url, body, timeoutMs) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
    if (!r.ok) throw new Error('http ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}
const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
async function mockMove(fen) {
  const d = await postJSON('/api/legal', { fen }, 4000);
  const moves = d.moves || [];
  if (!moves.length) throw new Error('no legal moves');
  // greedy-random: promotion bonus + uniform noise (mock only)
  let best = null, bestScore = -1;
  for (const u of moves) {
    const promo = u.length === 5 ? 8 : 0;
    const s = promo + Math.random() * 2;
    if (s > bestScore) { bestScore = s; best = u; }
  }
  return best;
}
async function realMove(fen, level, sans, budgetMs) {
  const d = await postJSON('/api/move', { fen, level, sans: sans || [] }, (budgetMs || 2500) + 4000);
  if (!d.move || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(d.move)) throw new Error('bad move shape');
  return d.move;
}
onmessage = async (e) => {
  const m = e.data || {};
  if (m.type === 'init') { MODE = m.mode === 'real' ? 'real' : 'mock'; postMessage({ id: m.id, ok: true, mode: MODE }); return; }
  if (m.type !== 'move') return;
  const t0 = Date.now();
  const attempt = () => MODE === 'real'
    ? realMove(m.fen, m.level, m.sans, m.budgetMs)
    : mockMove(m.fen);
  try {
    const move = await attempt();
    postMessage({ id: m.id, ok: true, move, ms: Date.now() - t0, source: MODE });
  } catch (err1) {
    try { // retry once
      const move = await attempt();
      postMessage({ id: m.id, ok: true, move, ms: Date.now() - t0, source: MODE, retried: true });
    } catch (err2) {
      postMessage({ id: m.id, ok: false, error: String((err2 && err2.message) || err2) });
    }
  }
};
