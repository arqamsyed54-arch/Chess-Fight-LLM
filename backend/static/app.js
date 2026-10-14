/* Chess Fight LLM — Crucible Arena app. No chat anywhere: the engine speaks only moves. */
"use strict";
const $ = (id) => document.getElementById(id);
const toast = (m) => { const t = $("toast"); t.textContent = m; t.classList.remove("hidden"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.add("hidden"), 2600); };
const api = {
  async _r(p, o) { const r = await fetch(p, o); if (!r.ok) { let d = {}; try { d = await r.json(); } catch {} throw new Error(d.detail || r.statusText); } const ct = r.headers.get("content-type") || ""; return ct.includes("json") ? r.json() : r.text(); },
  get(p) { return this._r(p); },
  post(p, b) { return this._r(p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }); },
};

/* ---------- settings ---------- */
const DEFSET = { theme: "slate", pieceSet: "neo", animMs: 120, confirmMoves: false, showLegal: true, showLastMove: true, showKeyboard: true, soundOn: true, volume: 75, sounds: { move: true, capture: true, check: true, lowtime: true, end: true }, highContrast: false, coordsOutside: false, reducedMotion: false, locale: "en" };
let SET = { ...DEFSET, sounds: { ...DEFSET.sounds } };
try {
  const _saved = JSON.parse(localStorage.getItem("cfl_settings") || "{}");
  Object.assign(SET, _saved);
  SET.sounds = { ...DEFSET.sounds, ...(_saved.sounds || {}) };
} catch {}
function saveSet() { localStorage.setItem("cfl_settings", JSON.stringify(SET)); }
function applySet() {
  document.documentElement.dataset.theme = SET.highContrast ? "high-contrast" : SET.theme;
  document.body.classList.toggle("reduced", SET.reducedMotion);
  saveSet();
}

/* ---------- sound (WebAudio synth, no assets) ---------- */
let AC = null;
function beep(freq, ms, type = "sine", gain = 1) {
  if (!SET.soundOn) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.value = freq;
    const v = (SET.volume / 100) * 0.25 * gain;
    g.gain.setValueAtTime(v, AC.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + ms / 1000);
    o.connect(g); g.connect(AC.destination); o.start(); o.stop(AC.currentTime + ms / 1000);
  } catch {}
}
const SFX = {
  move() { if (SET.sounds.move) beep(660, 48, "square", .6); },
  capture() { if (SET.sounds.capture) { beep(330, 62, "square", .8); setTimeout(() => beep(220, 60, "square", .6), 30); } },
  check() { if (SET.sounds.check) beep(880, 110, "sine", 1); },
  lowtime() { if (SET.sounds.lowtime) beep(440, 90, "sawtooth", .5); },
  end(win) { if (SET.sounds.end) { [523, 659, 784].forEach((f, i) => setTimeout(() => beep(f, 140, "sine", .9), i * 130)); if (!win) setTimeout(() => beep(196, 300, "sine", .8), 400); } },
};

/* ---------- FEN helpers ---------- */
function parseFen(fen) {
  const [place, turn] = fen.split(" ");
  const m = {}; const rows = place.split("/");
  for (let r = 0; r < 8; r++) { let f = 0; for (const ch of rows[7 - r]) { if (/\d/.test(ch)) f += +ch; else { m["abcdefgh"[f] + (r + 1)] = ch; f++; } } }
  return { pieces: m, turn };
}
const sqXY = (sq) => ["abcdefgh".indexOf(sq[0]), +sq[1] - 1];
const isW = (ch) => ch === ch.toUpperCase();
const START_COUNT = { P: 8, N: 2, B: 2, R: 2, Q: 1, p: 8, n: 2, b: 2, r: 2, q: 1 };
function capturedBy(fen) { // {byWhite:[glyphs], byBlack:[], diff (white-black material)}
  const { pieces } = parseFen(fen); const c = {};
  for (const p of Object.values(pieces)) c[p] = (c[p] || 0) + 1;
  const bw = [], bb = []; let mw = 0, mb = 0;
  for (const [k, n] of Object.entries(START_COUNT)) {
    const miss = n - (c[k] || 0);
    for (let i = 0; i < miss; i++) (isW(k) ? bb : bw).push(k);
  }
  for (const [p, n] of Object.entries(c)) { const v = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0, p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }[p] || 0; if (isW(p)) mw += v * n; else mb += v * n; }
  return { byWhite: bw, byBlack: bb, diff: mw - mb };
}

/* ---------- SVG board ---------- */
const GLYPH = {
  neo: { w: { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙" }, b: { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟" } },
  staunton: { w: { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟" }, b: { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟" } },
  minimal: { w: { K: "K", Q: "Q", R: "R", B: "B", N: "N", P: "P" }, b: { K: "K", Q: "Q", R: "R", B: "B", N: "N", P: "P" } },
};
function renderBoard(svg, fen, o = {}) {
  const NS = "http://www.w3.org/2000/svg";
  svg.innerHTML = "";
  const { pieces } = parseFen(fen);
  const flip = !!o.flip;
  const X = (f) => (flip ? 7 - f : f) * 100, Y = (r) => (flip ? r : 7 - r) * 100;
  const set = GLYPH[SET.pieceSet] || GLYPH.neo;
  const showCoordsOut = SET.coordsOutside;
  if (showCoordsOut) { svg.setAttribute("viewBox", "-40 -40 880 880"); } else svg.setAttribute("viewBox", "0 0 800 800");
  const last = o.last; const lf = last && last.slice(0, 2), lt = last && last.slice(2, 4);
  for (let f = 0; f < 8; f++) for (let r = 0; r < 8; r++) {
    const sq = "abcdefgh"[f] + (r + 1);
    const rect = document.createElementNS(NS, "rect");
    rect.setAttribute("x", X(f)); rect.setAttribute("y", Y(r));
    rect.setAttribute("width", 100); rect.setAttribute("height", 100);
    rect.setAttribute("class", "sq"); rect.setAttribute("fill", (f + r) % 2 ? "var(--bd)" : "var(--bl)");
    rect.dataset.sq = sq; svg.appendChild(rect);
    if (SET.showLastMove && (sq === lf || sq === lt)) {
      const l = document.createElementNS(NS, "rect");
      l.setAttribute("x", X(f)); l.setAttribute("y", Y(r)); l.setAttribute("width", 100); l.setAttribute("height", 100);
      l.setAttribute("fill", "rgba(56,189,248,.28)"); svg.appendChild(l);
    }
    if (sq === o.sel) {
      const s = document.createElementNS(NS, "rect");
      s.setAttribute("x", X(f)); s.setAttribute("y", Y(r)); s.setAttribute("width", 100); s.setAttribute("height", 100);
      s.setAttribute("fill", "rgba(245,158,11,.32)"); s.setAttribute("stroke", "#F59E0B"); s.setAttribute("stroke-width", "4"); svg.appendChild(s);
    }
    if (SET.showLegal && o.targets && o.targets.includes(sq)) {
      const c = document.createElementNS(NS, "circle");
      c.setAttribute("cx", X(f) + 50); c.setAttribute("cy", Y(r) + 50);
      if (pieces[sq]) { c.setAttribute("r", 44); c.setAttribute("fill", "none"); c.setAttribute("stroke", "rgba(245,158,11,.55)"); c.setAttribute("stroke-width", "7"); }
      else { c.setAttribute("r", 14); c.setAttribute("fill", "rgba(245,158,11,.5)"); }
      svg.appendChild(c);
    }
  }
  // coordinates
  const coord = (x, y, t) => { const e = document.createElementNS(NS, "text"); e.setAttribute("x", x); e.setAttribute("y", y); e.setAttribute("font-size", "17"); e.setAttribute("font-family", "var(--mono)"); e.setAttribute("font-weight", "700"); e.setAttribute("fill", "#8b93a3"); e.textContent = t; svg.appendChild(e); };
  for (let i = 0; i < 8; i++) {
    const f = flip ? 7 - i : i, r = flip ? i : 7 - i;
    if (!showCoordsOut) {
      coord(X(f) + 6, Y(r) + 22, String(r + 1));
      if (r === (flip ? 7 : 0)) coord(X(f) + 80, Y(r) + 94, "abcdefgh"[f]);
    } else {
      coord(X(f) + 42, -12, "abcdefgh"[f]); coord(-30, Y(r) + 58, String(r + 1));
    }
  }
  // pieces
  for (const [sq, p] of Object.entries(pieces)) {
    const [f, r] = sqXY(sq);
    const t = document.createElementNS(NS, "text");
    const white = isW(p);
    const g = (white ? set.w : set.b)[p.toUpperCase()];
    t.setAttribute("x", X(f) + 50); t.setAttribute("y", Y(r) + 72);
    t.setAttribute("text-anchor", "middle"); t.setAttribute("class", "piece");
    t.setAttribute("font-size", SET.pieceSet === "minimal" ? 52 : 66);
    t.setAttribute("font-family", SET.pieceSet === "minimal" ? "var(--mono)" : "var(--sans)");
    t.setAttribute("font-weight", "700");
    if (SET.pieceSet === "staunton") { t.setAttribute("fill", white ? "var(--pw)" : "var(--pb)"); t.setAttribute("stroke", white ? "var(--pb)" : "var(--pw)"); t.setAttribute("stroke-width", "2"); }
    else if (SET.pieceSet === "minimal") { t.setAttribute("fill", white ? "var(--pw)" : "var(--pb)"); t.setAttribute("stroke", white ? "#000" : "#fff"); t.setAttribute("stroke-width", "1"); }
    else { t.setAttribute("fill", white ? "var(--pw)" : "var(--pb)"); t.setAttribute("stroke", white ? "rgba(0,0,0,.65)" : "rgba(255,255,255,.55)"); t.setAttribute("stroke-width", "2.5"); t.setAttribute("paint-order", "stroke"); }
    t.textContent = g; t.dataset.sq = sq; svg.appendChild(t);
    if (o.check && ((o.checkWhite && white && p.toUpperCase() === "K") || (!o.checkWhite && !white && p.toUpperCase() === "K"))) {
      const ring = document.createElementNS(NS, "circle");
      ring.setAttribute("cx", X(f) + 50); ring.setAttribute("cy", Y(r) + 50); ring.setAttribute("r", 44);
      ring.setAttribute("fill", "rgba(239,68,68,.25)"); ring.setAttribute("stroke", "#EF4444"); ring.setAttribute("stroke-width", "5"); svg.appendChild(ring);
    }
  }
  svg.onclick = null;
  svg.onpointerdown = (e) => { const s = e.target.dataset && e.target.dataset.sq; dragFrom = s || null; };
  svg.onpointerup = (e) => {
    const s = e.target.dataset && e.target.dataset.sq;
    const from = dragFrom; dragFrom = null;
    if (!s || !o.onSquare) return;
    if (e.cancelable) e.preventDefault();
    if (from && from !== s) { if (sel !== from) o.onSquare(from); o.onSquare(s); }
    else o.onSquare(s);
  };
}
let dragFrom = null;

/* ---------- router ---------- */
const VIEWS = ["setup", "play", "history", "analysis", "study", "stats", "mcp", "settings"];
function route() {
  const h = location.hash || "#/setup";
  const name = (h.split("?")[0].replace("#/", "") || "setup");
  const v = VIEWS.includes(name) ? name : "setup";
  VIEWS.forEach((x) => $("view-" + x).classList.toggle("hidden", x !== v));
  document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("on", a.dataset.nav === v));
  const core = { setup: vSetup, play: vPlay, history: vHistory, analysis: vAnalysis, settings: vSettings };
  (core[v] || (window.CFViews && window.CFViews[v]) || vSetup)();
}
window.addEventListener("hashchange", route);

/* ---------- shared ---------- */
let MODEL = { params: 0 };
async function refreshEngineChip() {
  try {
    const h = await api.get("/api/health");
    MODEL = h;
    const mp = (h.params / 1e6).toFixed(1) + "M";
    $("engineChip").textContent = `🧠 ${mp} · ${(h.int8_mb).toFixed(0)}MB INT8`;
    $("setupModel").textContent = `${mp} weights · local`;
    $("setModel").textContent = `${mp} weights · local`;
    $("cacheParams").textContent = h.params.toLocaleString() + " weights (INT8)";
    $("cacheMb").textContent = `~${h.int8_mb.toFixed(1)} MB resident`;
  } catch { $("engineChip").textContent = "engine offline"; }
}
const LEVELS = {
  // Elo chips: measured 2026-10-12 (beginner 724, casual 650, club/strong/fight ≥1219
  // capped by weak anchors, ±~150 at n=4; head-to-head beginner-vs-casual split
  // 3-3 by color). Chips show design-intent ordering inside the error bars.
  beginner: { elo: '~650 ELO', temp: 'depth 1', extra: 'Noisy sampling, frequent blindspots', undo: 'Permitted' },
  casual: { elo: '~750 ELO', temp: 'depth 1', extra: 'Book lines, occasional blunder', undo: 'Permitted' },
  club: { elo: '~1100 ELO', temp: 'depth 2', extra: 'Sharp combinations, solid play', undo: 'Disabled' },
  strong: { elo: '~1350 ELO', temp: 'depth 2+', extra: 'Near-deterministic, punishes errors', undo: 'Disabled' },
  fight: { elo: 'FULL STRENGTH', temp: 'depth 3', extra: 'Strongest vs humans. Measured, never “unbeatable”.', undo: '0 granted' },
};
const fmtClock = (ms) => { if (ms == null) return "--:--"; const t = Math.max(0, ms); const m = Math.floor(t / 60000), s = Math.floor(t % 60000 / 1000), d = Math.floor(t % 1000 / 100); return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${d}`; };
const fmtDur = (s) => s < 60 ? `${Math.round(s)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
function download(name, text, type = "text/plain") { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }

/* ================= SETUP ================= */
const setup = { side: "white", level: "club", tc: "10+0" };
function vSetup() {
  refreshEngineChip();
  document.querySelectorAll("#sideCards .card").forEach((c) => {
    c.classList.toggle("sel", c.dataset.side === setup.side);
    c.onclick = () => { setup.side = c.dataset.side; vSetupCards(); };
  });
  const lc = $("levelCards"); lc.innerHTML = "";
  for (const [k, m] of Object.entries(LEVELS)) {
    const d = document.createElement("div");
    d.className = "card selectable" + (setup.level === k ? " sel" : "");
    d.tabIndex = 0;
    d.innerHTML = `<span class="tag ${k === "fight" ? "amber" : ""}">${m.elo}</span><b style="${k === "fight" ? "color:var(--amber)" : ""}">${k === "fight" ? "⚡ Fight Mode" : k[0].toUpperCase() + k.slice(1)}</b><p>${m.extra}</p><div class="ministats"><div><span>Temp</span><b>${m.temp}</b></div><div><span>Undo</span><b>${m.undo}</b></div></div>`;
    d.onclick = () => { setup.level = k; vSetupCards(); };
    lc.appendChild(d);
  }
  document.querySelectorAll("#tcCards .card").forEach((c) => {
    c.classList.toggle("sel", c.dataset.tc === setup.tc);
    c.onclick = () => { setup.tc = c.dataset.tc; vSetupCards(); };
  });
  vSetupCards();
}
function vSetupCards() {
  document.querySelectorAll("#sideCards .card").forEach((c) => c.classList.toggle("sel", c.dataset.side === setup.side));
  document.querySelectorAll("#levelCards .card").forEach((c, i) => c.classList.toggle("sel", Object.keys(LEVELS)[i] === setup.level));
  document.querySelectorAll("#tcCards .card").forEach((c) => c.classList.toggle("sel", c.dataset.tc === setup.tc));
  $("manifestSide").textContent = setup.side[0].toUpperCase() + setup.side.slice(1);
  $("manifestLevel").textContent = setup.level === "fight" ? "Fight (full)" : setup.level[0].toUpperCase() + setup.level.slice(1);
  $("manifestTc").textContent = setup.tc === "casual" ? "Untimed" : setup.tc;
}
function tcToBackend(tc) {
  if (tc === "casual") return { time_control: "none" };
  const [m, i] = tc.split("+").map(Number);
  return { time_control: "custom", custom_ms: m * 60000, custom_inc_ms: (i || 0) * 1000 };
}
$("advToggle").onclick = () => { const b = $("advBody"); b.classList.toggle("hidden"); $("advChev").textContent = b.classList.contains("hidden") ? "▸" : "▾"; };
function bindSwitch(el, get, set) {
  const paint = () => { el.classList.toggle("on", get()); el.setAttribute("aria-checked", String(get())); };
  el.onclick = (e) => { e.preventDefault(); set(!get()); paint(); };
  paint();
}
bindSwitch($("setupConfirm"), () => SET.confirmMoves, (v) => { SET.confirmMoves = v; applySet(); });
bindSwitch($("setupSound"), () => SET.soundOn, (v) => { SET.soundOn = v; applySet(); });
bindSwitch($("setupAdaptive"), () => setup.adaptive !== false, (v) => { setup.adaptive = v; });
bindSwitch($("setupAuto"), () => !!setup.autoLevel, (v) => { setup.autoLevel = v; });
async function startPayload() {
  let level = setup.level;
  if (setup.autoLevel) {
    try {
      const pid = localStorage.getItem("cf_profile");
      if (pid) level = (await api.get(`/api/profiles/${pid}/suggest`)).suggested;
    } catch {}
  }
  const body = { player_color: setup.side, level, ...tcToBackend(setup.tc), adaptive_book: setup.adaptive !== false };
  const ym = +($("oddsYou").value || 0), em = +($("oddsEng").value || 0);
  if (ym > 0 || em > 0) {
    const base = tcToBackend(setup.tc);
    body.time_control = "custom";
    body.custom_ms = ym > 0 ? ym * 60000 : (base.custom_ms || 600000);
    body.custom_inc_ms = base.custom_inc_ms || 0;
    body.custom_ms_engine = em > 0 ? em * 60000 : body.custom_ms;
  }
  const pid = localStorage.getItem("cf_profile");
  if (pid) body.profile_id = pid;
  return body;
}
$("btnStart").onclick = async () => {
  try {
    const g = await api.post("/api/games", await startPayload());
    try { localStorage.setItem("cfl_setup", JSON.stringify(setup)); } catch {}
    openGame(g);
    location.hash = "#/play";
  } catch (e) { toast("Start failed: " + e.message); }
};
$("btnRestore").onclick = async () => {
  try { Object.assign(setup, JSON.parse(localStorage.getItem("cfl_setup") || "{}")); } catch {}
  const id = localStorage.getItem("cfl_last_game");
  if (!id) { toast("No previous game stored"); vSetupCards(); return; }
  try { openGame(await api.get("/api/games/" + id)); location.hash = "#/play"; }
  catch { toast("Previous game is gone — starting fresh"); $("btnStart").click(); }
};

/* ================= ARENA ================= */
let S = null, sel = null, legal = [], pendingConfirm = null, analysisEvals = [], resultShownFor = "", lowWarned = false, busy = false;
let thinkT0 = 0, thinkTimer = 0;
function showThinking(on) {
  clearInterval(thinkTimer);
  $("boardWrap").classList.toggle("busy", on);
  if (on && S) {
    thinkT0 = Date.now();
    thinkTimer = setInterval(() => { if (S && busy) $("oppTele").textContent = `thinking ${((Date.now() - thinkT0) / 1000).toFixed(1)}s…`; }, 150);
  }
}
function openGame(g) { S = g; sel = null; pendingConfirm = null; legal = []; analysisEvals = []; resultShownFor = ""; lowWarned = false; busy = false; showThinking(false); $("confirmBar").classList.add("hidden"); try { localStorage.setItem("cfl_last_game", g.id); } catch {} }
function vPlay() {
  refreshEngineChip();
  $("kbdBar").style.display = SET.showKeyboard ? "" : "none";
  if (!S) {
    api.post("/api/games", { player_color: setup.side, level: setup.level, ...tcToBackend(setup.tc) })
      .then((g) => { openGame(g); paintPlay(); })
      .catch((e) => toast("Could not start: " + e.message));
  } else paintPlay();
}
function paintPlay() {
  if (!S) return;
  document.body.dataset.game = S.id;
  legal = S.status === "ongoing" ? (S.legal_moves || []) : [];
  const pw = S.player_color === "white";
  $("oppLevel").textContent = S.level.toUpperCase();
  $("oppLevel").className = "tag" + (S.level === "fight" ? " amber" : "");
  $("fightChip").classList.toggle("hidden", S.level !== "fight");
  const t = S.engine_telemetry || {};
  $("oppTele").textContent = S.level === "fight" && t.nodes
    ? `calc: depth ${t.depth} · ${(t.kns / 1000).toFixed(1)} kn/s · ${(t.ms / 1000).toFixed(1)}s`
    : (t.ms ? `net reply ${(t.ms / 1000).toFixed(2)}s · model-only` : "awaiting position");
  $("youSide").textContent = S.player_color.toUpperCase();
  $("matchTitle").textContent = `Match vs Neural Knight ${(MODEL.params / 1e6).toFixed(0)}M`;
  $("matchLevel").textContent = S.level.toUpperCase();
  $("matchLevel").className = "tag" + (S.level === "fight" ? " amber" : "");
  $("matchMeta").textContent = `${S.opening ? S.opening.eco + " · " + S.opening.name : ""} · ${S.moves.length} ply`;
  // clocks
  paintClocks();
  // captured + material
  const { byWhite, byBlack, diff } = capturedBy(S.fen);
  const gl = (p) => ({ K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟", k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" }[p]);
  $("capByPlayer").textContent = (pw ? byWhite : byBlack).map(gl).join("");
  $("capByEngine").textContent = (pw ? byBlack : byWhite).map(gl).join("");
  const lead = (pw ? diff : -diff);
  $("matDiffTop").textContent = lead < 0 ? `+${-lead}` : "";
  $("matDiffBot").textContent = lead > 0 ? `+${lead}` : "";
  // eval bar (model win% for white)
  const ev = S.engine_value || 0;
  const wp = Math.round((ev + 1) / 2 * 100);
  $("evalWhite").style.height = wp + "%";
  $("evalNum").textContent = wp + "%";
  // board
  const targets = sel ? legal.filter((u) => u.startsWith(sel)).map((u) => u.slice(2, 4)) : [];
  renderBoard($("board"), S.fen, {
    flip: !pw, sel, targets,
    last: S.moves.length ? S.moves[S.moves.length - 1] : null,
    check: S.check, checkWhite: S.turn === "white",
    onSquare: onSquare,
  });
  // hint + buttons
  const over = S.status !== "ongoing";
  $("youHint").textContent = over ? resultLine(S) : (S.turn === S.player_color ? "Your turn — select a square" : "Engine is thinking…");
  $("btnResign").disabled = over; $("btnDraw").disabled = over;
  const canUndo = !over && S.moves.length > 0 && ((S.level === "beginner" || S.level === "casual") || (S.takebacks_left || 0) > 0);
  $("btnUndo").disabled = !canUndo;
  $("undoNote").textContent = (S.level === "beginner" || S.level === "casual") ? "(training aid)" : `(${(S.takebacks_left || 0)} takeback token)`;
  paintLedger();
  fetchAnalysisBg();
  if (window.__extHook) { try { window.__extHook(S); } catch {} }
  if (over && resultShownFor !== S.id) { resultShownFor = S.id; showResult(); }
}
function resultLine(g) {
  const W = g.winner === g.player_color ? "You win" : g.winner === "draw" ? "Draw" : "Engine wins";
  const R = { checkmate: "checkmate", resign: "resignation", timeout: "flag fall", stalemate: "stalemate", insufficient: "insufficient material", fifty: "fifty-move rule", repetition: "threefold repetition", draw: "agreement" }[g.status] || g.status;
  return `${W} — ${R}.`;
}
function paintClocks() {
  if (!S) return;
  const pw = S.player_color === "white";
  const put = (el, ms, color, active) => {
    el.querySelector("small").textContent = color + (active ? " • ACTIVE" : "");
    el.querySelector("b").textContent = S.has_clock ? fmtClock(ms) : "∞";
    el.classList.toggle("active", !!active);
    el.classList.toggle("low", S.has_clock && ms < 30000 && S.status === "ongoing");
  };
  const wActive = S.turn === "white" && S.status === "ongoing";
  put($("clockTop"), pw ? S.clocks_ms.black : S.clocks_ms.white, pw ? "BLACK" : "WHITE", !pw ? wActive : !wActive);
  put($("clockBottom"), pw ? S.clocks_ms.white : S.clocks_ms.black, pw ? "WHITE" : "BLACK", pw ? wActive : !wActive);
  if (S.has_clock && S.status === "ongoing") {
    const mine = S.player_color === "white" ? S.clocks_ms.white : S.clocks_ms.black;
    if (mine < 30000 && !lowWarned) { lowWarned = true; SFX.lowtime(); }
  }
}
setInterval(() => { // client-side clock tick between server syncs
  if (!S || !S.has_clock || S.status !== "ongoing" || document.hidden) return;
  S.clocks_ms[S.turn] = Math.max(0, S.clocks_ms[S.turn] - 500);
  paintClocks();
}, 500);
function paintLedger() {
  const L = $("moveLedger"); L.innerHTML = "";
  for (let i = 0; i < S.sans.length; i += 2) {
    const row = document.createElement("div");
    row.className = "mrow" + (i + 2 >= S.sans.length ? " cur" : "");
    const e = (p) => analysisEvals[p] == null ? "" : Math.round((analysisEvals[p] + 1) / 2 * 100) + "%";
    row.innerHTML = `<span class="n">${i / 2 + 1}.</span><span>${S.sans[i] || ""} <span class="ev">${e(i + 1)}</span></span><span>${S.sans[i + 1] || ""} <span class="ev">${e(i + 2)}</span></span>`;
    L.appendChild(row);
  }
  L.scrollTop = L.scrollHeight;
}
let analysisTimer = 0;
function fetchAnalysisBg() {
  clearTimeout(analysisTimer);
  analysisTimer = setTimeout(async () => {
    if (!S) return;
    try {
      const a = await api.get(`/api/games/${S.id}/analysis`);
      if (S && a.plies === S.moves.length) { analysisEvals = a.evals; paintLedger(); }
    } catch {}
  }, 800);
}
function onSquare(sq) {
  if (busy || !S || S.status !== "ongoing" || S.turn !== S.player_color) return;
  if (pendingConfirm && pendingConfirm.to === sq && pendingConfirm.from === sel) {
    const u = pendingConfirm.uci; pendingConfirm = null; $("confirmBar").classList.add("hidden"); submitMove(u); return;
  }
  pendingConfirm = null; $("confirmBar").classList.add("hidden");
  const outs = legal.filter((u) => u.startsWith(sel || "") && u.slice(2, 4) === sq);
  if (sel && outs.length) {
    const promos = outs.filter((u) => u.length === 5);
    if (promos.length) { openPromo(outs); return; }
    const u = outs.find((x) => x.length === 4) || outs[0];
    if (SET.confirmMoves) { pendingConfirm = { from: sel, to: sq, uci: u }; $("confirmText").textContent = `Play ${u}? Tap ${sq} again to confirm.`; $("confirmBar").classList.remove("hidden"); paintPlay(); return; }
    sel = null; submitMove(u); return;
  }
  const { pieces } = parseFen(S.fen);
  const mine = pieces[sq] && (isW(pieces[sq]) === (S.player_color === "white"));
  sel = mine ? (sel === sq ? null : sq) : null;
  legal = S.legal_moves || [];
  paintPlay();
}
$("confirmCancel").onclick = () => { pendingConfirm = null; $("confirmBar").classList.add("hidden"); };
async function submitMove(uci) {
  if (busy) return;
  busy = true; showThinking(true);
  const before = S.sans.length;
  try {
    S = await api.post(`/api/games/${S.id}/move`, { uci });
    const moved = S.sans.length > before;
    const lastSan = S.sans[S.sans.length - (S.moves.length % 2 ? 1 : 2)] || "";
    if (moved) { if (lastSan.includes("x")) SFX.capture(); else SFX.move(); if (S.check) setTimeout(SFX.check, 120); }
    openGameKeep(S); paintPlay();
  } catch (e) { toast("Rejected: " + e.message); }
  busy = false; showThinking(false);
}
function openGameKeep(g) { S = g; sel = null; pendingConfirm = null; legal = []; $("confirmBar").classList.add("hidden"); try { localStorage.setItem("cfl_last_game", g.id); } catch {} }
$("btnResign").onclick = async () => { if (!S || !confirm("Resign this game?")) return; S = await api.post(`/api/games/${S.id}/resign`); SFX.end(false); paintPlay(); };
$("btnDraw").onclick = async () => {
  if (!S) return;
  const r = await api.post(`/api/games/${S.id}/draw-offer`);
  S = r; paintPlay();
  if (!r.draw_accepted) toast("Draw declined — position is not objectively drawn.");
  else SFX.end(true);
};
$("btnUndo").onclick = async () => {
  if (!S || busy) return;
  try { S = await api.post(`/api/games/${S.id}/undo`); sel = null; paintPlay(); toast("Took back the last round."); }
  catch (e) { toast("Undo: " + e.message); }
};
$("btnCopyPgn").onclick = async () => { if (!S) return; const t = await api.get(`/api/games/${S.id}/pgn`); try { await navigator.clipboard.writeText(t); toast("PGN copied"); } catch { download(`game_${S.id}.pgn`, t); } };
async function submitText() {
  const inp = $("kbdInput"); const t = inp.value.trim(); if (!t || !S || busy) return;
  busy = true; showThinking(true);
  try { S = await api.post(`/api/games/${S.id}/move-text`, { text: t }); inp.value = ""; SFX.move(); paintPlay(); }
  catch (e) { toast("Can't play that: " + e.message); }
  busy = false; showThinking(false);
}
$("kbdPlay").onclick = submitText;
$("kbdInput").addEventListener("keydown", (e) => { if (e.key === "Enter") submitText(); });
// promotion
let promoCands = [];
function openPromo(cands) { promoCands = cands; $("promoModal").classList.remove("hidden"); }
$("promoModal").querySelectorAll("button").forEach((b) => b.onclick = () => {
  $("promoModal").classList.add("hidden");
  const u = promoCands.find((x) => x.endsWith(b.dataset.p)) || promoCands[0];
  sel = null; submitMove(u);
});
// result modal
async function showResult() {
  $("resultTitle").textContent = resultLine(S);
  try {
    const a = await api.get(`/api/games/${S.id}/analysis`);
    $("resultReason").textContent = a.result_text + " · " + a.eco.eco + " " + a.eco.name;
    $("resultAcc").textContent = a.player_accuracy + "%";
    $("resultEngAcc").textContent = a.engine_accuracy + "%";
  } catch { $("resultReason").textContent = S.status; }
  $("resultPlies").textContent = S.moves.length;
  $("resultDur").textContent = fmtDur(S.duration_s || 0);
  $("resultModal").classList.remove("hidden");
  SFX.end(S.winner === S.player_color);
}
$("resultClose").onclick = () => $("resultModal").classList.add("hidden");
$("resultModal").addEventListener("click", (e) => { if (e.target === $("resultModal")) $("resultModal").classList.add("hidden"); });
$("ecoModal").addEventListener("click", (e) => { if (e.target === $("ecoModal")) $("ecoModal").classList.add("hidden"); });
$("btnAnalyze").onclick = () => { $("resultModal").classList.add("hidden"); location.hash = "#/analysis?id=" + S.id; };
$("btnNewMatch").onclick = () => { $("resultModal").classList.add("hidden"); location.hash = "#/setup"; };
$("btnRematch").onclick = async () => {
  $("resultModal").classList.add("hidden");
  const g = await api.post("/api/games", { player_color: S.player_color, level: S.level, time_control: S.time_control, custom_ms: S.tc_init_ms || 0, custom_inc_ms: S.tc_inc_ms || 0 });
  openGame(g); paintPlay();
};

/* ================= ARCHIVE ================= */
let arcGames = [], arcSel = null, rpFens = [], rpSans = [], rpIdx = -1, rpTimer = 0, arcFilter = "all", arcEco = "";
function vHistory() { refreshEngineChip(); loadArchive(); }
async function loadArchive() {
  try { arcGames = await api.get("/api/games"); } catch (e) { toast("Archive: " + e.message); return; }
  $("arcCount").textContent = `${arcGames.length} matches`;
  buildEcoList(); paintArchive();
  if (!arcSel && arcGames.length) selectArc(arcGames[0].id);
  else if (arcSel) selectArc(arcSel, true);
}
function arcMatches(g) {
  const q = ($("arcSearch").value || "").toLowerCase();
  const tc = $("arcTc").value;
  if (arcFilter === "fight" && g.level !== "fight") return false;
  if (arcFilter === "won" && g.winner !== g.player_color) return false;
  if (arcFilter === "lost" && !(g.winner && g.winner !== "draw" && g.winner !== g.player_color)) return false;
  if (arcFilter === "drawn" && g.winner !== "draw") return false;
  if (tc && g.time_control !== tc) return false;
  if (arcEco && (!g.opening || g.opening.eco !== arcEco)) return false;
  if (q) {
    const hay = `${g.opening ? g.opening.eco + " " + g.opening.name : ""} ${g.winner || ""} ${g.level} ${g.sans.join(" ")}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}
function paintArchive() {
  const list = $("arcList"); list.innerHTML = "";
  const games = arcGames.filter(arcMatches);
  for (const g of games) {
    const d = document.createElement("div");
    d.className = "arccard" + (g.id === arcSel ? " sel" : "");
    const res = g.winner === "draw" ? "½–½" : g.winner === "white" ? "1–0" : g.winner === "black" ? "0–1" : "*";
    const resCls = !g.winner ? "" : g.winner === g.player_color ? "color:var(--amber)" : g.winner === "draw" ? "" : "color:#ffb4ab";
    d.innerHTML = `<div class="top"><span class="tag ${g.level === "fight" ? "amber" : ""}">${g.level === "fight" ? "⚡ " : ""}${g.level.toUpperCase()}</span><span class="score" style="${resCls}">${res}</span></div>
    <div class="meta">${g.player_color} (you) · ${g.time_control} · ${g.moves.length} ply · ${fmtDur(g.duration_s || 0)}${g.source === "mcp" ? " · 🤖MCP" : ""}${g.referee ? " · ⚖️referee" : ""}</div>
    <div class="ecorow"><span><span class="eco">${g.opening ? g.opening.eco : "—"}</span> ${g.opening ? g.opening.name : ""}</span><span>${g.status}</span></div>
    <div class="foot"><span>${new Date(g.created_at * 1000).toLocaleString()}</span><span><button class="linkbtn" data-a="pgn">⧉ PGN</button> <button class="linkbtn" data-a="dl">⤓</button></span></div>`;
    d.onclick = (e) => {
      const a = e.target.dataset && e.target.dataset.a;
      if (a === "pgn") { e.stopPropagation(); copyPgn(g.id); return; }
      if (a === "dl") { e.stopPropagation(); dlPgn(g.id); return; }
      selectArc(g.id);
    };
    list.appendChild(d);
  }
  if (!games.length) list.innerHTML = `<p class="dim">No matches match this filter.</p>`;
}
async function copyPgn(id) { const t = await api.get(`/api/games/${id}/pgn`); try { await navigator.clipboard.writeText(t); toast("PGN copied"); } catch { download(`game_${id}.pgn`, t); } }
async function dlPgn(id) { download(`game_${id}.pgn`, await api.get(`/api/games/${id}/pgn`)); }
async function selectArc(id, keep = false) {
  arcSel = id;
  document.querySelectorAll(".arccard").forEach(() => {});
  paintArchive();
  const g = arcGames.find((x) => x.id === id);
  $("replayTitle").textContent = g ? `${g.opening ? g.opening.eco + " " + g.opening.name : id} · ${g.moves.length} ply` : "";
  try {
    const r = await api.get(`/api/games/${id}/replay`);
    rpFens = r.fens; rpSans = r.sans;
  } catch { rpFens = [g.fen]; rpSans = g.sans; }
  rpIdx = rpFens.length - 1;
  paintReplay();
}
function paintReplay() {
  const sl = $("rpSlider"); sl.max = Math.max(0, rpFens.length - 1); sl.value = Math.max(0, rpIdx);
  const fen = rpFens[Math.max(0, rpIdx)] || rpFens[0];
  const g = arcGames.find((x) => x.id === arcSel);
  renderBoard($("replayBoard"), fen, { flip: g ? g.player_color === "black" : false, last: rpIdx > 0 && g ? g.moves[rpIdx - 1] : null });
  $("rpLabel").textContent = rpIdx < 0 ? "—" : rpIdx === 0 ? "Starting position" : `Ply ${rpIdx}/${rpFens.length - 1} · ${rpSans[rpIdx - 1] || ""}`;
  const M = $("rpMoves"); M.innerHTML = "";
  for (let i = 0; i < rpSans.length; i += 2) {
    const row = document.createElement("div");
    row.className = "mrow" + (rpIdx === i + 1 || rpIdx === i + 2 ? " cur" : "");
    row.innerHTML = `<span class="n">${i / 2 + 1}.</span><span><a href="#" data-p="${i + 1}">${rpSans[i] || ""}</a></span><span><a href="#" data-p="${i + 2}">${rpSans[i + 1] || ""}</a></span>`;
    row.onclick = (e) => { const p = e.target.dataset && e.target.dataset.p; if (p) { e.preventDefault(); rpIdx = +p; paintReplay(); } };
    M.appendChild(row);
  }
}
function rpStop() { clearInterval(rpTimer); rpTimer = 0; $("rpPlay").textContent = "▶"; }
$("rpFirst").onclick = () => { rpIdx = 0; paintReplay(); };
$("rpPrev").onclick = () => { rpIdx = Math.max(0, rpIdx - 1); paintReplay(); };
$("rpNext").onclick = () => { rpIdx = Math.min(rpFens.length - 1, rpIdx + 1); paintReplay(); };
$("rpLast").onclick = () => { rpIdx = rpFens.length - 1; paintReplay(); };
$("rpSlider").oninput = (e) => { rpStop(); rpIdx = +e.target.value; paintReplay(); };
$("rpPlay").onclick = () => {
  if (rpTimer) { rpStop(); return; }
  if (rpIdx >= rpFens.length - 1) rpIdx = 0;
  $("rpPlay").textContent = "⏸";
  rpTimer = setInterval(() => { rpIdx++; if (rpIdx >= rpFens.length) { rpStop(); rpIdx = rpFens.length - 1; } paintReplay(); }, Math.max(250, SET.animMs * 3));
};
$("rpPgn").onclick = () => arcSel && dlPgn(arcSel);
$("rpOpen").onclick = async () => { if (!arcSel) return; openGame(await api.get("/api/games/" + arcSel)); location.hash = "#/play"; };
$("arcSearch").oninput = paintArchive;
$("arcTc").onchange = paintArchive;
document.querySelectorAll("#arcPills button").forEach((b) => b.onclick = () => {
  arcFilter = b.dataset.f;
  document.querySelectorAll("#arcPills button").forEach((x) => x.classList.toggle("on", x === b));
  paintArchive();
});
$("btnExportAll").onclick = async () => {
  const t = await api.get("/api/games/export");
  if (!t.trim() || t.startsWith("%")) { toast("Archive is empty"); return; }
  download("chess-fight-archive.pgn", t);
};
// ECO modal
function buildEcoList() {
  const counts = {};
  for (const g of arcGames) { const e = g.opening || { eco: "A00", name: "Uncommon" }; const k = e.eco + " " + e.name; counts[k] = (counts[k] || 0) + 1; }
  const L = $("ecoList"); L.innerHTML = "";
  for (const [k, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    const d = document.createElement("div");
    d.className = "ecorow2" + (arcEco && k.startsWith(arcEco) ? " sel" : "");
    d.innerHTML = `<span>${k}</span><b>${n}</b>`;
    d.onclick = () => { arcEco = k.split(" ")[0]; $("ecoFilterLabel").textContent = arcEco; $("ecoModal").classList.add("hidden"); paintArchive(); };
    L.appendChild(d);
  }
  if (!L.children.length) L.innerHTML = `<p class="dim">No games yet.</p>`;
}
$("btnEcoFilter").onclick = () => { buildEcoList(); $("ecoModal").classList.remove("hidden"); };
$("ecoClose").onclick = () => $("ecoModal").classList.add("hidden");
$("ecoClear").onclick = () => { arcEco = ""; $("ecoFilterLabel").textContent = "All"; $("ecoModal").classList.add("hidden"); paintArchive(); };

/* ================= ANALYSIS ================= */
let anId = null;
function vAnalysis() {
  refreshEngineChip();
  const q = new URLSearchParams((location.hash.split("?")[1] || "")).get("id");
  api.get("/api/games").then((gs) => {
    const pk = $("analysisPick"); pk.innerHTML = "";
    const done = gs.filter((g) => g.status !== "ongoing"), live = gs.filter((g) => g.status === "ongoing");
    for (const g of [...done, ...live].slice(0, 40)) {
      const o = document.createElement("option");
      o.value = g.id;
      o.textContent = `${g.id.slice(0, 6)} · ${g.level} · ${g.winner || "live"} · ${g.moves.length} ply`;
      pk.appendChild(o);
    }
    anId = q || (S && S.id) || (done[0] && done[0].id) || (gs[0] && gs[0].id);
    if (anId) pk.value = anId;
    if (anId) loadAnalysis(anId);
    else { $("analysisTitle").textContent = "No games yet — play one first."; }
  }).catch((e) => toast("Analysis: " + e.message));
  $("analysisPick").onchange = (e) => loadAnalysis(e.target.value);
}
async function loadAnalysis(id) {
  anId = id;
  const g = await api.get("/api/games/" + id);
  const a = await api.get(`/api/games/${id}/analysis`);
  const won = g.winner === g.player_color, draw = g.winner === "draw";
  const badge = $("analysisBadge");
  badge.textContent = g.status === "ongoing" ? "LIVE" : g.winner === "white" ? "1–0" : g.winner === "black" ? "0–1" : "½–½";
  badge.className = "outcome" + (g.status === "ongoing" ? " draw" : won ? "" : draw ? " draw" : " loss");
  $("analysisTitle").textContent = a.result_text;
  $("analysisSub").textContent = `${g.level} · you played ${g.player_color} · ${a.eco.eco} ${a.eco.name}` + ((a.note || "").includes("untrained") ? " · ⚠ provisional: net untrained" : "");
  $("analysisMeta").textContent = `${id.slice(0, 8)} · verified rules arbitration`;
  $("anAccP").textContent = a.player_accuracy + "%";
  $("anAccE").textContent = a.engine_accuracy + "%";
  $("anPlies").textContent = a.plies;
  $("anDur").textContent = fmtDur(a.duration_s);
  // chart
  const c = $("evalChart"); const NS = "http://www.w3.org/2000/svg"; c.innerHTML = "";
  const ev = a.evals.length ? a.evals : [0];
  const px = (i) => ev.length < 2 ? 300 : 10 + i * (580 / (ev.length - 1));
  const py = (v) => 150 - ((v + 1) / 2) * 140;
  const mid = document.createElementNS(NS, "line");
  mid.setAttribute("x1", 0); mid.setAttribute("x2", 600); mid.setAttribute("y1", 80); mid.setAttribute("y2", 80);
  mid.setAttribute("stroke", "#F59E0B"); mid.setAttribute("opacity", ".4"); c.appendChild(mid);
  const pl = document.createElementNS(NS, "polyline");
  pl.setAttribute("points", ev.map((v, i) => `${px(i)},${py(v)}`).join(" "));
  pl.setAttribute("fill", "none"); pl.setAttribute("stroke", "#38BDF8"); pl.setAttribute("stroke-width", "2"); c.appendChild(pl);
  const dot = (i, color) => {
    if (i < 0 || i >= ev.length) return;
    const d = document.createElementNS(NS, "circle");
    d.setAttribute("cx", px(i)); d.setAttribute("cy", py(ev[i])); d.setAttribute("r", 5);
    d.setAttribute("fill", color); d.setAttribute("stroke", "#0B0F17"); d.setAttribute("stroke-width", "1.5"); c.appendChild(d);
  };
  const ins = a.insights || { blunders: [], best_move: null };
  (ins.blunders || []).forEach(b => dot(b.ply, "#EF4444"));
  if (ins.best_move) dot(ins.best_move.ply, "#10B981");
  let insightHtml = `${a.eco.eco} — ${a.eco.name}`;
  if ((ins.blunders || []).length) insightHtml += `<br>⚠ Turning points: ` + ins.blunders.map(b => `${b.ply}. ${b.san} (${Math.round(b.swing * 100)}%)`).join(" · ");
  if (ins.best_move) insightHtml += `<br>✦ Best strike: ${ins.best_move.ply}. ${ins.best_move.san} (+${Math.round(ins.best_move.swing * 100)}%)`;
  $("anOpening").innerHTML = insightHtml;
  // moves
  const M = $("anMoves"); M.innerHTML = "";
  let worst = 0, worstI = -1;
  const losses = ev.slice(1).map((v, i) => Math.max(0, (i % 2 === 0 ? ev[i] - v : v - ev[i])));
  losses.forEach((l, i) => { if (l > worst) { worst = l; worstI = i; } });
  for (let i = 0; i < a.sans.length; i += 2) {
    const row = document.createElement("div"); row.className = "mrow";
    const cell = (j) => j >= a.sans.length ? "" : `<span style="${j === worstI && worst > .25 ? "color:var(--red);font-weight:700" : ""}">${a.sans[j]} <span class="ev">${Math.round((ev[j + 1] + 1) / 2 * 100)}%</span></span>`;
    row.innerHTML = `<span class="n">${i / 2 + 1}.</span>${cell(i)}${cell(i + 1)}`;
    M.appendChild(row);
  }
  $("anCopy").onclick = async () => { const t = await api.get(`/api/games/${id}/pgn`); try { await navigator.clipboard.writeText(t); toast("PGN copied"); } catch { download(`game_${id}.pgn`, t); } };
  $("anDl").onclick = async () => download(`game_${id}.pgn`, await api.get(`/api/games/${id}/pgn`));
  $("anRematch").onclick = async () => {
    const ng = await api.post("/api/games", { player_color: g.player_color, level: g.level, time_control: g.time_control, custom_ms: g.tc_init_ms || 0, custom_inc_ms: g.tc_inc_ms || 0 });
    openGame(ng); location.hash = "#/play";
  };
}

/* ================= SETTINGS ================= */
const THEMES = [
  { id: "slate", n: "Tournament Slate", d: "FIDE slate & mist", c: ["#cbd5e1", "#1e293b"] },
  { id: "obsidian", n: "Obsidian Carbon", d: "Carbon & ash", c: ["#71717a", "#18181b"] },
  { id: "walnut", n: "Classic Walnut", d: "Walnut & maple", c: ["#e6d3af", "#593e2b"] },
  { id: "phosphor", n: "Terminal Green", d: "Phosphor & mint", c: ["#6ee7b7", "#064e3b"] },
  { id: "high-contrast", n: "High Contrast", d: "WCAG AAA binary", c: ["#ffffff", "#000000"] },
];
function vSettings() {
  refreshEngineChip();
  const tg = $("themeGrid"); tg.innerHTML = "";
  for (const t of THEMES) {
    const d = document.createElement("div");
    d.className = "themecard" + ((SET.highContrast ? "high-contrast" : SET.theme) === t.id ? " sel" : "");
    d.innerHTML = `<div class="swatches"><div style="background:${t.c[0]}"></div><div style="background:${t.c[1]}"></div><div style="background:${t.c[1]}"></div><div style="background:${t.c[0]}"></div></div><b>${t.n}</b><small>${t.d}</small>`;
    d.onclick = () => {
      if (t.id === "high-contrast") { SET.highContrast = true; }
      else { SET.theme = t.id; SET.highContrast = false; }
      applySet(); syncSettingsUI(); paintSettingsCards(); toast("Board theme: " + t.n); if (S) paintPlay();
    };
    tg.appendChild(d);
  }
  document.querySelectorAll("#pieceGrid .card").forEach((c) => {
    c.classList.toggle("sel", c.dataset.ps === SET.pieceSet);
    c.onclick = () => { SET.pieceSet = c.dataset.ps; SET.locale = "en"; applySet(); syncSettingsUI(); paintSettingsCards(); toast("Piece set: " + c.dataset.ps); if (S) paintPlay(); };
  });
  syncSettingsUI();
}
function paintSettingsCards() {
  const active = SET.highContrast ? "high-contrast" : SET.theme;
  document.querySelectorAll("#themeGrid .themecard").forEach((el, i) => el.classList.toggle("sel", THEMES[i].id === active));
  document.querySelectorAll("#pieceGrid .card").forEach((c) => c.classList.toggle("sel", c.dataset.ps === SET.pieceSet));
}
function syncSettingsUI() {
  document.querySelectorAll("#animSeg button").forEach((b) => {
    b.classList.toggle("on", +b.dataset.v === SET.animMs);
    b.onclick = () => { SET.animMs = +b.dataset.v; applySet(); syncSettingsUI(); };
  });
  $("animLabel").textContent = SET.animMs + "ms";
  const mk = (host, rows) => {
    const H = $(host); H.innerHTML = "";
    for (const [label, sub, get, set] of rows) {
      const d = document.createElement("div"); d.className = "togglerow";
      d.innerHTML = `<span><b>${label}</b><small>${sub}</small></span>`;
      const b = document.createElement("button"); b.className = "switch" + (get() ? " on" : ""); b.setAttribute("role", "switch");
      b.innerHTML = "<span></span>";
      b.onclick = () => { set(!get()); applySet(); syncSettingsUI(); if (S && (host === "mechToggles")) paintPlay(); };
      d.appendChild(b); H.appendChild(d);
    }
  };
  mk("mechToggles", [
    ["Strict move confirmation", "Tap destination twice to commit.", () => SET.confirmMoves, (v) => SET.confirmMoves = v],
    ["Legal departure dots", "Show legal destinations on select.", () => SET.showLegal, (v) => SET.showLegal = v],
    ["Last-move highlight", "Cyan trace of the previous ply.", () => SET.showLastMove, (v) => SET.showLastMove = v],
    ["Keyboard console bar", "UCI/SAN input under the ledger.", () => SET.showKeyboard, (v) => SET.showKeyboard = v],
  ]);
  mk("a11yToggles", [
    ["Force high contrast", "WCAG AAA black/white.", () => SET.highContrast, (v) => SET.highContrast = v],
    ["Reduced motion", "Suppress pulses and transitions.", () => SET.reducedMotion, (v) => SET.reducedMotion = v],
    ["Coordinates outside board", "Rim labels instead of corners.", () => SET.coordsOutside, (v) => SET.coordsOutside = v],
  ]);
  bindSwitch($("setSoundMaster"), () => SET.soundOn, (v) => { SET.soundOn = v; applySet(); });
  $("volRange").value = SET.volume; $("volLabel").textContent = SET.volume + "%";
  const SR = $("soundRows"); SR.innerHTML = "";
  const names = { move: ["Piece move", "tactile strike · 48ms"], capture: ["Piece capture", "damped impact · 62ms"], check: ["Check alert", "sine ping · 110ms"], lowtime: ["Low-time buzzer", "warning under 30s"], end: ["Termination chime", "victory / defeat"] };
  for (const [k, [n, d]] of Object.entries(names)) {
    const row = document.createElement("div"); row.className = "soundrow";
    row.innerHTML = `<span><button class="iconbtn" data-s="${k}">▶</button> <b>${n}</b><br><small>${d}</small></span>`;
    const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = SET.sounds[k];
    cb.onchange = () => { SET.sounds[k] = cb.checked; applySet(); };
    row.appendChild(cb); SR.appendChild(row);
  }
  SR.querySelectorAll("[data-s]").forEach((b) => b.onclick = () => SFX[b.dataset.s === "end" ? "end" : b.dataset.s](true));
  $("localeSel").value = SET.locale;
}
$("volRange").oninput = (e) => { SET.volume = +e.target.value; $("volLabel").textContent = SET.volume + "%"; applySet(); };
$("btnAudition").onclick = () => { SFX.move(); setTimeout(SFX.capture, 150); setTimeout(SFX.check, 350); setTimeout(() => SFX.end(true), 550); };
$("localeSel").onchange = (e) => {
  SET.locale = e.target.value;
  if (SET.locale === "sym") { SET.pieceSet = "minimal"; toast("Universal symbols: letter pieces enabled"); }
  applySet(); syncSettingsUI(); if (S) paintPlay();
};
$("btnRefreshEngine").onclick = async () => { await refreshEngineChip(); toast("Engine status refreshed"); };
$("btnExportSettings").onclick = () => download("chess-fight-settings.json", JSON.stringify({ ...SET, version: 3 }, null, 2), "application/json");
$("importSettings").onchange = (e) => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => { try { const _imp = JSON.parse(r.result); SET = { ...DEFSET, ..._imp, sounds: { ...DEFSET.sounds, ...(_imp.sounds || {}) } }; applySet(); syncSettingsUI(); paintSettingsCards(); toast("Settings imported"); } catch { toast("Invalid settings file"); } };
  r.readAsText(f);
};
$("btnResetSettings").onclick = () => { SET = { ...DEFSET, sounds: { ...DEFSET.sounds } }; applySet(); syncSettingsUI(); paintSettingsCards(); toast("Defaults restored"); };
$("btnApplySettings").onclick = () => { applySet(); location.hash = "#/play"; toast("Settings applied"); };

/* ---------- boot ---------- */
applySet();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
try { Object.assign(setup, JSON.parse(localStorage.getItem("cfl_setup") || "{}")); } catch {}
(function bootQuery() {
  const q = new URLSearchParams(location.search);
  if (q.get("notice") === "webgl") setTimeout(() => toast("WebGL unavailable — flat 2D board. Full rules, same engine."), 600);
  const id = q.get("id");
  if (id) api.get("/api/games/" + id).then((g) => { S = g; if ((location.hash || "#/setup") === "#/setup") location.hash = "#/play"; else route(); }).catch(() => route());
  else route();
})();
refreshEngineChip();
