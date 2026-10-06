import * as THREE from "three";
import { envOf } from "./envs.js";
import { PS } from "./track.js";

const V3 = THREE.Vector3;
const L = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const dummy = new THREE.Object3D(), col = new THREE.Color();

let winTex, timberTex;
function windowTexture() {
  if (winTex) return winTex;
  const c = document.createElement("canvas"); c.width = 64; c.height = 128; const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 128; y += 14) for (let x = 5; x < 64; x += 14) { g.fillStyle = Math.random() < 0.3 ? "#ffe9a8" : "#5a6878"; g.fillRect(x, y, 9, 9); }
  winTex = new THREE.CanvasTexture(c); winTex.colorSpace = THREE.SRGBColorSpace; return winTex;
}
function timberTexture() {
  if (timberTex) return timberTex;
  const c = document.createElement("canvas"); c.width = 64; c.height = 64; const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, 64, 64);
  g.strokeStyle = "#4a2a14"; g.lineWidth = 4; g.strokeRect(2, 2, 60, 60); g.beginPath(); g.moveTo(0, 32); g.lineTo(64, 32); g.moveTo(32, 0); g.lineTo(32, 64); g.moveTo(0, 0); g.lineTo(32, 32); g.moveTo(64, 0); g.lineTo(32, 32); g.stroke();
  g.fillStyle = "#6a8aa8"; g.fillRect(8, 40, 14, 14); g.fillRect(42, 40, 14, 14); g.fillRect(8, 8, 14, 14); g.fillRect(42, 8, 14, 14);
  timberTex = new THREE.CanvasTexture(c); timberTex.colorSpace = THREE.SRGBColorSpace; return timberTex;
}
const GEO = () => ({
  box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 10), cone: new THREE.ConeGeometry(0.5, 1, 7), cone4: new THREE.ConeGeometry(0.5, 1, 4),
  ico: new THREE.IcosahedronGeometry(0.5, 0), sph: new THREE.SphereGeometry(0.5, 10, 7), dodec: new THREE.DodecahedronGeometry(0.5, 0), tent: new THREE.ConeGeometry(0.5, 1, 10),
});
class Inst {
  constructor() { this.lists = {}; }
  add(type, x, y, z, sx, sy, sz, c = 0xffffff, r = 0, rx = 0) { (this.lists[type] = this.lists[type] || []).push([x, y, z, sx, sy, sz, c, r, rx]); }
  build(group) {
    const G = GEO();
    const M = {
      box: L(0xffffff), boxF: L(0xffffff, { flatShading: true }), bldg: new THREE.MeshLambertMaterial({ map: windowTexture() }), house: new THREE.MeshLambertMaterial({ map: timberTexture() }),
      glow: new THREE.MeshBasicMaterial({ color: 0xffffff }), cyl: L(0xffffff), cone: L(0xffffff, { flatShading: true }), cone4: L(0xffffff, { flatShading: true }), ico: L(0xffffff, { flatShading: true }),
      sph: L(0xffffff), dodec: L(0xffffff, { flatShading: true }), tent: L(0xffffff, { flatShading: true }), cloud: L(0xffffff, { flatShading: true, emissive: 0x555566 }),
    };
    const geoOf = { box: "box", boxF: "box", bldg: "box", house: "box", glow: "box", cyl: "cyl", cone: "cone", cone4: "cone4", ico: "ico", sph: "sph", dodec: "dodec", tent: "tent", cloud: "ico", glowS: "sph" };
    M.glowS = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (const k in this.lists) {
      const l = this.lists[k]; if (!l.length) continue;
      const m = new THREE.InstancedMesh(G[geoOf[k]], M[k], l.length);
      l.forEach((it, i) => {
        dummy.position.set(it[0], it[1], it[2]); dummy.scale.set(it[3], it[4], it[5]); dummy.rotation.set(it[8], it[7], 0); dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix); m.setColorAt(i, col.set(it[6]));
      });
      m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
      group.add(m);
    }
  }
}

// ---------------- supports ----------------
export function buildSupports(T, group) {
  const I = new Inst(), gy = T.groundY;
  for (const p of T.paths) {
    const S = p.S;
    for (let i = 0; i < S.length; i += 1) {
      const s = S[i]; if (s.hide || s.elev < 4 || s.up.y < 0.5) continue;
      const E = envOf(s.env), sup = E.sup || (s.encl ? "pillar" : "pillar");
      if (sup === "none") continue;
      const h = s.elev - 1.2, W = s.hw + (s.sh ? s.shw : 0), yaw = Math.atan2(s.t.x, s.t.z);
      const mid = gy + h / 2;
      if (sup === "rock") { if (i % 5) continue; const w = W * 2.4 + h * 0.5; I.add("dodec", s.x, gy + h * 0.42, s.z, w, h * 1.1, w * 0.8, pick([0x8a8478, 0x7a7468, 0x9a9080]), yaw); }
      else if (sup === "building") { if (i % 6) continue; I.add("bldg", s.x, mid - 0.5, s.z, W * 2 + 4, h, 18, pick([0xe8dcc8, 0xd8c8b0, 0xc8d0d8, 0xf0e8d8]), yaw); }
      else if (sup === "wall") { if (i % 2) continue; I.add("box", s.x, mid, s.z, W * 2 + 4, h, 3.2, 0xa8a8a0, yaw); }
      else if (sup === "train") { if (i % 2) continue; I.add("box", s.x, s.y - 2.6, s.z, W * 2 - 1, 4.2, 3, i % 16 < 2 ? 0x222222 : 0xf0f0f0, yaw); I.add("box", s.x, s.y - 3.2, s.z, W * 2 - 0.8, 0.6, 3.1, 0xdd0000, yaw); if (i % 8 === 0) I.add("cyl", s.x, s.y - 5, s.z, 1.6, W * 2, 1.6, 0x222222, yaw, Math.PI / 2); }
      else if (sup === "ship") { if (i % 3) continue; I.add("box", s.x, s.y - 4, s.z, W * 2 + 6, 8, 8, 0x2a4a8a, yaw); }
      else if (sup === "truss") { if (i % 6) continue; for (const sd of [-1, 1]) { const q = PS(s, sd * (W - 0.5), 0, new V3()); I.add("box", q.x, (q.y + gy) / 2 - 0.6, q.z, 0.7, q.y - gy, 0.7, 0xc84a2a); } }
      else if (sup === "cable") { if (i % 40) continue; for (const sd of [-1, 1]) { const q = PS(s, sd * (W + 1), 0, new V3()); I.add("box", q.x, (q.y + gy) / 2 + 12, q.z, 2, q.y - gy + 24, 2, 0xc84a2a); } }
      else { if (i % 8) continue; I.add("cyl", s.x, mid - 0.6, s.z, 3.4, h, 3.4, 0xb0aca4); I.add("box", s.x, s.y - 1.6, s.z, W * 1.6, 1, 3, 0xa09c94, yaw); }
    }
  }
  I.build(group);
}

// ---------------- outdoor decor ----------------
export function buildDecor(T, group) {
  const I = new Inst(), gy = T.groundY;
  const clear = (x, z, m, y) => {
    let ok = true;
    T.query(x, z, 40, (s) => { if (!ok) return; if (Math.abs(s.y - y) > 30 && y < s.y - 30) { /* far below road: only block under narrow */ const d = Math.hypot(s.x - x, s.z - z); if (d < s.hw + 2) ok = false; return; } const d = Math.hypot(s.x - x, s.z - z); if (d < s.hw + (s.sh ? s.shw : 0) + m) ok = false; });
    return ok;
  };
  const tree = (x, z, y = gy) => { const h = rnd(6, 12); I.add("ico", x, y + h * 0.75, z, h * 0.75, h * 0.75, h * 0.75, pick([0x3f8a3a, 0x4a9a3a, 0x5aa040, 0x2f7a35])); I.add("cyl", x, y + h * 0.25, z, 0.9, h * 0.5, 0.9, 0x6b4423); };
  const pine = (x, z, y = gy, snow) => { const h = rnd(10, 22); I.add("cone", x, y + h * 0.55, z, h * 0.36, h, h * 0.36, snow ? 0x3a6a55 : pick([0x2a6a35, 0x24603a, 0x2f7040])); if (snow) I.add("cone", x, y + h * 0.85, z, h * 0.18, h * 0.35, h * 0.18, 0xffffff); I.add("cyl", x, y + 1.5, z, 1, 3, 1, 0x6b4423); };
  const house = (x, z, r, y = gy) => { const h = rnd(7, 12), w = rnd(8, 12); I.add("house", x, y + h / 2, z, w, h, w * 0.9, pick([0xffffff, 0xf3e3c3, 0xffe0b0, 0xf0d0d0]), r); I.add("cone4", x, y + h + 3, z, w * 1.45, 6.5, w * 1.3, pick([0xb5452d, 0x8b3a24, 0x5a3a2a]), r + Math.PI / 4); };
  const bldg = (x, z, r, hmin, hmax, y = gy) => { const h = rnd(hmin, hmax), w = rnd(12, 24), d = rnd(12, 24); I.add("bldg", x, y + h / 2, z, w, h, d, pick([0xd9cbb3, 0xbfb4a3, 0xa3a9b3, 0xe3d3c3, 0x9aa3b3, 0xc8b8a0]), r); };
  const kits = {
    city: { n: 0.9, near: 4, far: 70, m: 12, fn: (x, z, r) => bldg(x, z, r, 14, 60) },
    rural: { n: 0.6, near: 4, far: 100, m: 5, fn: (x, z, r) => Math.random() < 0.85 ? tree(x, z) : house(x, z, r) },
    village: { n: 0.7, near: 3, far: 60, m: 8, fn: (x, z, r) => Math.random() < 0.65 ? house(x, z, r) : tree(x, z) },
    highway: { n: 0.4, near: 8, far: 140, m: 6, fn: (x, z, r) => Math.random() < 0.8 ? tree(x, z) : bldg(x, z, r, 8, 24) },
    bridge: { n: 0.05, near: 30, far: 120, m: 10, fn: (x, z) => tree(x, z) },
    alpine: { n: 0.7, near: 3, far: 110, m: 4, fn: (x, z) => Math.random() < 0.85 ? pine(x, z) : I.add("dodec", x, gy + 3, z, rnd(5, 12), rnd(4, 9), rnd(5, 12), 0x8a8478) },
    snowy: { n: 0.7, near: 3, far: 110, m: 4, fn: (x, z) => Math.random() < 0.8 ? pine(x, z, gy, true) : I.add("sph", x, gy, z, rnd(6, 14), rnd(3, 6), rnd(6, 14), 0xffffff) },
    forest: { n: 1.6, near: 2, far: 70, m: 3, fn: (x, z) => Math.random() < 0.8 ? pine(x, z) : tree(x, z) },
    farm: { n: 0.5, near: 5, far: 110, m: 6, fn: (x, z, r) => { const q = Math.random(); if (q < 0.35) I.add("cyl", x, gy + 1.3, z, 2.6, 2.4, 2.6, 0xe0c060, r, Math.PI / 2); else if (q < 0.5) { I.add("box", x, gy + 5, z, 12, 10, 16, 0xb03a24, r); I.add("cone4", x, gy + 13, z, 14, 6, 18, 0x5a3a2a, r + Math.PI / 4); } else if (q < 0.65) { I.add("box", x, gy + 1.8, z, 1.6, 1.5, 3, 0xffffff, r); I.add("box", x, gy + 2.4, z + 1.8, 1, 1, 1, 0xffffff, r); } else tree(x, z); } },
    vineyard: { n: 1.3, near: 2, far: 60, m: 2.5, fn: (x, z, r) => I.add("box", x, gy + 1.2, z, 1.4, 2.4, 9, 0x3e7a2a, r) },
    beach: { n: 0.5, near: 3, far: 60, m: 3, fn: (x, z) => { const q = Math.random(); if (q < 0.4) { I.add("cyl", x, gy + 4, z, 0.6, 8, 0.6, 0x9a7a4a); I.add("ico", x, gy + 8.5, z, 6, 1.8, 6, 0x3aa040); } else if (q < 0.7) { I.add("cone", x, gy + 3, z, 5, 1.2, 5, pick([0xff4040, 0x40a0ff, 0xffd23f, 0xffffff])); I.add("cyl", x, gy + 1.4, z, 0.2, 3, 0.2, 0xffffff); } else I.add("box", x, gy + 1.5, z, 2.5, 3, 2.5, pick([0x3a6ad8, 0xd83a3a, 0xffffff, 0x3ad86a])); } },
    river: { n: 0.6, near: 3, far: 80, m: 4, fn: (x, z) => Math.random() < 0.75 ? tree(x, z) : I.add("dodec", x, gy + 1, z, rnd(3, 6), rnd(2, 4), rnd(3, 6), 0x9a948c) },
    harbor: { n: 0.9, near: 3, far: 80, m: 5, fn: (x, z, r) => { if (Math.random() < 0.85) { const st = Math.floor(rnd(1, 5)); const c = pick([0xc0392b, 0x2980b9, 0x27ae60, 0xf39c12, 0x8e44ad, 0xd35400]); for (let k = 0; k < st; k++) I.add("box", x, gy + 1.5 + k * 3, z, 3, 3, 8, k % 2 ? c : pick([0xc0392b, 0x2980b9, 0x27ae60]), r); } else { I.add("box", x, gy + 20, z, 2, 40, 2, 0xe8a010); I.add("box", x, gy + 40, z + 8, 2, 2, 28, 0xe8a010, r); } } },
    industrial: { n: 0.6, near: 4, far: 100, m: 8, fn: (x, z, r) => { const q = Math.random(); if (q < 0.3) I.add("cyl", x, gy + 20, z, 4, 40, 4, 0xb06050); else if (q < 0.6) I.add("cyl", x, gy + 6, z, 12, 12, 12, 0xc0c4c8); else I.add("box", x, gy + 8, z, 24, 16, 30, 0x8a7060, r); } },
    construction: { n: 0.7, near: 3, far: 70, m: 4, fn: (x, z, r) => { const q = Math.random(); if (q < 0.3) I.add("cone", x, gy + 0.9, z, 1.4, 1.8, 1.4, 0xff6a00); else if (q < 0.5) { I.add("box", x, gy + 25, z, 1.6, 50, 1.6, 0xffcc00); I.add("box", x + 10, gy + 50, z, 26, 1.4, 1.4, 0xffcc00); } else if (q < 0.75) I.add("sph", x, gy, z, rnd(8, 14), rnd(4, 8), rnd(8, 14), 0xa07a4a); else I.add("box", x, gy + 6, z, 10, 12, 10, 0xbbbbbb, r); } },
    airport: { n: 0.25, near: 10, far: 160, m: 12, fn: (x, z, r) => { if (Math.random() < 0.5) { I.add("cyl", x, gy + 3, z, 4, 30, 4, 0xffffff, r, Math.PI / 2); I.add("box", x, gy + 3, z, 32, 0.6, 5, 0xffffff, r); I.add("box", x, gy + 6, z - 13, 0.6, 7, 4, 0xdd2222, r); } else I.add("cyl", x, gy + 0.2, z, 10, 0.4, 10, 0x777777); } },
    roof: { n: 0.5, near: 1, far: 60, m: 6, fn: (x, z, r) => bldg(x, z, r, 20, 90) },
    sky: { n: 0.12, near: 20, far: 260, m: 30, fn: (x, z, r, s) => { const y = s.y + rnd(-90, 40); if (Math.random() < 0.6) { const w = rnd(14, 40); I.add("cloud", x, y, z, w, w * 0.35, w * 0.6, 0xffffff, r); I.add("cloud", x + w * 0.3, y + 3, z, w * 0.6, w * 0.3, w * 0.5, 0xffffff, r); } else { const w = rnd(14, 30); I.add("cone", x, y - w * 0.6, z, w, w * 1.4, w, 0x8a6a4a, 0, Math.PI); I.add("cyl", x, y + 0.5, z, w, 1.4, w, 0x5aa040); if (Math.random() < 0.6) tree(x, z, y + 1); } } },
    fair: { n: 0.7, near: 3, far: 70, m: 6, fn: (x, z) => { const q = Math.random(); if (q < 0.5) { I.add("tent", x, gy + 5, z, 9, 10, 9, pick([0xff3b3b, 0xffdd00, 0x2a9df4, 0xff7ab8, 0xffffff])); I.add("cyl", x, gy + 2, z, 8.6, 4, 8.6, 0xf5f5f5); } else if (q < 0.7) I.add("sph", x, gy + rnd(12, 30), z, 2.4, 3, 2.4, pick([0xff3b3b, 0xffdd00, 0x2a9df4, 0xff7ab8])); else tree(x, z); } },
    fairy: { n: 0.9, near: 3, far: 90, m: 4, fn: (x, z) => { const q = Math.random(); if (q < 0.5) { const h = rnd(6, 12); I.add("sph", x, gy + h, z, h * 1.1, h * 0.9, h * 1.1, pick([0xff7ab8, 0x7ae0ff, 0xfff07a, 0xb07aff, 0x7aff9a])); I.add("cyl", x, gy + h / 2, z, 1.2, h, 1.2, 0xffffff); } else if (q < 0.8) { const r = rnd(2, 5); I.add("sph", x, gy + r * 0.9, z, r * 2, r, r * 2, pick([0xff3b3b, 0xff9ad5])); I.add("cyl", x, gy + r * 0.4, z, r * 0.6, r * 0.8, r * 0.6, 0xfff4e0); } else I.add("box", x, gy + 3, z, 6, 6, 6, pick([0x8a5a2a, 0xffffff]), Math.random()); } },
    castle: { n: 0.5, near: 4, far: 90, m: 5, fn: (x, z, r) => Math.random() < 0.7 ? pine(x, z) : (I.add("cyl", x, gy + 9, z, 7, 18, 7, 0xd8d0c0), I.add("cone", x, gy + 22, z, 9, 9, 9, 0x3a5a9a)) },
  };
  for (const p of T.paths) {
    const S = p.S;
    for (let i = 0; i < S.length; i += 2) {
      const s = S[i]; if (s.encl) continue;
      const E = envOf(s.env), kit = kits[E.decor]; if (!kit) continue;
      if (Math.random() > kit.n * 0.5) continue;
      const side = Math.random() < 0.5 ? -1 : 1;
      const d = s.hw + (s.sh ? s.shw : 0) + kit.m + rnd(kit.near, kit.far);
      const rh = new V3(s.r.x, 0, s.r.z).normalize();
      const x = s.x + rh.x * side * d, z = s.z + rh.z * side * d;
      if (!clear(x, z, kit.m, E.decor === "sky" ? s.y : gy)) continue;
      kit.fn(x, z, Math.atan2(s.t.x, s.t.z), s);
    }
  }
  // distant mountain ring
  const th = T.def.theme || {};
  if (th.mtns) {
    let cx = 0, cz = 0; for (const s of T.S) { cx += s.x; cz += s.z; } cx /= T.N; cz /= T.N;
    let R = 0; for (const s of T.S) R = Math.max(R, Math.hypot(s.x - cx, s.z - cz));
    const [n, colr, snow] = th.mtns;
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2 + rnd(0, 0.3), r = R + rnd(350, 750), h = rnd(220, 520);
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      I.add("cone", x, gy + h / 2 - 5, z, h * 1.1, h, h * 1.1, colr || 0x7a8a9a);
      if (snow) I.add("cone", x, gy + h * 0.8, z, h * 0.44, h * 0.4 + 2, h * 0.44, 0xffffff);
    }
  }
  I.build(group);
}

// ---------------- indoor props ----------------
export function buildProps(T, group) {
  const I = new Inst();
  const at = (s, lat, h) => PS(s, lat, h, new V3());
  for (const p of T.paths) {
    const S = p.S;
    for (let i = 0; i < S.length; i++) {
      const s = S[i]; if (!s.encl || s.hide) continue;
      const E = envOf(s.env), W = s.hw + (s.sh ? s.shw : 0), H = s.ech, yaw = Math.atan2(s.t.x, s.t.z);
      const edge = W + 0.1;
      // ceiling lights
      if (i % 5 === 0 && s.encl !== "cave" && s.encl !== "mine") { const q = at(s, 0, H - 0.4); I.add("glow", q.x, q.y, q.z, Math.min(W, 8), 0.3, 1.2, E.light || 0xffffff, yaw); }
      const both = (fn) => { fn(-1); fn(1); };
      switch (E.props) {
        case "subway": if (i % 8 === 0) both(sd => { const q = at(s, sd * (s.hw + 1), H / 2); I.add("box", q.x, q.y, q.z, 1.2, H, 1.2, 0x3a7ad8, yaw); }); break;
        case "pipes": if (i % 3 === 0) both(sd => { const q = at(s, sd * (W - 0.4), H * 0.55); I.add("cyl", q.x, q.y, q.z, 1.1, 3, 1.1, 0x6a7a5a, yaw, Math.PI / 2); }); if (i % 7 === 0) { const q = at(s, (Math.random() - 0.5) * W * 2, 0.2); I.add("glowS", q.x, q.y, q.z, 1.2, 0.3, 1.2, 0x9aff7a); } break;
        case "mushrooms": if (i % 3 === 0) { const sd = Math.random() < 0.5 ? -1 : 1, q = at(s, sd * (W - 1), 0), h = rnd(1, 4); I.add("cyl", q.x, q.y + h / 2, q.z, 0.5, h, 0.5, 0xfff0e0); I.add("glowS", q.x, q.y + h, q.z, h * 1.2, h * 0.5, h * 1.2, pick([0x66ffcc, 0xff66ee, 0x66aaff])); } if (i % 5 === 0) { const q = at(s, (Math.random() - 0.5) * W * 1.6, H * 0.8); I.add("cone", q.x, q.y, q.z, 1.2, 4, 1.2, 0x5a4a6a, 0, Math.PI); } break;
        case "minebeams": if (i % 6 === 0) { both(sd => { const q = at(s, sd * (W - 0.3), H * 0.45); I.add("box", q.x, q.y, q.z, 0.8, H * 0.9, 0.8, 0x6b4a2a, yaw); }); const q = at(s, 0, H * 0.88); I.add("box", q.x, q.y, q.z, W * 2, 0.8, 0.8, 0x6b4a2a, yaw); const l = at(s, 0, H * 0.75); I.add("glowS", l.x, l.y, l.z, 0.7, 0.9, 0.7, 0xffb040); } break;
        case "garage": if (i % 10 === 0) both(sd => { const q = at(s, sd * (s.hw + 0.8), H / 2); I.add("box", q.x, q.y, q.z, 1.4, H, 1.4, 0xb0b0b0, yaw); }); if (i % 4 === 0 && s.shw > 2.5) { const sd = i % 8 ? 1 : -1, q = at(s, sd * (W - 1.6), 0.9); I.add("box", q.x, q.y, q.z, 4.4, 1.6, 2.2, pick([0x2a6ad8, 0xd83a3a, 0xf0f0f0, 0x333333, 0xffd23f, 0x3ad86a]), yaw); } break;
        case "lobby": if (i % 9 === 0) both(sd => { const q = at(s, sd * (W - 1), 0); I.add("cyl", q.x, q.y + 0.6, q.z, 1.4, 1.2, 1.4, 0xb08850); I.add("ico", q.x, q.y + 2.4, q.z, 2.4, 2.8, 2.4, 0x3a9a40); }); if (i % 14 === 0) both(sd => { const q = at(s, sd * (s.hw + 1.5), H / 2); I.add("cyl", q.x, q.y, q.z, 1.6, H, 1.6, 0xf0e8d8); }); break;
        case "hallway": if (i % 4 === 0) both(sd => { const q = at(s, sd * (W + 0.2), 1.6); I.add("box", q.x, q.y, q.z, 0.3, 3.2, 1.8, pick([0x8a5a2a, 0x6a4a2a, 0xa06a3a]), yaw); }); if (i % 6 === 3) both(sd => { const q = at(s, sd * (W + 0.25), 3.6); I.add("box", q.x, q.y, q.z, 0.2, 1.2, 1.6, pick([0xffd23f, 0x3a8ad8, 0xd83a3a]), yaw); }); break;
        case "apartment": if (i % 5 === 0) { const sd = (i / 5) % 2 ? 1 : -1, q = at(s, sd * (W - 1.3), 0); const c = pick([0x3a6ad8, 0xd83a3a, 0x8a5a2a, 0x3ad86a]); I.add("box", q.x, q.y + 0.5, q.z, 2.2, 1, 4, c, yaw); I.add("box", q.x + s.r.x * sd * 0.8, q.y + 1.3, q.z + s.r.z * sd * 0.8, 0.6, 1.4, 4, c, yaw); } if (i % 7 === 2) both(sd => { const q = at(s, sd * (W + 0.2), 2.6); I.add("glow", q.x, q.y, q.z, 0.2, 1.6, 2.6, 0x8fd0ff, yaw); }); break;
        case "mall": if (i % 4 === 0) both(sd => { const q = at(s, sd * (W + 0.1), 3.5); I.add("box", q.x, q.y, q.z, 0.4, 7, 9, pick([0xff6fb5, 0x6fd0ff, 0xffd23f, 0x7aff9a, 0xff8a3a, 0xb07aff]), yaw); const g = at(s, sd * (W - 0.1), 7.8); I.add("glow", g.x, g.y, g.z, 0.3, 1.2, 7, pick([0xffffff, 0xffee88]), yaw); }); if (i % 11 === 5) { const q = at(s, 0, 0); I.add("ico", q.x + s.r.x * (s.hw + 2), q.y + 2, q.z + s.r.z * (s.hw + 2), 3, 4, 3, 0x3a9a40); } break;
        case "food": if (i % 3 === 0) { const sd = Math.random() < 0.5 ? -1 : 1, q = at(s, sd * rnd(s.hw + 1, W - 1), 0); I.add("cyl", q.x, q.y + 1.1, q.z, 2.4, 0.2, 2.4, 0xffffff); I.add("cyl", q.x, q.y + 0.55, q.z, 0.2, 1.1, 0.2, 0x888888); I.add("cone", q.x, q.y + 3.6, q.z, 3.4, 1, 3.4, pick([0xff3b3b, 0xffdd00, 0x2a9df4])); } if (i % 6 === 0) both(sd => { const q = at(s, sd * (W + 0.1), 3); I.add("box", q.x, q.y, q.z, 0.6, 6, 7, pick([0xff8a00, 0xdd0000, 0xffd23f, 0x2a9d4f]), yaw); }); break;
        case "shelves": if (i % 2 === 0) both(sd => { const q = at(s, sd * (W - 0.6), 1.8); I.add("box", q.x, q.y, q.z, 1.2, 3.6, 2.5, 0xe8e8e8, yaw); for (let k = 0; k < 3; k++) { const b = at(s, sd * (W - 0.8), 0.6 + k * 1.1); I.add("box", b.x, b.y, b.z, 0.8, 0.7, 2.2, pick([0xff3b3b, 0xffdd00, 0x2a9df4, 0x7aff9a, 0xff8a3a]), yaw); } }); break;
        case "crates": if (i % 3 === 0) { const sd = Math.random() < 0.5 ? -1 : 1, q = at(s, sd * (W - 1.4), 0), st = 1 + Math.floor(Math.random() * 3); for (let k = 0; k < st; k++) I.add("box", q.x, q.y + 1.1 + k * 2.2, q.z, 2.2, 2.2, 2.2, pick([0xb07a3a, 0x9a6a2a, 0x2a6ad8]), yaw + Math.random() * 0.3); } break;
        case "castlehall": if (i % 6 === 0) both(sd => { const q = at(s, sd * (W - 0.6), H / 2); I.add("box", q.x, q.y, q.z, 1.8, H, 1.8, 0xb8a888, yaw); const b = at(s, sd * (W + 0.2), H * 0.65); I.add("box", b.x, b.y, b.z, 0.2, H * 0.4, 3, 0x8a1a2a, yaw); const t = at(s, sd * (W - 0.4), H * 0.4); I.add("glowS", t.x, t.y, t.z, 0.7, 1.1, 0.7, 0xffa040); }); if (i % 12 === 6) { const q = at(s, 0, H * 0.7); I.add("cyl", q.x, q.y, q.z, 6, 0.6, 6, 0xd4af37); I.add("glowS", q.x, q.y - 0.6, q.z, 5, 0.8, 5, 0xffe0a0); } break;
        case "torches": if (i % 4 === 0) both(sd => { const q = at(s, sd * (W + 0.1), 3.4); I.add("glowS", q.x, q.y, q.z, 0.8, 1.2, 0.8, 0xff9a30); }); break;
        case "cathedral": if (i % 5 === 0) both(sd => { const q = at(s, sd * (W - 1), H / 2); I.add("cyl", q.x, q.y, q.z, 2.6, H, 2.6, 0x9a9488); const g = at(s, sd * (W + 0.3), H * 0.6); I.add("glow", g.x, g.y, g.z, 0.2, H * 0.4, 3.5, pick([0x4466cc, 0xcc3344, 0xffcc44, 0x44cc77]), yaw); }); break;
        case "beertent": if (i % 3 === 0) both(sd => { const q = at(s, sd * (W - 2), 0); I.add("box", q.x, q.y + 1.1, q.z, 1.8, 0.2, 5, 0x9a6a3a, yaw); I.add("cyl", q.x, q.y + 1.6, q.z, 0.5, 0.9, 0.5, 0xffd23f); }); if (i % 2 === 0) { const q = at(s, (i % 4 ? -1 : 1) * W * 0.6, H * 0.7); I.add("box", q.x, q.y, q.z, 0.8, 0.8, 0.1, i % 4 ? 0x2a6fdb : 0xffffff, yaw); } break;
        case "barn": if (i % 3 === 0) { const sd = Math.random() < 0.5 ? -1 : 1, q = at(s, sd * (W - 1.6), 0); I.add("cyl", q.x, q.y + 1.3, q.z, 2.6, 2.4, 2.6, 0xe0c060, yaw, Math.PI / 2); } break;
        case "terminal": if (i % 6 === 0) both(sd => { const q = at(s, sd * (W - 1), 0.5); I.add("box", q.x, q.y, q.z, 1.2, 1, 6, 0x3a4a6a, yaw); const b = at(s, sd * (W + 0.2), 5); I.add("glow", b.x, b.y, b.z, 0.2, 2, 6, 0x111133, yaw); const y2 = at(s, sd * (W + 0.1), 5); I.add("glow", y2.x, y2.y + 0.6, y2.z, 0.25, 0.3, 5, 0xffd23f, yaw); }); break;
      }
    }
  }
  I.build(group);
}
