import * as THREE from "three";
import { surfMat } from "./envs.js";
import { PS } from "./track.js";

const V3 = THREE.Vector3;
const L = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
const tmp = new V3();
let boxTex;
function qTex() {
  if (boxTex) return boxTex;
  const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
  const gr = g.createLinearGradient(0, 0, 64, 64); gr.addColorStop(0, "#ff4fd8"); gr.addColorStop(0.5, "#ffd23f"); gr.addColorStop(1, "#3ad0ff");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); g.fillStyle = "#fff"; g.font = "bold 46px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("?", 32, 35);
  g.strokeStyle = "#fff"; g.lineWidth = 4; g.strokeRect(2, 2, 60, 60);
  boxTex = new THREE.CanvasTexture(c); boxTex.colorSpace = THREE.SRGBColorSpace; return boxTex;
}
export function textTex(text, bg = "#1a5a2a", fg = "#fff", w = 512, h = 128) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d");
  g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
  g.fillStyle = fg; let fs = 64; g.font = "bold " + fs + "px sans-serif";
  while (g.measureText(text).width > w - 40 && fs > 18) { fs -= 4; g.font = "bold " + fs + "px sans-serif"; }
  g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, w / 2, h / 2 + 3);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
let gTex = {};
export function groundTex(color, kind) {
  const key = color + (kind || "");
  if (gTex[key]) return gTex[key];
  const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
  const col = new THREE.Color(color);
  g.fillStyle = "#" + col.getHexString(); g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 260; i++) { const k = 0.8 + Math.random() * 0.4; g.fillStyle = "#" + col.clone().multiplyScalar(k).getHexString(); g.fillRect(Math.random() * 64, Math.random() * 64, 2 + Math.random() * 3, 2 + Math.random() * 3); }
  if (kind === "water") { g.fillStyle = "rgba(255,255,255,.25)"; for (let i = 0; i < 12; i++) g.fillRect(Math.random() * 64, Math.random() * 64, 14, 1.5); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(400, 400); t.colorSpace = THREE.SRGBColorSpace;
  return (gTex[key] = t);
}
// wedge ramp mesh
function rampMesh(w, len, h, color) {
  const g = new THREE.BufferGeometry();
  const x = w / 2;
  const v = [-x, 0, -len, x, 0, -len, x, h, 0, -x, 0, -len, x, h, 0, -x, h, 0, -x, 0, 0, x, 0, 0, x, h, 0, -x, 0, 0, x, h, 0, -x, h, 0,
    -x, 0, -len, -x, h, 0, -x, 0, 0, x, 0, -len, x, 0, 0, x, h, 0];
  g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals();
  return new THREE.Mesh(g, L(color, { side: THREE.DoubleSide, emissive: new THREE.Color(color).multiplyScalar(0.25) }));
}
let chevTex;
function chevron() {
  if (chevTex) return chevTex;
  const c = document.createElement("canvas"); c.width = 64; c.height = 128; const g = c.getContext("2d");
  g.fillStyle = "#ff7a00"; g.fillRect(0, 0, 64, 128); g.fillStyle = "#ffe14a";
  for (let y = 0; y < 128; y += 42) { g.beginPath(); g.moveTo(8, y + 34); g.lineTo(32, y + 8); g.lineTo(56, y + 34); g.lineTo(56, y + 44); g.lineTo(32, y + 18); g.lineTo(8, y + 44); g.fill(); }
  chevTex = new THREE.CanvasTexture(c); chevTex.colorSpace = THREE.SRGBColorSpace; return chevTex;
}
function orient(m, s, lat, h) { PS(s, lat, h, m.position); const f = s.t, up = s.up; const left = new V3().crossVectors(up, f).normalize(); m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(left, up, f)); return m; }

export const OBST = {
  cone: { r: 0.9, brk: true, c: 0xff6a00, mk: () => { const g = new THREE.Group(); const k = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.8, 10), L(0xff6a00)); k.position.y = 0.9; const b = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.3, 10), L(0xffffff)); b.position.y = 0.9; g.add(k, b); return g; } },
  crate: { r: 1.4, brk: true, c: 0xb07a3a, mk: () => { const m = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.4), L(0xb07a3a)); m.position.y = 1.2; const g = new THREE.Group(); g.add(m); return g; } },
  hay: { r: 1.6, brk: true, c: 0xe0c060, mk: () => { const m = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 2.2, 12), L(0xe0c060)); m.rotation.z = Math.PI / 2; m.position.y = 1.4; const g = new THREE.Group(); g.add(m); return g; } },
  barrel: { r: 1.1, brk: true, c: 0x8a5a2a, mk: () => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.8, 12), L(0x8a5a2a)); m.position.y = 0.9; const g = new THREE.Group(); g.add(m); const r = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.08, 4, 14), L(0x444444)); r.rotation.x = Math.PI / 2; r.position.y = 1.4; g.add(r); return g; } },
  barrier: { r: 1.5, brk: true, c: 0xff3030, mk: () => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 0.2), L(0xff3030)); b.position.y = 1.3; const b2 = b.clone(); b2.material = L(0xffffff); b2.position.y = 0.7; g.add(b, b2); for (const x of [-1.3, 1.3]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.6, 0.15), L(0x333333)); l.position.set(x, 0.8, 0); g.add(l); } return g; } },
  snowman: { r: 1.4, brk: true, c: 0xffffff, mk: () => { const g = new THREE.Group(); for (const [r, y] of [[1.2, 1.1], [0.85, 2.7], [0.6, 3.8]]) { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), L(0xffffff)); s.position.y = y; g.add(s); } const n = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.8, 6), L(0xff7a00)); n.rotation.x = Math.PI / 2; n.position.set(0, 3.8, 0.8); g.add(n); return g; } },
  trolley: { r: 1.4, brk: true, c: 0xaaaaaa, mk: () => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 2.2), L(0xb8c0c8, { wireframe: false })); b.position.y = 1.4; g.add(b); return g; } },
  suitcase: { r: 1.1, brk: true, c: 0x3a6ad8, mk: () => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.3, 0.7), L([0x3a6ad8, 0xd83a3a, 0x3ad86a, 0xffd23f][Math.floor(Math.random() * 4)])); b.position.y = 0.65; g.add(b); return g; } },
  pillar: { r: 1.6, brk: false, c: 0xcccccc, mk: () => { const m = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 14, 12), L(0xdddddd)); m.position.y = 7; const g = new THREE.Group(); g.add(m); return g; } },
  rock: { r: 2.2, brk: false, c: 0x8a8478, mk: () => { const m = new THREE.Mesh(new THREE.DodecahedronGeometry(2.4, 0), L(0x8a8478, { flatShading: true })); m.position.y = 1.4; m.scale.y = 0.7; const g = new THREE.Group(); g.add(m); return g; } },
  tree: { r: 1.4, brk: false, c: 0x2a6a35, mk: () => { const g = new THREE.Group(); const t = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 4, 6), L(0x6b4423)); t.position.y = 2; const c = new THREE.Mesh(new THREE.ConeGeometry(3, 9, 7), L(0x2a6a35, { flatShading: true })); c.position.y = 8; g.add(t, c); return g; } },
  cow: { r: 2, brk: false, cow: true, c: 0xffffff, mk: () => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.5, 3), L(0xffffff)); b.position.y = 1.8; g.add(b); for (let i = 0; i < 3; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.7, 0.8), L(0x222222)); sp.position.set(0, 1.9 + (i % 2) * 0.3, -1 + i * 0.9); g.add(sp); } const h = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1.1), L(0xffffff)); h.position.set(0, 2.4, 1.9); g.add(h); for (const x of [-0.6, 0.6]) for (const z of [-1.1, 1.1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.1, 0.35), L(0xffffff)); l.position.set(x, 0.55, z); g.add(l); } const bell = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.4, 6), L(0xd4af37)); bell.position.set(0, 1.6, 2.1); g.add(bell); return g; } },
  table: { r: 1.8, brk: true, c: 0x9a6a3a, mk: () => { const g = new THREE.Group(); const t = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, 1.6), L(0x9a6a3a)); t.position.y = 1.2; g.add(t); const s = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.3, 0.9, 8), L(0xd8a020)); s.position.set(0.6, 1.8, 0); g.add(s); return g; } },
  car: { r: 2.6, brk: false, c: 0x2a6ad8, mk: () => { const g = new THREE.Group(); const c = [0x2a6ad8, 0xd83a3a, 0xf0f0f0, 0x333333, 0xffd23f][Math.floor(Math.random() * 5)]; const b = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 4.6), L(c)); b.position.y = 1; const t = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.9, 2.4), L(0x9fd8ff)); t.position.y = 2; g.add(b, t); return g; } },
  tnt: { r: 1.5, brk: true, boom: true, c: 0xdd2222, mk: () => { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 2.2), new THREE.MeshLambertMaterial({ map: textTex("TNT", "#cc1111", "#fff", 128, 128) })); m.position.y = 1.1; g.add(m); return g; } },
};

export function addFeature(T, f, path, i, grp, vis) {
  const O = T.objs, S = path.S, N = S.length;
  i = path.closed ? ((i % N) + N) % N : Math.max(0, Math.min(N - 1, i));
  const s = S[i];
  const pi = path.idx;
  switch (f.t) {
    case "box": {
      const n = f.n || 4, w = (f.w || s.hw * 1.5);
      for (let k = 0; k < n; k++) {
        const lat = (f.lat || 0) + (n === 1 ? 0 : (k / (n - 1) - 0.5) * w);
        const b = { pi, i, lat, active: true, timer: 0, ph: Math.random() * 6, f, pos: PS(s, lat, 1.6, new V3()) };
        if (vis) { const m = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshLambertMaterial({ map: qTex(), transparent: true, opacity: 0.9, emissive: 0x332244 })); m.position.copy(b.pos); grp.add(m); b.mesh = m; b.y = b.pos.y; }
        O.boxes.push(b);
      }
      break;
    }
    case "boost": case "bounce": {
      const lat = f.lat || 0, w = f.w || 5;
      const p = { pi, i, lat, w, kind: f.t, p: f.p || 22, f };
      if (vis) {
        const m = f.t === "boost" ? new THREE.Mesh(new THREE.PlaneGeometry(w, 6), new THREE.MeshBasicMaterial({ map: chevron(), transparent: true })) : new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2 + 0.3, 0.6, 16), L(0xff3a8a, { emissive: 0x551133 }));
        if (f.t === "boost") m.geometry.rotateX(-Math.PI / 2), m.geometry.rotateY(Math.PI);
        orient(m, s, lat, 0.07); grp.add(m); p.mesh = m;
      }
      O.pads.push(p);
      break;
    }
    case "ramp": {
      const lat = f.lat || 0, w = f.w || Math.min(s.hw * 2 - 1, 12), p = f.p || 18;
      const r = { pi, i, lat, w, p, f, boost: f.boost };
      if (vis) { const m = rampMesh(w, f.len || 7, f.h || 1.6, f.c || 0xffce00); orient(m, s, lat, 0); grp.add(m); r.mesh = m; }
      O.ramps.push(r);
      break;
    }
    case "gap": {
      const len = Math.ceil((f.len || 20) / path.sp), id = T.gapSecs.length;
      const sec = { id, pi, i0: i, i1: i + len, lap: f.lap || 1, until: f.until, f, broken: (f.lap || 1) <= 1 };
      T.gapSecs.push(sec);
      for (let k = 0; k < len; k++) { const q = path.closed ? (i + k) % N : Math.min(N - 1, i + k); const ss = S[q]; if (sec.lap > 1) { ss.gapId = id; ss.gapSec = sec; } else { ss.gapLap = 1; ss.hide = true; } }
      if (f.ramp !== false) addFeature(T, { t: "ramp", p: f.p || 20, w: s.hw * 2 - 0.5, lap: f.rampLap, c: f.rc }, path, i - 2, grp, vis);
      break;
    }
    case "patch": {
      const len = Math.ceil((f.len || 20) / path.sp), lat = f.lat || 0, w = f.w || s.hw * 2;
      const pt = { l0: lat - w / 2, l1: lat + w / 2, surf: f.surf || "mud", lap: f.lap, until: f.until };
      const pos = [], uv = [];
      for (let k = 0; k < len; k++) {
        const q = path.closed ? (i + k) % N : Math.min(N - 1, i + k), ss = S[q];
        (ss.patches = ss.patches || []).push(pt);
        if (vis && k < len - 1) {
          const nn = S[path.closed ? (q + 1) % N : Math.min(N - 1, q + 1)];
          const a = PS(ss, pt.l0, 0.05, new V3()), b = PS(ss, pt.l1, 0.05, new V3()), c = PS(nn, pt.l1, 0.05, new V3()), d = PS(nn, pt.l0, 0.05, new V3());
          pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z);
          const v0 = k * path.sp / 8, v1 = v0 + path.sp / 8, uw = w / 8;
          uv.push(0, v0, uw, v0, uw, v1, 0, v0, uw, v1, 0, v1);
        }
      }
      if (vis && pos.length) { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); const m = new THREE.Mesh(g, surfMat(pt.surf)); m.visible = !f.lap; pt.mesh = m; grp.add(m); (T.lapMeshes = T.lapMeshes || []).push(pt); }
      break;
    }
    case "obst": {
      const def = OBST[f.kind] || OBST.cone, n = f.n || 1, sp = f.spread || 0, len = f.len || 0;
      for (let k = 0; k < n; k++) {
        const q = i + (n > 1 ? Math.round((k / (n - 1)) * len / path.sp) : 0);
        const qq = path.closed ? ((q % N) + N) % N : Math.min(N - 1, q), ss = S[qq];
        const lat = f.lats ? f.lats[k % f.lats.length] : (f.lat || 0) + (n > 1 ? ((k * 7919) % 13 / 12 - 0.5) * sp : 0);
        const o = { pi, i: qq, lat, r: def.r * (f.s || 1), brk: def.brk, cow: def.cow, boom: def.boom, kind: f.kind, c: def.c, pos: PS(ss, lat, 0, new V3()), fly: 0, vel: new V3(), spin: 0, resp: def.brk ? 18 : 0, down: false, f };
        if (vis) { const m = def.mk(); orient(m, ss, lat, 0); m.scale.setScalar(f.s || 1); m.rotation.y += Math.random() * 0.5; grp.add(m); o.mesh = m; o.home = m.position.clone(); o.homeQ = m.quaternion.clone(); }
        O.obst.push(o);
      }
      break;
    }
    case "banner": case "slowmo": case "splash": case "cheer":
      O.triggers.push({ pi, i, f, type: f.t });
      break;
    case "sign": {
      if (!vis) break;
      const g = new THREE.Group(); const w = s.hw * 2 + 3;
      const b = new THREE.Mesh(new THREE.BoxGeometry(Math.min(w, 22), 3.2, 0.4), new THREE.MeshBasicMaterial({ map: textTex(f.text, f.bg || "#1d5fb4", "#fff") }));
      b.position.y = (f.y || 8); g.add(b);
      for (const x of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, (f.y || 8) + 1.6, 0.5), L(0x888888)); p.position.set(x * (w / 2), ((f.y || 8) + 1.6) / 2, 0); g.add(p); }
      orient(g, s, f.lat || 0, 0); g.rotateY(Math.PI); grp.add(g);
      O.signs.push(g);
      break;
    }
  }
}

const GATE_LOOK = {
  smash: { c: 0x9a6a3a, text: "CONSTRUCTION", bg: "#e8a010" }, hidden: { c: 0x3a7a2a, text: "", bg: null }, lap: { c: 0xdd2222, text: "LOCKED", bg: "#cc1111" },
  door: { c: 0x888c94, text: "GATE", bg: "#555" }, switch: { c: 0xffd23f, text: "SWITCH", bg: "#333" }, bomb: { c: 0xcc2222, text: "EXPLOSION", bg: "#cc1111" },
};
export function addGate(T, b, grp, vis) {
  const gd = b.def.gate, kind = typeof gd === "string" ? gd : gd.kind, i = Math.min(b.N - 2, Math.ceil(12 / b.sp));
  const s = b.S[i];
  const g = { b, i, kind, lap: gd.lap || 2, period: gd.period || 9, closed: kind !== "door", broken: 0, mesh: null, pos: PS(s, 0, 2, new V3()), w: s.hw + (s.sh ? s.shw : 0) };
  if (vis) {
    const look = GATE_LOOK[kind] || GATE_LOOK.smash;
    const grpG = new THREE.Group();
    const W = g.w * 2;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(W, kind === "door" ? 6 : 4, 0.8), look.bg ? new THREE.MeshLambertMaterial({ map: textTex(look.text, look.bg, "#fff", 512, 96), color: 0xffffff }) : L(look.c));
    wall.position.y = kind === "door" ? 3 : 2; grpG.add(wall);
    if (kind === "hidden") { wall.material = L(0x2f6a28); for (let k = 0; k < 8; k++) { const sp = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 0), L(0x3a8a30, { flatShading: true })); sp.position.set((k / 7 - 0.5) * W, 3.2 + Math.random(), 0); grpG.add(sp); } }
    if (kind === "bomb") for (let k = 0; k < 3; k++) { const m = OBST.tnt.mk(); m.position.set((k - 1) * 2.6, 4, 0.6); grpG.add(m); }
    orient(grpG, s, 0, 0); grp.add(grpG); g.mesh = grpG; g.wall = wall;
  }
  T.objs.gates.push(g);
  b.gate = g;
}
// is a gate open for this kart?
export function gateOpen(T, g, kart) {
  if (g.broken > 0) return true;
  if (g.kind === "door") return !g.closed;
  if (g.kind === "lap") return kart ? kart.curLap >= g.lap : T.lap >= g.lap;
  if (g.kind === "switch") return !!g.switched;
  return false;
}
export function breakGate(T, g, dur = 22) {
  g.broken = dur;
  if (g.mesh) { g.flyT = 1.4; g.flyV = new V3(0, 16, 0); }
}
export function updateFeatures(T, dt, time) {
  const O = T.objs;
  for (const b of O.boxes) {
    if (!b.active) { b.timer -= dt; if (b.timer <= 0) { b.active = true; if (b.mesh) b.mesh.visible = true; } }
    if (b.active && b.mesh) { b.mesh.rotation.y = time * 1.6 + b.ph; b.mesh.rotation.x = Math.sin(time + b.ph) * 0.3; b.mesh.position.y = b.y + Math.sin(time * 3 + b.ph) * 0.35; }
  }
  for (const o of O.obst) {
    if (o.fly > 0 && o.mesh) {
      o.fly -= dt; o.vel.y -= 46 * dt; o.mesh.position.addScaledVector(o.vel, dt); o.mesh.rotation.x += o.spin * dt; o.mesh.rotation.z += o.spin * 0.7 * dt;
      if (o.fly <= 0) o.mesh.visible = false;
    }
    if (o.down) { o.respT -= dt; if (o.respT <= 0) { o.down = false; if (o.mesh) { o.mesh.visible = true; o.mesh.position.copy(o.home); o.mesh.quaternion.copy(o.homeQ); } } }
  }
  for (const g of O.gates) {
    if (g.kind === "door") { const ph = (time % g.period) / g.period; g.closed = ph > 0.55; if (g.wall) g.wall.position.y = THREE.MathUtils.lerp(g.wall.position.y, g.closed ? 3 : 9, Math.min(1, dt * 6)); }
    if (g.kind === "lap" && g.mesh) g.mesh.visible = T.lap < g.lap;
    if (g.kind === "switch" && g.wall) g.wall.rotation.z = THREE.MathUtils.lerp(g.wall.rotation.z, g.switched ? 1.4 : 0, Math.min(1, dt * 5));
    if (g.broken > 0) {
      g.broken -= dt;
      if (g.mesh) {
        if (g.flyT > 0) { g.flyT -= dt; g.mesh.position.y += 10 * dt; g.mesh.scale.multiplyScalar(Math.exp(-dt * 2)); g.mesh.rotation.z += dt * 3; if (g.flyT <= 0) g.mesh.visible = false; }
        if (g.broken <= 0) { g.mesh.visible = true; g.mesh.scale.setScalar(1); g.mesh.rotation.z = 0; orient(g.mesh, g.b.S[g.i], 0, 0); }
      }
    }
    if (g.switched > 0) { g.switched -= dt; if (g.switched <= 0) g.switched = 0; }
  }
  if (T.lapMeshes) for (const pt of T.lapMeshes) pt.mesh.visible = T.lapOk(pt, T.lap);
}
export function buildCore(c, groundY) {
  const g = new THREE.Group();
  const top = c.y + Math.max(0, c.dy) + (c.extra || 10);
  const H = top - groundY;
  const R = c.w || Math.max(6, c.r - 16);
  switch (c.k) {
    case "tower": case "apartment": case "sky": {
      const tex = new THREE.CanvasTexture((() => { const cv = document.createElement("canvas"); cv.width = 64; cv.height = 128; const x = cv.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, 64, 128); for (let y = 4; y < 128; y += 12) for (let xx = 4; xx < 64; xx += 12) { x.fillStyle = Math.random() < 0.35 ? "#ffe9a8" : "#4a5868"; x.fillRect(xx, y, 8, 8); } return cv; })());
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(4, H / 14); tex.colorSpace = THREE.SRGBColorSpace;
      const b = new THREE.Mesh(new THREE.BoxGeometry(R * 1.35, H, R * 1.35), new THREE.MeshLambertMaterial({ map: tex, color: c.c || 0xe8dcc8 }));
      b.position.set(c.x, groundY + H / 2, c.z); g.add(b);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(R * 1.4, 1, R * 1.4), L(0x555555)); roof.position.set(c.x, groundY + H, c.z); g.add(roof);
      if (c.k === "sky") { const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.8, 30, 6), L(0xdddddd)); ant.position.set(c.x, groundY + H + 15, c.z); g.add(ant); }
      break;
    }
    case "rock": { const m = new THREE.Mesh(new THREE.ConeGeometry(R * 1.1, H * 1.3, 8), L(c.c || 0x8a8478, { flatShading: true })); m.position.set(c.x, groundY + H * 0.55, c.z); g.add(m); break; }
    case "castle": { const m = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 1.05, H, 16), L(0xd8d0c0)); m.position.set(c.x, groundY + H / 2, c.z); const r = new THREE.Mesh(new THREE.ConeGeometry(R * 1.2, R * 1.6, 16), L(0x3a5a9a)); r.position.set(c.x, groundY + H + R * 0.8, c.z); g.add(m, r); break; }
    case "lighthouse": { for (let k = 0; k < 6; k++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(R * (0.8 - k * 0.04), R * (0.84 - k * 0.04), H / 6, 16), L(k % 2 ? 0xffffff : 0xdd2222)); m.position.set(c.x, groundY + H / 12 + k * H / 6, c.z); g.add(m); } const l = new THREE.Mesh(new THREE.SphereGeometry(R * 0.5, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffaa })); l.position.set(c.x, groundY + H + 2, c.z); g.add(l); break; }
    case "tree": { const m = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.7, R, H, 10), L(0x6b4423)); m.position.set(c.x, groundY + H / 2, c.z); const cr = new THREE.Mesh(new THREE.IcosahedronGeometry(R * 2.4, 1), L(c.c || 0x3a9a40, { flatShading: true })); cr.position.set(c.x, groundY + H + R, c.z); g.add(m, cr); break; }
    case "silo": { const m = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 16), L(0xc0c4c8)); m.position.set(c.x, groundY + H / 2, c.z); const d = new THREE.Mesh(new THREE.SphereGeometry(R, 16, 8, 0, 6.3, 0, 1.6), L(0xa0a4a8)); d.position.set(c.x, groundY + H, c.z); g.add(m, d); break; }
    case "pit": break;
    default: return null;
  }
  return g;
}
