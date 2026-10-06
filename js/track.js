import * as THREE from "three";
import { envOf, surfMat, wallTex } from "./envs.js";
import { buildDecor, buildProps, buildSupports } from "./decor.js";
import { buildLandmark, makeSky, buildDecor as sceneryKit } from "./scenery.js";
import { buildEvents } from "./dyn.js";
import { addFeature, addGate, buildCore, groundTex, updateFeatures } from "./trackfeat.js";

export const SP = 2.5;
const V3 = THREE.Vector3, Y = new V3(0, 1, 0);
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const sstep = (x) => x * x * (3 - 2 * x);

// ---------------- raw generation ----------------
function segAttrs(sg, si, def) {
  const E = envOf(sg.env);
  const hw = sg.hw || E.hw || def.hw || 11;
  return {
    env: sg.env, hw, seg: si, roll: sg.roll || 0, conv: sg.conv || 0,
    surf: sg.surf || E.surf, sh: sg.sh !== undefined ? sg.sh : E.sh, shw: sg.shw !== undefined ? sg.shw : (E.shw || 0),
    wallL: sg.wallL !== undefined ? sg.wallL : sg.wall !== undefined ? sg.wall : E.wall, wallR: sg.wallR !== undefined ? sg.wallR : sg.wall !== undefined ? sg.wall : E.wall,
    wh: sg.wh || E.wh || 1.2, encl: sg.encl !== undefined ? sg.encl : E.encl, ech: sg.ech || E.ech || 9, soft: sg.soft !== undefined ? sg.soft : E.soft, grind: sg.grind || 0,
  };
}
function genMain(def, cores) {
  const raw = [];
  const st = def.start || {};
  let x = st.x || 0, z = st.z || 0, y = st.y || 0, h = (st.h || 0) * Math.PI / 180;
  const x0 = x, z0 = z, y0s = y, h0 = h;
  def.segs.forEach((sg, si) => {
    const A = segAttrs(sg, si, def);
    if (sg.k === "S" || sg.k === "T") {
      const L = sg.k === "S" ? sg.len : Math.abs(sg.ang) * Math.PI / 180 * sg.r;
      const n = Math.max(2, Math.ceil(L)), ds = L / n, yb = y, dy = sg.dy || 0, sgn = Math.sign(sg.ang || 0);
      if (sg.k === "T" && sg.core) cores.push({ x: x + Math.cos(h) * sg.r * sgn, z: z - Math.sin(h) * sg.r * sgn, y: yb, dy, r: sg.r, ...sg.core });
      for (let k = 1; k <= n; k++) {
        if (sg.k === "T") h += sgn * ds / sg.r;
        x += Math.sin(h) * ds; z += Math.cos(h) * ds;
        const f = k / n; y = yb + dy * (sg.ease ? sstep(f) : f);
        raw.push({ ...A, x, y, z, f, cr: sg.cork ? sstep(f) * Math.PI * 2 * sg.cork : 0, lock: !!sg.cork || !!sg.lockY });
      }
    } else if (sg.k === "LOOP") {
      const R = sg.r || 14, sh = sg.shift || A.hw * 2 + 4, n = Math.ceil(Math.PI * 2 * R);
      const fx = Math.sin(h), fz = Math.cos(h), rx = -Math.cos(h), rz = Math.sin(h);
      const bx = x, bz = z, by = y;
      for (let k = 1; k <= n; k++) {
        const th = (k / n) * Math.PI * 2, fw = R * Math.sin(th), up = R * (1 - Math.cos(th)), la = sh * sstep(k / n);
        raw.push({ ...A, x: bx + fx * fw + rx * la, y: by + up, z: bz + fz * fw + rz * la, f: k / n, pt: true, lock: true, cr: 0, noLaunch: true, wallL: A.wallL || "low", wallR: A.wallR || "low", wh: 0.9 });
      }
      x = bx + rx * sh; z = bz + rz * sh; y = by;
    } else if (sg.k === "LIFT") {
      const H = sg.h, n = Math.ceil(Math.abs(H)), fwd = Math.abs(H) * 0.16, yb = y;
      for (let k = 1; k <= n; k++) { const f = k / n; raw.push({ ...A, x: x + Math.sin(h) * fwd * f, z: z + Math.cos(h) * fwd * f, y: yb + H * f, f, lift: sg.speed || 15, lock: true, cr: 0, noLaunch: true, hide: true }); }
      x += Math.sin(h) * fwd; z += Math.cos(h) * fwd; y = yb + H;
    }
  });
  const ex = x, ez = z, ey = y, eh = h;
  const D = Math.hypot(x0 - ex, z0 - ez);
  if (D > 1) {
    const m = D * 1.1, est = Math.ceil(D * 1.5);
    const A = segAttrs(def.segs[def.close || 0] || def.segs[0], -1, def);
    const m0x = Math.sin(eh) * m, m0z = Math.cos(eh) * m, m1x = Math.sin(h0) * m, m1z = Math.cos(h0) * m;
    for (let k = 1; k < est; k++) {
      const t = k / est, t2 = t * t, t3 = t2 * t;
      const a = 2 * t3 - 3 * t2 + 1, b = t3 - 2 * t2 + t, c = -2 * t3 + 3 * t2, d = t3 - t2;
      raw.push({ ...A, x: a * ex + b * m0x + c * x0 + d * m1x, z: a * ez + b * m0z + c * z0 + d * m1z, y: lerp(ey, y0s, sstep(t)), f: t, cr: 0 });
    }
  }
  raw.push({ ...segAttrs(def.segs[0], 0, def), x: x0, y: y0s, z: z0, f: 0, cr: 0, seg: -1 });
  return { raw, closeLen: D, endH: eh, endY: ey, endX: ex, endZ: ez };
}
function smoothY(raw, closed, win = 14, passes = 2) {
  const n = raw.length;
  for (let p = 0; p < passes; p++) {
    const ny = raw.map(r => r.y), nr = raw.map(r => r.roll);
    for (let i = 0; i < n; i++) {
      let sy = 0, sr = 0, c = 0, cr2 = 0;
      for (let k = -win; k <= win; k++) {
        let j = i + k; if (closed) j = (j + n) % n; else if (j < 0 || j >= n) continue;
        sr += raw[j].roll; cr2++;
        if (raw[j].lock) continue; sy += raw[j].y; c++;
      }
      if (!raw[i].lock) ny[i] = c ? sy / c : raw[i].y;
      nr[i] = sr / cr2;
    }
    raw.forEach((r, i) => { r.y = ny[i]; r.roll = nr[i]; });
  }
}
export function resample(raw, closed) {
  const n = raw.length, cum = [0];
  const segs = closed ? n : n - 1;
  for (let i = 1; i <= segs; i++) { const a = raw[i - 1], b = raw[i % n]; cum.push(cum[i - 1] + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)); }
  const L = cum[segs], N = Math.max(4, Math.round(L / SP)), sp = L / N;
  const out = []; let j = 0;
  const cnt = closed ? N : N + 1;
  for (let k = 0; k < cnt; k++) {
    const d = Math.min(L, k * sp);
    while (j < segs - 1 && cum[j + 1] < d) j++;
    const a = raw[j], b = raw[(j + 1) % n], f = clamp((d - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j]), 0, 1);
    const src = f < 0.5 ? a : b;
    out.push({ ...src, x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f), z: lerp(a.z, b.z, f), roll: lerp(a.roll, b.roll, f), cr: Math.abs(b.cr - a.cr) > 1 ? src.cr : lerp(a.cr, b.cr, f), d });
  }
  return { S: out, L, sp };
}
// ---------------- frames ----------------
function computeFrames(S, closed) {
  const N = S.length;
  const at = (i) => closed ? S[(i + N) % N] : S[clamp(i, 0, N - 1)];
  let prevUp = null;
  const kh = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = at(i - 1), b = at(i + 1), s = S[i];
    const t = new V3(b.x - a.x, b.y - a.y, b.z - a.z);
    if (t.lengthSq() < 1e-8) t.set(0, 0, 1);
    t.normalize(); s.t = t;
    const ya = Math.atan2(s.x - a.x, s.z - a.z), yb = Math.atan2(b.x - s.x, b.z - s.z);
    kh[i] = Math.hypot(t.x, t.z) > 0.3 ? angDiff(ya, yb) / (SP * 2) * 2 : 0;
  }
  const khS = new Float32Array(N);
  for (let i = 0; i < N; i++) { let sum = 0, c = 0; for (let k = -8; k <= 8; k++) { const j = closed ? (i + k + N) % N : i + k; if (j < 0 || j >= N) continue; sum += kh[j]; c++; } khS[i] = sum / c; }
  for (let i = 0; i < N; i++) {
    const s = S[i], t = s.t;
    let up;
    if (s.pt && prevUp) up = prevUp.clone().addScaledVector(t, -t.dot(prevUp));
    else { up = Y.clone().addScaledVector(t, -t.y); if (up.lengthSq() < 0.01 && prevUp) up = prevUp.clone().addScaledVector(t, -t.dot(prevUp)); }
    if (up.lengthSq() < 1e-6) up.set(0, 1, 0);
    up.normalize();
    if (!s.pt && prevUp && at(i - 1).pt) { const reg = up.clone(); up = prevUp.clone().addScaledVector(t, -t.dot(prevUp)).normalize().lerp(reg, 0.5).normalize(); }
    prevUp = up.clone();
    const r0 = new V3().crossVectors(t, up).normalize();
    s.kh = kh[i];
    const auto = s.pt || s.lift ? 0 : clamp(khS[i] * 11, -0.36, 0.36) * (s.env === "sky" || s.env === "coaster" ? 1.6 : 1);
    const b = s.roll + auto + s.cr;
    s.bank = b;
    s.up = up.clone().multiplyScalar(Math.cos(b)).addScaledVector(r0, -Math.sin(b)).normalize();
    s.r = r0.clone().multiplyScalar(Math.cos(b)).addScaledVector(up, Math.sin(b)).normalize();
  }
  for (let i = 0; i < N; i++) {
    const s = S[i], n = closed ? S[(i + 1) % N] : S[Math.min(N - 1, i + 1)];
    s.kv = n.t.clone().sub(s.t).dot(s.up) / SP;
    s.kt = new V3().crossVectors(s.t, n.t).dot(s.up) / SP;
  }
  for (let i = 0; i < N; i++) if (S[i].noLaunch) for (let k = -8; k <= 8; k++) { const j = closed ? (i + k + N) % N : i + k; if (j >= 0 && j < N) S[j].nl = true; }
}
// ---------------- crossing resolution ----------------
function resolveCrossings(S, closed, minSep = 13) {
  const N = S.length;
  let bumps = 0;
  // distance (in samples) to nearest locked sample
  const nl = new Int32Array(N).fill(9999);
  for (let pass = 0; pass < 2; pass++) for (let k = 0; k < N * 2; k++) { const i = closed ? k % N : Math.min(N - 1, k); if (!closed && k >= N) break; const p = closed ? (i - 1 + N) % N : i - 1; nl[i] = S[i].lock ? 0 : Math.min(nl[i], p >= 0 ? nl[p] + 1 : 9999); }
  for (let pass = 0; pass < 2; pass++) for (let k = N * 2 - 1; k >= 0; k--) { const i = closed ? k % N : k; if (!closed && k >= N) continue; const p = closed ? (i + 1) % N : i + 1; if (p < N) nl[i] = Math.min(nl[i], nl[p] + 1); }
  for (let iter = 0; iter < 6; iter++) {
    const add = new Float32Array(N);
    let changed = false;
    for (let i = 0; i < N; i += 2) {
      const a = S[i];
      for (let j = i + 40; j < N; j += 2) {
        if (closed && N - j + i < 40) continue;
        const b = S[j];
        const dx = a.x - b.x, dz = a.z - b.z, rr = a.hw + a.shw + b.hw + b.shw + 2;
        if (dx * dx + dz * dz > rr * rr) continue;
        const dy = b.y - a.y;
        if (Math.abs(dy) >= minSep) continue;
        const need = dy >= 0 ? minSep - dy + 1.5 : -(minSep + dy) - 1.5;
        const okA = nl[i] > 45, okB = nl[j] > 45;
        if (!okA && !okB) continue;
        if (okB && (nl[j] >= nl[i] || !okA)) { if (Math.abs(need) > Math.abs(add[j])) add[j] = need; }
        else if (Math.abs(need) > Math.abs(add[i])) add[i] = -need;
      }
    }
    const tot = new Float32Array(N);
    for (let j = 0; j < N; j++) if (add[j]) {
      changed = true; bumps++;
      for (let k = -44; k <= 44; k++) { const q = closed ? (j + k + N) % N : j + k; if (q < 0 || q >= N || S[q].lock) continue; const w = Math.exp(-(k * k) / (2 * 17 * 17)); const v = add[j] * w; if (Math.abs(v) > Math.abs(tot[q])) tot[q] = v; }
    }
    for (let q = 0; q < N; q++) S[q].y += tot[q];
    if (!changed) break;
  }
  return bumps;
}
// ---------------- geometry ----------------
class GeoBag {
  constructor() { this.m = {}; }
  quad(key, a, b, c, d, ua, ub, uc, ud) {
    const g = this.m[key] || (this.m[key] = { p: [], uv: [] });
    g.p.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z);
    g.uv.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1], ua[0], ua[1], uc[0], uc[1], ud[0], ud[1]);
  }
  build(group, matFn) {
    for (const k in this.m) {
      const g = this.m[k]; if (!g.p.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(g.p, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(g.uv, 2));
      geo.computeVertexNormals();
      group.add(new THREE.Mesh(geo, matFn(k)));
    }
  }
}
const mc = {};
function miscMat(key) {
  if (mc[key]) return mc[key];
  let m;
  if (key.startsWith("wall:")) m = new THREE.MeshLambertMaterial({ map: wallTex(key.slice(5)), side: THREE.DoubleSide, transparent: key.includes("glass"), opacity: key.includes("glass") ? 0.45 : 1 });
  else if (key.startsWith("encl:")) { const [, c, op] = key.split(":"); m = new THREE.MeshLambertMaterial({ color: +c, side: THREE.DoubleSide, transparent: op === "t", opacity: op === "t" ? 0.28 : 1, depthWrite: op !== "t" }); }
  else if (key.startsWith("shell:")) m = new THREE.MeshLambertMaterial({ map: shellTex(), color: +key.slice(6), side: THREE.DoubleSide });
  else if (key === "under") m = new THREE.MeshLambertMaterial({ color: 0x5a5650, side: THREE.DoubleSide });
  else if (key === "underSky") m = new THREE.MeshLambertMaterial({ color: 0x2a1a5a, emissive: 0x1a0a40, side: THREE.DoubleSide });
  else if (key === "rail") m = new THREE.MeshLambertMaterial({ color: 0xd8dde4, emissive: 0x444444, side: THREE.DoubleSide });
  else m = surfMat(key.replace("s:", ""));
  return (mc[key] = m);
}
let _shell;
function shellTex() {
  if (_shell) return _shell;
  const c = document.createElement("canvas"); c.width = 64; c.height = 64; const g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, 64, 64);
  for (let y = 8; y < 64; y += 28) for (let x = 6; x < 64; x += 20) { g.fillStyle = Math.random() < 0.4 ? "#ffe9a8" : "#6a7888"; g.fillRect(x, y, 10, 14); }
  _shell = new THREE.CanvasTexture(c); _shell.wrapS = _shell.wrapT = THREE.RepeatWrapping; _shell.colorSpace = THREE.SRGBColorSpace; return _shell;
}
const tA = new V3(), tB = new V3(), tC = new V3(), tD = new V3();
export function PS(s, lat, h, out) { return out.set(s.x + s.r.x * lat + s.up.x * h, s.y + s.r.y * lat + s.up.y * h, s.z + s.r.z * lat + s.up.z * h); }
function enclProfile(kind, W, H, i) {
  switch (kind) {
    case "box": case "shaft": return [[-W, 0], [-W, H], [W, H], [W, 0]];
    case "tent": return [[-W, 0], [-W, H * 0.55], [0, H], [W, H * 0.55], [W, 0]];
    case "station": { const o = []; for (let k = 0; k <= 8; k++) { const a = Math.PI * k / 8; o.push([-Math.cos(a) * W, Math.sin(a) * H]); } return o; }
    case "arch": case "glass": case "mine": { const o = [[-W, 0]]; for (let k = 0; k <= 8; k++) { const a = Math.PI * k / 8; o.push([-Math.cos(a) * W, H * 0.45 + Math.sin(a) * H * 0.55]); } o.push([W, 0]); return o; }
    case "tube": { const o = []; for (let k = -1; k <= 9; k++) { const a = Math.PI * k / 8; o.push([-Math.cos(a) * W, H * 0.4 + Math.sin(a) * H * 0.6]); } return o; }
    case "cave": { const o = [[-W - 2, -1]]; for (let k = 0; k <= 8; k++) { const a = Math.PI * k / 8, n = 1 + Math.sin(i * 0.37 + k * 1.7) * 0.15 + Math.sin(i * 0.11 + k) * 0.1; o.push([-Math.cos(a) * W * n, H * 0.3 + Math.sin(a) * H * 0.7 * n]); } o.push([W + 2, -1]); return o; }
  }
  return null;
}
function buildRibbon(path, bag, T) {
  const S = path.S, N = S.length, segN = path.closed ? N : N - 1;
  for (let i = 0; i < segN; i++) {
    const a = S[i], b = S[(i + 1) % N];
    if (a.hide || b.hide) continue;
    const pre = a.gapId !== undefined ? "gap" + a.gapId + "|" : "";
    const va = a.d / 8, vb = va + path.sp / 8;
    if (a.grind) {
      for (let k = 0; k < 6; k++) {
        const a0 = k / 6 * Math.PI * 2, a1 = (k + 1) / 6 * Math.PI * 2, rr = 0.55;
        bag.quad(pre + "rail", PS(a, Math.cos(a0) * rr, Math.sin(a0) * rr - 0.5, tA), PS(a, Math.cos(a1) * rr, Math.sin(a1) * rr - 0.5, tB), PS(b, Math.cos(a1) * rr, Math.sin(a1) * rr - 0.5, tC), PS(b, Math.cos(a0) * rr, Math.sin(a0) * rr - 0.5, tD), [0, va], [1, va], [1, vb], [0, vb]);
      }
      continue;
    }
    const hA = a.hw, hB = b.hw, rv = 8 / (hA * 2);
    bag.quad(pre + "s:" + a.surf, PS(a, -hA, 0, tA), PS(a, hA, 0, tB), PS(b, hB, 0, tC), PS(b, -hB, 0, tD), [0, va * rv], [1, va * rv], [1, vb * rv], [0, vb * rv]);
    if (a.sh && a.shw > 0) {
      const sw = a.shw, sb = b.shw;
      bag.quad(pre + "s:" + a.sh, PS(a, -hA - sw, -0.03, tA), PS(a, -hA, -0.03, tB), PS(b, -hB, -0.03, tC), PS(b, -hB - sb, -0.03, tD), [0, va], [sw / 8, va], [sw / 8, vb], [0, vb]);
      bag.quad(pre + "s:" + a.sh, PS(a, hA, -0.03, tA), PS(a, hA + sw, -0.03, tB), PS(b, hB + sb, -0.03, tC), PS(b, hB, -0.03, tD), [0, va], [sw / 8, va], [sw / 8, vb], [0, vb]);
    }
    const eA = hA + (a.sh ? a.shw : 0), eB = hB + (b.sh ? b.shw : 0);
    for (const side of [-1, 1]) {
      const w = side < 0 ? a.wallL : a.wallR;
      if (!w || (side < 0 ? a.openL : a.openR)) continue;
      bag.quad(pre + "wall:" + w, PS(a, side * eA, -0.1, tA), PS(a, side * eA, a.wh, tB), PS(b, side * eB, a.wh, tC), PS(b, side * eB, -0.1, tD), [va, 0], [va, 1], [vb, 1], [vb, 0]);
    }
    if (!a.encl && a.elev > 2.5 && a.up.y > 0.2) {
      const k2 = pre + (a.env === "sky" || a.env === "skyglass" ? "underSky" : "under"), th = a.env === "sky" ? 0.6 : 1.4;
      bag.quad(k2, PS(a, -eA, -th, tA), PS(a, eA, -th, tB), PS(b, eB, -th, tC), PS(b, -eB, -th, tD), [0, 0], [1, 0], [1, 1], [0, 1]);
      bag.quad(k2, PS(a, -eA, -0.05, tA), PS(a, -eA, -th, tB), PS(b, -eB, -th, tC), PS(b, -eB, -0.05, tD), [0, 0], [1, 0], [1, 1], [0, 1]);
      bag.quad(k2, PS(a, eA, -0.05, tA), PS(a, eA, -th, tB), PS(b, eB, -th, tC), PS(b, eB, -0.05, tD), [0, 0], [1, 0], [1, 1], [0, 1]);
    }
  }
}
function buildEnclosures(path, bag) {
  const S = path.S, N = S.length, segN = path.closed ? N : N - 1;
  for (let i = 0; i < segN; i++) {
    const a = S[i], b = S[(i + 1) % N];
    if (!a.encl || !b.encl || a.encl !== b.encl) continue;
    const E = envOf(a.env), Wa = a.hw + a.shw + 0.6, Wb = b.hw + b.shw + 0.6;
    const pa = enclProfile(a.encl, Wa, a.ech, i), pb = enclProfile(a.encl, Wb, b.ech, i + 1);
    if (!pa) continue;
    const ck = "encl:" + (E.ec || 0x888888) + ":" + (a.encl === "glass" ? "t" : "o");
    const va = a.d / 10, vb = va + path.sp / 10;
    for (let k = 0; k < pa.length - 1; k++) bag.quad(ck, PS(a, pa[k][0], pa[k][1], tA), PS(a, pa[k + 1][0], pa[k + 1][1], tB), PS(b, pb[k + 1][0], pb[k + 1][1], tC), PS(b, pb[k][0], pb[k][1], tD), [k / 4, va], [(k + 1) / 4, va], [(k + 1) / 4, vb], [k / 4, vb]);
    if (a.encl === "box" && E.ec2 !== undefined) {
      const sh = enclProfile("box", Wa + 1.2, a.ech + 1.5, i), shb = enclProfile("box", Wb + 1.2, b.ech + 1.5, i);
      for (let k = 0; k < sh.length - 1; k++) bag.quad("shell:" + (a.env === "hall" || a.env === "cathedral" || a.env === "stairs" ? 0xb8a888 : 0xe8e0d0), PS(a, sh[k][0], sh[k][1] - 1, tA), PS(a, sh[k + 1][0], sh[k + 1][1] - 1, tB), PS(b, shb[k + 1][0], shb[k + 1][1] - 1, tC), PS(b, shb[k][0], shb[k][1] - 1, tD), [0, va / 2], [1, va / 2], [1, vb / 2], [0, vb / 2]);
    }
  }
}
// ---------------- branches ----------------
export function mainAtDist(main, d) {
  const S = main.S, N = S.length, L = main.L;
  d = ((d % L) + L) % L;
  const u = d / main.sp, i = Math.floor(u) % N, f = u - Math.floor(u), a = S[i], b = S[(i + 1) % N];
  return { i, u, x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f), z: lerp(a.z, b.z, f), s: a };
}
function buildBranch(def, br, main, bi) {
  const L = main.L, from = br.from * L, to = br.to * L;
  const span = ((to - from) % L + L) % L;
  const A0 = mainAtDist(main, from), A1 = mainAtDist(main, to);
  const sg = { env: br.env, hw: br.hw, surf: br.surf, sh: br.sh, shw: br.shw, wall: br.wall, wallL: br.wallL, wallR: br.wallR, encl: br.encl, ech: br.ech, grind: br.rail ? 1 : 0, roll: 0, conv: br.conv };
  const A = segAttrs(sg, -1, def);
  if (br.rail) { A.hw = 1.4; A.shw = 0; A.sh = null; A.wallL = A.wallR = null; A.encl = null; A.surf = "rail"; }
  const side = br.side || 1;
  const edgeOff = (s) => side * (s.hw + (s.sh ? s.shw : 0) + 2.5);
  const pts = [];
  const o0 = edgeOff(A0.s), o1 = edgeOff(A1.s);
  const lead = Math.min(0.12, 24 / span);
  const P0 = (br.pts || []).slice().sort((p, q) => p[0] - q[0]);
  const prof = [[0, o0, 0], [lead * 0.5, o0 + side * 2.5, 0], [lead, o0 + side * (A.hw + 2), P0.length ? P0[0][2] * 0.1 : 0]];
  for (const p of P0) if (p[0] > lead && p[0] < 1 - lead) prof.push([p[0], side * p[1], p[2] || 0]);
  prof.push([1 - lead, o1 + side * (A.hw + 2), P0.length ? P0[P0.length - 1][2] * 0.1 : 0], [1 - lead * 0.5, o1 + side * 2.5, 0], [1, o1, 0]);
  const profAt = (f) => { let j = 0; while (j < prof.length - 2 && prof[j + 1][0] < f) j++; const p = prof[j], q = prof[j + 1], s = sstep(clamp((f - p[0]) / ((q[0] - p[0]) || 1), 0, 1)); return [lerp(p[1], q[1], s), lerp(p[2], q[2], s)]; };
  const tanAt = (d) => { const p = mainAtDist(main, d - 1), q = mainAtDist(main, d + 1); const v = new V3(q.x - p.x, 0, q.z - p.z); return v.normalize(); };
  const M = Math.max(8, Math.ceil(span / 3));
  for (let k = 0; k <= M; k++) {
    const f = k / M, d = from + span * f, m = mainAtDist(main, d), s = m.s;
    const rh = new V3(s.r.x, 0, s.r.z).normalize();
    let [off, dy] = profAt(f);
    const ta = tanAt(d - 9), tb = tanAt(d + 9), dt = tb.sub(ta).multiplyScalar(1 / 18), kap = dt.length();
    if (kap > 1e-4 && dt.dot(rh) * off > 0) off = Math.sign(off) * Math.min(Math.abs(off), 0.7 / kap);
    pts.push(new V3(m.x + rh.x * off, m.y + dy, m.z + rh.z * off));
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
  const len = curve.getLength(), n = Math.ceil(len);
  const raw = [];
  for (let k = 0; k <= n; k++) { const p = curve.getPointAt(k / n), dE = Math.min(k, n - k) * len / n, tp = sstep(Math.min(1, dE / 34)); raw.push({ ...A, x: p.x, y: p.y, z: p.z, f: k / n, cr: 0, roll: (br.roll || 0) * Math.sin(Math.PI * k / n), hw: lerp(4, A.hw, tp), shw: (A.shw || 0) * tp }); }
  // relax the centerline so waypoint offsets on curving mains do not leave hooks
  for (let pass = 0; pass < 160; pass++) for (let k = 1; k < raw.length - 1; k++) {
    const r = raw[k], a = raw[k - 1], b = raw[k + 1], dE = Math.min(k, raw.length - 1 - k);
    const w = 0.5 * sstep(Math.min(1, dE / 6));
    r.x += w * ((a.x + b.x) / 2 - r.x); r.z += w * ((a.z + b.z) / 2 - r.z); r.y += w * 0.5 * ((a.y + b.y) / 2 - r.y);
  }
  if (br.cork) raw.forEach(r => { const f = clamp((r.f - 0.3) / 0.4, 0, 1); r.cr = sstep(f) * Math.PI * 2 * br.cork; r.lock = f > 0 && f < 1; });
  const rs = resample(raw, false);
  const S = rs.S;
  const i0 = A0.i, i1 = A1.i, NM = main.S.length, dI = ((i1 - i0) % NM + NM) % NM;
  S.forEach((s, k) => { s.mainU = (i0 + dI * (k / (S.length - 1))) % NM; s.pi = bi; s.i = k; });
  const openLen = Math.ceil(28 / rs.sp);
  S.forEach((s, k) => { if (k < openLen || k > S.length - 1 - openLen) { if (side > 0) s.openL = true; else s.openR = true; } });
  computeFrames(S, false);
  const MS = main.S;
  const mark = (ci, a, b) => { for (let k = a; k <= b; k++) { const s = MS[((ci + k) % NM + NM) % NM]; if (side > 0) s.openR = true; else s.openL = true; } };
  mark(i0, -2, openLen + 2); mark(i1, -openLen - 2, 2);
  return { S, N: S.length, closed: false, L: rs.L, sp: rs.sp, def: br, side, i0, i1, id: br.id || "b" + bi, label: br.label, idx: bi };
}
// adjust straight lengths (weighted min-norm) so the layout closes on itself
function fitClose(def) {
  if (def.fit === false) return def;
  const segs = def.segs.map(s => ({ ...s }));
  const st = def.start || {};
  for (let it = 0; it < 6; it++) {
    let x = st.x || 0, z = st.z || 0, h = (st.h || 0) * Math.PI / 180;
    const free = [];
    for (const sg of segs) {
      if (sg.k === "S") { if (!sg.fixed && !sg._lock) free.push({ sg, dx: Math.sin(h), dz: Math.cos(h) }); x += Math.sin(h) * sg.len; z += Math.cos(h) * sg.len; }
      else if (sg.k === "T") { const L = Math.abs(sg.ang) * Math.PI / 180 * sg.r, n = Math.max(2, Math.ceil(L)), ds = L / n, sgn = Math.sign(sg.ang); for (let k = 0; k < n; k++) { h += sgn * ds / sg.r; x += Math.sin(h) * ds; z += Math.cos(h) * ds; } }
      else if (sg.k === "LOOP") { const sh = sg.shift || (sg.hw || def.hw || 11) * 2 + 4; x += -Math.cos(h) * sh; z += Math.sin(h) * sh; }
      else if (sg.k === "LIFT") { const f = Math.abs(sg.h) * 0.16; x += Math.sin(h) * f; z += Math.cos(h) * f; }
    }
    const rx = (st.x || 0) - x, rz = (st.z || 0) - z;
    if (Math.hypot(rx, rz) < 0.5 || free.length < 2) break;
    let a = 0, b = 0, c = 0;
    for (const f of free) { const w = f.sg.len; a += w * f.dx * f.dx; b += w * f.dx * f.dz; c += w * f.dz * f.dz; }
    const det = a * c - b * b; if (Math.abs(det) < 1e-6) break;
    const l1 = (c * rx - b * rz) / det, l2 = (a * rz - b * rx) / det;
    let clamped = false;
    for (const f of free) { const nl = f.sg.len + f.sg.len * (f.dx * l1 + f.dz * l2); if (nl < 24) { f.sg.len = 24; f.sg._lock = 1; clamped = true; } else f.sg.len = nl; }
    if (!clamped) break;
  }
  return { ...def, segs };
}
// ---------------- main builder ----------------
export function buildTrack(def, scene) {
  def = fitClose(def);
  const group = new THREE.Group(); if (scene) scene.add(group);
  const theme = def.theme || {};
  const cores = [];
  const gm = genMain(def, cores);
  smoothY(gm.raw, true);
  const rm = resample(gm.raw, true);
  const main = { S: rm.S, N: rm.S.length, closed: true, L: rm.L, sp: rm.sp, id: "main", idx: 0 };
  main.S.forEach((s, i) => { s.mainU = i; s.pi = 0; s.i = i; });
  const bumps = resolveCrossings(main.S, true);
  computeFrames(main.S, true);
  const groundY = def.groundY !== undefined ? def.groundY : Math.min(...main.S.map(s => s.y)) - 0.4;
  const paths = [main];
  const T = { def, group, paths, main, N: main.N, S: main.S, groundY, cores, bumps, gm, lap: 1, time: 0 };
  const segR = {};
  main.S.forEach((s, i) => { if (s.seg < 0) return; const r = segR[s.seg] || (segR[s.seg] = [i, i]); r[0] = Math.min(r[0], i); r[1] = Math.max(r[1], i); });
  T.segR = segR;
  T.idxOf = (seg, at = 0) => { const r = segR[seg]; if (!r) return 0; return Math.round(r[0] + (r[1] - r[0]) * at); };
  (def.branches || []).forEach((br, k) => paths.push(buildBranch(def, br, main, k + 1)));
  T.branches = paths.slice(1);
  T.minY = Infinity;
  for (const p of paths) for (const s of p.S) {
    s.elev = s.y - groundY; T.minY = Math.min(T.minY, s.y);
    if (s.soft === undefined || s.soft === null) s.soft = s.elev < 2.5 || !!s.encl;
  }
  // features
  const O = T.objs = { ramps: [], pads: [], boxes: [], obst: [], gates: [], triggers: [], signs: [] };
  T.gapSecs = [];
  const featG = new THREE.Group(); group.add(featG); T.featG = featG;
  def.segs.forEach((sg, si) => { for (const f of sg.f || []) addFeature(T, f, main, T.idxOf(si, f.at || 0), featG, !!scene); });
  T.branches.forEach((b) => { for (const f of b.def.f || []) addFeature(T, f, b, Math.round((f.at || 0) * (b.N - 1)), featG, !!scene); });
  T.branches.forEach((b) => { if (b.def.gate) addGate(T, b, featG, !!scene); });
  T.forks = T.branches.map(b => ({ i: b.i0, side: b.side, b }));
  // spatial hash
  const CELL = 16, grid = new Map();
  for (const p of paths) for (const s of p.S) { const k = Math.floor(s.x / CELL) * 73856 + Math.floor(s.z / CELL); let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(s); }
  T.query = (x, z, R, fn) => {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL), n = Math.ceil(R / CELL);
    for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) { const l = grid.get((cx + a) * 73856 + cz + b); if (l) for (const s of l) fn(s); }
  };
  // meshes
  if (scene) {
    const bag = new GeoBag();
    for (const p of paths) { buildRibbon(p, bag, T); buildEnclosures(p, bag); }
    const gapBags = {};
    for (const k in bag.m) if (k.startsWith("gap")) { const id = k.slice(3, k.indexOf("|")); (gapBags[id] = gapBags[id] || new GeoBag()).m[k.slice(k.indexOf("|") + 1)] = bag.m[k]; delete bag.m[k]; }
    bag.build(group, miscMat);
    for (const sec of T.gapSecs) { sec.group = new THREE.Group(); group.add(sec.group); if (gapBags[sec.id]) gapBags[sec.id].build(sec.group, miscMat); }
    const sky = makeSky(theme.sky ? theme.sky[0] : 0x6ab8ff, theme.sky ? theme.sky[1] : 0xdff2ff); group.add(sky);
    scene.fog = new THREE.Fog(theme.fog || (theme.sky ? theme.sky[1] : 0xdff2ff), theme.fogNear || 300, theme.fogFar || 1700);
    scene.background = new THREE.Color(theme.sky ? theme.sky[1] : 0xdff2ff);
    if (theme.ground !== null) {
      const g = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), new THREE.MeshLambertMaterial({ map: groundTex(theme.ground || 0x5aa04a, theme.groundTex) }));
      g.rotation.x = -Math.PI / 2; g.position.y = groundY - 0.35; group.add(g);
    }
    try { buildSupports(T, group); } catch (e) { console.warn("supports", e); }
    try { buildDecor(T, group); } catch (e) { console.warn("decor", e); }
    try { buildProps(T, group); } catch (e) { console.warn("props", e); }
    for (const c of cores) { const m = buildCore(c, groundY); if (m) group.add(m); }
    const kits = new Set();
    for (const lm of def.lms || []) {
      const s = main.S[T.idxOf(lm.seg, lm.at || 0)];
      const o = buildLandmark(lm.kind, theme);
      if (!o) { if (!kits.has(lm.kind)) { kits.add(lm.kind); try { const all = []; for (const p of T.paths) for (const q of p.S) { if (q.rx === undefined) { q.rx = q.r.x; q.rz = q.r.z; } all.push({ ...q, hw: q.hw + (q.shw || 0) + 4 }); } sceneryKit(lm.kind, group, all, all.length, groundY, theme); } catch (e) { console.warn("kit", lm.kind, e); } } continue; }
      const off = (lm.side || 1) * (s.hw + s.shw + (lm.off !== undefined ? lm.off : 30));
      o.position.set(s.x + s.r.x * off, lm.y !== undefined ? s.y + lm.y : groundY, s.z + s.r.z * off);
      o.rotation.y = Math.atan2(s.t.x, s.t.z) + (lm.rot || 0);
      o.scale.setScalar(lm.s || 1); group.add(o);
    }
  }
  T.hazards = [];
  T.dyn = buildEvents(T, def.events || [], scene ? featG : null);
  // ---------- API ----------
  T.lapOk = (f, lap) => (!f.lap || lap >= f.lap) && (!f.lapOnly || lap === f.lapOnly) && (!f.until || lap < f.until);
  T.gapAt = (s, lap) => {
    if (s.gapSec) return s.gapSec.broken;
    if (s.gapLap && lap >= s.gapLap && (!s.gapUntil || lap < s.gapUntil)) return true;
    if (s.dynGap && s.dynGap.open) return true;
    return false;
  };
  T.surfAt = (s, lat, lap) => {
    let name = Math.abs(lat) <= s.hw ? s.surf : (s.sh || s.surf);
    if (s.patches) for (const pt of s.patches) if (lat >= pt.l0 && lat <= pt.l1 && T.lapOk(pt, lap)) name = pt.surf;
    if (s.flood && s.flood.level > 0.5) name = "water";
    if (s.snowed && s.snowed.on) name = "snow";
    return name;
  };
  const fr = { p: new V3(), t: new V3(), r: new V3(), up: new V3() }, fr2 = { p: new V3(), t: new V3(), r: new V3(), up: new V3() };
  T.frame = (pi, u, out = fr) => {
    const p = paths[pi], S = p.S, N = S.length;
    const uu = p.closed ? ((u % N) + N) % N : clamp(u, 0, N - 1.001);
    const i = Math.floor(uu), f = uu - i, a = S[i], b = p.closed ? S[(i + 1) % N] : S[Math.min(N - 1, i + 1)];
    out.p.set(lerp(a.x, b.x, f), lerp(a.y, b.y, f), lerp(a.z, b.z, f));
    out.t.copy(a.t).lerp(b.t, f).normalize(); out.up.copy(a.up).lerp(b.up, f).normalize(); out.r.copy(a.r).lerp(b.r, f).normalize();
    out.s = f < 0.5 ? a : b; out.a = a; out.b = b; out.i = i; out.f = f; out.hw = lerp(a.hw, b.hw, f); out.shw = lerp(a.sh ? a.shw : 0, b.sh ? b.shw : 0, f);
    return out;
  };
  T.place = (pi, u, lat, h, out = new V3()) => { const F = T.frame(pi, u, fr2); return out.copy(F.p).addScaledVector(F.r, lat).addScaledVector(F.up, h); };
  const dv = new V3();
  T.findSurface = (pos, vel, lap, below = 2.5) => {
    let best = null, bestH = -1e9;
    T.query(pos.x, pos.z, 34, (s) => {
      if (s.up.y < 0.25 || s.hide) return;
      dv.set(pos.x - s.x, pos.y - s.y, pos.z - s.z);
      const al = dv.dot(s.t); if (Math.abs(al) > SP * 0.6) return;
      const h = dv.dot(s.up); if (h > 0.4 || h < -below) return;
      const lat = dv.dot(s.r); if (Math.abs(lat) > s.hw + (s.sh ? s.shw : 0) + 0.4) return;
      if (vel && vel.dot(s.up) > 3) return;
      if (T.gapAt(s, lap)) return;
      if (h > bestH) { bestH = h; best = { s, pi: s.pi, u: s.i + al / paths[s.pi].sp, lat, h }; }
    });
    return best;
  };
  T.project = (pi, pos, hint, range = 12) => {
    const p = paths[pi], S = p.S, N = S.length;
    let bi = Math.round(hint), bd = Infinity;
    for (let k = -range; k <= range; k++) {
      let j = Math.round(hint) + k; if (p.closed) j = ((j % N) + N) % N; else if (j < 0 || j >= N) continue;
      const s = S[j]; const d = (pos.x - s.x) ** 2 + (pos.y - s.y) ** 2 * 0.3 + (pos.z - s.z) ** 2;
      if (d < bd) { bd = d; bi = j; }
    }
    if (p.closed) bi = ((bi % N) + N) % N; else bi = clamp(bi, 0, N - 1);
    const s = S[bi]; dv.set(pos.x - s.x, pos.y - s.y, pos.z - s.z);
    return { u: bi + dv.dot(s.t) / p.sp, lat: dv.dot(s.r), h: dv.dot(s.up), s };
  };
  T.update = (dt, time, lap) => {
    T.lap = lap; T.time = time; updateFeatures(T, dt, time); if (T.dyn) T.dyn.update(dt, time, lap);
    for (const sec of T.gapSecs) if (sec.f.t === "gap" && sec.lap > 1) {
      if (!sec.broken && lap >= sec.lap) { sec.broken = true; sec.vy = 0; sec.tt = 0; if (T.onBreak) T.onBreak(sec); }
      if (sec.broken && sec.group && sec.group.visible) { sec.tt += dt; sec.vy -= 30 * dt; sec.group.position.y += sec.vy * dt; if (sec.tt > 6) sec.group.visible = false; }
    }
  };
  T.dispose = () => {
    if (scene) scene.remove(group);
    group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  };
  return T;
}
