/* 3D arena app: screens, HUD, AI worker wiring, clocks, replay, a11y.
   Rules live server-side; the scene only renders. The AI speaks only moves. */
import { Board3D } from './board3d.js';
import { parsePlacement, diffPositions, sqToPos } from './coord.js';

const $ = id => document.getElementById(id);
const api = {
  async _r(p, o, timeoutMs = 25000) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await fetch(p, { ...(o || {}), signal: ctl.signal });
      if (!r.ok) { let d = {}; try { d = await r.json(); } catch {} throw new Error(d.detail || r.statusText); }
      const ct = r.headers.get('content-type') || '';
      return ct.includes('json') ? r.json() : r.text();
    } catch (e) {
      if (e && e.name === 'AbortError') throw new Error('request timed out — server busy, please retry');
      throw e;
    } finally { clearTimeout(t); }
  },
  get: p => api._r(p),
  post: (p, b) => api._r(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}) }),
};
const toast = m => { const t = $('toast'); t.textContent = m; t.classList.remove('hidden'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.add('hidden'), 2600); };
const announce = m => { const a = $('sr-live'); if (a) a.textContent = m; };

/* settings (shared keys with the 2D app where they overlap) */
const DEF = { theme: 'slate', pieceStyle: 'staunton', animMs: 280, confirmMoves: false, showLegal: true, showLastMove: true, soundOn: true, volume: 75, highContrast: false, reducedMotion: false, quality: 'auto', camera: 'auto', cinematic: true };
let SET = { ...DEF };
try { Object.assign(SET, JSON.parse(localStorage.getItem('cfl3d_settings') || '{}')); } catch {}
const _q = new URLSearchParams(location.search).get('quality');
if (_q && ['low', 'medium', 'high'].includes(_q)) SET.quality = _q; // test/perf override, not persisted
if (SET.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches) SET.reducedMotion = true;
const saveSet = () => localStorage.setItem('cfl3d_settings', JSON.stringify(SET));
function autoQuality() {
  const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 700;
  const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4;
  return (cores >= 8 && mem >= 4 && !mobile) ? 'high' : (mobile ? 'low' : 'medium');
}
const quality = () => SET.quality === 'auto' ? autoQuality() : SET.quality;
const theme3d = () => {
  if (SET.highContrast) return 'highcontrast';
  return { slate: 'slate', walnut: 'wood', obsidian: 'slate', phosphor: 'cyber', 'high-contrast': 'highcontrast' }[SET.theme] || 'slate';
};
/* sound: tiny WebAudio synth, no assets */
let AC = null;
function beep(f, ms, type = 'sine', g = 1) {
  if (!SET.soundOn) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), gn = AC.createGain();
    o.type = type; o.frequency.value = f;
    gn.gain.setValueAtTime((SET.volume / 100) * 0.22 * g, AC.currentTime);
    gn.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + ms / 1000);
    o.connect(gn); gn.connect(AC.destination); o.start(); o.stop(AC.currentTime + ms / 1000);
  } catch {}
}
const SFX = { move: () => beep(660, 48, 'square', .6), capture: () => { beep(330, 62, 'square', .8); }, check: () => beep(880, 110), end: w => { [523, 659, 784].forEach((f, i) => setTimeout(() => beep(f, 140), i * 130)); } };

/* ---------- boot + WebGL guard ---------- */
let board = null;
try {
  board = new Board3D($('scene'), {
    theme: theme3d(), pieceStyle: SET.pieceStyle, quality: quality(),
    animMs: SET.animMs, reducedMotion: SET.reducedMotion, cinematic: SET.cinematic,
  });
  board.playerSide = 'white';
} catch (err) {
  location.href = 'index.html?notice=webgl';
  throw err;
}
board.o.onPick = onPick;
board.o.onDragStart = d => !!canPlayFrom(d);
board.o.onDrop = (f, t) => attemptMove(f, t);

/* ---------- AI worker RPC ---------- */
const worker = new Worker('js/aiworker.js');
let rpcId = 0; const pending = new Map();
const MOCK = new URLSearchParams(location.search).has('mock');
worker.onmessage = e => {
  const m = e.data || {}, p = pending.get(m.id);
  if (p) { pending.delete(m.id); m.ok ? p.res(m) : p.rej(new Error(m.error || 'ai failed')); }
};
worker.postMessage({ type: 'init', id: 0, mode: MOCK ? 'mock' : 'real' });
function getMove(fen, level, budgetMs, sans) {
  return new Promise((res, rej) => {
    const id = ++rpcId;
    pending.set(id, { res, rej });
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error('ai timeout')); } }, (budgetMs || 2500) + 6000);
    worker.postMessage({ type: 'move', id, fen, level, budgetMs, sans });
  });
}

/* ---------- state ---------- */
let S = null, sel = null, busy = false, pendingConfirm = null, aiError = null;
let cursor = null;
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
function openGame(g) {
  S = g; sel = null; pendingConfirm = null; aiError = null; cursor = null;
  try { localStorage.setItem('cfl_last_game', g.id); } catch {}
}
function show(name) {
  for (const v of ['home', 'setup', 'game', 'history', 'settings']) $('view-' + v).classList.toggle('hidden', v !== name);
  document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === name));
  $('resultOverlay').classList.toggle('hidden', !(name === 'game' && S && S.status !== 'ongoing'));
}
/* ---------- rendering state ---------- */
function kingSq(map, color) {
  const k = color === 'white' ? 'K' : 'k';
  for (const [sq, p] of Object.entries(map)) if (p === k) return sq;
  return null;
}
function paintClocks() {
  if (!S) return;
  const put = (id, ms, active) => {
    const el = $(id);
    el.querySelector('b').textContent = S.has_clock ? fmtClock(ms) : '∞';
    el.classList.toggle('active', !!active); el.classList.toggle('low', S.has_clock && ms < 30000 && S.status === 'ongoing');
  };
  const live = S.status === 'ongoing';
  const pw = S.player_color === 'white';
  put('clockTop', pw ? S.clocks_ms.black : S.clocks_ms.white, live && S.turn === S.engine_color);
  put('clockBottom', pw ? S.clocks_ms.white : S.clocks_ms.black, live && S.turn === S.player_color);
}
const fmtClock = ms => { if (ms == null) return '--:--'; const t = Math.max(0, ms); return String(Math.floor(t / 60000)).padStart(2, '0') + ':' + String(Math.floor(t % 60000 / 1000)).padStart(2, '0') + '.' + Math.floor(t % 1000 / 100); };
setInterval(() => {
  if (!S || !S.has_clock || S.status !== 'ongoing' || document.hidden) return;
  S.clocks_ms[S.turn] = Math.max(0, S.clocks_ms[S.turn] - 250);
  paintClocks();
}, 250);
function paintLedger() {
  const L = $('moves'); L.innerHTML = '';
  (S ? S.sans : []).forEach((s, i) => {
    if (i % 2) return;
    const row = document.createElement('div'); row.className = 'mrow';
    row.innerHTML = `<span class="n">${i / 2 + 1}.</span><span>${s}</span><span>${S.sans[i + 1] || ''}</span>`;
    L.appendChild(row);
  });
  L.scrollTop = L.scrollHeight;
}
function paintTray() {
  const { pieces } = { pieces: parsePlacement(S.fen) };
  const START = { P: 8, N: 2, B: 2, R: 2, Q: 1, p: 8, n: 2, b: 2, r: 2, q: 1 };
  const c = {}; for (const p of Object.values(pieces)) c[p] = (c[p] || 0) + 1;
  const GL = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟', k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
  let bw = '', bb = '', mw = 0, mb = 0;
  const V = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0, p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  for (const [k, n] of Object.entries(START)) { const miss = n - (c[k] || 0); for (let i = 0; i < miss; i++) (k === k.toUpperCase() ? bb += GL[k] : bw += GL[k]); }
  for (const [p, n] of Object.entries(c)) { if (p === p.toUpperCase()) mw += (V[p] || 0) * n; else mb += (V[p] || 0) * n; }
  const pw = S.player_color === 'white';
  $('trayTop').textContent = pw ? bw : bb;
  $('trayBottom').textContent = pw ? bb : bw;
  const lead = pw ? mw - mb : mb - mw;
  $('matEdge').textContent = lead === 0 ? '' : (lead > 0 ? '+' + lead + ' you' : '+' + (-lead) + ' engine');
}
function resultLine(g) {
  const W = g.winner === g.player_color ? 'You win' : g.winner === 'draw' ? 'Draw' : 'Engine wins';
  const R = { checkmate: 'checkmate', resign: 'resignation', timeout: 'flag fall', stalemate: 'stalemate', insufficient: 'insufficient material', fifty: 'fifty-move rule', repetition: 'threefold repetition', draw: 'agreement' }[g.status] || g.status;
  return [W, R];
}
async function paint(full = true) {
  if (!S) return;
  document.body.dataset.plies = S.moves.length;
  if (full) board.syncFromFen(S.fen);
  const map = parsePlacement(S.fen);
  board.setSelected(sel);
  const tg = (sel && SET.showLegal) ? (S.legal_moves || []).filter(u => u.startsWith(sel)) : [];
  board.setTargets(tg.map(u => u.slice(2, 4)), tg.filter(u => Boolean(map[u.slice(2, 4)])));
  const lm = S.moves.length ? S.moves[S.moves.length - 1] : null;
  board.setLastMove(SET.showLastMove && lm ? { from: lm.slice(0, 2), to: lm.slice(2, 4) } : null);
  board.setCheck(S.check ? kingSq(map, S.turn) : null);
  board.playerSide = S.player_color;
  paintClocks(); paintLedger(); paintTray();
  $('levelTag').textContent = S.level.toUpperCase() + (S.level === 'fight' ? ' · FULL STRENGTH' : '');
  $('matchLine').textContent = `${S.opening ? S.opening.eco + ' ' + S.opening.name : ''} · ${S.moves.length} ply`;
  $('youTag').textContent = 'YOU · ' + S.player_color.toUpperCase();
  $('oppTag').textContent = 'NEURAL KNIGHT · ' + S.level.toUpperCase();
  const over = S.status !== 'ongoing';
  $('btnResign').disabled = over; $('btnDraw').disabled = over;
  $('btnUndo').disabled = over || !(S.level === 'beginner' || S.level === 'casual') || !S.moves.length;
  $('thinkBadge').classList.toggle('hidden', S.turn !== S.engine_color || over);
  if (over) showResult(); else $('resultOverlay').classList.add('hidden');
}
/* ---------- moves ---------- */
function canPlayFrom(sq) {
  if (busy || !S || S.status !== 'ongoing' || S.turn !== S.player_color) return false;
  const p = parsePlacement(S.fen)[sq];
  return !!p && ((p === p.toUpperCase()) === (S.player_color === 'white'));
}
function onPick(sq) {
  if (busy || !S || S.status !== 'ongoing' || S.turn !== S.player_color) return;
  if (pendingConfirm && pendingConfirm.to === sq && sel === pendingConfirm.from) {
    const u = pendingConfirm.uci; pendingConfirm = null; submitMove(u); return;
  }
  pendingConfirm = null;
  const outs = (S.legal_moves || []).filter(u => u.startsWith(sel || '') && u.slice(2, 4) === sq);
  if (sel && outs.length) {
    if (outs.some(u => u.length === 5)) { openPromo(outs); return; }
    const u = outs.find(x => x.length === 4) || outs[0];
    if (SET.confirmMoves) { pendingConfirm = { from: sel, to: sq, uci: u }; toast(`Play ${u}? Tap ${sq} again.`); return; }
    sel = null; submitMove(u); return;
  }
  sel = canPlayFrom(sq) ? (sel === sq ? null : sq) : null;
  paint(false);
}
function attemptMove(from, to) {
  if (busy || !S || S.status !== 'ongoing') { if (S) board.shake(from); return; }
  const outs = (S.legal_moves || []).filter(u => u.startsWith(from) && u.slice(2, 4) === to);
  if (!outs.length) { board.shake(from); paint(false); return; } // illegal: shake + snap back
  if (outs.some(u => u.length === 5)) { sel = from; openPromo(outs); paint(false); return; }
  const u = outs.find(x => x.length === 4) || outs[0];
  sel = null; submitMove(u);
}
async function submitMove(uci) {
  if (busy) return;
  busy = true;
  const prevMap = parsePlacement(S.fen);
  try {
    const g = await api.post(`/api/games/${S.id}/move`, { uci, engine_reply: false });
    const facts = diffPositions(prevMap, parsePlacement(g.fen));
    openGameKeep(g);
    S = g;
    await board.animateFacts(facts, parsePlacement(g.fen));
    afterMove(facts);
    if (S.status === 'ongoing' && S.turn === S.engine_color) aiTurn();
    else paint();
  } catch (e) { toast('Rejected: ' + e.message); board.shake(uci.slice(0, 2)); }
  busy = false;
}
function openGameKeep(g) { S = g; sel = null; pendingConfirm = null; try { localStorage.setItem('cfl_last_game', g.id); } catch {} }
function afterMove(facts) {
  if (facts.captured) SFX.capture(); else SFX.move();
  if (S.check && S.status === 'ongoing') setTimeout(SFX.check, 150);
  const san = S.sans[S.sans.length - 1] || '';
  announce(`Move ${S.moves.length}: ${san}. ${S.check ? 'Check. ' : ''}${S.status !== 'ongoing' ? resultLine(S).join(', ') : ''}`);
  if (facts.captured && board.o.cinematic && facts.to) { const p = sqToPos(facts.to); board.cinematicPush(p.x, p.z); }
  paint();
}
async function aiTurn() {
  board.setThinking(true, S.engine_color);
  paint();
  try {
    const r = await getMove(S.fen, S.level, S.level === 'fight' ? 2500 : 1200, S.sans);
    const g = await api.post(`/api/games/${S.id}/engine-move`, { uci: r.move });
    const facts = diffPositions(parsePlacement(S.fen), parsePlacement(g.fen));
    S = g; openGameKeep(g);
    await board.animateFacts(facts, parsePlacement(g.fen));
    board.setThinking(false);
    if (facts.captured && board.o.cinematic) board.cinematicPush(sqToPos(facts.to).x, sqToPos(facts.to).z);
    if (S.status !== 'ongoing') { const loser = S.winner === 'draw' ? null : (S.winner === 'white' ? 'black' : 'white'); await board.endGame(loser, S.winner === 'draw' ? null : S.winner); if (board.o.cinematic) board.cinematicPush(0, 0); SFX.end(S.winner === S.player_color); }
    else if (S.check) SFX.check();
    announce(`Engine played ${S.sans[S.sans.length - 1]}.`);
    paint();
  } catch (e) {
    board.setThinking(false);
    aiError = e.message;
    $('errText').textContent = 'Engine hiccup (neutral): ' + e.message;
    $('errBanner').classList.remove('hidden');
    paint();
  }
  busy = false;
}
$('errRetry').onclick = () => { $('errBanner').classList.add('hidden'); if (S && S.status === 'ongoing' && S.turn === S.engine_color && !busy) { busy = true; aiTurn(); } };
/* promotion picker (accessible overlay; assumption noted in README) */
let promoCands = [];
function openPromo(cands) { promoCands = cands; $('promoOverlay').classList.remove('hidden'); }
document.querySelectorAll('#promoOverlay button').forEach(b => b.onclick = () => {
  $('promoOverlay').classList.add('hidden');
  const u = promoCands.find(x => x.endsWith(b.dataset.p)) || promoCands[0];
  sel = null; submitMove(u);
});
/* ---------- HUD buttons ---------- */
$('btnResign').onclick = async () => { if (!S || !confirm('Resign this game?')) return; S = await api.post(`/api/games/${S.id}/resign`); paint(); };
$('btnDraw').onclick = async () => {
  if (!S) return;
  const r = await api.post(`/api/games/${S.id}/draw-offer`);
  S = r; paint();
  if (!r.draw_accepted) toast('Draw declined — position is not objectively drawn.');
};
$('btnUndo').onclick = async () => {
  if (!S || busy) return;
  try { const g = await api.post(`/api/games/${S.id}/undo`); openGame(g); S = g; board.syncFromFen(S.fen); paint(); toast('Took back the last round.'); }
  catch (e) { toast('Undo: ' + e.message); }
};
$('btnCopyPgn').onclick = async () => { if (!S) return; const t = await api.get(`/api/games/${S.id}/pgn`); try { await navigator.clipboard.writeText(t); toast('PGN copied'); } catch { dl(`game_${S.id}.pgn`, t); } };
$('btnPgnDl').onclick = async () => { if (S) dl(`game_${S.id}.pgn`, await api.get(`/api/games/${S.id}/pgn`)); };
function dl(name, text) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
$('btnRematch').onclick = async () => {
  const g = await api.post('/api/games', { player_color: S.player_color, level: S.level, time_control: S.time_control, custom_ms: S.tc_init_ms || 0, custom_inc_ms: S.tc_inc_ms || 0 });
  openGame(g); enterGame();
};
$('btnHome').onclick = () => location.hash = '#/home';
$('btnAnalyze').onclick = () => location.href = 'index.html#/analysis?id=' + S.id;
$('btnMenu').onclick = () => location.hash = '#/home';
/* move input + keyboard cursor */
async function submitText() {
  const inp = $('kbdInput'), t = inp.value.trim();
  if (!t || !S || busy) return;
  busy = true;
  try { await submitMoveText(t); inp.value = ''; } catch (e) { toast("Can't play that: " + e.message); }
  busy = false;
}
async function submitMoveText(t) {
  const prevMap = parsePlacement(S.fen);
  const g = await api.post(`/api/games/${S.id}/move-text`, { text: t, engine_reply: false });
  const facts = diffPositions(prevMap, parsePlacement(g.fen));
  openGameKeep(g); S = g;
  await board.animateFacts(facts, parsePlacement(g.fen));
  afterMove(facts);
  if (S.status === 'ongoing' && S.turn === S.engine_color) aiTurn(); else paint();
}
$('kbdPlay').onclick = submitText;
$('kbdInput').addEventListener('keydown', e => { if (e.key === 'Enter') submitText(); e.stopPropagation(); });
const CURSOR_HOME = { white: 'e2', black: 'e7' };
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (location.hash.startsWith('#/game')) {
    if (['1', '2', '3', '4'].includes(e.key)) { board.setCamera(['white', 'black', 'top', 'iso'][+e.key - 1]); return; }
    if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      if (!cursor) cursor = S && S.player_color === 'black' ? 'e7' : 'e2';
      let [f, r] = [cursor.charCodeAt(0) - 97, +cursor[1] - 1];
      const flip = (S && S.player_color === 'black');
      let dx = 0, dy = 0;
      if (e.key === 'ArrowLeft') dx = -1; if (e.key === 'ArrowRight') dx = 1;
      if (e.key === 'ArrowUp') dy = 1; if (e.key === 'ArrowDown') dy = -1;
      if (flip) { dx = -dx; dy = -dy; }
      f = Math.max(0, Math.min(7, f + dx)); r = Math.max(0, Math.min(7, r + dy));
      cursor = 'abcdefgh'[f] + (r + 1);
      board.setCursor(cursor);
      return;
    }
    if (e.key === 'Enter' && cursor) { onPick(cursor); return; }
  }
});
/* camera buttons */
document.querySelectorAll('[data-cam]').forEach(b => b.onclick = () => { SET.camera = b.dataset.cam; saveSet(); board.setCamera(b.dataset.cam === 'auto' ? (S && S.player_color === 'black' ? 'black' : 'white') : b.dataset.cam); });
$('btnCamReset').onclick = () => board.resetCamera();
/* ---------- result ---------- */
async function showResult() {
  const [W, R] = resultLine(S);
  $('resTitle').textContent = W + ' — ' + R;
  $('resSub').textContent = S.status;
  $('resMeta').textContent = `${S.moves.length} plies · ${Math.round(S.duration_s || 0)}s · ${S.level}`;
  $('resultOverlay').classList.remove('hidden');
  try {
    const a = await api.get(`/api/games/${S.id}/analysis`);
    $('resSub').textContent = a.result_text + ' · ' + a.eco.eco + ' ' + a.eco.name;
  } catch { /* basic info already shown */ }
  const loser = S.winner === 'draw' ? null : (S.winner === 'white' ? 'black' : 'white');
  await board.endGame(loser, S.winner === 'draw' ? null : S.winner);
}
/* ---------- screens ---------- */
function enterGame() {
  location.hash = '#/game';
  board.setThinking(false);
  board.syncFromFen(S.fen);
  const cam = SET.camera === 'auto' ? (S.player_color === 'black' ? 'black' : 'white') : SET.camera;
  board.setCamera(cam, false);
  busy = true;
  paint().then(() => { busy = false; });
  if (S.status === 'ongoing' && S.turn === S.engine_color && !S.moves.length) {
    // engine opens (same model/book as any engine move); worker drives the rest
    aiTurn();
  } else if (S.status === 'ongoing' && S.turn === S.engine_color) aiTurn();
}
async function boot() {
  const h = location.hash || '#/home';
  route(h);
  window.addEventListener('hashchange', () => route(location.hash));
  try { const s = await api.get('/api/health'); $('homeModel').textContent = `${(s.params / 1e6).toFixed(0)}M-param silent model · ${s.trained ? 'trained' : 'tactics+book build'}`; } catch {}
  const id = new URLSearchParams(location.search).get('continue') || null;
  if (id) { try { const g = await api.get('/api/games/' + id); openGame(g); enterGame(); } catch {} }
  else {
    try {
      const last = localStorage.getItem('cfl_last_game');
      $('btnContinue').disabled = !last;
    } catch { $('btnContinue').disabled = true; }
  }
  board.setCamera('iso', false);
  board.controls.autoRotate = !SET.reducedMotion; board.controls.autoRotateSpeed = 0.7;
  board.syncFromFen(START_FEN);
}
function route(h) {
  const name = (h.split('?')[0].replace('#/', '') || 'home');
  const v = ['home', 'setup', 'game', 'history', 'settings'].includes(name) ? name : 'home';
  show(v);
  board.controls.autoRotate = (v === 'home' || v === 'result') && !SET.reducedMotion;
  if (v === 'game' && S) { paint(); }
  if (v === 'history') loadHistory();
  if (v === 'settings') paintSettings();
  announce(v + ' screen');
}
/* home */
$('btnNew3d').onclick = () => location.hash = '#/setup';
$('btnContinue').onclick = async () => {
  try { const g = await api.get('/api/games/' + localStorage.getItem('cfl_last_game')); openGame(g); enterGame(); }
  catch { toast('No saved game to continue'); }
};
$('btnHist3d').onclick = () => location.hash = '#/history';
$('btnSet3d').onclick = () => location.hash = '#/settings';
$('btnFlat').onclick = () => location.href = 'index.html#/setup';
/* setup */
const setup3d = { side: 'white', level: 'club', tc: '10+0' };
function tcToBackend(tc) {
  if (tc === 'casual') return { time_control: 'none' };
  const [m, i] = tc.split('+').map(Number);
  return { time_control: 'custom', custom_ms: m * 60000, custom_inc_ms: (i || 0) * 1000 };
}
function paintSetup() {
  document.querySelectorAll('#s3Side .card').forEach(c => { c.classList.toggle('sel', c.dataset.side === setup3d.side); c.onclick = () => { setup3d.side = c.dataset.side; paintSetup(); }; });
  const lc = $('s3Level'); lc.innerHTML = '';
  for (const [k, label] of [['beginner', 'Beginner'], ['casual', 'Casual'], ['club', 'Club'], ['strong', 'Strong'], ['fight', '⚡ Fight mode · Full strength']]) {
    const d = document.createElement('div');
    d.className = 'card selectable' + (setup3d.level === k ? ' sel' : '');
    d.innerHTML = `<b>${label}</b><p>${k === 'fight' ? 'Full strength. Never called unbeatable.' : 'Openly handicapped.'}</p>`;
    d.onclick = () => { setup3d.level = k; paintSetup(); };
    lc.appendChild(d);
  }
  document.querySelectorAll('#s3Tc .card').forEach(c => { c.classList.toggle('sel', c.dataset.tc === setup3d.tc); c.onclick = () => { setup3d.tc = c.dataset.tc; paintSetup(); }; });
  $('s3Manifest').textContent = `${setup3d.side} · ${setup3d.level} · ${setup3d.tc}`;
}
$('btnStart3d').onclick = async () => {
  try {
    const g = await api.post('/api/games', { player_color: setup3d.side, level: setup3d.level, ...tcToBackend(setup3d.tc) });
    openGame(g); enterGame();
  } catch (e) { toast('Start failed: ' + e.message); }
};
$('btnBackHome').onclick = () => location.hash = '#/home';
/* history + replay */
let hGames = [], hSel = null, hFens = [], hSans = [], hIdx = 0, hTimer = 0;
async function loadHistory() {
  try { hGames = await api.get('/api/games'); } catch (e) { toast('Archive: ' + e.message); return; }
  const L = $('hList'); L.innerHTML = '';
  for (const g of hGames) {
    const d = document.createElement('div'); d.className = 'arccard' + (g.id === hSel ? ' sel' : '');
    const res = g.winner === 'draw' ? '½–½' : g.winner === 'white' ? '1–0' : g.winner === 'black' ? '0–1' : '*';
    d.innerHTML = `<div class="top"><span class="tag">${g.level.toUpperCase()}</span><span class="score">${res}</span></div>
    <div class="meta">${g.player_color} · ${g.time_control} · ${g.moves.length} ply</div>
    <div class="ecorow"><span>${g.opening ? g.opening.eco + ' ' + g.opening.name : ''}</span><span>${g.status}</span></div>`;
    d.onclick = () => selectReplay(g.id);
    L.appendChild(d);
  }
  if (!L.children.length) L.innerHTML = '<p class="dim">No saved games yet.</p>';
  if (hSel) selectReplay(hSel); else if (hGames.length) selectReplay(hGames[0].id);
}
async function selectReplay(id) {
  hSel = id;
  document.querySelectorAll('#hList .arccard').forEach(() => {});
  paintReplayList();
  try {
    const r = await api.get(`/api/games/${id}/replay`);
    hFens = r.fens; hSans = r.sans;
  } catch { hFens = [START_FEN]; hSans = []; }
  hIdx = hFens.length - 1; paintReplay();
}
function paintReplayList() {
  document.querySelectorAll('#hList .arccard').forEach((el, i) => el.classList.toggle('sel', hGames[i] && hGames[i].id === hSel));
}
function paintReplay() {
  const sl = $('hSlider'); sl.max = Math.max(0, hFens.length - 1); sl.value = Math.max(0, hIdx);
  board.syncFromFen(hFens[Math.max(0, hIdx)] || START_FEN);
  const lm = hIdx > 0 ? hSans[hIdx - 1] : null;
  board.setLastMove(hIdx > 0 && hSans.length ? { from: null, to: null } : null);
  $('hLabel').textContent = hIdx <= 0 ? 'Starting position' : `Ply ${hIdx}/${hFens.length - 1} · ${hSans[hIdx - 1] || ''}`;
  void lm;
}
$('hFirst').onclick = () => { hIdx = 0; paintReplay(); };
$('hPrev').onclick = () => { hIdx = Math.max(0, hIdx - 1); paintReplay(); };
$('hNext').onclick = () => { hIdx = Math.min(hFens.length - 1, hIdx + 1); paintReplay(); };
$('hLast').onclick = () => { hIdx = hFens.length - 1; paintReplay(); };
$('hSlider').oninput = e => { hStop(); hIdx = +e.target.value; paintReplay(); };
function hStop() { clearInterval(hTimer); hTimer = 0; $('hPlay').textContent = '▶'; }
$('hPlay').onclick = () => {
  if (hTimer) { hStop(); return; }
  if (hIdx >= hFens.length - 1) hIdx = 0;
  $('hPlay').textContent = '⏸';
  hTimer = setInterval(() => { hIdx++; if (hIdx >= hFens.length) { hStop(); hIdx = hFens.length - 1; } paintReplay(); }, Math.max(400, SET.animMs * 3));
};
$('hOpenArena').onclick = async () => { if (!hSel) return; openGame(await api.get('/api/games/' + hSel)); enterGame(); };
$('hBackHome2').onclick = () => location.hash = '#/home';
/* settings */
function paintSettings() {
  $('qSel').value = SET.quality;
  $('thSel').value = SET.theme;
  $('psSel').value = SET.pieceStyle;
  $('camSel').value = SET.camera;
  $('animRange').value = SET.animMs; $('animVal').textContent = SET.animMs + 'ms';
  const sw = (id, get, set) => {
    const el = $(id);
    el.classList.toggle('on', get()); el.setAttribute('aria-checked', String(get()));
    el.onclick = () => { set(!get()); saveSet(); applyRuntime(); paintSettings(); };
  };
  sw('swSound', () => SET.soundOn, v => SET.soundOn = v);
  sw('swConfirm', () => SET.confirmMoves, v => SET.confirmMoves = v);
  sw('swLegal', () => SET.showLegal, v => SET.showLegal = v);
  sw('swLast', () => SET.showLastMove, v => SET.showLastMove = v);
  sw('swCine', () => SET.cinematic, v => SET.cinematic = v);
  sw('swHC', () => SET.highContrast, v => SET.highContrast = v);
  $('vol3').value = SET.volume; $('vol3Val').textContent = SET.volume + '%';
}
function applyRuntime() {
  board.o.animMs = SET.animMs; board.o.reducedMotion = SET.reducedMotion;
  board.o.cinematic = SET.cinematic && !SET.reducedMotion;
  board.applyTheme(theme3d());
  board.setQuality(quality());
  if (S) paint(false);
}
$('qSel').onchange = e => { SET.quality = e.target.value; saveSet(); applyRuntime(); };
$('thSel').onchange = e => { SET.theme = e.target.value; saveSet(); applyRuntime(); };
$('psSel').onchange = e => { SET.pieceStyle = e.target.value; saveSet(); board.o.pieceStyle = SET.pieceStyle; if (S) board.syncFromFen(S.fen); else board.syncFromFen(START_FEN); };
$('camSel').onchange = e => { SET.camera = e.target.value; saveSet(); };
$('animRange').oninput = e => { SET.animMs = +e.target.value; $('animVal').textContent = SET.animMs + 'ms'; saveSet(); applyRuntime(); };
$('vol3').oninput = e => { SET.volume = +e.target.value; $('vol3Val').textContent = SET.volume + '%'; saveSet(); };
$('btnFlat2d').onclick = () => location.href = 'index.html#/setup';
$('btnBackHome3').onclick = () => location.hash = '#/home';
$('btnGear').onclick = () => location.hash = '#/settings';
$('gearBack').onclick = () => location.hash = S ? '#/game' : '#/home';
/* fps probe for the perf test */
setInterval(() => { window.__fps = board ? board.fps : 0; }, 500);
/* ledger collapse (mobile) */
$('ledgerToggle').onclick = () => $('ledgerBody').classList.toggle('hidden');

paintSetup();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
boot();
