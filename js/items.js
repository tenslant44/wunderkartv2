import * as THREE from "three";
import { ITEMS, ITEM_TABLE } from "./data.js";
import { buildKartModel } from "./kart.js";
import { SFX } from "./audio.js";

const Lm = (c, o) => new THREE.MeshLambertMaterial({ color: c, ...o });
const pick = (a) => a[Math.floor(Math.random() * a.length)];

function itemMesh(kind) {
  const ex = extraMesh(kind); if (ex) return ex;
  const g = new THREE.Group();
  switch (kind) {
    case "pretzel": {
      const m = Lm(0xa0522d);
      const t1 = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.35, 8, 16), m); t1.position.x = -0.6; t1.scale.set(1, 1.2, 1);
      const t2 = t1.clone(); t2.position.x = 0.6;
      const t3 = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.38, 8, 20, Math.PI), m); t3.position.y = -0.3; t3.rotation.z = Math.PI;
      g.add(t1, t2, t3);
      for (let i = 0; i < 10; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), Lm(0xffffff)); s.position.set((Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 1.6, 0.4); g.add(s); }
      g.scale.setScalar(1.4); break;
    }
    case "potato": { const p = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 1), Lm(0xb08850, { flatShading: true })); p.scale.set(1.4, 0.9, 1); g.add(p); 
      for (const x of [-0.3, 0.3]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 4), Lm(0xffffff)); e.position.set(x, 0.3, 0.9); const pu = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), Lm(0x000000)); pu.position.z = 0.15; e.add(pu); g.add(e); } break; }
    case "brick": {
      const b = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 1.1), Lm(0xb5452d)); b.position.y = 0.55; g.add(b);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2, 10), Lm(0xff6600)); cone.position.set(0, 2, 0); g.add(cone);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.52, 0.3, 10), Lm(0xffffff)); band.position.set(0, 2, 0); g.add(band);
      break;
    }
    case "ice": {
      const w = Lm(0xffffff), r = Lm(0xe10600);
      const b = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 6), w); b.position.y = 1.2; g.add(b);
      const s = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.3, 6), r); s.position.y = 0.6; g.add(s);
      const n = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), w); n.scale.set(1, 1, 2); n.position.set(0, 1.2, 3); g.add(n);
      const win = new THREE.Mesh(new THREE.BoxGeometry(2.06, 0.5, 5), Lm(0x223344)); win.position.y = 1.6; g.add(win);
      g.scale.setScalar(1.3); break;
    }
    case "boar": {
      const m = Lm(0x5a3a22);
      const b = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 8), m); b.scale.set(1, 0.9, 1.5); b.position.y = 1.4; g.add(b);
      const h = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.1, 1.2), m); h.position.set(0, 1.5, 2); g.add(h);
      const sn = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.4, 8), Lm(0xd08080)); sn.rotation.x = Math.PI / 2; sn.position.set(0, 1.3, 2.7); g.add(sn);
      for (const x of [-0.5, 0.5]) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.7, 6), Lm(0xffffff)); t.position.set(x, 1.0, 2.6); t.rotation.x = -2.6; g.add(t);
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 4), Lm(0xff0000, { emissive: 0xaa0000 })); e.position.set(x * 0.8, 1.9, 2.6); g.add(e); }
      for (const [x, z] of [[-0.7, 1], [0.7, 1], [-0.7, -1], [0.7, -1]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1, 0.35), m); l.position.set(x, 0.5, z); l.name = "leg"; g.add(l); }
      g.scale.setScalar(1.2); break;
    }
    case "beer": case "stein": {
      const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.8, 12), Lm(0xf2b632, { transparent: true, opacity: 0.9 })); mug.position.y = 0.9; g.add(mug);
      const foam = new THREE.Mesh(new THREE.SphereGeometry(0.85, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), Lm(0xffffff)); foam.position.y = 1.8; g.add(foam);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.12, 6, 10, Math.PI), Lm(0xeeeeee)); handle.position.set(0.85, 0.9, 0); handle.rotation.z = -Math.PI / 2; g.add(handle);
      g.scale.setScalar(1.3); break;
    }
    case "note": {
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), Lm(0x111111)); h.scale.set(1.3, 0.9, 0.9); h.position.y = 0.7; g.add(h);
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.4, 0.15), Lm(0x111111)); st.position.set(0.8, 1.9, 0); g.add(st);
      const fl = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.25, 0.15), Lm(0x111111)); fl.position.set(1.15, 2.9, 0); fl.rotation.z = -0.5; g.add(fl);
      g.scale.setScalar(1.3); break;
    }
    case "tennis": { const b = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 8), Lm(0xd4ff3a)); g.add(b); break; }
    case "football": { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3, 1), Lm(0xffffff, { flatShading: true })); g.add(b);
      for (let i = 0; i < 6; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.4, 5, 4), Lm(0x111111)); const a = i / 6 * Math.PI * 2; p.position.set(Math.cos(a) * 1.15, Math.sin(a) * 1.15 * 0.6, Math.sin(a) * 0.6); b.add(p); } break; }
    case "pumpkin": { const b = new THREE.Mesh(new THREE.SphereGeometry(3, 12, 10), Lm(0xff8c1a)); b.scale.y = 0.8; b.position.y = 2.4; g.add(b); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 1, 6), Lm(0x2a6a2a)); st.position.y = 5; g.add(st); break; }
    case "candy": { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.4, 14), Lm(pick([0xff3b6b, 0x3bff8a, 0xffdd00]))); b.position.y = 0.9; b.rotation.x = Math.PI / 2; g.add(b); const s = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.2, 6), Lm(0xffffff)); s.position.y = 0.3; g.add(s); g.scale.setScalar(1.6); break; }
  }
  return g;
}

function extraMesh(kind) {
  const g = new THREE.Group();
  const B = (w, h, d, c) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), Lm(c));
  const S = (r, c) => new THREE.Mesh(new THREE.SphereGeometry(r, 12, 9), Lm(c));
  switch (kind) {
    case "cone": { const k = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.4, 10), Lm(0xff6a00)); k.position.y = 1.2; const b = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.35, 10), Lm(0xffffff)); b.position.y = 1.2; g.add(k, b); return g; }
    case "barrier": { for (const [y, c] of [[1.6, 0xff2020], [0.9, 0xffffff]]) { const b = B(7, 0.55, 0.25, c); b.position.y = y; g.add(b); } for (const x of [-3.2, 3.2]) { const l = B(0.2, 2, 0.2, 0x333333); l.position.set(x, 1, 0); g.add(l); const lamp = S(0.25, 0xffaa00); lamp.position.set(x, 2.2, 0); g.add(lamp); } return g; }
    case "roller": { const d = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 5, 16), Lm(0x888888)); d.rotation.z = Math.PI / 2; d.position.set(0, 1.6, 2.4); d.name = "spin"; const b = B(3.2, 2.2, 4, 0xffcc00); b.position.set(0, 2, -0.8); const c = B(2.4, 1.6, 2, 0x333333); c.position.set(0, 3.8, -1.2); g.add(d, b, c); return g; }
    case "duck": { const b = S(1.3, 0xffd400); b.scale.set(1, 0.8, 1.3); b.position.y = 1; const h = S(0.8, 0xffd400); h.position.set(0, 2.1, 0.9); const k = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 8), Lm(0xff7a00)); k.rotation.x = Math.PI / 2; k.position.set(0, 2, 1.8); g.add(b, h, k); for (const x of [-0.3, 0.3]) { const e = S(0.12, 0x111111); e.position.set(x, 2.3, 1.55); g.add(e); } return g; }
    case "bomb": { const b = S(1.2, 0x222222); b.position.y = 1.2; const f = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.8, 6), Lm(0xc8a060)); f.position.y = 2.6; const sp = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffaa00 })); sp.position.y = 3.05; g.add(b, f, sp); return g; }
    case "zeppelin": { const b = S(1, 0xd8d0c0); b.scale.set(5, 5, 14); const gnd = B(2, 1.2, 4, 0x333333); gnd.position.y = -5.4; const fin = B(0.3, 4, 3, 0xdd0000); fin.position.set(0, 2, -6.5); g.add(b, gnd, fin); return g; }
    case "crate": { const b = B(3, 3, 3, 0xb07a3a); b.position.y = 1.5; g.add(b); return g; }
    case "gnome": { const bd = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.6, 10), Lm(0x2a6ad8)); bd.position.y = 0.8; const hd = S(0.5, 0xf2c9a0); hd.position.y = 1.8; const hat = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.3, 10), Lm(0xdd2222)); hat.position.y = 2.7; const be = S(0.45, 0xffffff); be.scale.set(1, 1.2, 0.6); be.position.set(0, 1.5, 0.3); g.add(bd, hd, hat, be); g.scale.setScalar(1.3); return g; }
    case "sauerkraut": { const c = new THREE.Mesh(new THREE.CircleGeometry(4, 20), new THREE.MeshLambertMaterial({ color: 0xe8e0a0, transparent: true, opacity: 0.9 })); c.rotation.x = -Math.PI / 2; c.position.y = 0.06; g.add(c); for (let i = 0; i < 26; i++) { const s = B(0.8, 0.1, 0.12, 0xd8d080); s.position.set((Math.random() - 0.5) * 6, 0.12, (Math.random() - 0.5) * 6); s.rotation.y = Math.random() * 3; g.add(s); } return g; }
    case "dackel": { const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.6, 2.6, 4, 8), Lm(0x8a4a1a)); b.rotation.x = Math.PI / 2; b.position.y = 1; const h = S(0.6, 0x8a4a1a); h.position.set(0, 1.4, 1.9); const sn = B(0.5, 0.4, 0.7, 0x6a3a10); sn.position.set(0, 1.25, 2.5); g.add(b, h, sn); for (const x of [-0.5, 0.5]) { const e = B(0.2, 0.8, 0.5, 0x5a2a0a); e.position.set(x, 1.2, 1.8); g.add(e); } for (const z of [-1, 1]) for (const x of [-0.35, 0.35]) { const l = B(0.25, 0.6, 0.25, 0x6a3a10); l.position.set(x, 0.3, z); l.name = "leg"; g.add(l); } return g; }
    case "fogcloud": case "grill": { for (let i = 0; i < 9; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(2 + Math.random() * 2, 8, 6), new THREE.MeshLambertMaterial({ color: kind === "grill" ? 0x777777 : 0xeeeeee, transparent: true, opacity: 0.55, depthWrite: false })); s.position.set((Math.random() - 0.5) * 9, 1.5 + Math.random() * 3, (Math.random() - 0.5) * 9); g.add(s); } return g; }
    case "ramp": { const geo = new THREE.BufferGeometry(); const x = 3.5, L = 6, h = 2; geo.setAttribute("position", new THREE.Float32BufferAttribute([-x, 0, -L, x, 0, -L, x, h, 0, -x, 0, -L, x, h, 0, -x, h, 0], 3)); geo.computeVertexNormals(); g.add(new THREE.Mesh(geo, Lm(0xffd400, { side: THREE.DoubleSide }))); return g; }
  }
  return null;
}

const V3 = THREE.Vector3;
const tv = new V3(), tl = new V3(), tm = new THREE.Matrix4();
export class Items {
  constructor(G) { this.G = G; this.list = []; this.later = []; }
  clear() { for (const p of this.list) this.G.scene.remove(p.mesh); this.list = []; this.later = []; }
  roll(kart) {
    const G = this.G, n = Math.max(1, G.karts.length);
    const table = ITEM_TABLE[Math.min(3, Math.floor((kart.place - 1) / n * 4))];
    let tot = 0; for (const k in table) tot += table[k];
    let r = Math.random() * tot;
    for (const k in table) { r -= table[k]; if (r <= 0) return k; }
    return "pretzel";
  }
  after(t, fn) { this.later.push({ t, fn }); }
  // path-relative projectile
  spawn(kind, owner, o = {}) {
    const G = this.G;
    const mesh = itemMesh(o.mesh || kind); G.scene.add(mesh);
    const dir = o.back ? -1 : 1;
    const p = {
      kind, owner, mesh, pi: o.pi !== undefined ? o.pi : owner.pi, u: (o.u !== undefined ? o.u : owner.u) + (o.du !== undefined ? o.du : dir * 2.2), lat: o.lat !== undefined ? o.lat : owner.lat,
      v: (o.v || 0) * dir, h: o.h !== undefined ? o.h : 0.5, vy: o.vy || 0, life: o.life || 7, age: 0, r: o.r || 2.4,
      stat: !!o.stat, hit: o.hit || "spin", bounces: o.bounces || 0, wobble: o.wobble || 0, latV: o.latV || 0, home: o.home || 0, target: o.target || null,
      pierce: !!o.pierce, smash: !!o.smash, onLand: o.onLand, onWater: o.onWater, area: o.area, slow: o.slow, fog: o.fog, ramp: o.ramp, spin: o.spin, orbit: o.orbit, pos: new V3(), lap: owner.curLap || 1,
    };
    this.place(p); this.list.push(p);
    return p;
  }
  place(p) {
    const T = this.G.track;
    T.place(p.pi, p.u, p.lat, p.h, p.pos);
    const F = T.frame(p.pi, p.u); p.s = F.s;
    if (p.orbit !== undefined) return;
    p.mesh.position.copy(p.pos);
    tv.copy(F.t).multiplyScalar(p.v < 0 ? -1 : 1);
    tl.crossVectors(F.up, tv).normalize();
    p.mesh.quaternion.setFromRotationMatrix(tm.makeBasis(tl, F.up, tv));
  }
  update(dt) {
    const G = this.G, T = G.track;
    for (let k = this.later.length - 1; k >= 0; k--) { const l = this.later[k]; l.t -= dt; if (l.t <= 0) { this.later.splice(k, 1); l.fn(); } }
    for (let k = this.list.length - 1; k >= 0; k--) {
      const p = this.list[k];
      p.age += dt; p.life -= dt;
      if (p.life <= 0) { this.remove(k); continue; }
      if (p.orbit !== undefined) { // pretzel shield
        const o = p.owner; if (!o || !(o.orbitN > p.orbit) || o.respawnT > 0) { this.remove(k); continue; }
        const a = G.time * 4 + p.orbit * 2.094; p.pos.copy(o.pos); p.pos.x += Math.cos(a) * 3.4; p.pos.z += Math.sin(a) * 3.4; p.pos.y += 1.4;
        p.mesh.position.copy(p.pos); p.mesh.rotation.y = a;
        continue;
      }
      let path = T.paths[p.pi];
      if (!p.stat) {
        if (p.home) {
          let best = p.target, bd = 70;
          if (!best) for (const kk of G.karts) { if (kk === p.owner || kk.pi !== p.pi) continue; let d = (kk.u - p.u) * Math.sign(p.v || 1); if (path.closed) d = ((d % path.N) + path.N) % path.N; if (d > 0 && d < bd) { bd = d; best = kk; } }
          if (best && best.pi === p.pi) { const d = Math.abs(best.u - p.u); p.lat += (best.lat - p.lat) * Math.min(1, dt * p.home * (d < 12 ? 2 : 1)); if (p.kind === "dackel" && d < 30) p.v = Math.sign(p.v) * Math.max(Math.abs(p.v), Math.abs(best.speed) + 12); }
        }
        p.u += p.v * dt / path.sp;
        p.lat += p.latV * dt + Math.sin(p.age * 7) * p.wobble * dt;
        if (path.closed) { if (p.u >= path.N) p.u -= path.N; if (p.u < 0) p.u += path.N; }
        else if (p.u >= path.N - 1.2 || p.u < 0) { const w = T.place(p.pi, p.u, p.lat, 0); const pr = T.project(0, w, p.u < 0 ? path.i0 : path.i1, 14); p.pi = 0; p.u = pr.u; p.lat = Math.max(-8, Math.min(8, pr.lat)); path = T.paths[0]; }
        const s = T.frame(p.pi, p.u).s, lim = s.hw + (s.sh ? s.shw : 0) - 1.5;
        if (Math.abs(p.lat) > lim) { p.lat = Math.sign(p.lat) * lim; p.latV *= -0.8; }
        const wet = () => T.surfAt(s, p.lat, p.lap) === "water";
        if (p.vy || p.h > 0.6) {
          p.vy -= 40 * dt; p.h += p.vy * dt;
          if (p.h <= 0.5) {
            p.h = 0.5;
            if (p.onWater && wet()) { this.place(p); p.onWater(p); this.remove(k); continue; }
            if (p.bounces > 0) { p.bounces--; p.vy = Math.abs(p.vy) * 0.6 + 7; if (p.kind === "potato") { p.latV = (Math.random() - 0.5) * 30; p.v *= 0.8 + Math.random() * 0.5; } }
            else { p.vy = 0; if (p.onLand) { this.place(p); p.onLand(p); this.remove(k); continue; } }
          }
        } else if (p.onWater && wet()) { this.place(p); p.onWater(p); this.remove(k); continue; }
        if (T.gapAt(s, p.lap) && p.h < 1.5) { p.life = Math.min(p.life, 0.6); p.h -= 30 * dt; }
        this.place(p);
        if (p.spin) p.mesh.children.forEach(c => { if (c.name === "spin") c.rotation.x += dt * 8; });
        if (p.kind === "potato" || p.kind === "stein") p.mesh.rotateX(p.age * 10 % 6.283);
        if (p.kind === "boar" || p.kind === "dackel") { p.mesh.children.forEach((c, j) => { if (c.name === "leg") c.rotation.x = Math.sin(G.time * 25 + j * 2) * 0.7; }); }
        if (p.smash && T.dyn && Math.floor(p.age * 10) !== Math.floor((p.age - dt) * 10)) { if (T.dyn.hitAt(p.pos, p.r + 1, p.kind === "bomb" || p.kind === "roller" || p.kind === "ice")) G.onEnvHit && G.onEnvHit(p.pos, p.kind); }
      } else {
        if (p.kind === "note") { p.h = 0.5 + Math.abs(Math.sin(p.age * 4)) * 3; this.place(p); }
        else if (p.kind === "gnome") p.mesh.rotateY(Math.sin(p.age * 3) * 0.02);
      }
      if (p.area && Math.random() < dt * 20) G.fx.spawn(p.pos.x + (Math.random() - 0.5) * p.r * 2, p.pos.y + Math.random() * 3, p.pos.z + (Math.random() - 0.5) * p.r * 2, 0, 1.5, 0, p.area, 3, 1.2, 0, 1);
      if (p.ramp) continue;
      let gone = false;
      for (const kk of G.karts) {
        if (kk === p.owner && (p.age < (p.stat ? 1.2 : 0.7) || p.slow || p.fog)) continue;
        if (kk.respawnT > 0 || (kk.finished && !kk.isPlayer)) continue;
        const rr = p.r + kk.rad;
        if (kk.pos.distanceToSquared(p.pos) > rr * rr) continue;
        if (p.slow) { if (kk.starT <= 0 && kk.phaseT <= 0 && !kk.remote) { if (p.slow === "ice") kk.slipT = Math.max(kk.slipT || 0, 0.6); else kk.slowT = Math.max(kk.slowT, 0.4); if (G.onItemHit) G.onItemHit(kk, p); } continue; }
        if (p.fog) { if (!kk.remote) { kk.fogT = Math.max(kk.fogT, 1.2); if (G.onItemHit) G.onItemHit(kk, p); } continue; }
        if (kk.deflect > 0 && !p.stat) { kk.deflect--; G.fx.burst(p.pos, 0x00ff00, 25, 12); kk.shout("Berechnet!", true); this.remove(k); gone = true; break; }
        if (kk.orbitN > 0 && kk !== p.owner) { kk.orbitN--; G.fx.burst(p.pos, 0xa0522d, 20, 10); this.remove(k); gone = true; break; }
        const did = kk.remote ? true : kk.hit(p.hit, p.owner);
        if (did && G.onItemHit) G.onItemHit(kk, p);
        G.fx.burst(p.pos, p.kind === "stein" ? 0xf2b632 : p.kind === "gnome" || p.kind === "bomb" ? 0xff6a00 : 0xffffff, 25, 14);
        if (p.kind === "gnome") this.explode(p.pos, p.owner, 5, kk);
        if (did && p.kind === "stein" && SFX.glug) SFX.glug();
        if (!p.pierce) { this.remove(k); gone = true; break; }
      }
      if (gone || p.stat) continue;
      for (const o of T.objs.obst) if (!o.down && o.brk && o.pos.distanceToSquared(p.pos) < (o.r + p.r) ** 2) { T.dyn.hitAt(o.pos, 1); if (!p.pierce && !p.smash) { this.remove(k); break; } }
    }
  }
  remove(k) { const p = this.list[k]; this.G.scene.remove(p.mesh); this.list.splice(k, 1); }
  makeRamp(p, life = 14, power = 22) {
    const G = this.G, T = G.track, N = T.paths[p.pi].N;
    const i = ((Math.round(p.u) % N) + N) % N;
    T.objs.ramps.push({ pi: p.pi, i, lat: p.lat, w: 7, p: power, f: {}, temp: life });
    const s = this.spawn("ramp", p.owner, { pi: p.pi, u: i, du: 0, lat: p.lat, h: 0.05, stat: true, life, ramp: true });
    G.fx.burst(s.pos, 0x9fd8ff, 30, 12);
    if (p.owner && p.owner.isPlayer) G.banner("🌊 WATER RAMP!", 0.9);
  }

  use(kart, back, forced) {
    const G = this.G, T = G.track, it = forced || kart.item;
    if (!it) return;
    if (!forced) { kart.item = null; if (kart.isPlayer) G.hud.setItem(null); if (G.net && !kart.remote) G.net.sendItem(kart, it, back); }
    const sp = Math.max(30, Math.abs(kart.speed));
    const say = (a) => kart.shout(a, true);
    switch (it) {
      case "pretzel": this.spawn("pretzel", kart, { v: back ? 40 : sp + 45, back, h: 1.4, home: back ? 0 : 3, life: 6 }); break;
      case "pretzel3": kart.orbitN = 3; for (let i = 0; i < 3; i++) this.spawn("pretzel", kart, { orbit: i, life: 30, stat: true, du: 0 }); say(["Three pretzels, please!", "Pretzel shield!"]); break;
      case "potato": this.spawn("potato", kart, { v: back ? 20 : sp + 25, back, h: 2, vy: 14, bounces: 5, wobble: 4, life: 7, smash: true }); break;
      case "cone": this.spawn("cone", kart, { back: true, du: -2.5, stat: true, life: 25, r: 1.6, h: 0 }); break;
      case "barrier": this.spawn("barrier", kart, { back: true, du: -3, stat: true, life: 20, r: 3.6, h: 0, hit: "bump" }); say(["Construction zone!", "No entry!"]); break;
      case "ice": this.spawn("ice", kart, { v: sp + 55, h: 0.2, life: 9, r: 3, hit: "launch", pierce: true, smash: true }); say(["Watch the tracks!", "Please stand clear!"]); break;
      case "boar": this.spawn("boar", kart, { v: sp + 25, h: 0.3, life: 7, r: 2.6, hit: "launch", wobble: 60, smash: true }); break;
      case "roller": this.spawn("roller", kart, { v: back ? 18 : sp + 12, back, h: 0, life: 8, r: 3.2, hit: "squash", pierce: true, smash: true, spin: true }); say(["Flat as a pancake!", "Steamroller coming!"]); break;
      case "autobahn": kart.addBoost(2.2, 1.75); G.fx.burst(kart.pos, 0xffffff, 30, 12); say(["No speed limit!", "Clear road!", "Left lane!"]); break;
      case "engineering": kart.starT = 7; kart.addBoost(7, 1.25); say(["German engineering!", "Made in Germany!", "Progress through technology!"]); break;
      case "wrench": kart.armorT = 6; kart.spinT = 0; kart.squashT = 0; kart.slowT = 0; kart.reverseT = 0; kart.addBoost(1.2, 1.45); say(["Quick fix!", "Good as new!"]); break;
      case "cuckoo": {
        if (SFX.cuckoo) SFX.cuckoo(); say(["Cuckoo!", "Cuckoo! Cuckoo!"]);
        let n = 0;
        for (const k of G.karts) if (k !== kart && k.pos.distanceTo(kart.pos) < 90) { if (k.remote || k.hit("reverse", kart)) { n++; G.fx.burst(k.pos, 0xffd23f, 15, 6); } }
        if (n === 0) for (const k of G.karts) if (k !== kart && k.place < kart.place) { if (!k.remote) k.hit("reverse", kart); break; }
        break;
      }
      case "magnet": {
        const metal = kart.v.rail || kart.v.maglev || ["silber", "einkauf", "bagger", "walze", "dampf"].includes(kart.vehId);
        kart.magT = metal ? 5 : 3; kart.addBoost(metal ? 2.5 : 1.5, metal ? 1.6 : 1.45);
        say(metal ? ["Volle Anziehungskraft!", "Metall zieht!"] : ["Magnetisch!", "Komm her!"]); break;
      }
      case "fog": this.spawn("fogcloud", kart, { back: true, du: -4, stat: true, life: 14, r: 9, h: 0, fog: true }); say(["Fog of doom!", "Where am I?"]); for (const k of G.karts) if (k !== kart && k.progress < kart.progress && !k.remote) k.fogT = Math.max(k.fogT, 2.5); break;
      case "stein": if (SFX.glug) SFX.glug(); say(["Cheers!", "It's tapped!", "A toast!"]); this.spawn("stein", kart, { v: back ? 12 : sp + 30, back, h: 2, vy: back ? 8 : 12, bounces: 4, life: 7, onWater: (p) => this.makeRamp(p, 14, 22), wobble: 3 }); break;
      case "duck": {
        const onLand = (p) => { if (T.surfAt(p.s, p.lat, p.lap) === "water") this.makeRamp(p, 16, 24); else this.spawn("duck", p.owner, { pi: p.pi, u: p.u, du: 0, lat: p.lat, stat: true, life: 18, h: 0 }); };
        this.spawn("duck", kart, { v: back ? 6 : sp * 0.8, back, h: 2.4, vy: 10, life: 6, onWater: (p) => this.makeRamp(p, 16, 24), onLand });
        say(["Squeak!", "Duck, duck, hooray!"]); break;
      }
      case "railswitch": { let n = 0; for (const g of T.objs.gates) if (g.kind === "switch" || g.kind === "door") { g.switched = 15; if (g.kind === "door") g.forceOpen = 12; n++; } kart.addBoost(0.6, 1.3); if (kart.isPlayer) G.banner(n ? "🔀 SWITCHES FLIPPED!" : "🔀 NO SWITCH HERE", 1.2); break; }
      case "bomb": this.spawn("bomb", kart, { v: back ? 10 : sp + 20, back, h: 2, vy: 16, life: 5, onLand: (p) => this.explode(p.pos, p.owner, 9), r: 2, hit: "launch", smash: true }); say(["Demolition expert!", "Fire away!"]); break;
      case "zeppelin": {
        let lead = null; for (const k of G.karts) if (k !== kart && (!lead || k.progress > lead.progress)) lead = k;
        if (!lead) break;
        if (lead.isPlayer || kart.isPlayer) G.banner("🎈 ZEPPELIN CHASING " + lead.name.toUpperCase() + "!", 1.6, true);
        const zp = this.spawn("zeppelin", kart, { pi: lead.pi, u: lead.u, du: -16, lat: lead.lat, h: 28, v: Math.abs(lead.speed) + 25, life: 9, target: lead, home: 4, r: 0.01, pierce: true });
        zp.zTarget = lead; this.after(0.1, () => this.zeppelinTick(zp));
        break;
      }
      case "gnome": this.spawn("gnome", kart, { back: true, du: -2.5, stat: true, life: 30, r: 1.8, h: 0, hit: "launch" }); say(["A little gnome for you!", "Garden peace!"]); break;
      case "sauerkraut": this.spawn("sauerkraut", kart, { back: true, du: -3, stat: true, life: 18, r: 4, h: 0, slow: "ice" }); say(["Get lost!"]); break;
      case "dackel": this.spawn("dackel", kart, { v: back ? 30 : sp + 22, back, h: 0, life: 9, r: 2, hit: "side", home: 6 }); say(["Sic 'em, Waldi!", "Wuff!"]); break;
      case "grill": this.spawn("grill", kart, { back: true, du: -4, stat: true, life: 12, r: 8, h: 0, slow: true, area: 0x888888 }); say(["Grilling season!", "Want a sausage?"]); break;
      case "espresso": kart.addBoost(1.15, 1.55); kart.driftCharge += 0.55; G.fx.burst(kart.pos, 0x8b4c2b, 24, 9); say(["Espresso!", "Wide awake!"]); break;
      case "schirm": kart.shieldT = Math.max(kart.shieldT, 5); kart.addBoost(0.45, 1.25); G.fx.burst(kart.pos, 0x73d9ff, 22, 8); say(["Saved by the umbrella!", "Rain or shine!"]); break;
      case "schnitzel": this.spawn("potato", kart, { v: back ? 20 : sp + 24, back, h: 2, vy: 12, bounces: 3, wobble: 2, life: 6, r: 2.2, hit: "spin" }); say(["Dinner is served!", "Schnitzel incoming!"]); break;
      default: this.spawn("pretzel", kart, { v: sp + 45, h: 1.4, life: 6 });
    }
  }
  zeppelinTick(zp) {
    if (!this.list.includes(zp)) return;
    const t = zp.zTarget, T = this.G.track;
    if (t.respawnT > 0) { this.after(0.2, () => this.zeppelinTick(zp)); return; }
    if (zp.pi !== t.pi) { zp.pi = t.pi; zp.u = t.u - 8; }
    zp.lat = t.lat;
    if (Math.abs(zp.u - t.u) < 3) {
      const lead = Math.max(1, Math.abs(t.speed) * 0.55 / T.paths[t.pi].sp);
      this.spawn("crate", zp.owner, { pi: t.pi, u: t.u, du: lead, lat: t.lat, h: 24, vy: -12, life: 3, r: 2.6, hit: "squash", onLand: (p) => this.explode(p.pos, p.owner, 6) });
      zp.life = Math.min(zp.life, 2); zp.target = null; zp.home = 0; zp.v = 70; return;
    }
    this.after(0.05, () => this.zeppelinTick(zp));
  }
  explode(pos, owner, R, skip) {
    const G = this.G, T = G.track;
    G.fx.burst(pos, 0xff6a00, 50, 18); G.fx.burst(pos, 0x333333, 30, 10); if (SFX.boom) SFX.boom(); G.shake = Math.max(G.shake || 0, 0.6);
    for (const k of G.karts) if (k !== skip && !k.remote && k.pos.distanceTo(pos) < R + k.rad) k.hit("launch", owner);
    if (T.dyn && T.dyn.hitAt(pos, R, true) && G.onEnvHit) G.onEnvHit(pos, "bomb");
  }
  // ---------- abilities ----------
  warp(kart, meters, risky) {
    const G = this.G, T = G.track;
    G.fx.burst(kart.pos, risky ? 0xff3300 : 0x66ccff, 40, 14);
    const path = T.paths[kart.pi], pu = kart.u;
    kart.u += meters / path.sp; kart.grounded = true; kart.vel.set(0, 0, 0); kart.hop = 0; kart.hdg = kart.mh = 0; kart.inLift = false;
    for (let k = 0; k < 40; k++) { const s = T.frame(kart.pi, kart.u).s; if (!T.gapAt(s, kart.curLap) && !s.lift && s.up.y > 0.6) break; kart.u += 1; }
    const s = T.frame(kart.pi, kart.u).s; kart.lat = Math.max(-s.hw + 2, Math.min(s.hw - 2, kart.lat));
    kart.afterMove(pu, -1, 0.016);
    G.fx.burst(kart.pos, risky ? 0xff3300 : 0x66ccff, 40, 14);
  }
  ability(kart) {
    const G = this.G, a = kart.char.ability;
    G.onAbility(kart);
    if (G.net && !kart.remote) G.net.sendAbility(kart);
    const behind = (n, kind, spread = 6, life = 15, hit = "spin") => { for (let i = 0; i < n; i++) this.spawn(kind, kart, { du: -3 - i * 4, lat: kart.lat + (i - (n - 1) / 2) * spread, stat: true, life, h: 0, hit }); };
    const fwd = (kind, o) => this.spawn(kind, kart, { v: Math.abs(kart.speed) + 45, h: 1.4, life: 5, ...o });
    switch (a.type) {
      case "shield": kart.shieldT = 6; if (SFX.sting) SFX.sting("beethoven"); break;
      case "faust": if (Math.random() < 0.72) { this.warp(kart, 110, true); kart.addBoost(0.8, 1.4); } else { this.warp(kart, 60, true); kart.hit("spin"); kart.shout("Der Teufel!", true); } break;
      case "notes": behind(3, "note", 6, 14); break;
      case "bigboost": kart.shieldT = 1.2; this.after(1.2, () => { kart.addBoost(3, 1.95); G.fx.burst(kart.pos, 0xd4af37, 50, 18); }); break;
      case "drift": kart.driftBuffT = 9; kart.addBoost(0.5); break;
      case "decoy": behind(1, "crate", 0, 14); break;
      case "fairy": { const r = Math.floor(Math.random() * 3); if (r === 0) { G.banner("🎃 PUMPKIN MAGIC!", 1.4, true); behind(2, "pumpkin", 8, 15); } else if (r === 1) { G.banner("🍬 HANSEL & GRETEL!", 1.4, true); behind(5, "candy", 4, 15); } else { G.banner("✨ ONCE UPON A TIME…", 1.4, true); kart.addBoost(2, 1.6); } break; }
      case "slowworld": G.worldSlow = 4; G.worldSlowOwner = kart; G.banner("⏳ EVERYTHING IS RELATIVE!", 1.4, true); break;
      case "topspeed": kart.addBoost(3, 1.7); break;
      case "pads": kart.padsT = 12; kart.addBoost(1.2, 1.5); break;
      case "explore": if (!kart.item) { kart.item = this.roll(kart); if (kart.isPlayer) G.hud.setItem(kart.item); } kart.addBoost(1, 1.4); break;
      case "cloud": this.spawn("fogcloud", kart, { du: -5, stat: true, life: 7, r: 9, h: 0, slow: true, area: 0xffffff }); kart.addBoost(0.8, 1.35); break;
      case "phase": kart.phaseT = 5; break;
      case "multiboost": for (let i = 0; i < 5; i++) this.after(i * 0.55, () => { kart.addBoost(0.4, 1.65); G.fx.burst(kart.pos, 0xffd60a, 12, 8); }); break;
      case "momentum": kart.addBoost(1 + Math.abs(kart.speed) / 28, 1.5); break;
      case "smoke": kart.addBoost(1.6, 1.6); this.spawn("grill", kart, { du: -5, stat: true, life: 6, r: 8, h: 0, slow: true, area: 0x555555 }); break;
      case "recover": kart.recover = 1; break;
      case "deflect": kart.deflect = 3; break;
      case "driftchain": kart.driftChainT = 14; kart.chain = 0; kart.driftBuffT = 6; break;
      case "serve": for (let i = -1; i <= 1; i++) fwd("tennis", { lat: kart.lat + i * 3, latV: i * 6, r: 1.6 }); break;
      case "kick": fwd("football", { latV: (Math.random() < 0.5 ? -1 : 1) * 14, r: 2, life: 6, pierce: true }); break;
      case "pull": for (const k of G.karts) if (k !== kart && !k.remote && k.progress > kart.progress && k.progress - kart.progress < 60) k.slowT = Math.max(k.slowT, 1.5); kart.addBoost(1.2, 1.5); break;
      case "anchor": kart.anchorT = 5; kart.addBoost(1, 1.3); break;
      case "route": this.warp(kart, 70, false); kart.addBoost(1, 1.4); break;
      case "absorb": kart.absorb = 1; break;
      default: kart.addBoost(1.5, 1.5);
    }
  }
}
export { itemMesh };
