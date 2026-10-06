import * as THREE from "three";

const L = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
const B = (w, h, d, c) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof c === "number" ? L(c) : c);
const C = (rt, rb, h, c, seg = 12) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), typeof c === "number" ? L(c) : c);
const K = (r, h, c, seg = 12) => new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), typeof c === "number" ? L(c) : c);
const at = (m, x, y, z) => (m.position.set(x, y, z), m);

export function makeSky(top, bottom) {
  const geo = new THREE.SphereGeometry(3000, 24, 12);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, bottom: { value: new THREE.Color(bottom) } },
    vertexShader: "varying vec3 vp; void main(){ vp = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} ",
    fragmentShader: "uniform vec3 top; uniform vec3 bottom; varying vec3 vp; void main(){ float h = normalize(vp).y; gl_FragColor = vec4(mix(bottom, top, smoothstep(-0.05, 0.5, h)), 1.0);} ",
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = -10;
  return m;
}

let winTex;
function windowTexture() {
  if (winTex) return winTex;
  const c = document.createElement("canvas"); c.width = 64; c.height = 128;
  const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 128; y += 14) for (let x = 5; x < 64; x += 14) { g.fillStyle = Math.random() < 0.3 ? "#ffe9a8" : "#5a6878"; g.fillRect(x, y, 9, 9); }
  winTex = new THREE.CanvasTexture(c); winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping; winTex.colorSpace = THREE.SRGBColorSpace;
  return winTex;
}
let timberTex;
function timberTexture() {
  if (timberTex) return timberTex;
  const c = document.createElement("canvas"); c.width = 64; c.height = 64;
  const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, 64, 64);
  g.strokeStyle = "#4a2a14"; g.lineWidth = 4;
  g.strokeRect(2, 2, 60, 60); g.beginPath(); g.moveTo(0, 32); g.lineTo(64, 32); g.moveTo(32, 0); g.lineTo(32, 64); g.moveTo(0, 0); g.lineTo(32, 32); g.moveTo(64, 0); g.lineTo(32, 32); g.stroke();
  g.fillStyle = "#6a8aa8"; g.fillRect(8, 40, 14, 14); g.fillRect(42, 40, 14, 14); g.fillRect(8, 8, 14, 14); g.fillRect(42, 8, 14, 14);
  timberTex = new THREE.CanvasTexture(c); timberTex.colorSpace = THREE.SRGBColorSpace;
  return timberTex;
}

function instanced(group, geo, mat, list) {
  if (!list.length) return;
  const im = new THREE.InstancedMesh(geo, mat, list.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color();
  list.forEach((it, i) => {
    q.setFromEuler(e.set(0, it.r || 0, 0));
    m.compose(p.set(it.x, it.y, it.z), q, s.set(it.sx, it.sy, it.sz));
    im.setMatrixAt(i, m);
    if (it.c !== undefined) im.setColorAt(i, col.set(it.c));
  });
  group.add(im);
}

export function buildDecor(kind, group, S, N, gy, theme) {
  // spatial hash of road
  const cell = 24, grid = new Map();
  for (let i = 0; i < N; i += 2) {
    const s = S[i]; const k = Math.floor(s.x / cell) + "," + Math.floor(s.z / cell);
    if (!grid.has(k)) grid.set(k, []); grid.get(k).push(s);
  }
  const clear = (x, z, m) => {
    const cx = Math.floor(x / cell), cz = Math.floor(z / cell), R = Math.ceil((m + 15) / cell);
    for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) {
      const l = grid.get((cx + a) + "," + (cz + b)); if (!l) continue;
      for (const s of l) if (Math.hypot(s.x - x, s.z - z) < s.hw + m) return false;
    }
    return true;
  };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const scatter = (count, near, far, margin, fn) => {
    let tries = 0, made = 0;
    while (made < count && tries < count * 6) {
      tries++;
      const s = S[Math.floor(Math.random() * N)];
      const side = Math.random() < 0.5 ? -1 : 1, d = s.hw + rnd(near, far);
      const x = s.x + s.rx * side * d, z = s.z + s.rz * side * d;
      if (!clear(x, z, margin)) continue;
      fn(x, z, s); made++;
    }
  };
  const lists = {};
  const push = (name, it) => (lists[name] = lists[name] || []).push(it);
  const pines = (n, near, far, snowy) => scatter(n, near, far, 4, (x, z) => {
    const h = rnd(10, 22); push(snowy ? "pineS" : "pine", { x, y: gy + h / 2 + 2, z, sx: h * 0.35, sy: h, sz: h * 0.35 }); push("trunk", { x, y: gy + 1.5, z, sx: 1, sy: 3, sz: 1 });
  });
  const rounds = (n, near, far, colors) => scatter(n, near, far, 4, (x, z) => {
    const r = rnd(3, 6); push("ball", { x, y: gy + r + 3, z, sx: r, sy: r, sz: r, c: pick(colors) }); push("trunk", { x, y: gy + 2, z, sx: 1, sy: 4, sz: 1 });
  });
  const blocks = (n, near, far, hmin, hmax, colors, wmin = 10, wmax = 22) => scatter(n, near, far, 14, (x, z, s) => {
    const h = rnd(hmin, hmax), w = rnd(wmin, wmax), d = rnd(wmin, wmax);
    push("bldg", { x, y: gy + h / 2, z, sx: w, sy: h, sz: d, r: Math.atan2(s.tx, s.tz), c: pick(colors) });
  });
  const houses = (n, near, far, colors) => scatter(n, near, far, 10, (x, z, s) => {
    const h = rnd(8, 14), w = rnd(8, 12);
    const r = Math.atan2(s.tx, s.tz);
    push("house", { x, y: gy + h / 2, z, sx: w, sy: h, sz: w, r, c: pick(colors) });
    push("roof", { x, y: gy + h + 3.5, z, sx: w * 0.75, sy: 7, sz: w * 0.75, r: r + Math.PI / 4, c: pick([0xb5452d, 0x8b3a24, 0x5a3a2a]) });
  });
  const mountains = (n, rmin, rmax, colors, snow) => {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + rnd(0, 0.3), r = rnd(rmin, rmax), h = rnd(160, 420);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      push("mtn", { x, y: gy + h / 2, z, sx: h * 0.9, sy: h, sz: h * 0.9, c: pick(colors) });
      if (snow) push("snowcap", { x, y: gy + h * 0.82, z, sx: h * 0.9 * 0.36, sy: h * 0.38, sz: h * 0.9 * 0.36 });
    }
  };
  switch (kind) {
    case "alps": mountains(28, 650, 1100, [0x7a8a9a, 0x8899aa, 0x6a7a8a], true); pines(260, 6, 160, true); break;
    case "castle": mountains(20, 700, 1100, [0x6a8a5a, 0x7a9a6a], true); pines(200, 6, 160, false); rounds(60, 8, 120, [0x5aa04a, 0x7ab85a]); break;
    case "forest": mountains(14, 700, 1000, [0x2a4a2a], false); pines(520, 4, 120, false); break;
    case "rail": mountains(18, 650, 1100, [0x6a8a6a, 0x7a8a9a], true); rounds(120, 8, 150, [0x4a9a3a, 0x6aaa4a]); houses(40, 20, 120, [0xffffff, 0xf3e3c3]); break;
    case "river": mountains(16, 650, 1000, [0x6a9a5a], false); rounds(140, 8, 130, [0x3f8a3a, 0x5a9a3a]); scatter(300, 6, 90, 3, (x, z) => push("vine", { x, y: gy + 1.2, z, sx: 1.4, sy: 2.4, sz: 7, c: 0x3e7a2a })); houses(30, 30, 120, [0xffffff, 0xf3d3a3]); break;
    case "city": blocks(220, 6, 150, 16, 60, [0xd9cbb3, 0xbfb4a3, 0xa3a9b3, 0xe3d3c3, 0x9aa3b3]); rounds(40, 4, 20, [0x4a8a3a]); break;
    case "skyline": blocks(220, 6, 220, 30, 220, [0x9ab3d3, 0x7a93b3, 0xbcd3e3, 0x5a6a8a, 0xaab0c0], 14, 28); break;
    case "highway": blocks(60, 60, 220, 10, 40, [0xcccccc, 0xb3b3b3]); rounds(180, 8, 200, [0x4a8a3a, 0x5a9a4a]); mountains(10, 900, 1200, [0x7a9a8a], false); break;
    case "harbor": scatter(300, 6, 120, 6, (x, z, s) => { const st = Math.floor(rnd(1, 4)); for (let k = 0; k < st; k++) push("bldg", { x, y: gy + 1.5 + k * 3, z, sx: 3, sy: 3, sz: 7, r: Math.atan2(s.tx, s.tz), c: pick([0xc0392b, 0x2980b9, 0x27ae60, 0xf39c12, 0x8e44ad]) }); }); blocks(40, 120, 260, 20, 50, [0x8a4a3a, 0x9a5a4a]); break;
    case "beer": rounds(120, 10, 120, [0x4a9a3a]); scatter(70, 8, 80, 8, (x, z) => { push("tentC", { x, y: gy + 5, z, sx: 7, sy: 10, sz: 7, c: pick([0xffffff, 0x2a6fdb]) }); push("house", { x, y: gy + 2, z, sx: 9, sy: 4, sz: 9, c: 0xf5f5f5 }); }); break;
    case "town": houses(240, 4, 120, [0xffffff, 0xf3e3c3, 0xffe0b0, 0xf0d0d0]); rounds(50, 4, 60, [0x4a8a3a]); break;
    case "fairy": rounds(200, 6, 140, [0xff7ab8, 0x7ae0ff, 0xfff07a, 0xb07aff, 0x7aff9a]); scatter(80, 6, 80, 4, (x, z) => { const r = rnd(3, 7); push("ball", { x, y: gy + r * 0.6, z, sx: r, sy: r * 0.6, sz: r, c: pick([0xff3b3b, 0xffffff, 0xff9ad5]) }); }); mountains(12, 700, 1000, [0xd0a0ff, 0xffa0d0], true); break;
    case "coaster": rounds(120, 8, 140, [0x4a9a3a]); scatter(80, 10, 120, 8, (x, z) => push("tentC", { x, y: gy + 5, z, sx: 6, sy: 10, sz: 6, c: pick([0xff3b3b, 0xffdd00, 0x2a9df4, 0xff7ab8]) })); blocks(30, 40, 160, 10, 30, [0xff6b6b, 0x6bc5ff, 0xffd36b]); break;
    case "cathedral": blocks(200, 6, 160, 12, 34, [0xcbbfa8, 0xb8a888, 0xd8c8a8]); houses(80, 6, 100, [0xf3e3c3, 0xffffff]); break;
    case "ring": pines(380, 6, 160, false); rounds(100, 8, 150, [0x3a7a2a]); scatter(20, 6, 14, 4, (x, z, s) => push("bldg", { x, y: gy + 4, z, sx: 6, sy: 8, sz: 30, r: Math.atan2(s.tx, s.tz), c: 0xd0d0d0 })); break;
  }
  const geos = {
    pine: new THREE.ConeGeometry(1, 1, 7), pineS: new THREE.ConeGeometry(1, 1, 7), trunk: new THREE.CylinderGeometry(0.5, 0.6, 1, 5),
    ball: new THREE.IcosahedronGeometry(1, 0), bldg: new THREE.BoxGeometry(1, 1, 1), house: new THREE.BoxGeometry(1, 1, 1),
    roof: new THREE.ConeGeometry(1, 1, 4), mtn: new THREE.ConeGeometry(1, 1, 7), snowcap: new THREE.ConeGeometry(1, 1, 7),
    vine: new THREE.BoxGeometry(1, 1, 1), tentC: new THREE.ConeGeometry(1, 1, 10),
  };
  const mats = {
    pine: L(0x2a6a35, { flatShading: true }), pineS: L(0x3a6a55, { flatShading: true }), trunk: L(0x6b4423),
    ball: L(0xffffff, { flatShading: true }), bldg: new THREE.MeshLambertMaterial({ map: windowTexture() }), house: new THREE.MeshLambertMaterial({ map: timberTexture() }),
    roof: L(0xffffff, { flatShading: true }), mtn: L(0xffffff, { flatShading: true }), snowcap: L(0xffffff, { flatShading: true }),
    vine: L(0xffffff), tentC: L(0xffffff, { flatShading: true }),
  };
  if (kind === "alps") mats.pineS.color.set(0x2a5a45);
  for (const k in lists) instanced(group, geos[k], mats[k], lists[k]);
}

// ---------- Landmarks ----------
export function buildLandmark(kind, theme) {
  const g = new THREE.Group();
  switch (kind) {
    case "summitcross": {
      g.add(at(B(0.8, 10, 0.8, 0x6b4423), 0, 5, 0), at(B(5, 0.8, 0.8, 0x6b4423), 0, 7.5, 0));
      const flag = at(B(0.1, 2, 3.2, 0x000000), 0, 9, 1.6); g.add(flag);
      g.add(at(B(0.1, 0.7, 3.2, 0xdd0000), 0, 8.3, 1.6), at(B(0.1, 0.7, 3.2, 0xffce00), 0, 7.6, 1.6));
      break;
    }
    case "chalet": {
      g.add(at(B(14, 9, 12, 0xf5efe0), 0, 4.5, 0), at(B(14.4, 4, 12.4, 0x7a4a24), 0, 11, 0));
      const roof = at(K(11, 6, 0x6b3a1e, 4), 0, 15.5, 0); roof.rotation.y = Math.PI / 4; roof.scale.z = 0.9; g.add(roof);
      g.add(at(B(15, 0.6, 2, 0x7a4a24), 0, 7, 6.5));
      for (const x of [-4, 0, 4]) g.add(at(B(1.6, 1, 0.8, 0xff3355), x, 7.7, 6.6));
      break;
    }
    case "mountain": {
      const m = at(K(260, 520, 0x8a9aaa, 8), 0, 260, 0); m.material.flatShading = true; g.add(m);
      g.add(at(K(100, 200, 0xffffff, 8), 0, 420, 0));
      break;
    }
    case "windmill": {
      g.add(at(C(3, 4.5, 16, 0x8a6545, 10), 0, 8, 0));
      const roof = at(K(4.2, 5, 0x6b3a2a, 8), 0, 18.5, 0); roof.rotation.y = Math.PI / 8; g.add(roof);
      const sails = new THREE.Group(); sails.position.set(0, 20.5, 2.8);
      for (let i = 0; i < 4; i++) {
        const sail = at(B(1.2, 15, 0.65, i % 2 ? 0xf1e6ca : 0xffffff), 0, 7.5, 0);
        sail.rotation.z = i * Math.PI / 2; sails.add(sail);
      }
      sails.add(at(C(0.9, 0.9, 1.4, 0x594333), 0, 0, 0)); g.add(sails);
      break;
    }
    case "lighthouse": {
      for (let i = 0; i < 6; i++) g.add(at(C(3.4 - i * 0.12, 3.7 - i * 0.12, 4, i % 2 ? 0xf5eee0 : 0xd94c3d, 12), 0, 2 + i * 4, 0));
      g.add(at(C(2.5, 2.8, 1, 0x343d49, 12), 0, 25, 0));
      const lamp = at(B(3.2, 2.8, 3.2, new THREE.MeshLambertMaterial({ color: 0xffefad, emissive: 0x806022 })), 0, 27, 0); g.add(lamp);
      const roof = at(K(3.2, 3.2, 0x343d49, 8), 0, 30, 0); g.add(roof);
      break;
    }
    case "brandenburg": {
      const st = 0xd9c9a3;
      for (const x of [-25, -19, -14, 14, 19, 25]) g.add(at(C(1.3, 1.5, 22, st), x, 11, 0));
      g.add(at(B(54, 5, 8, st), 0, 24.5, 0), at(B(16, 3, 6, st), 0, 28.5, 0));
      // quadriga
      g.add(at(B(5, 3, 2, 0x3a7a5a), 0, 31.5, 0));
      for (const x of [-1.6, -0.5, 0.6, 1.7]) g.add(at(B(0.5, 2, 3, 0x3a7a5a), x, 32, 1.5));
      break;
    }
    case "tvtower": {
      g.add(at(C(3, 5, 200, 0xdddddd), 0, 100, 0));
      const ball = at(new THREE.Mesh(new THREE.SphereGeometry(14, 20, 14), L(0xc0c8d0)), 0, 200, 0); g.add(ball);
      g.add(at(C(1, 1.5, 60, 0xdd0000), 0, 240, 0));
      break;
    }
    case "bus": {
      g.add(at(B(4, 4.4, 13, 0xffd200), 0, 2.6, 0), at(B(4.1, 1.4, 11.5, 0x223344), 0, 3.4, 0));
      for (const z of [-4, 4]) for (const x of [-2, 2]) { const w = at(C(1, 1, 0.6, 0x111111), x, 0.9, z); w.rotation.z = Math.PI / 2; g.add(w); }
      break;
    }
    case "station": {
      g.add(at(B(18, 14, 40, 0xb8a888), 0, 7, 0));
      const roof = at(C(10, 10, 42, 0x5a7a8a, 16), 0, 14, 0); roof.rotation.x = Math.PI / 2; roof.scale.x = 0.95; g.add(roof);
      g.add(at(B(8, 2, 0.5, 0x003399), 0, 12, 20.3));
      break;
    }
    case "neuschwanstein": {
      const w = 0xf3eee6, blue = 0x3b5ba5;
      g.add(at(B(40, 30, 18, w), 0, 15, 0));
      const roof = at(K(22, 12, blue, 4), 0, 36, 0); roof.rotation.y = Math.PI / 4; roof.scale.z = 0.5; g.add(roof);
      for (const [x, z, h] of [[-22, 0, 52], [22, 4, 44], [-8, 12, 60], [10, -10, 40], [28, -8, 34]]) {
        g.add(at(C(4, 4, h, w), x, h / 2, z), at(K(5.5, 14, blue), x, h + 7, z));
      }
      g.add(at(B(12, 6, 30, w), -30, 3, 20));
      g.scale.setScalar(1.3);
      break;
    }
    case "cuckoo": {
      g.add(at(B(16, 22, 10, 0x6b3a1e), 0, 11, 0));
      const roof = at(K(14, 9, 0x4a2a14, 4), 0, 26, 0); roof.rotation.y = Math.PI / 4; roof.scale.z = 0.7; g.add(roof);
      const face = at(C(6, 6, 1, 0xfff3d0, 24), 0, 14, 5.2); face.rotation.x = Math.PI / 2; g.add(face);
      const hand = at(B(0.5, 5, 0.3, 0x000000), 0, 15.5, 5.8); g.add(hand);
      const hand2 = at(B(0.5, 3.5, 0.3, 0x000000), 0, 14, 5.8); g.add(hand2);
      const bird = at(new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 6), L(0xffd23f)), 0, 21, 5); g.add(bird);
      g.userData.animate = (dt, t) => { hand.rotation.z = -t * 2; hand2.rotation.z = -t * 0.2; bird.position.z = 5 + Math.max(0, Math.sin(t * 1.5)) * 4; };
      break;
    }
    case "riesenrad": {
      const wheel = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(32, 0.8, 6, 40), L(0xffffff)); wheel.add(ring);
      const cabins = [];
      for (let k = 0; k < 16; k++) {
        const a = k / 16 * Math.PI * 2;
        const sp = at(B(0.5, 32, 0.5, 0xffffff), Math.cos(a) * 16, Math.sin(a) * 16, 0); sp.rotation.z = a - Math.PI / 2; wheel.add(sp);
        const cab = at(B(3, 3, 3, [0xff3b3b, 0xffdd00, 0x2a9df4, 0x2ecc71][k % 4]), Math.cos(a) * 32, Math.sin(a) * 32 - 2, 0); wheel.add(cab); cabins.push(cab);
      }
      wheel.position.y = 40; g.add(wheel);
      g.add(at(B(2, 40, 2, 0xdddddd), -6, 20, 0), at(B(2, 40, 2, 0xdddddd), 6, 20, 0));
      g.userData.animate = (dt) => { wheel.rotation.z += dt * 0.25; for (const c of cabins) c.rotation.z = -wheel.rotation.z; };
      break;
    }
    case "tent": {
      const t = at(B(40, 10, 24, 0xffffff), 0, 5, 0); g.add(t);
      const r = at(K(26, 10, 0x2a6fdb, 4), 0, 15, 0); r.rotation.y = Math.PI / 4; r.scale.z = 0.6; g.add(r);
      g.add(at(B(14, 4, 0.5, 0xffd23f), 0, 12, 12.3));
      break;
    }
    case "rathaus": {
      g.add(at(B(30, 20, 14, 0xf0d0a0), 0, 10, 0));
      const r = at(K(20, 10, 0x8b3a24, 4), 0, 25, 0); r.rotation.y = Math.PI / 4; r.scale.z = 0.5; g.add(r);
      g.add(at(B(7, 40, 7, 0xf0d0a0), 0, 20, 2), at(K(5.5, 12, 0x2a6a5a, 8), 0, 46, 2));
      const face = at(C(2.5, 2.5, 0.5, 0xffffff, 20), 0, 34, 5.7); face.rotation.x = Math.PI / 2; g.add(face);
      break;
    }
    case "fountain": {
      g.add(at(C(8, 9, 2, 0xaaaaaa, 20), 0, 1, 0), at(C(7, 7, 0.3, 0x4aa8e8, 20), 0, 2, 0), at(C(1, 1.5, 8, 0xc0b090), 0, 5, 0));
      break;
    }
    case "dam": {
      const st = 0xb0b0a8;
      g.add(at(B(30, 70, 12, st), -40, 35, 0), at(B(30, 70, 12, st), 40, 35, 0), at(B(110, 12, 12, st), 0, 64, 0));
      const water = at(B(50, 50, 2, new THREE.MeshBasicMaterial({ color: 0x8fd8ff, transparent: true, opacity: 0.6 })), 0, 34, 2); g.add(water);
      break;
    }
    case "elphi": {
      g.add(at(B(50, 30, 30, 0x8a4a3a), 0, 15, 0));
      const glass = at(B(52, 30, 32, new THREE.MeshLambertMaterial({ color: 0x9fc8e8, emissive: 0x223344 })), 0, 45, 0); g.add(glass);
      for (let k = 0; k < 4; k++) { const wave = at(C(14, 14, 52, 0xdde8f0, 16), -18 + k * 12, 60, 0); wave.rotation.z = Math.PI / 2; wave.scale.set(1, 1, 0.9); g.add(wave); }
      break;
    }
    case "gingerbread": {
      g.add(at(B(14, 10, 12, 0x9a5a2a), 0, 5, 0));
      const r = at(K(12, 8, 0xffffff, 4), 0, 14, 0); r.rotation.y = Math.PI / 4; g.add(r);
      for (let k = 0; k < 10; k++) g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), L([0xff3b3b, 0x3bff8a, 0xffdd00, 0x3b9aff][k % 4])), -6 + (k % 5) * 3, 3 + Math.floor(k / 5) * 4, 6.2));
      break;
    }
    case "rapunzel": {
      g.add(at(C(7, 8, 80, 0xd8c8b0, 16), 0, 40, 0), at(K(10, 18, 0x8e44ad, 16), 0, 89, 0));
      const hair = at(B(1.2, 70, 0.6, 0xffd23f), 6, 45, 6); hair.rotation.z = 0.06; g.add(hair);
      g.add(at(B(3, 4, 1, 0x3a2a1a), 0, 74, 7.5));
      break;
    }
    case "dom": {
      const st = 0x5a564e;
      g.add(at(B(40, 50, 120, st), 0, 25, 30));
      const roof = at(K(30, 30, 0x4a463e, 4), 0, 65, 30); roof.rotation.y = Math.PI / 4; roof.scale.set(0.95, 1, 2.6); g.add(roof);
      for (const x of [-14, 14]) { g.add(at(B(18, 110, 18, st), x, 55, -36)); g.add(at(K(11, 60, st, 8), x, 140, -36)); g.add(at(K(2, 8, 0xd4af37, 6), x, 173, -36)); }
      g.scale.setScalar(1.1);
      break;
    }
    default: return null;
  }
  return g;
}
