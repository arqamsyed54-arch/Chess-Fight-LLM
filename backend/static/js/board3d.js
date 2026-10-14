/* 3D board scene: procedural Staunton pieces (lathe), board, lights, camera,
   picking, animations. Renders game state; never decides legality. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { sqToPos, parsePlacement } from './coord.js';

export const THEMES = {
  slate:  { light: 0x94a3b8, dark: 0x334155, frame: 0x0f172a, white: 0xf1f5f9, black: 0x1e293b, table: 0x080c14 },
  wood:   { light: 0xd4b483, dark: 0x6f4e37, frame: 0x2b1d0c, white: 0xfaf3dd, black: 0x2e1c0c, table: 0x120b04 },
  cyber:  { light: 0x38bdf8, dark: 0x0f2942, frame: 0x050d1a, white: 0xe0f2fe, black: 0x0c4a6e, table: 0x02070f },
  highcontrast: { light: 0xffffff, dark: 0x000000, frame: 0x000000, white: 0xffffff, black: 0x000000, table: 0x000000 },
};
/* Lathe profiles [radius, y]; Staunton-ish silhouettes. */
const PROFILES = {
  p: [[0,0],[.38,0],[.36,.08],[.28,.16],[.16,.5],[.20,.55],[.12,.6],[.22,.7],[.23,.82],[.17,.94],[0,1.0]],
  r: [[0,0],[.42,0],[.40,.1],[.30,.2],[.24,.5],[.27,.8],[.35,.9],[.35,1.15],[0,1.15]],
  n: [[0,0],[.42,0],[.40,.12],[.30,.22],[.24,.42]],
  b: [[0,0],[.40,0],[.38,.1],[.28,.2],[.19,.6],[.24,.8],[.14,.9],[.27,1.08],[.2,1.3],[.07,1.4],[0,1.46]],
  q: [[0,0],[.46,0],[.44,.12],[.32,.24],[.23,.72],[.28,1.02],[.17,1.12],[.36,1.44],[.3,1.56],[0,1.62]],
  k: [[0,0],[.48,0],[.45,.12],[.34,.26],[.24,.78],[.30,1.12],[.19,1.22],[.34,1.5],[.26,1.66],[.09,1.74],[0,1.8]],
};
const STYLE = {
  staunton: { seg: 28, sy: 1.0, rough: [0.22, 0.3], metal: [0.35, 0.45] },
  classic:  { seg: 24, sy: 0.88, rough: [0.5, 0.55], metal: [0.1, 0.15] },
  minimal:  { seg: 10, sy: 0.95, rough: [0.7, 0.7], metal: [0.0, 0.0] },
};
const CAMS = {
  white: { p: [0, 9.8, 11.5], t: [0, 0, 0] },
  black: { p: [0, 9.8, -11.5], t: [0, 0, 0] },
  top:   { p: [0, 16.5, 0.02], t: [0, 0, 0] },
  iso:   { p: [9.5, 9.0, 9.5], t: [0, 0, 0] },
};
function lathe(points, seg) {
  return new THREE.LatheGeometry(points.map(p => new THREE.Vector2(p[0], p[1])), seg);
}
function textSprite(text, color = '#8b93a3') {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = color; g.font = '700 84px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 64, 70);
  const tex = new THREE.CanvasTexture(c);
  const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const s = new THREE.Sprite(m); s.scale.set(0.55, 0.55, 1);
  return s;
}
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  gr.addColorStop(0, 'rgba(245,158,11,0.9)'); gr.addColorStop(1, 'rgba(245,158,11,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export class Board3D {
  constructor(container, opts = {}) {
    this.o = Object.assign({ theme: 'slate', pieceStyle: 'staunton', quality: 'medium', animMs: 280, reducedMotion: false, glow: true }, opts);
    this.container = container;
    this.map = {}; // sq -> {group, type, color}
    this.tweens = [];
    this.frames = 0; this.fpsT = performance.now(); this.fps = 60;
    const w = container.clientWidth || 800, h = container.clientHeight || 600;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0e17);
    this.scene.fog = new THREE.FogExp2(0x0a0e17, 0.02);
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 120);
    this.camera.position.set(0, 9.8, 11.5);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 6; this.controls.maxDistance = 26;
    this.controls.maxPolarAngle = 1.42; this.controls.target.set(0, 0, 0);
    this.controls.addEventListener('change', () => this.clampTarget());
    // procedural environment (no HDR file): gradient equirect -> PMREM
    try {
      const c = document.createElement('canvas'); c.width = 64; c.height = 32;
      const g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 0, 32);
      gr.addColorStop(0, '#1c2942'); gr.addColorStop(0.55, '#0a0e17'); gr.addColorStop(0.72, '#3a2a10'); gr.addColorStop(1, '#05070c');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 32);
      const tex = new THREE.CanvasTexture(c);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      const pm = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pm.fromEquirectangular(tex).texture;
      tex.dispose(); pm.dispose();
    } catch {}
    this.buildLights(); this.buildBoard();
    this.glowTex = glowTexture();
    this.buildMarkers();
    this.applyTheme(this.o.theme);
    this.setQuality(this.o.quality);
    this.ray = new THREE.Raycaster(); this.ptr = new THREE.Vector2();
    this.hoverSq = null; this.dragging = null;
    this.bindPointer();
    new ResizeObserver(() => this.resize()).observe(container);
    this.renderer.setAnimationLoop(() => this.tick());
  }
  clampTarget() {
    const t = this.controls.target;
    t.x = Math.max(-6, Math.min(6, t.x)); t.z = Math.max(-6, Math.min(6, t.z)); t.y = Math.max(-1, Math.min(4, t.y));
  }
  buildLights() {
    this.scene.add(new THREE.AmbientLight(0xd0d8f0, 0.65));
    this.key = new THREE.DirectionalLight(0xfffaed, 1.5);
    this.key.position.set(8, 18, 10); this.key.castShadow = true;
    Object.assign(this.key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 45 });
    this.key.shadow.bias = -0.0005;
    this.scene.add(this.key);
    const rim = new THREE.PointLight(0x38bdf8, 12, 40); rim.position.set(-10, 8, -12); this.scene.add(rim);
    const warm = new THREE.PointLight(0xf59e0b, 10, 30); warm.position.set(10, 6, -10); this.scene.add(warm);
  }
  buildBoard() {
    const T = THEMES[this.o.theme];
    this.boardGroup = new THREE.Group(); this.scene.add(this.boardGroup);
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(11.6, 0.6, 11.6),
      new THREE.MeshStandardMaterial({ color: T.frame, roughness: 0.35, metalness: 0.4 }));
    frame.position.y = -0.31; frame.receiveShadow = true; this.boardGroup.add(frame);
    this.frameMesh = frame;
    const table = new THREE.Mesh(
      new THREE.CylinderGeometry(15, 15, 0.5, 48),
      new THREE.MeshStandardMaterial({ color: T.table, roughness: 0.85, metalness: 0.1 }));
    table.position.y = -0.68; table.receiveShadow = true; this.boardGroup.add(table);
    this.tableMesh = table;
    this.sqGeo = new THREE.BoxGeometry(1.25, 0.2, 1.25);
    this.lightMat = new THREE.MeshStandardMaterial({ roughness: 0.28, metalness: 0.22 });
    this.darkMat = new THREE.MeshStandardMaterial({ roughness: 0.28, metalness: 0.22 });
    this.squares = {}; this.squareList = [];
    for (let f = 0; f < 8; f++) for (let r = 0; r < 8; r++) {
      const sq = 'abcdefgh'[f] + (r + 1);
      const m = new THREE.Mesh(this.sqGeo, (f + r) % 2 ? this.lightMat : this.darkMat);
      const p = sqToPos(sq);
      m.position.set(p.x, 0, p.z); m.receiveShadow = true;
      m.userData.square = sq;
      this.boardGroup.add(m); this.squares[sq] = m; this.squareList.push(m);
    }
    // engraved-look coordinate labels on the frame rim
    this.labels = new THREE.Group(); this.boardGroup.add(this.labels);
    for (let f = 0; f < 8; f++) {
      for (const z of [5.55, -5.55]) {
        const s = textSprite('abcdefgh'[f]); s.position.set((f - 3.5) * 1.25, 0.02, z); this.labels.add(s);
      }
    }
    for (let r = 0; r < 8; r++) {
      for (const x of [-5.55, 5.55]) {
        const s = textSprite(String(r + 1)); s.position.set(x, 0.02, (3.5 - r) * 1.25); this.labels.add(s);
      }
    }
  }
  buildMarkers() {
    this.markerGroup = new THREE.Group(); this.scene.add(this.markerGroup);
    const dotGeo = new THREE.CircleGeometry(0.2, 24);
    const ringGeo = new THREE.RingGeometry(0.46, 0.6, 32);
    const selGeo = new THREE.RingGeometry(0.4, 0.58, 32);
    const planeGeo = new THREE.PlaneGeometry(1.2, 1.2);
    this.dotMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.8, depthWrite: false });
    this.capMat = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.9, depthWrite: false });
    this.selMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide });
    this.lastMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.28, depthWrite: false });
    this.checkMat = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
    this.hoverMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false });
    this.dotGeo = dotGeo; this.ringGeo = ringGeo; this.selGeo = selGeo; this.planeGeo = planeGeo;
    this.markerPool = [];
    // thinking ring (non-text AI indicator) around opponent side
    this.thinkRing = new THREE.Mesh(new THREE.RingGeometry(5.5, 5.85, 64),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    this.thinkRing.rotation.x = -Math.PI / 2; this.thinkRing.position.y = 0.03;
    this.scene.add(this.thinkRing);
    this.thinking = false; this.thinkSide = 'black';
  }
  marker(geo, mat, sq, y = 0.12) {
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    const p = sqToPos(sq); m.position.set(p.x, y, p.z);
    m.userData.deco = true;
    this.markerGroup.add(m); this.markerPool.push(m);
    return m;
  }
  clearMarkers() {
    for (const m of this.markerPool) { this.markerGroup.remove(m); }
    this.markerPool = [];
  }
  setSelected(sq) { this.selSq = sq; this.refreshMarkers(); }
  setTargets(targets, captureSet) { this.targets = targets || []; this.capSet = new Set(captureSet || []); this.refreshMarkers(); }
  setLastMove(f) { this.lastF = f; this.refreshMarkers(); }
  setCheck(sq) { this.checkSq = sq || null; this.refreshMarkers(); }
  setCursor(sq) { this.cursorSq = sq || null; this.refreshMarkers(); }
  refreshMarkers() {
    this.clearMarkers();
    if (this.lastF) {
      if (this.lastF.from) this.marker(this.planeGeo, this.lastMat, this.lastF.from, 0.11);
      if (this.lastF.to) this.marker(this.planeGeo, this.lastMat, this.lastF.to, 0.11);
    }
    for (const t of this.targets || []) this.marker(this.capSet.has(t) ? this.ringGeo : this.dotGeo, this.capSet.has(t) ? this.capMat : this.dotMat, t, 0.13);
    if (this.selSq) this.marker(this.selGeo, this.selMat, this.selSq, 0.13);
    if (this.hoverSq && this.hoverSq !== this.selSq) this.marker(this.planeGeo, this.hoverMat, this.hoverSq, 0.115);
    if (this.checkSq) this.marker(this.selGeo, this.checkMat, this.checkSq, 0.14);
    if (this.cursorSq) this.marker(this.selGeo, this.selMat, this.cursorSq, 0.135);
  }
  pieceMaterial(color) {
    const T = THEMES[this.o.theme], st = STYLE[this.o.pieceStyle] || STYLE.staunton;
    const isW = color === 'w';
    return new THREE.MeshStandardMaterial({
      color: isW ? T.white : T.black, roughness: isW ? st.rough[0] : st.rough[1],
      metalness: isW ? st.metal[0] : st.metal[1], flatShading: this.o.pieceStyle === 'minimal',
    });
  }
  buildPiece(type, color) {
    const t = type.toLowerCase(), st = STYLE[this.o.pieceStyle] || STYLE.staunton;
    const g = new THREE.Group(), mat = this.pieceMaterial(color);
    const add = (geo, y = 0) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
    if (t === 'n') {
      add(lathe(PROFILES.n, st.seg));
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.27, 0.7, 8), mat);
      head.rotation.x = 0.45; head.position.set(0, 0.72, 0.1); head.castShadow = true; g.add(head);
      const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.42), mat);
      muzzle.position.set(0, 0.62, 0.3); muzzle.castShadow = true; g.add(muzzle);
      if (color === 'b') g.rotation.y = Math.PI;
    } else {
      add(lathe(PROFILES[t] || PROFILES.p, st.seg));
      if (t === 'k') {
        const h = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.08), mat); h.position.y = 1.92; g.add(h);
        const v = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.08), mat); v.position.y = 1.92; g.add(v);
      } else if (t === 'q') {
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), mat); ball.position.y = 1.7; ball.castShadow = true; g.add(ball);
      } else if (t === 'r') {
        const top = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.14, 16), mat); top.position.y = 1.1; top.castShadow = true; g.add(top);
      } else if (t === 'b') {
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), mat); ball.position.y = 1.5; g.add(ball);
      }
    }
    g.scale.set(1.1, 1.1 * st.sy, 1.1);
    return g;
  }
  syncFromFen(fen) {
    const want = parsePlacement(fen);
    for (const sq of Object.keys(this.map)) {
      if (this.map[sq] && want[sq] !== this.map[sq].userData.piece) {
        this.scene.remove(this.map[sq].group); delete this.map[sq];
      }
    }
    for (const [sq, p] of Object.entries(want)) {
      const cur = this.map[sq];
      if (!cur || cur.userData.piece !== p) {
        if (cur) this.scene.remove(cur.group);
        const color = p === p.toUpperCase() ? 'w' : 'b';
        const group = this.buildPiece(p, color);
        const pos = sqToPos(sq); group.position.set(pos.x, 0.1, pos.z);
        group.userData = { square: sq, piece: p, type: p.toLowerCase(), color };
        group.traverse(o => { o.userData.pickSquare = sq; });
        this.scene.add(group);
        this.map[sq] = { group, userData: group.userData };
      }
    }
    this.refreshMarkers();
  }
  removeAt(sq, fade = true) {
    const e = this.map[sq];
    if (!e) return Promise.resolve();
    delete this.map[sq];
    if (!fade || this.o.reducedMotion) { this.scene.remove(e.group); return Promise.resolve(); }
    return new Promise(res => {
      const mats = new Set();
      e.group.traverse(o => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; mats.add(o.material); } });
      this.tweens.push({ t: 0, dur: 160, update: k => mats.forEach(m => m.opacity = 1 - k), done: () => { this.scene.remove(e.group); res(); } });
    });
  }
  glide(group, to, arcH, dur) {
    const from = group.position.clone();
    const target = new THREE.Vector3(to.x, 0.1, to.z);
    if (this.o.reducedMotion || dur <= 0) { group.position.copy(target); return Promise.resolve(); }
    return new Promise(res => {
      this.tweens.push({
        t: 0, dur, update: k => {
          const e = k < 0.5 ? 2 * k * k : -1 + (4 - 2 * k) * k;
          group.position.x = from.x + (target.x - from.x) * e;
          group.position.z = from.z + (target.z - from.z) * e;
          group.position.y = 0.1 + Math.sin(k * Math.PI) * arcH;
        }, done: () => { group.position.copy(target); res(); }
      });
    });
  }
  async animateFacts(f, nextMap) {
    const D = this.o.reducedMotion ? 0 : this.o.animMs;
    const knight = f.moved && f.moved.toLowerCase() === 'n';
    const arcH = knight ? 1.5 : 0.7;
    if (f.captured && f.captureSq && !(f.to === f.captureSq)) await this.removeAt(f.captureSq);
    if (f.castle) {
      const king = this.map[f.from], rook = this.map[f.castle.rookFrom];
      if (king && rook) {
        const kp = sqToPos(f.to), rp = sqToPos(f.castle.rookTo);
        await Promise.all([this.glide(king.group, kp, arcH * 0.7, D), this.glide(rook.group, rp, arcH * 0.7, D)]);
        this.moveEntry(f.from, f.to, f.moved);
        this.moveEntry(f.castle.rookFrom, f.castle.rookTo, rook.userData.piece);
      }
    } else if (f.from && f.to) {
      const e = this.map[f.from];
      if (e) {
        if (f.to === f.captureSq && f.captured) await this.removeAt(f.to);
        await this.glide(e.group, sqToPos(f.to), arcH, D);
        this.moveEntry(f.from, f.to, f.moved);
      }
    }
    if (f.promotion) {
      const sq = f.to, color = f.promotion === f.promotion.toUpperCase() ? 'w' : 'b';
      const old = this.map[sq];
      if (old) this.scene.remove(old.group);
      const group = this.buildPiece(f.promotion, color);
      const pos = sqToPos(sq); group.position.set(pos.x, 0.1, pos.z);
      const up = f.promotion.toLowerCase() === 'n' ? 'n' : f.promotion.toLowerCase();
      group.userData = { square: sq, piece: f.promotion, type: up, color };
      group.traverse(o => { o.userData.pickSquare = sq; });
      if (!this.o.reducedMotion) {
        group.scale.set(0.2, 0.2, 0.2);
        this.scene.add(group); this.map[sq] = { group, userData: group.userData };
        await new Promise(res => this.tweens.push({ t: 0, dur: 180, update: k => group.scale.setScalar(0.2 + 0.9 * k), done: () => { group.scale.set(1.1, 1.1 * (STYLE[this.o.pieceStyle] || STYLE.staunton).sy, 1.1); res(); } }));
      } else { this.scene.add(group); this.map[sq] = { group, userData: group.userData }; }
    }
    this.syncFromFenMap(nextMap);
    this.refreshMarkers();
  }
  moveEntry(from, to, piece) {
    const e = this.map[from];
    if (!e) return;
    delete this.map[from];
    e.userData.square = to; e.userData.piece = piece || e.userData.piece;
    e.group.traverse(o => { o.userData.pickSquare = to; });
    this.map[to] = e;
  }
  syncFromFenMap(map) {
    for (const sq of Object.keys(this.map)) {
      if (!(sq in map)) { this.scene.remove(this.map[sq].group); delete this.map[sq]; }
    }
    for (const [sq, p] of Object.entries(map)) {
      const cur = this.map[sq];
      if (!cur || cur.userData.piece !== p) {
        if (cur) this.scene.remove(cur.group);
        const color = p === p.toUpperCase() ? 'w' : 'b';
        const group = this.buildPiece(p, color);
        const pos = sqToPos(sq); group.position.set(pos.x, 0.1, pos.z);
        group.userData = { square: sq, piece: p, type: p.toLowerCase(), color };
        group.traverse(o => { o.userData.pickSquare = sq; });
        this.scene.add(group);
        this.map[sq] = { group, userData: group.userData };
      }
    }
  }
  shake(sq) {
    const e = this.map[sq];
    if (!e || this.o.reducedMotion) return;
    const x0 = e.group.position.x;
    this.tweens.push({ t: 0, dur: 220, update: k => { e.group.position.x = x0 + Math.sin(k * Math.PI * 4) * 0.12 * (1 - k); }, done: () => { e.group.position.x = x0; } });
  }
  async endGame(loserColor, winnerColor) {
    for (const [sq, e] of Object.entries(this.map)) {
      if (e.userData.color === loserColor && e.userData.type === 'k') {
        const g = e.group;
        if (this.o.reducedMotion) { g.rotation.z = Math.PI / 2 * (loserColor === 'w' ? 1 : -1); }
        else await new Promise(res => this.tweens.push({ t: 0, dur: 650, update: k => { g.rotation.z = k * Math.PI / 2 * (loserColor === 'w' ? 1 : -1); g.position.y = 0.1 + Math.sin(k * Math.PI) * 0.5; }, done: res }));
      }
    }
    if (winnerColor && !this.o.reducedMotion) {
      const mats = new Set();
      for (const e of Object.values(this.map)) if (e.userData.color === winnerColor) e.group.traverse(o => { if (o.material && o.material.emissive) mats.add(o.material); });
      mats.forEach(m => { m.emissive = new THREE.Color(0xf59e0b); m.emissiveIntensity = 0; });
      this.tweens.push({ t: 0, dur: 1800, update: k => mats.forEach(m => m.emissiveIntensity = 0.35 * Math.sin(k * Math.PI * 3) ** 2), done: () => mats.forEach(m => m.emissiveIntensity = 0) });
    }
  }
  setThinking(on, side = 'black') {
    this.thinking = on; this.thinkSide = side;
    this.thinkRing.position.z = side === 'black' ? -3.4 : 3.4;
  }
  /* camera */
  setCamera(name, animate = true) {
    const c = CAMS[name] || CAMS.white;
    this.preset = name;
    const p1 = this.camera.position.clone(), t1 = this.controls.target.clone();
    const p2 = new THREE.Vector3(...c.p), t2 = new THREE.Vector3(...c.t);
    if (!animate || this.o.reducedMotion) { this.camera.position.copy(p2); this.controls.target.copy(t2); return; }
    const ms = 650;
    this.tweens.push({ t: 0, dur: ms, update: k => {
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      this.camera.position.lerpVectors(p1, p2, e); this.controls.target.lerpVectors(t1, t2, e);
    }, done: () => {} });
  }
  resetCamera() { this.setCamera(this.preset === 'top' ? 'top' : (this.playerSide === 'black' ? 'black' : 'white')); }
  cinematicPush(x, z) {
    if (this.o.reducedMotion || !this.o.cinematic) return;
    const dir = this.camera.position.clone().sub(new THREE.Vector3(x, 0, z)).setY(0).normalize();
    const p1 = this.camera.position.clone(), p2 = p1.clone().addScaledVector(dir, -1.1); p2.y = Math.max(4.5, p2.y - 0.8);
    this.tweens.push({ t: 0, dur: 700, update: k => { const e = Math.sin(k * Math.PI); this.camera.position.lerpVectors(p1, p2, e); }, done: () => {} });
  }
  /* picking */
  castAt(clientX, clientY) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ptr.x = ((clientX - r.left) / r.width) * 2 - 1;
    this.ptr.y = -((clientY - r.top) / r.height) * 2 + 1;
    this.ray.setFromCamera(this.ptr, this.camera);
    const hits = this.ray.intersectObjects([this.boardGroup, this.scene], true);
    for (const h of hits) {
      if (h.object.userData.deco) continue; // markers never intercept picks
      let o = h.object;
      while (o) { if (o.userData && (o.userData.square || o.userData.pickSquare)) return o.userData.square || o.userData.pickSquare; o = o.parent; }
    }
    return null;
  }
  squarePoint(sq) { const p = sqToPos(sq); return new THREE.Vector3(p.x, 0.15, p.z); }
  bindPointer() {
    const el = this.renderer.domElement;
    let downAt = 0, downXY = null, downSq = null, maybeDrag = null;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', e => {
      downAt = performance.now(); downXY = [e.clientX, e.clientY];
      downSq = this.castAt(e.clientX, e.clientY);
      const dragCbs = this.o.onDragStart;
      if (downSq && this.map[downSq] && dragCbs && dragCbs(downSq)) {
        maybeDrag = downSq;
        el.setPointerCapture && el.setPointerCapture(e.pointerId);
      }
    });
    el.addEventListener('pointermove', e => {
      if (!maybeDrag) {
        const s = this.castAt(e.clientX, e.clientY);
        if (s !== this.hoverSq) { this.hoverSq = s; this.refreshMarkers(); }
        return;
      }
      const entry = this.map[maybeDrag];
      if (!entry) { maybeDrag = null; return; }
      const r = el.getBoundingClientRect();
      this.ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      this.ptr.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      this.ray.setFromCamera(this.ptr, this.camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.55);
      const pt = new THREE.Vector3();
      if (this.ray.ray.intersectPlane(plane, pt)) {
        pt.x = Math.max(-5, Math.min(5, pt.x)); pt.z = Math.max(-5, Math.min(5, pt.z));
        entry.group.position.set(pt.x, 0.55, pt.z);
        if (this.o.onDragOver) this.o.onDragOver(this.squareFromPoint(pt));
      }
    });
    const up = e => {
      const moved = downXY ? Math.hypot(e.clientX - downXY[0], e.clientY - downXY[1]) : 99;
      const dt = performance.now() - downAt;
      if (maybeDrag) {
        const entry = this.map[maybeDrag];
        const toSq = this.castAt(e.clientX, e.clientY);
        if (entry) { const p = sqToPos(maybeDrag); entry.group.position.set(p.x, 0.1, p.z); }
        const from = maybeDrag; maybeDrag = null;
        if (toSq && toSq !== from && this.o.onDrop) this.o.onDrop(from, toSq);
        else if (this.o.onPick) this.o.onPick(from);
        downSq = null; return;
      }
      if (moved < 6 && dt < 600 && this.o.onPick) {
        const s = this.castAt(e.clientX, e.clientY);
        if (s) this.o.onPick(s);
      }
      downSq = null;
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', () => { maybeDrag = null; });
  }
  squareFromPoint(pt) {
    let best = null, bd = 1e9;
    for (let f = 0; f < 8; f++) for (let r = 0; r < 8; r++) {
      const sq = 'abcdefgh'[f] + (r + 1), p = sqToPos(sq);
      const d = Math.hypot(pt.x - p.x, pt.z - p.z);
      if (d < bd) { bd = d; best = sq; }
    }
    return bd < 0.9 ? best : null;
  }
  /* quality + themes */
  applyTheme(name) {
    if (!THEMES[name]) name = 'slate';
    this.o.theme = name;
    const T = THEMES[name];
    this.lightMat.color.setHex(T.light); this.darkMat.color.setHex(T.dark);
    this.frameMesh.material.color.setHex(T.frame);
    this.tableMesh.material.color.setHex(T.table);
    for (const [sq, e] of Object.entries(this.map)) {
      const color = e.userData.color;
      e.group.traverse(o => { if (o.material && o.material.color) o.material.color.setHex(color === 'w' ? T.white : T.black); });
    }
  }
  setQuality(q) {
    this.o.quality = q;
    const pr = window.devicePixelRatio || 1;
    const cap = q === 'low' ? 1 : q === 'medium' ? 1.5 : 2;
    this.renderer.setPixelRatio(Math.min(pr, cap));
    this.key.castShadow = q !== 'low';
    const sz = q === 'high' ? 2048 : 1024;
    if (this.key.shadow.map) { this.key.shadow.map.dispose(); this.key.shadow.map = null; }
    this.key.shadow.mapSize.set(sz, sz);
    this.glowOn = (q !== 'low') && this.o.glow;
  }
  resize() {
    const w = this.container.clientWidth || 800, h = this.container.clientHeight || 600;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
  tick() {
    const now = performance.now();
    this.frames++;
    if (now - this.fpsT >= 1000) { this.fps = this.frames * 1000 / (now - this.fpsT); this.frames = 0; this.fpsT = now; }
    const dt = Math.min(0.1, ((now - (this.lastT || now)) / 1000) || 0.016);
    this.lastT = now;
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.t += dt * 1000;
      const k = Math.min(1, tw.t / tw.dur);
      try { tw.update(k); } catch {}
      if (k >= 1) { this.tweens.splice(i, 1); try { tw.done(); } catch {} }
    }
    if (this.thinking) this.thinkRing.material.opacity = 0.45 + Math.sin(now * 0.008) * 0.3;
    else this.thinkRing.material.opacity = Math.max(0, this.thinkRing.material.opacity - 0.06);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
  dispose() { this.renderer.setAnimationLoop(null); this.renderer.dispose(); }
}
