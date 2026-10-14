/* Study room, stats, fight-night series, drills, daily, share cards, PWA.
   Reads globals from app.js (api, toast, S, openGame). Registers CFViews. */
"use strict";
window.CFViews = window.CFViews || {};
const $s = (id) => document.getElementById(id);
function fenPieces(fen) {
  const m = {}; const rows = fen.split(" ")[0].split("/");
  for (let r = 0; r < 8; r++) { let f = 0; for (const ch of rows[7 - r]) { if (/\d/.test(ch)) f += +ch; else { m["abcdefgh"[f] + (r + 1)] = ch; f++; } } }
  return m;
}
function miniBoard(fen, px = 200) {
  const sq = px / 8, pieces = fenPieces(fen);
  let s = '<svg viewBox="0 0 800 800" width="' + px + '" height="' + px + '" style="border-radius:6px">';
  for (let f = 0; f < 8; f++) for (let r = 0; r < 8; r++) {
    const bg = (f + r) % 2 ? '#739552' : '#ebecd9';
    s += '<rect x="' + (f * 100) + '" y="' + ((7 - r) * 100) + '" width="100" height="100" fill="' + bg + '"/>';
    const p = pieces['abcdefgh'[f] + (r + 1)];
    if (p) {
      const up = p === p.toUpperCase();
      const glyph = '♚♛♜♝♞♟'['KQRBNP'.indexOf(p.toUpperCase())];
      const fill = up ? '#fff' : '#111', stroke = up ? '#000' : '#fff';
      s += '<text x="' + (f * 100 + 50) + '" y="' + ((7 - r) * 100 + 74) + '" font-size="68" text-anchor="middle" fill="' + fill + '" stroke="' + stroke + '" stroke-width="2">' + glyph + '</text>';
    }
  }
  return s + '</svg>';
}
/* ---------- SRS (localStorage, per-item boxes) ---------- */
const BOX_DAYS = [1, 3, 7, 14, 30, 60];
function srsLoad() { try { return JSON.parse(localStorage.getItem("cfl_srs") || "{}"); } catch { return {}; } }
function srsSave(s) { try { localStorage.setItem("cfl_srs", JSON.stringify(s)); } catch {} }
function srsDueCount() {
  const s = srsLoad(), now = Date.now();
  return Object.values(s).filter(x => (x.due || 0) <= now).length;
}
function srsMark(key, ok) {
  const s = srsLoad(), it = s[key] || { box: 0, due: 0 };
  it.box = ok ? Math.min(BOX_DAYS.length - 1, it.box + 1) : 0;
  it.due = Date.now() + BOX_DAYS[it.box] * 864e5;
  it.seen = (it.seen || 0) + 1; if (ok) it.ok = (it.ok || 0) + 1;
  s[key] = it; srsSave(s); paintDue();
}
function paintDue() { const el = $s("studyDue"); if (el) el.textContent = srsDueCount(); }

/* ---------- STUDY TABS ---------- */
let studyTab = "puzzles";
document.querySelectorAll("#studyTabs button").forEach(b => b.onclick = () => {
  studyTab = b.dataset.t;
  document.querySelectorAll("#studyTabs button").forEach(x => x.classList.toggle("on", x === b));
  paintStudy();
});
async function vStudy() { paintDue(); paintStudy(); }
window.CFViews.study = vStudy;
async function paintStudy() {
  const B = $s("studyBody"); B.innerHTML = "<p class='dim'>Loading…</p>";
  try {
    if (studyTab === "puzzles") await tabPuzzles(B);
    else if (studyTab === "rep") await tabRep(B);
    else if (studyTab === "drills") tabDrills(B);
    else await tabDaily(B);
  } catch (e) { B.innerHTML = `<p class="dim">Study error: ${e.message}</p>`; }
}
async function finishedGames(limit = 20) {
  const gs = await api.get("/api/games");
  return gs.filter(g => g.status !== "ongoing").slice(0, limit);
}
async function tabPuzzles(B) {
  const gs = await finishedGames();
  if (!gs.length) { B.innerHTML = "<p class='dim'>Finish a game first — your blunders become puzzles here.</p>"; return; }
  const opts = gs.map((g, i) => `<option value="${g.id}">${g.id.slice(0, 6)} · ${g.level} · ${g.winner || "?"} · ${g.moves.length} ply</option>`).join("");
  B.innerHTML = `<label class="field">Game<select id="pzGame">${opts}</select></label><div id="pzList"></div>`;
  const load = async () => {
    const gid = $s("pzGame").value;
    const list = await api.get(`/api/games/${gid}/puzzles`);
    const L = $s("pzList");
    if (!list.length) { L.innerHTML = "<p class='dim'>No big drops found — clean game!</p>"; return; }
    L.innerHTML = "";
    for (const p of list) {
      const key = `pz:${gid}:${p.ply}`;
      const d = document.createElement("div"); d.className = "panel";
      d.innerHTML = `<div style="display:flex;gap:12px;flex-wrap:wrap"><div>${miniBoard(p.fen_before, 180)}</div>
        <div style="flex:1;min-width:200px"><b>Move ${p.ply}: you played ${p.played}</b>
        <p class="dim">Eval dropped ${Math.round(-p.swing * 100)}%. Find better.</p>
        <div class="kbdrow"><input placeholder="e.g. Nf3" data-in><button class="btn primary sm" data-go>Solve</button>
        <button class="btn sm ghost" data-reveal>Reveal</button></div>
        <p class="telemetry" data-fb></p></div></div>`;
      const inp = d.querySelector("[data-in]");
      const fb = d.querySelector("[data-fb]");
      d.querySelector("[data-go]").onclick = async () => {
        const r = await api.post("/api/puzzles/solve", { fen: p.fen_before, san: inp.value });
        if (r.correct) { fb.textContent = "✓ Correct!"; srsMark(key, true); }
        else { fb.textContent = r.legal ? "✗ Not the best — try again." : "✗ Illegal there — try again."; srsMark(key, false); }
      };
      d.querySelector("[data-reveal]").onclick = async () => {
        const r = await api.post("/api/puzzles/solve", { fen: p.fen_before, uci: "a2a3" });
        fb.textContent = "Solution: " + r.solution; srsMark(key, false);
      };
      L.appendChild(d);
    }
  };
  $s("pzGame").onchange = load;
  await load();
}
/* repertoire with SRS + side choice */
let repState = null;
async function tabRep(B) {
  const lines = await api.get("/api/repertoire");
  const opts = lines.map(l => `<option value="${l.id}">${l.eco} — ${l.name} (${l.moves.length} plies)</option>`).join("");
  B.innerHTML = `<div style="display:flex;gap:8px;flex-wrap:wrap">
    <label class="field">Line<select id="repLine">${opts}</select></label>
    <label class="field">Play<select id="repSide"><option value="white">White</option><option value="black">Black</option></select></label>
    <button id="repStart" class="btn primary">Drill</button></div><div id="repArea"></div>`;
  $s("repStart").onclick = () => {
    const line = lines.find(l => l.id === $s("repLine").value);
    repState = { line, side: $s("repSide").value, ply: 0, mistakes: 0 };
    paintRepStep();
  };
}
function paintRepStep() {
  const A = $s("repArea"), st = repState;
  const turnWhite = st.ply % 2 === 0;
  const myTurn = (turnWhite && st.side === "white") || (!turnWhite && st.side === "black");
  const done = st.ply >= st.line.moves.length;
  const key = `rep:${st.line.id}:${st.side}`;
  if (done) {
    const clean = st.mistakes === 0;
    srsMark(key, clean);
    A.innerHTML = `<div class="panel"><b>${clean ? "✓ Flawless!" : `Done with ${st.mistakes} miss${st.mistakes > 1 ? "es" : ""}.`}</b>
      <p class="dim">${st.line.eco} ${st.line.name} · ${st.line.moves.join(" ")}</p></div>`;
    paintDue(); return;
  }
  const played = st.line.moves.slice(0, st.ply).join(" ") || "start";
  if (!myTurn) {
    A.innerHTML = `<div class="panel"><p class="dim">${played}</p><p>…opponent plays <b>${st.line.moves[st.ply]}</b></p><button id="repNext" class="btn sm">Continue</button></div>`;
    $s("repNext").onclick = () => { st.ply++; paintRepStep(); };
    return;
  }
  A.innerHTML = `<div class="panel"><p class="dim">${played}</p><p>Your move (${st.side}), ${st.ply + 1}/${st.line.moves.length}</p>
    <div class="kbdrow"><input id="repIn" placeholder="UCI or SAN…"><button id="repGo" class="btn primary sm">Play</button></div>
    <p class="telemetry" id="repFb"></p></div>`;
  const go = async () => {
    const r = await api.post("/api/repertoire/try", { line_id: st.line.id, ply: st.ply, uci: $s("repIn").value.trim() }).catch(() => ({ correct: false }));
    if (r.correct) { st.ply++; paintRepStep(); }
    else { st.mistakes++; srsMark(key, false); $s("repFb").textContent = `✗ Expected ${r.expected || "?"} — try again.`; }
  };
  $s("repGo").onclick = go;
  $s("repIn").addEventListener("keydown", e => { if (e.key === "Enter") go(); });
}
/* drills */
function tabDrills(B) {
  B.innerHTML = `<div class="cards3">
    <div class="card"><b>♕ Queen vs King</b><p>Mate a lone king. vs Beginner clock.</p><button class="btn primary sm" data-d="kqk">Start</button></div>
    <div class="card"><b>♖ Rook vs King</b><p>The classic windmill. vs Beginner.</p><button class="btn sm" data-d="krk">Start</button></div>
    <div class="card"><b>♙ Pawn run</b><p>Queen the e-pawn vs Beginner.</p><button class="btn sm" data-d="kpk">Start</button></div>
  </div><p class="dim">Drills open in the Arena with a goal banner; completion pops automatically.</p>`;
  B.querySelectorAll("[data-d]").forEach(b => b.onclick = async () => {
    const ds = await api.get("/api/drills");
    const d = ds[b.dataset.d];
    const g = await api.post("/api/games", { player_color: "white", level: "beginner", fen: d.fen, drill: b.dataset.d });
    openGame(g); location.hash = "#/play";
  });
}
/* daily */
async function tabDaily(B) {
  const d = await api.get("/api/daily");
  const st = JSON.parse(localStorage.getItem("cfl_daily") || "{}");
  const today = new Date().toISOString().slice(0, 10);
  B.innerHTML = `<div class="panel"><div style="display:flex;gap:14px;flex-wrap:wrap">
    <div>${miniBoard(d.fen, 220)}</div>
    <div style="flex:1;min-width:220px"><b>${d.name}</b> <span class="tag">${d.goal}</span>
    <p class="dim">Streak: <b>${st.streak || 0}</b> ${st.last === today ? "(done today ✓)" : ""}</p>
    <div class="kbdrow"><input id="dailyIn" placeholder="Your move…"><button id="dailyGo" class="btn primary sm">Solve</button></div>
    <p class="telemetry" id="dailyFb"></p></div></div></div>`;
  $s("dailyGo").onclick = async () => {
    let r;
    try { r = await api.post("/api/daily/try", { date: d.date, san: $s("dailyIn").value }); }
    catch (e) { $s("dailyFb").textContent = "✗ " + e.message; return; }
    if (r.correct) {
      $s("dailyFb").textContent = "✓ Correct!";
      const s2 = JSON.parse(localStorage.getItem("cfl_daily") || "{}");
      const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      s2.streak = (s2.last === y) ? (s2.streak || 0) + 1 : 1;
      s2.last = today;
      localStorage.setItem("cfl_daily", JSON.stringify(s2));
    } else $s("dailyFb").textContent = r.legal ? "✗ Not mate — try again." : "✗ Illegal there.";
  };
}
/* ---------- STATS ---------- */
async function vStats() {
  const pid = localStorage.getItem("cf_profile") || "";
  const st = await api.get("/api/stats" + (pid ? `?profile_id=${pid}` : "")).catch(e => ({ error: e.message }));
  if (st.error) { $s("accChart").innerHTML = ""; return; }
  const c = $s("accChart"), NS = "http://www.w3.org/2000/svg"; c.innerHTML = "";
  const pts = st.games.slice().reverse().map(g => g.player_accuracy ?? 100);
  const px = i => pts.length < 2 ? 300 : 10 + i * (580 / (pts.length - 1));
  const py = v => 150 - (Math.max(0, Math.min(100, v)) / 100) * 140;
  const pl = document.createElementNS(NS, "polyline");
  pl.setAttribute("points", pts.map((v, i) => `${px(i)},${py(v)}`).join(" "));
  pl.setAttribute("fill", "none"); pl.setAttribute("stroke", "#F59E0B"); pl.setAttribute("stroke-width", "2.5");
  c.appendChild(pl);
  pts.forEach((v, i) => {
    const d = document.createElementNS(NS, "circle");
    d.setAttribute("cx", px(i)); d.setAttribute("cy", py(v)); d.setAttribute("r", 4); d.setAttribute("fill", "#F59E0B");
    c.appendChild(d);
  });
  const E = $s("ecoTable"); E.innerHTML = st.openings.length ? "" : "<p class='dim'>No games yet.</p>";
  for (const o of st.openings) {
    const d = document.createElement("div"); d.className = "mrow";
    d.innerHTML = `<span><b>${o.eco}</b></span><span>${o.w}W ${o.d}D ${o.l}L</span><span class="ev">${o.n} games</span>`;
    E.appendChild(d);
  }
  const P = $s("phaseBars"); P.innerHTML = "";
  const max = Math.max(0.001, ...Object.values(st.phases).map(p => p.avg_loss));
  for (const [k, p] of Object.entries(st.phases)) {
    const d = document.createElement("div"); d.style.margin = "6px 0";
    d.innerHTML = `<div style="display:flex;justify-content:space-between;font-size:12px"><span>${k}</span><span class="telemetry">${p.avg_loss} avg loss · ${p.moves} moves</span></div>
      <div style="background:#0A0E16;border-radius:4px;height:10px"><div style="width:${Math.round(p.avg_loss / max * 100)}%;height:100%;border-radius:4px;background:var(--amber)"></div></div>`;
    P.appendChild(d);
  }
}
window.CFViews.stats = vStats;
$s("btnStatsRefresh").onclick = () => vStats();
/* ---------- FIGHT NIGHT SERIES ---------- */
function seriesLoad() { try { return JSON.parse(localStorage.getItem("cfl_series") || "null"); } catch { return null; } }
function seriesSave(s) { try { localStorage.setItem("cfl_series", JSON.stringify(s)); } catch {} paintSeriesState(); }
function paintSeriesState() {
  const s = seriesLoad(), el = $s("seriesState");
  if (el) el.textContent = s && s.active ? `${s.you}–${s.eng} first to ${s.target} · ${s.level}` : "no series";
  const chip = $s("seriesChip");
  if (chip) {
    if (s && s.active) { chip.textContent = `🌃 Series ${s.you}–${s.eng} · first to ${s.target} (${s.level})`; chip.classList.remove("hidden"); }
    else chip.classList.add("hidden");
  }
}
$s("btnSeriesStart").onclick = () => {
  seriesSave({ active: true, level: document.querySelector("#levelCards .card.sel") ? setup.level : setup.level, target: +$s("seriesTarget").value, you: 0, eng: 0, draws: 0, ids: [] });
  toast("Series started — play from the Arena.");
};
$s("btnSeriesStop").onclick = () => { localStorage.removeItem("cfl_series"); paintSeriesState(); };
function seriesRecord(g) {
  const s = seriesLoad();
  if (!s || !s.active || s.ids.includes(g.id) || g.level !== s.level) return;
  s.ids.push(g.id);
  if (g.winner === g.player_color) s.you++;
  else if (g.winner === "draw" || !g.winner) s.draws++;
  else s.eng++;
  if (s.you >= s.target || s.eng >= s.target) {
    s.active = false;
    seriesSave(s);
    $s("seriesTitle").textContent = s.you > s.eng ? `🏆 You take the series ${s.you}–${s.eng}` : `Engine takes it ${s.eng}–${s.you}`;
    $s("seriesText").textContent = `${s.draws} draws · level ${s.level} · games: ${s.ids.map(id => id.slice(0, 6)).join(", ")}`;
    $s("seriesModal").classList.remove("hidden");
  } else seriesSave(s);
}
$s("seriesClose").onclick = () => $s("seriesModal").classList.add("hidden");
$s("seriesHome").onclick = () => { $s("seriesModal").classList.add("hidden"); location.hash = "#/setup"; };
$s("seriesRematch").onclick = async () => {
  $s("seriesModal").classList.add("hidden");
  const g = await api.post("/api/games", { player_color: setup.side, level: (seriesLoad() || {}).level || setup.level, ...tcToBackend(setup.tc) });
  openGame(g); location.hash = "#/play";
};
/* ---------- DRILL + SERIES hooks (called from paintPlay) ---------- */
let drillShownFor = "";
window.__extHook = async function (g) {
  paintSeriesState();
  const db = $s("drillBar");
  if (g.drill) {
    const ds = await api.get("/api/drills").catch(() => ({}));
    const goal = (ds[g.drill] || {}).goal_text || g.drill;
    $s("drillText").textContent = `♞ Drill [${g.drill.toUpperCase}]: ${goal}`;
    db.classList.remove("hidden");
    if (g.id !== drillShownFor) {
      const st = await api.get(`/api/games/${g.id}/drill`).catch(() => ({}));
      if (st.done) {
        drillShownFor = g.id;
        $s("drillTitle").textContent = "Drill complete — " + (st.how || "done");
        $s("drillText").textContent = `Goal reached (${st.how}). ${g.moves.length} plies.`;
        $s("drillModal").classList.remove("hidden");
      }
    }
  } else db.classList.add("hidden");
  if (g.status !== "ongoing") seriesRecord(g);
};
$s("drillClose").onclick = () => $s("drillModal").classList.add("hidden");
$s("drillAgain").onclick = async () => {
  $s("drillModal").classList.add("hidden");
  const ds = await api.get("/api/drills");
  const d = ds[S.drill];
  openGame(await api.post("/api/games", { player_color: "white", level: "beginner", fen: d.fen, drill: S.drill }));
  paintPlay();
};
$s("drillStudy").onclick = () => { $s("drillModal").classList.add("hidden"); location.hash = "#/study"; };
/* ---------- SHARE CARD ---------- */
async function shareCard(gid) {
  const g = await api.get("/api/games/" + gid);
  const a = await api.get(`/api/games/${gid}/analysis`).catch(() => null);
  const W = 520, BH = 520, H = BH + 190;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const x = cv.getContext("2d");
  x.fillStyle = "#0B0F17"; x.fillRect(0, 0, W, H);
  const res = !g.winner ? "In progress" : g.winner === "draw" ? "Draw" : (g.winner === g.player_color ? "You win" : "Engine wins");
  x.fillStyle = "#DFE2EE"; x.font = "700 30px system-ui"; x.fillText("Chess Fight LLM", 20, 42);
  x.fillStyle = "#F59E0B"; x.font = "700 24px system-ui"; x.fillText(res + " · " + (g.level || ""), 20, 74);
  const sq = BH / 8, pcs = fenPieces(g.fen), GL = { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟" };
  for (let f = 0; f < 8; f++) for (let r = 0; r < 8; r++) {
    x.fillStyle = (f + r) % 2 ? "#739552" : "#ebecd9";
    const flip = g.player_color === "black";
    const df = flip ? 7 - f : f, dr = flip ? r : 7 - r;
    x.fillRect(20 + df * sq, 90 + dr * sq, sq, sq);
    const p = pcs["abcdefgh"[f] + (r + 1)];
    if (p) {
      x.fillStyle = p === p.toUpperCase() ? "#fff" : "#111";
      x.font = `${Math.round(sq * 0.72)}px serif`; x.textAlign = "center";
      x.fillText(GL[p.toUpperCase()], 20 + df * sq + sq / 2, 90 + dr * sq + sq * 0.78);
      x.textAlign = "left";
    }
  }
  x.fillStyle = "#98A2B3"; x.font = "15px system-ui";
  const eco = g.opening ? `${g.opening.eco} ${g.opening.name}` : "";
  x.fillText(`${eco} · ${g.moves.length} plies`, 20, H - 66);
  if (a) x.fillText(`You ${a.player_accuracy}% · Engine ${a.engine_accuracy}% · model-judged`, 20, H - 42);
  x.fillStyle = "#5b6472"; x.fillText("Made by Ahmad Syed", 20, H - 18);
  return new Promise(res2 => cv.toBlob(async (blob) => {
    const file = new File([blob], `chessfight_${gid.slice(0, 6)}.png`, { type: "image/png" });
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": file })]);
      toast("Card copied to clipboard");
    } catch { /* clipboard blocked: download instead */ }
    const aEl = document.createElement("a");
    aEl.href = URL.createObjectURL(blob); aEl.download = file.name; aEl.click();
    setTimeout(() => URL.revokeObjectURL(aEl.href), 3000);
    res2(true);
  }));
}
$s("btnShare").onclick = () => { if (S) shareCard(S.id); };
/* analysis-screen share button (appended once) */
(function () {
  const host = document.querySelector("#view-analysis .panelhead .actions");
  if (host && !$s("btnShareAn")) {
    const b = document.createElement("button");
    b.id = "btnShareAn"; b.className = "btn sm ghost"; b.textContent = "🖼 Card";
    b.onclick = () => { if (anId) shareCard(anId); };
    host.appendChild(b);
  }
})();
/* ---------- PWA install ---------- */
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault(); deferredPrompt = e;
  $s("btnInstall").classList.remove("hidden");
});
$s("btnInstall").onclick = async () => {
  if (deferredPrompt) { deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; }
  $s("btnInstall").classList.add("hidden");
};
/* ---------- MCP MODE (visible entrance to /mcp) ---------- */
async function vMcp() {
  paintDue();
  let ok = false;
  try {
    const r = await fetch("/mcp/", { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "ui", version: "1" } } }) });
    ok = r.ok;
  } catch { ok = false; }
  const el = $s("mcpStatus");
  el.textContent = ok ? "● LIVE" : "● OFFLINE";
  el.style.color = ok ? "#10B981" : "#EF4444";
  const all = await api.get("/api/games").catch(() => []);
  const bots = all.filter(g => g.source === "mcp");
  const H = $s("mcpGames");
  H.innerHTML = bots.length ? "" : "<p class='dim'>No bot games yet — connect an agent above, or run the demo.</p>";
  for (const g of bots.slice(0, 15)) {
    const d = document.createElement("div"); d.className = "mrow";
    d.innerHTML = `<span><b>${g.id.slice(0, 6)}</b> ${g.level}${g.referee ? " ⚖️" : ""}</span><span>${g.status}${g.winner ? " (" + g.winner + ")" : ""}</span><span class="ev">${g.moves.length} ply</span>`;
    d.style.cursor = "pointer";
    d.onclick = async () => { openGame(await api.get("/api/games/" + g.id)); location.hash = "#/play"; };
    H.appendChild(d);
  }
}
window.CFViews.mcp = vMcp;
$s("btnMcpCopy").onclick = async () => {
  try { await navigator.clipboard.writeText("http://127.0.0.1:8000/mcp/"); toast("MCP URL copied"); }
  catch { toast("http://127.0.0.1:8000/mcp/"); }
};
let demoStop = false;
$s("btnDemoStop").onclick = () => { demoStop = true; };
$s("btnDemo").onclick = async () => {
  demoStop = false;
  const level = $s("demoLevel").value;
  const log = $s("demoLog"), res = $s("demoResult");
  log.innerHTML = ""; res.textContent = "";
  try {
    const g0 = await api.post("/api/games", { player_color: "white", level, engine_opponent: false });
    let gid = g0.id, n = 0;
    while (!demoStop && n < 60) {
      const st = await api.get("/api/games/" + gid);
      $s("demoBoard").innerHTML = miniBoard(st.fen, 220);
      if (st.status !== "ongoing") { res.textContent = `Done: ${st.winner || st.status} · ${st.moves.length} plies`; break; }
      const mv = await api.post("/api/move", { fen: st.fen, level, sans: st.sans });
      const st2 = await api.post(`/api/games/${gid}/move`, { uci: mv.move });
      const li = document.createElement("div"); li.className = "mrow";
      li.innerHTML = `<span class="n">${st2.moves.length}.</span><span>${st2.sans[st2.sans.length - 1] || ""}</span><span class="ev">${st2.turn}</span>`;
      log.appendChild(li); log.scrollTop = log.scrollHeight;
      n++;
      await new Promise(r => setTimeout(r, 500));
    }
    if (demoStop) res.textContent = "Stopped.";
    const done = await api.get("/api/games/" + gid).catch(() => null);
    if (done) $s("demoBoard").innerHTML = miniBoard(done.fen, 220);
  } catch (e) { res.textContent = "Demo error: " + e.message; }
  vMcp();
};
paintSeriesState();
paintDue();
if (/#\/(study|stats|mcp)/.test(location.hash)) route();
