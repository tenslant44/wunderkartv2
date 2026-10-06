import * as THREE from "three";
import { PHRASES } from "./data.js";
import { SURF, CLS } from "./envs.js";
import { buildVehicle, terrMul, gripMul, VEH } from "./vehicles.js";
import { gateOpen, breakGate } from "./trackfeat.js";
import { smashObst } from "./dyn.js";

export const GRAV = 46;
const V3 = THREE.Vector3;
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const Lm = (c, o) => new THREE.MeshLambertMaterial({ color: c, ...o });
const SKIN = 0xf2c9a0;
function sph(r, c, ws = 14, hs = 10) { return new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), typeof c === "number" ? Lm(c) : c); }
function box(w, h, d, c) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof c === "number" ? Lm(c) : c); }
function cyl(rt, rb, h, c, s = 12) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, s), typeof c === "number" ? Lm(c) : c); }
const P = (m, x, y, z) => (m.position.set(x, y, z), m);

function buildHead(look) {
  const head = new THREE.Group();
  head.add(sph(1, SKIN, 18, 14));
  const nose = P(sph(0.22, SKIN), 0, -0.05, 0.98); nose.scale.set(1, 1.1, 1.3); head.add(nose);
  const eyes = [];
  for (const x of [-0.36, 0.36]) { const w = P(sph(0.27, 0xffffff), x, 0.22, 0.82); w.scale.z = 0.6; const pu = P(sph(0.12, 0x111111, 8, 6), 0, 0, 0.22); w.add(pu); head.add(w); eyes.push({ w, pu }); }
  const brows = [];
  for (const x of [-0.36, 0.36]) { const b = P(box(0.42, 0.09, 0.1, look.hair === "einstein" || look.hair === "wig" ? 0xdddddd : look.hc), x, 0.55, 0.88); head.add(b); brows.push(b); }
  const mouth = P(box(0.5, 0.08, 0.1, 0x5a1010), 0, -0.42, 0.9); head.add(mouth);
  const hc = look.hc;
  const cap = (c = hc, s = 1.06) => { const m = sph(s, c, 16, 10); m.scale.set(1, 0.85, 1); m.position.set(0, 0.22, -0.12); return m; };
  const stach = (c = hc, w = 0.7) => P(box(w, 0.16, 0.2, c), 0, -0.26, 0.95);
  switch (look.hair) {
    case "wild": head.add(cap()); for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; head.add(P(sph(0.42, hc, 8, 6), Math.cos(a) * 0.95, 0.35 + Math.sin(i * 1.7) * 0.25, Math.sin(a) * 0.8 - 0.3)); } break;
    case "wig": head.add(cap(0xf5f5f5, 1.08)); for (const x of [-1, 1]) for (let k = 0; k < 3; k++) head.add(P(sph(0.36, 0xf5f5f5, 8, 6), x, 0.1 - k * 0.42, -0.1)); break;
    case "beret": { head.add(cap(hc, 1.02)); const b = P(cyl(1.1, 1.1, 0.3, 0x111111, 16), 0.15, 0.95, -0.05); b.rotation.z = -0.25; head.add(b); break; }
    case "bun": head.add(cap()); head.add(P(sph(0.5, hc, 10, 8), 0, 0.55, -0.95)); break;
    case "tophat": head.add(cap(hc, 1.04)); head.add(P(cyl(1.3, 1.3, 0.1, 0x111111, 16), 0, 0.85, 0)); head.add(P(cyl(0.75, 0.8, 1.4, 0x111111, 16), 0, 1.55, 0)); head.add(P(cyl(0.82, 0.82, 0.2, 0xc9a227, 16), 0, 1.0, 0)); break;
    case "einstein": for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; head.add(P(sph(0.48, 0xffffff, 8, 6), Math.cos(a) * 1.05, 0.45 + Math.sin(i * 2.3) * 0.35, Math.sin(a) * 0.9 - 0.35)); } head.add(stach(0xffffff, 0.8)); break;
    case "beard": { head.add(cap()); const b = P(sph(0.75, hc, 10, 8), 0, -0.6, 0.45); b.scale.set(1.05, 0.9, 0.7); head.add(b); head.add(stach()); break; }
    case "bald": for (const x of [-0.95, 0.95]) head.add(P(sph(0.3, hc, 8, 6), x, 0.05, -0.2)); head.add(stach(hc, 0.55)); head.add(P(box(1.1, 0.06, 0.06, 0x222222), 0, 0.22, 1.0)); break;
    case "short": head.add(cap()); break;
    case "helmet": { const h = sph(1.22, 0xdd0000, 18, 12); h.position.y = 0.1; head.add(h); head.add(P(box(1.6, 0.5, 0.5, Lm(0x111111, { emissive: 0x111133 })), 0, 0.2, 1.0)); eyes.forEach(e => e.w.visible = false); break; }
    case "pickel": { const h = sph(1.08, 0x1a1a1a, 16, 10); h.scale.set(1, 0.7, 1); h.position.y = 0.45; head.add(h); head.add(P(new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.9, 8), Lm(0xd4af37)), 0, 1.4, 0)); const m = stach(0xd0d0d0, 1.5); m.scale.y = 1.5; head.add(m); break; }
    case "bob": { head.add(cap(hc, 1.1)); for (const x of [-1, 1]) head.add(P(box(0.35, 1.0, 1.2, hc), x * 0.95, -0.2, -0.1)); head.add(P(box(1.5, 0.3, 0.3, hc), 0, 0.75, 0.75)); break; }
    case "ponytail": { head.add(cap()); const t = P(cyl(0.22, 0.12, 1.3, hc, 8), 0, 0.2, -1.2); t.rotation.x = 0.8; head.add(t); break; }
    case "side": head.add(cap()); for (const x of [-1, 1]) { head.add(P(sph(0.34, hc, 8, 6), x * 0.95, 0.15, -0.15)); head.add(P(sph(0.3, hc, 8, 6), x * 0.95, -0.25, -0.15)); } break;
    case "duo": head.add(cap()); head.add(stach(hc, 0.5)); break;
  }
  return { head, eyes, brows, mouth };
}

export function buildKartModel(char, vehId) {
  const look = char.look, v = VEH[vehId] || VEH.flitzer;
  const root = new THREE.Group();
  const tilt = new THREE.Group(); root.add(tilt);
  const fx = new THREE.Group(); tilt.add(fx);
  const V = buildVehicle(v, look);
  fx.add(V.body);
  const driver = new THREE.Group(); driver.position.set(V.seat[0], V.seat[1], V.seat[2]); fx.add(driver);
  driver.add(P(box(1.3, 1.3, 0.9, look.suit), 0, 0.65, 0));
  const heads = [];
  const mk = (x) => { const h = buildHead(look); h.head.position.set(x, 2.15, 0.05); h.head.scale.setScalar(0.95); driver.add(h.head); heads.push(h); };
  if (look.hair === "duo") { mk(-0.62); mk(0.62); driver.children[0].scale.x = 1.6; } else mk(0);
  const arms = [];
  for (const x of [-0.75, 0.75]) {
    const sh = new THREE.Group(); sh.position.set(x * (look.hair === "duo" ? 1.5 : 1), 1.1, 0.1);
    const a = P(cyl(0.18, 0.18, 1.3, look.suit, 6), 0, -0.1, 0.55); a.rotation.x = Math.PI / 2 - 0.5; sh.add(a);
    sh.add(P(sph(0.24, 0xffffff, 8, 6), 0, -0.42, 1.15));
    driver.add(sh); arms.push(sh);
  }
  const wheelS = P(new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.08, 6, 14), Lm(0x111111)), 0, 0.85, 1.25); wheelS.rotation.x = -0.6; driver.add(wheelS);
  fx.scale.setScalar(V.scale);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(2.4, 18), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
  const aura = new THREE.Mesh(new THREE.SphereGeometry(3.6, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.25, depthWrite: false }));
  aura.position.y = 1.6; aura.visible = false; tilt.add(aura);
  const plat = new THREE.Mesh(new THREE.BoxGeometry(8, 0.5, 8), Lm(0x8a9aaa)); plat.position.y = -0.3; plat.visible = false; root.add(plat);
  return { root, tilt, fx, body: V.body, wheels: V.wheels, driver, heads, arms, wheelS, shadow, aura, plat, veh: v };
}

// ======================================================
const tq = new THREE.Quaternion(), tm = new THREE.Matrix4(), tf = new V3(), tl = new V3(), tv = new V3(), tw = new V3();
const FR = { p: new V3(), t: new V3(), r: new V3(), up: new V3() };

export class Kart {
  constructor(char, vehId, isPlayer, G, idx, opts = {}) {
    this.char = char; this.vehId = vehId; this.v = VEH[vehId] || VEH.flitzer; this.isPlayer = isPlayer; this.G = G; this.idx = idx;
    this.remote = !!opts.remote; this.netId = opts.netId; this.name = opts.name || char.short; this.isBot = !isPlayer && !this.remote;
    this.m = buildKartModel(char, this.v.id);
    G.scene.add(this.m.root); G.scene.add(this.m.shadow);
    const v = this.v, c = char;
    this.maxSpeed = (v.spd + (c.spd - 3) * 0.8) * 1.14;
    this.accel = (v.acc === 0 ? 7 : v.acc + (c.acc - 3) * 1.6) * 1.16;
    this.turn = (v.hnd === 0 ? 0 : v.hnd + (c.hnd - 3) * 0.06) * 1.08;
    this.weight = v.wt === 0 ? 0 : v.wt + (c.wt - 3) * 0.4;
    this.rad = v.tiny ? 1.35 : v.wt >= 5.5 ? 2.0 : 1.65;
    this.pos = new V3(); this.vel = new V3(); this.knock = new V3(); this.quat = new THREE.Quaternion();
    this.pi = 0; this.u = 0; this.lat = 0; this.hdg = 0; this.mh = 0; this.speed = 0; this.hop = 0; this.vh = 0; this.grounded = true; this.aYaw = 0;
    this.lap = 0; this.half = false; this.progress = 0; this.finished = false; this.finishTime = 0; this.mainU = 0;
    this.boostT = 0; this.boostPow = 1; this.drift = 0; this.driftCharge = 0; this.driftLvl = 0; this.pendingDrift = false;
    this.airT = 0; this.canTrick = false; this.trickT = 0; this.tricks = 0; this.trickAxis = 0; this.trickDir = 1;
    this.spinT = 0; this.flipT = 0; this.squashT = 0; this.reverseT = 0; this.slowT = 0; this.starT = 0; this.fogT = 0; this.armorT = 0; this.magT = 0; this.slipT = 0;
    this.shieldT = 0; this.phaseT = 0; this.absorb = 0; this.recover = 0; this.deflect = 0; this.anchorT = 0; this.driftBuffT = 0; this.padsT = 0; this.chain = 0; this.driftChainT = 0;
    this.item = null; this.item2 = 0; this.rouletteT = 0; this.ability = 0; this.respawnT = 0; this.safe = { pi: 0, u: 0 }; this.landT = 0;
    this.talkT = 0; this.mood = "normal"; this.moodT = 0; this.wallT = 0; this.surf = "asphalt"; this.cls = "road"; this.grind = false; this.inLift = false; this.wallRide = 0;
    this.ai = { lane: (Math.random() - 0.5) * 0.6, laneT: 0, skill: this.isBot ? 1.85 + Math.random() * 0.15 : 0.9 + Math.random() * 0.1, itemT: 0, driftT: 0, trick: this.isBot ? 1.35 + Math.random() * 0.25 : 0.4 + Math.random() * 0.6, short: Math.random(), take: null };
    this.lastShout = 0; this.place = 1; this.style = 0; this.nearT = 0; this.hitStunMul = v.sturdy ? 0.6 : 1;
  }
  get curLap() { return Math.max(1, this.lap + 1); }
  get T() { return this.G.track; }
  setStart(u, lat) {
    const T = this.T; this.pi = 0; this.u = u; this.lat = lat; this.hdg = this.mh = 0; this.grounded = true;
    this.safe = { pi: 0, u };
    T.place(0, u, lat, 0, this.pos);
    this.syncOrient(1);
    this.m.root.position.copy(this.pos);
  }
  shout(cat, force) {
    const t = this.G.time;
    if (!force && t - this.lastShout < 1.6) return;
    this.lastShout = t;
    const txt = Array.isArray(cat) ? pick(cat) : (PHRASES[cat] ? (Math.random() < 0.25 && this.char.lines ? pick(this.char.lines) : pick(PHRASES[cat])) : cat);
    this.talkT = 1.2;
    this.G.say(this, txt);
  }
  setMood(m, t = 1.2) { this.mood = m; this.moodT = t; }
  addBoost(t, pow = 1.35) { const v = this.v; t *= v.bdur; pow = 1 + (pow - 1) * v.boost; this.boostT = Math.max(this.boostT, t); this.boostPow = Math.max(this.boostT > 0 ? this.boostPow : 1, pow); this.G.onBoost(this); }
  hit(type, src) {
    if (this.remote) return true; // the victim's own client resolves hits
    if (this.finished && !this.isPlayer) return false;
    if (this.starT > 0 || this.phaseT > 0 || this.respawnT > 0) return false;
    const soft = type === "reverse" || type === "fog" || type === "slow" || type === "pull";
    if (!soft && this.absorb > 0) { this.absorb = 0; this.shout("Alternativlos.", true); this.G.fx.burst(this.pos, 0x1e88e5, 30, 12); return false; }
    if (!soft && this.recover > 0) { this.recover = 0; this.addBoost(1.2, 1.4); this.shout("Ingenieursmodus!", true); this.G.fx.burst(this.pos, 0xc8102e, 30, 12); return false; }
    if (!soft && this.armorT > 0) { this.G.fx.burst(this.pos, 0xc0c0c0, 20, 10); this.armorT = Math.max(0, this.armorT - 1.5); return false; }
    if (this.shieldT > 0 && (type === "bump" || type === "spin" || type === "launch")) { this.G.fx.burst(this.pos, 0xffd23f, 20, 10); return false; }
    if (this.anchorT > 0 && type === "bump") return false;
    const G = this.G, m = this.hitStunMul;
    switch (type) {
      case "spin": this.spinT = 1.1 * m; this.speed *= 0.35; this.drift = 0; break;
      case "side": this.spinT = 0.6 * m; this.speed *= 0.6; this.drift = 0; this.knockSide = (Math.random() < 0.5 ? -1 : 1) * 26; break;
      case "launch": this.spinT = 1.4 * m; this.flipT = 1.0; this.speed *= 0.3; this.drift = 0; this.launch(24, true); break;
      case "squash": this.squashT = 1.6 * m; this.speed *= 0.15; this.drift = 0; break;
      case "reverse": this.reverseT = 3.5; this.shout("What the heck?!", true); this.setMood("dizzy", 3.5); G.onHit(this, type, src); return true;
      case "fog": this.fogT = 4; G.onHit(this, type, src); return true;
      case "bump": this.speed *= 0.7; this.spinT = Math.max(this.spinT, 0.35 * m); break;
      case "slow": this.slowT = 2; break;
      case "pull": return true;
    }
    this.boostT = 0;
    this.setMood("scared", 1.6);
    if (type !== "slow") this.shout("hit", true);
    if (src && src !== this && src.shout && type !== "slow") setTimeout(() => src.shout("hitOther"), 400);
    G.onHit(this, type, src);
    return true;
  }
  // ---------- frame helpers ----------
  frame() { return this.T.frame(this.pi, this.u, FR); }
  syncOrient(rate) {
    const F = this.frame();
    if (this.grounded) {
      if (this.inLift) { const y = this.liftYaw || 0; tf.set(Math.sin(y), 0, Math.cos(y)); tv.set(0, 1, 0); }
      else { tf.copy(F.t).multiplyScalar(Math.cos(this.hdg)).addScaledVector(F.r, -Math.sin(this.hdg)).normalize(); tv.copy(F.up); }
    } else {
      tf.set(Math.sin(this.aYaw), 0, Math.cos(this.aYaw)); const pitch = clamp(-this.vel.y * 0.012, -0.5, 0.5); tf.y = -Math.sin(pitch) * 0; tf.normalize();
      tv.set(0, 1, 0).addScaledVector(tf, Math.sin(clamp(this.vel.y * 0.01, -0.45, 0.45))).normalize();
      tf.addScaledVector(tv, -tf.dot(tv)).normalize();
    }
    tl.crossVectors(tv, tf).normalize();
    tm.makeBasis(tl, tv, tf); tq.setFromRotationMatrix(tm);
    if (rate >= 1) this.quat.copy(tq); else this.quat.slerp(tq, rate);
  }
  worldFwd(out) { const F = this.frame(); return out.copy(F.t).multiplyScalar(Math.cos(this.mh)).addScaledVector(F.r, -Math.sin(this.mh)).normalize(); }
  // transfer kart onto another path at world position
  transferTo(pi, u, lat) {
    const T = this.T;
    const fdir = this.worldFwd(new V3()), face = new V3(), F0 = this.frame();
    face.copy(F0.t).multiplyScalar(Math.cos(this.hdg)).addScaledVector(F0.r, -Math.sin(this.hdg));
    this.pi = pi; this.u = u; this.lat = lat;
    const F = this.frame();
    this.mh = Math.atan2(-fdir.dot(F.r), fdir.dot(F.t));
    this.hdg = Math.atan2(-face.dot(F.r), face.dot(F.t));
    if (pi !== 0 && T.paths[pi].label && this.isPlayer) this.G.onShortcut(this, T.paths[pi]);
  }
  launch(p, hitLaunch) {
    if (!this.grounded) { this.vel.y = Math.max(this.vel.y, p); return; }
    const F = this.frame();
    this.worldFwd(this.vel).multiplyScalar(this.speed);
    if (this.T.S && F.s.conv) this.vel.addScaledVector(F.t, F.s.conv);
    this.vel.addScaledVector(F.up, p + this.vh);
    this.grounded = false; this.hop = 0; this.vh = 0;
    this.aYaw = Math.atan2(this.vel.x, this.vel.z) + (this.hdg - this.mh);
    if (Math.hypot(this.vel.x, this.vel.z) < 2) { tf.copy(F.t).multiplyScalar(Math.cos(this.hdg)).addScaledVector(F.r, -Math.sin(this.hdg)); this.aYaw = Math.atan2(tf.x, tf.z); }
    this.airT = 0; this.canTrick = !hitLaunch; this.tricks = 0; this.trickT = 0;
  }
  // ---------- main update ----------
  update(dt, inp) {
    const G = this.G, T = this.T, time = G.time;
    for (const k of ["boostT", "spinT", "flipT", "squashT", "reverseT", "slowT", "starT", "shieldT", "phaseT", "anchorT", "driftBuffT", "padsT", "talkT", "moodT", "wallT", "trickT", "landT", "driftChainT", "fogT", "armorT", "magT", "nearT", "slipT"]) if (this[k] > 0) this[k] = Math.max(0, this[k] - dt);
    if (this.moodT <= 0) this.mood = "normal";
    if (this.respawnT > 0) { this.respawnT -= dt; this.updateRespawn(dt); this.animate(dt, 0); return; }
    if (G.worldSlow > 0 && G.worldSlowOwner !== this) dt *= 0.55;
    let steer = inp.steer || 0;
    if (this.reverseT > 0) steer = -steer;
    const ctrl = this.spinT <= 0 && this.squashT <= 0 && G.racing;
    if (!ctrl) steer = 0;
    let throttle = ctrl ? (inp.throttle || 0) : 0;
    const brake = ctrl ? inp.brake : false;
    const v = this.v;
    let top = this.maxSpeed * (this.isBot ? (this.aiSpeedMul || 1) : 1);
    if (this.boostT > 0) top *= this.boostPow;
    if (this.starT > 0) top *= 1.25;
    if (this.slowT > 0) top *= 0.55;
    if (this.magT > 0) top *= 1.15;
    if (this.grounded) this.groundStep(dt, inp, steer, throttle, brake, top, ctrl);
    else this.airStep(dt, inp, steer, throttle, top, ctrl);
    // item roulette
    if (this.rouletteT > 0) { this.rouletteT -= dt; if (this.rouletteT <= 0) G.finishRoulette(this); }
    this.ability = Math.min(1, this.ability + dt / 22 * (this.drift ? 1.8 : 1));
    if (ctrl && inp.item && this.item && this.rouletteT <= 0) G.useItem(this, inp.back);
    if (ctrl && inp.ability && this.ability >= 1) { this.ability = 0; G.useAbility(this); }
    this.animate(dt, steer);
  }
  groundStep(dt, inp, steer, throttle, brake, top, ctrl) {
    const G = this.G, T = this.T, v = this.v, lap = this.curLap;
    const path = T.paths[this.pi];
    let F = this.frame(); let s = F.s;
    const prevU = this.u, prevPi = this.pi;
    // ---- lift ----
    if (s.lift) {
      if (!this.inLift) { this.inLift = true; const a = F.a; const prev = path.S[Math.max(0, (a.i - 12 + path.N) % path.N)]; this.liftYaw = Math.atan2(prev.t.x, prev.t.z); G.onLift && G.onLift(this); }
      this.speed = s.lift; this.drift = 0; this.hdg *= 0.9; this.mh *= 0.9; this.lat *= Math.exp(-dt * 3);
      this.u += this.speed * dt / path.sp; this.hop = 0;
      this.afterMove(prevU, prevPi, dt);
      return;
    } else if (this.inLift) { this.inLift = false; this.speed = Math.max(this.speed, 22); this.addBoost(0.6, 1.3); }
    // ---- surface ----
    const surfName = T.surfAt(s, this.lat, lap);
    const SU = SURF[surfName] || SURF.asphalt, cls = SU.cls, C = CLS[cls];
    if (this.cls !== cls && this.isPlayer && G.onSurface) G.onSurface(this, cls, this.cls);
    this.surf = surfName; this.cls = cls;
    let pen = C.pen * terrMul(v, cls);
    if (this.starT > 0 || this.armorT > 0) pen = Math.min(pen, 0);
    let grip = gripMul(v, cls) * v.grip;
    this.grind = !!s.grind;
    let topS = top * (1 - pen);
    if (this.grind) topS *= v.rail ? 1.16 : 1.07;
    if (SU.metal && (v.rail || v.maglev)) topS *= 1.06;
    if (this.armorT > 0) this.speed += this.accel * 0.4 * dt;
    // ---- throttle ----
    const sp0 = this.speed;
    if (throttle > 0) {
      if (this.speed < topS) this.speed = Math.min(topS, this.speed + this.accel * throttle * dt * (this.speed < topS * 0.5 ? 1.4 : 1) * (0.6 + 0.4 * Math.min(1, grip + 0.3)));
      else this.speed = lerp(this.speed, topS, 1 - Math.exp(-dt * (pen > 0.1 ? 2.2 : 1.2)));
    } else if (brake) this.speed = Math.max(-18, this.speed - 50 * dt);
    else this.speed *= Math.exp(-dt * (0.8 + pen * 1.5));
    if (this.boostT > 0) this.speed = Math.max(this.speed, topS * 0.98);
    // slope gravity
    this.speed -= 21 * F.t.y * Math.cos(this.mh) * dt;
    // ---- steering / drift ----
    const sp = Math.abs(this.speed);
    const steerF = Math.min(1, sp / 12) * (this.speed < 0 ? -1 : 1);
    if (this.slipT > 0) { grip *= 0.25; this.hdg += Math.sin(G.time * 9 + this.idx) * dt * 1.4; }
    const turn = this.turn * (0.78 + 0.22 * Math.min(1, grip));
    if (this.drift) {
      const d = this.drift;
      const rate = (d * 0.85 + steer * 0.6) * turn * 1.15 * v.drift;
      this.hdg += rate * dt * steerF;
      this.mh += angDiff(this.mh, this.hdg - d * 0.28) * Math.min(1, dt * 4.5 * Math.max(0.35, grip));
      let ch = (0.55 + Math.abs(steer + d) * 0.45) * dt * v.drift;
      if (this.driftBuffT > 0) ch *= 2;
      this.driftCharge += ch;
      const lvl = this.driftCharge > 2.1 ? 3 : this.driftCharge > 1.2 ? 2 : this.driftCharge > 0.45 ? 1 : 0;
      if (lvl > this.driftLvl) { this.driftLvl = lvl; G.onDriftLevel(this, lvl); }
      this.speed *= Math.exp(-dt * 0.08);
      if (!inp.drift || sp < 12) this.endDrift();
    } else {
      this.hdg += steer * turn * dt * steerF * (1 - Math.min(0.35, sp / 200));
      this.mh += angDiff(this.mh, this.hdg) * Math.min(1, dt * 14 * grip * grip);
      if (this.pendingDrift && inp.drift && Math.abs(steer) > 0.25 && sp > 18 && this.hop <= 0) { this.drift = Math.sign(steer); this.driftCharge = 0; this.driftLvl = 0; this.pendingDrift = false; }
      if (!inp.drift) this.pendingDrift = false;
    }
    // hop
    if (inp.driftPressed && ctrl && sp > 8 && this.hop <= 0) { this.vh = 8.5; this.hop = 0.01; this.pendingDrift = true; }
    if (this.hop > 0) { this.vh -= GRAV * dt; this.hop += this.vh * dt; if (this.hop <= 0) { this.hop = 0; this.vh = 0; this.landT = 0.15; if (inp.drift && Math.abs(inp.steer) > 0.25 && sp > 18 && this.spinT <= 0) { this.drift = Math.sign(inp.steer); this.driftCharge = 0; this.driftLvl = 0; this.pendingDrift = false; } } }
    // ---- move in track space ----
    const kt = s.kt || 0;
    const stretch = clamp(1 + this.lat * kt, 0.4, 2.5);
    const along = this.speed * Math.cos(this.mh) + (s.conv || 0);
    let latV = -this.speed * Math.sin(this.mh);
    // knock (world)
    if (this.knock.lengthSq() > 0.01) { latV += this.knock.dot(F.r); this.u += this.knock.dot(F.t) * dt / path.sp; this.knock.multiplyScalar(Math.exp(-dt * 4)); }
    if (this.knockSide) { latV += this.knockSide; this.knockSide *= Math.exp(-dt * 5); if (Math.abs(this.knockSide) < 0.5) this.knockSide = 0; }
    // lateral gravity on steep banks/walls when slow
    const rollG = F.r.y;
    if (Math.abs(rollG) > 0.45) { const need = 26; latV += -rollG * Math.max(0, need - sp) * 0.9; this.wallRide = Math.abs(rollG); } else this.wallRide = 0;
    const du = along * dt / (path.sp * stretch);
    this.u += du;
    this.lat += latV * dt;
    const dHead = kt * du * path.sp;
    this.hdg -= dHead; this.mh -= dHead;
    // detach from walls/loops when too slow
    if (F.up.y < 0.35 && sp < 22) { this.launch(1); this.G.onDetach && this.G.onDetach(this); return; }
    this.afterMove(prevU, prevPi, dt, true);
  }
  // shared: wrap, branch transfer, edges, features, pos
  afterMove(prevU, prevPi, dt, full) {
    const G = this.G, T = this.T, lap = this.curLap;
    let path = T.paths[this.pi];
    // branch end -> main
    if (!path.closed && (this.u >= path.N - 1.2 || this.u < 0)) {
      T.place(this.pi, this.u, this.lat, 0, tw);
      const pr = T.project(0, tw, this.u < 0 ? path.i0 : path.i1, 14);
      this.xfer = { pi: this.pi, t: 0.8 };
      this.transferTo(0, pr.u, pr.lat); path = T.paths[0]; prevPi = -1;
    }
    if (path.closed) {
      const N = path.N;
      if (this.u >= N) { this.u -= N; }
      else if (this.u < 0) { this.u += N; }
    }
    if (this.xfer && this.xfer.t > 0) this.xfer.t -= dt;
    let F = this.frame(), s = F.s;
    // ---- edges ----
    const shw = s.sh ? s.shw : 0, L = s.hw + shw, edge = L - (this.v.tiny ? 0.9 : 1.25);
    if (Math.abs(this.lat) > edge && !this.inLift) {
      const side = Math.sign(this.lat), wall = side < 0 ? s.wallL : s.wallR, open = side < 0 ? s.openL : s.openR;
      let handled = false;
      if (wall && !open) {
        handled = true;
        const push = Math.abs(this.lat) - edge; this.lat = side * edge;
        const into = -Math.sin(this.mh) * side;
        if (into > 0.05) {
          const hard = into > 0.45 && Math.abs(this.speed) > 30;
          this.mh *= hard ? 0.3 : 0.5; this.hdg += angDiff(this.hdg, 0) * (hard ? 0.4 : 0.15);
          this.speed *= hard ? 0.75 : 0.985;
          if (hard) { this.knockSide = -side * 12; if (this.wallT <= 0) { this.shout("wall"); this.setMood("scared", 0.6); G.onWall(this, true, side); } this.wallT = 0.6; }
          else if (Math.abs(this.speed) > 25) G.onWall(this, false, side, F);
        }
      } else {
        // try another surface (fork / join / jump-over)
        T.place(this.pi, this.u, this.lat, 0, tw);
        let best = null;
        const xf = this.xfer && this.xfer.t > 0 ? this.xfer.pi : -1;
        T.query(tw.x, tw.z, 30, (q) => {
          if (q.pi === this.pi && Math.abs(q.i - F.i) < 30) return;
          if (q.pi === xf) return;
          if (this.pi === 0 && q.pi !== 0 && q.i > T.paths[q.pi].N * 0.4) return;
          tv.set(tw.x - q.x, tw.y - q.y, tw.z - q.z);
          const al = tv.dot(q.t); if (Math.abs(al) > 1.6) return;
          const h = tv.dot(q.up); if (Math.abs(h) > 1.6) return;
          const la = tv.dot(q.r), Lq = q.hw + (q.sh ? q.shw : 0) - 0.4; if (Math.abs(la) > Lq) return;
          if (T.gapAt(q, lap)) return;
          const sc = Math.abs(h) + Math.max(0, Math.abs(la) - q.hw) * 0.1;
          if (!best || sc < best.sc) best = { q, al, la, sc };
        });
        if (best) { handled = true; this.xfer = { pi: this.pi, t: 0.5 }; this.transferTo(best.q.pi, best.q.i + best.al / T.paths[best.q.pi].sp, best.la); F = this.frame(); s = F.s; }
        else if (open) { handled = true; this.lat = side * Math.min(Math.abs(this.lat), L + 8); this.lat -= side * 16 * dt; }
        else if (s.soft) { handled = true; this.lat = side * Math.min(Math.abs(this.lat), edge + 0.5); this.speed *= Math.exp(-dt * 1.8); this.mh += angDiff(this.mh, 0) * Math.min(1, dt * 3); if (Math.abs(this.speed) > 20 && Math.random() < 0.3) G.onBush && G.onBush(this); }
        else if (Math.abs(this.lat) > L + 0.4) { this.launch(0); this.G.onEdge && this.G.onEdge(this); return; }
        else handled = true;
      }
    }
    // gaps
    if (T.gapAt(s, lap) && !s.lift && this.hop <= 0.5) { this.launch(0); return; }
    // crest launch
    if (full && !s.nl && this.speed > 20 && s.kv < 0) {
      if (-s.kv * this.speed * this.speed > GRAV * Math.max(0.2, F.up.y) * 1.08) { this.launch(0); this.canTrick = true; return; }
    }
    if (full) this.checkFeatures(prevU, prevPi, F);
    // safe point
    if (Math.abs(this.lat) < s.hw && !T.gapAt(s, lap) && !s.lift && F.up.y > 0.6) { this.safe.pi = this.pi; this.safe.u = this.u; }
    T.place(this.pi, this.u, this.lat, this.hop, this.pos);
    this.updateProgress(s);
  }
  updateProgress(s) {
    const T = this.T, N = T.N;
    const mu = this.pi === 0 ? this.u : s.mainU;
    if (!this.half && mu > N * 0.4 && mu < N * 0.6) this.half = true;
    if (this.half && this.mainU > N * 0.75 && mu < N * 0.25) { this.half = false; this.lap++; this.mainU = mu; this.progress = this.lap * N + mu; this.G.onLap(this); return; }
    this.mainU = mu;
    this.progress = this.lap * N + mu;
  }
  checkFeatures(prevU, prevPi, F) {
    const G = this.G, T = this.T, O = T.objs, lap = this.curLap, path = T.paths[this.pi];
    if (prevPi !== this.pi) return;
    const N = path.N;
    let a = prevU, b = this.u;
    if (path.closed && b < a - N / 2) b += N;
    if (b <= a) return;
    const passed = (i) => { let ii = i; if (path.closed && ii < a - 1) ii += N; return ii > a && ii <= b; };
    for (const r of O.ramps) if (r.pi === this.pi && passed(r.i) && T.lapOk(r.f, lap) && Math.abs(this.lat - r.lat) < r.w / 2 + 1) {
      if (r.dyn && !r.dyn.open && r.f.onlyOpen) continue;
      this.launch(r.p + Math.abs(this.speed) * 0.07); this.canTrick = true; G.onRamp(this, r); return;
    }
    for (const p of O.pads) if (p.pi === this.pi && passed(p.i) && T.lapOk(p.f, lap) && Math.abs(this.lat - p.lat) < p.w / 2 + 1.2) {
      if (p.kind === "boost") { this.addBoost(1.0, this.padsT > 0 ? 1.7 : 1.42); this.shout("boost"); G.onPad(this, p); }
      else { this.launch(p.p); this.canTrick = true; G.onBounce(this); return; }
    }
    for (const tr of O.triggers) if (tr.pi === this.pi && passed(tr.i)) G.onTrigger(this, tr);
    // gate
    if (path.gate && passed(path.gate.i)) {
      const g = path.gate;
      if (!gateOpen(T, g, this)) {
        const sp = Math.abs(this.speed);
        const can = this.starT > 0 || (g.kind === "hidden" && sp > 12) || (g.kind === "smash" && (this.v.smash || this.boostT > 0 || this.armorT > 0 || sp > 58)) || (g.kind === "bomb" && (this.v.smash && this.boostT > 0));
        if (can) { breakGate(T, g); G.onSmash(this, g.pos, true); this.speed *= 0.92; G.onStyle && G.onStyle(this, "BREAKTHROUGH!", 150); }
        else { this.u = g.i - 0.8; this.speed = -Math.abs(this.speed) * 0.3; this.spinT = 0.3; G.onWall(this, true, 0); if (this.isPlayer) G.banner(g.kind === "lap" ? "STILL LOCKED!" : g.kind === "bomb" ? "BOMBS ONLY!" : g.kind === "door" ? "GATE CLOSED!" : g.kind === "switch" ? "FLIP THE SWITCH!" : "TOO SLOW!", 1); }
      }
    }
    // obstacles
    const kr = this.rad;
    for (const o of O.obst) {
      if (o.down || o.pi !== this.pi) continue;
      let di = o.i - this.u; if (path.closed) { if (di > N / 2) di -= N; if (di < -N / 2) di += N; }
      if (Math.abs(di * path.sp) > o.r + 2 || Math.abs(o.lat - this.lat) > o.r + kr) continue;
      if (this.hop > 2.5) continue;
      if (o.brk) {
        this.worldFwd(tv).multiplyScalar(this.speed);
        smashObst(T, o, tv);
        if (!(this.v.smash || this.starT > 0 || this.armorT > 0)) this.speed *= o.kind === "cone" ? 0.95 : 0.82;
        G.onSmash(this, o.pos, false, o);
        if (o.boom) { this.hit("launch"); if (T.dyn) T.dyn.hitAt(o.pos, 10, true); }
      } else {
        if (this.starT > 0) continue;
        this.u -= Math.sign(di || 1) * 0.5; this.speed = -Math.abs(this.speed) * 0.25; this.spinT = Math.max(this.spinT, 0.4); this.knockSide = Math.sign(this.lat - o.lat || 1) * 14;
        G.onWall(this, true, 0); if (o.cow) this.G.onCow && this.G.onCow(this);
      }
    }
    // boxes
    for (const bx of O.boxes) if (bx.active && bx.pi === this.pi) {
      let di = bx.i - this.u; if (path.closed) { if (di > N / 2) di -= N; if (di < -N / 2) di += N; }
      if (Math.abs(di) < 1.3 && Math.abs(bx.lat - this.lat) < 2.4) {
        bx.active = false; if (bx.mesh) bx.mesh.visible = false; bx.timer = 2.5; G.fx.burst(bx.pos, 0xffffff, 18, 10);
        if (this.remote) continue;
        if (!this.item && this.rouletteT <= 0) { this.rouletteT = this.isPlayer ? 1.1 : 0.5; G.onItemBox(this); }
        else if (this.item && !this.item2 && this.rouletteT <= 0 && Math.random() < 0.0) {}
      }
    }
  }
  airStep(dt, inp, steer, throttle, top, ctrl) {
    const G = this.G, T = this.T, v = this.v, lap = this.curLap;
    this.airT += dt;
    const g = GRAV * (v.glide ? 0.62 : 1) * (this.airT < 0.5 && this.vel.y > 0 ? 0.92 : 1);
    this.vel.y -= g * dt;
    // air control: rotate horizontal velocity + facing
    const hs = Math.hypot(this.vel.x, this.vel.z);
    const ac = (0.25 + v.air * 0.75);
    const rot = steer * this.turn * ac * 0.55 * dt;
    if (rot) { const c = Math.cos(rot), sn = Math.sin(rot); const x = this.vel.x * c + this.vel.z * sn, z = -this.vel.x * sn + this.vel.z * c; this.vel.x = x; this.vel.z = z; }
    this.aYaw += steer * this.turn * (0.6 + v.air * 0.5) * dt;
    const velYaw = Math.atan2(this.vel.x, this.vel.z);
    if (hs > 3) this.aYaw += angDiff(this.aYaw, velYaw + (this.drift ? this.drift * 0.25 : 0)) * Math.min(1, dt * 1.5);
    if (throttle > 0 && hs < top) { this.vel.x += Math.sin(this.aYaw) * this.accel * 0.2 * dt; this.vel.z += Math.cos(this.aYaw) * this.accel * 0.2 * dt; }
    this.vel.x += this.knock.x * dt; this.vel.z += this.knock.z * dt; this.knock.multiplyScalar(Math.exp(-dt * 4));
    // tricks
    if (inp.driftPressed && ctrl && this.canTrick && this.airT > 0.12 && this.trickT <= 0.1 && this.tricks < 3) {
      this.tricks++; this.trickT = 0.55; this.trickAxis = inp.steer < -0.3 || inp.steer > 0.3 ? 0 : (inp.throttle ? 2 : 1);
      this.trickDir = steer < -0.3 ? -1 : steer > 0.3 ? 1 : (Math.random() < 0.5 ? -1 : 1);
      G.onTrick(this); this.setMood("happy", 1);
    }
    const prev = this.pos.clone();
    this.pos.addScaledVector(this.vel, dt);
    // landing
    const sur = T.findSurface(this.pos, this.vel, lap, 1.4 + Math.max(0, -this.vel.y) * dt * 1.5);
    if (sur) { this.land(sur, inp); return; }
    if (this.pos.y < T.groundY - 1 || this.airT > 7 || this.pos.y < T.minY - 45) { this.startRespawn(); return; }
    this.speed = Math.hypot(this.vel.x, this.vel.z);
    // progress while flying (nearest main)
    this.updateProgress(T.paths[this.pi].S[Math.max(0, Math.min(T.paths[this.pi].N - 1, Math.floor(this.u)))]);
  }
  land(sur, inp) {
    const G = this.G, T = this.T, s = sur.s;
    const vt = this.vel.dot(s.t), vr = this.vel.dot(s.r), vn = this.vel.dot(s.up);
    const impact = -vn;
    const fwX = Math.sin(this.aYaw), fwZ = Math.cos(this.aYaw);
    tf.set(fwX, 0, fwZ);
    const prevPi = this.pi;
    this.pi = sur.pi; this.u = sur.u; this.lat = sur.lat;
    this.speed = Math.hypot(vt, vr) * (vt < 0 ? -1 : 1);
    this.mh = vt < 0 ? 0 : Math.atan2(-vr, vt);
    this.hdg = Math.atan2(-tf.dot(s.r), tf.dot(s.t));
    if (Math.abs(angDiff(this.mh, this.hdg)) > 0.9) this.hdg = this.mh + Math.sign(angDiff(this.mh, this.hdg)) * 0.9;
    if (vt < 0) { this.speed = Math.abs(this.speed) * 0.3; this.hdg = 0; this.mh = 0; }
    this.grounded = true; this.hop = 0; this.vh = 0;
    const straight = Math.abs(this.hdg) < 0.45;
    this.landT = clamp(impact / 40, 0.15, 0.5);
    if (this.tricks > 0 && this.trickT <= 0.05) {
      const perfect = straight && this.trickT <= 0.02;
      this.addBoost(0.7 + this.tricks * 0.35 + (this.airT > 1.5 ? 0.4 : 0) + (perfect ? 0.3 : 0), 1.4 + (perfect ? 0.08 : 0));
      this.shout("trick"); G.onTrickLand(this, this.tricks, perfect);
    } else if (this.tricks > 0) { this.spinT = 0.5; this.speed *= 0.7; G.onBotch && G.onBotch(this); }
    else if (this.airT > 1.2 && this.spinT <= 0) { this.addBoost(0.5, 1.25); if (straight && this.airT > 1.6) G.onStyle && G.onStyle(this, "CLEAN LANDING", 50); }
    if (this.v.bouncy && impact > 22 && this.tricks === 0) { this.launch(impact * 0.25); this.canTrick = true; return; }
    if (impact > 30) G.onBigLand(this, impact);
    this.tricks = 0; this.canTrick = false; this.trickT = 0;
    if (inp.drift && Math.abs(inp.steer) > 0.3 && Math.abs(this.speed) > 18 && this.spinT <= 0) { this.drift = Math.sign(inp.steer); this.driftCharge = 0; this.driftLvl = 0; }
    if (sur.pi !== 0 && sur.pi !== prevPi && T.paths[sur.pi].label) G.onShortcut(this, T.paths[sur.pi]);
    T.place(this.pi, this.u, this.lat, 0, this.pos);
    this.updateProgress(this.frame().s);
  }
  endDrift() {
    if (this.drift && this.driftLvl > 0) {
      const t = [0, 0.85, 1.4, 2.1][this.driftLvl];
      let pow = 1.32 + this.driftLvl * 0.05;
      if (this.driftChainT > 0) { this.chain = Math.min(5, this.chain + 1); pow += this.chain * 0.07; }
      this.addBoost(t, pow);
      this.G.onDriftBoost(this, this.driftLvl);
    }
    this.drift = 0; this.driftCharge = 0; this.driftLvl = 0;
  }
  nudge(vec) { // world push
    if (this.grounded) { const F = this.frame(); this.lat += vec.dot(F.r); this.u += vec.dot(F.t) / this.T.paths[this.pi].sp; }
    else this.pos.add(vec);
  }
  startRespawn() {
    if (this.respawnT > 0) return;
    this.respawnT = 1.5; this.speed = 0; this.drift = 0; this.boostT = 0; this.vel.set(0, 0, 0); this.placed = false;
    this.shout("fall", true); this.setMood("scared", 2);
    this.G.onFall(this);
  }
  updateRespawn(dt) {
    const T = this.T;
    if (this.respawnT < 1.0 && !this.placed) {
      this.placed = true;
      const p = T.paths[this.safe.pi];
      if (this.lastFallU !== undefined && this.lastFallPi === this.safe.pi && Math.abs(this.lastFallU - this.safe.u) < 6) this.fallRep = (this.fallRep || 0) + 1; else this.fallRep = 0;
      this.lastFallU = this.safe.u; this.lastFallPi = this.safe.pi;
      let u = this.safe.u + 1 + (this.fallRep >= 2 ? 16 * (this.fallRep - 1) : 0);
      if (!p.closed) u = Math.min(p.N - 2, u);
      // move forward past gaps
      for (let k = 0; k < 40; k++) { const s = p.S[((Math.floor(u) % p.N) + p.N) % p.N]; if (!T.gapAt(s, this.curLap) && !s.lift) break; u -= 1; }
      this.pi = this.safe.pi; this.u = p.closed ? ((u % p.N) + p.N) % p.N : Math.max(0, u);
      if (!p.closed && u > p.N - 14) { this.pi = 0; this.u = (p.i1 + 3) % T.N; this.safe = { pi: 0, u: this.u }; }
      this.lat = 0; this.hdg = this.mh = 0; this.grounded = true; this.inLift = false;
      T.place(this.pi, this.u, 0, 0, this.pos); this.dropH = 14;
      this.syncOrient(1);
    }
    if (this.placed) {
      this.dropH = Math.max(0, this.dropH - dt * 16);
      T.place(this.pi, this.u, 0, this.dropH, this.pos);
      if (this.respawnT <= 0.05) { this.placed = false; this.respawnT = 0; this.grounded = true; this.addBoost(0.6, 1.2); this.phaseT = 1; this.updateProgress(this.frame().s); }
    }
  }
  // ---------- animation ----------
  // ---------- network ----------
  netState() {
    const q = this.quat, r = Math.round;
    const f = (this.drift < 0 ? 1 : 0) | (this.drift > 0 ? 2 : 0) | (this.boostT > 0 ? 4 : 0) | (this.spinT > 0 ? 8 : 0) | (this.squashT > 0 ? 16 : 0) | (this.starT > 0 ? 32 : 0) | (this.grounded ? 64 : 0) | (this.trickT > 0 ? 128 : 0) | (this.respawnT > 0 ? 256 : 0) | (this.shieldT > 0 || this.phaseT > 0 || this.armorT > 0 ? 512 : 0) | (this.trickAxis << 10) | (this.driftLvl << 12) | (this.finished ? 16384 : 0);
    return [this.netId, r(this.pos.x * 10), r(this.pos.y * 10), r(this.pos.z * 10), r(q.x * 1000), r(q.y * 1000), r(q.z * 1000), r(q.w * 1000), this.pi, r(this.u * 10), r(this.lat * 10), r(this.speed), f, this.lap, r(this.progress), this.inputBits || 0];
  }
  netPush(a, now) {
    const b = this.nbuf || (this.nbuf = []);
    b.push({ t: now, x: a[1] / 10, y: a[2] / 10, z: a[3] / 10, q: new THREE.Quaternion(a[4] / 1000, a[5] / 1000, a[6] / 1000, a[7] / 1000).normalize(), pi: a[8], u: a[9] / 10, lat: a[10] / 10, sp: a[11], f: a[12], lap: a[13], prog: a[14], inputs: a[15] || 0 });
    if (b.length > 8) b.shift();
  }
  netUpdate(dt, now) {
    const b = this.nbuf; if (!b || !b.length) { this.animate(dt, 0); return; }
    const rt = now - 140;
    let A = b[0], B = b[b.length - 1];
    for (let i = 0; i < b.length - 1; i++) if (b[i].t <= rt && b[i + 1].t >= rt) { A = b[i]; B = b[i + 1]; break; }
    const span = B.t - A.t, k = span > 0 ? clamp((rt - A.t) / span, 0, 1.2) : 1;
    const far = Math.hypot(B.x - A.x, B.z - A.z) > 40;
    if (far) { this.pos.set(B.x, B.y, B.z); this.quat.copy(B.q); }
    else { this.pos.set(lerp(A.x, B.x, k), lerp(A.y, B.y, k), lerp(A.z, B.z, k)); this.quat.slerpQuaternions(A.q, B.q, Math.min(1, k)); }
    const S = k > 0.5 ? B : A;
    this.inputBits = S.inputs || 0;
    this.pi = S.pi < this.T.paths.length ? S.pi : 0; this.u = S.u; this.lat = S.lat; this.speed = S.sp; this.lap = S.lap; this.progress = S.prog;
    const f = S.f;
    this.drift = f & 1 ? -1 : f & 2 ? 1 : 0; this.driftLvl = (f >> 12) & 3;
    this.boostT = f & 4 ? 0.2 : 0; this.spinT = f & 8 ? Math.max(this.spinT, 0.3) : 0; this.squashT = f & 16 ? 0.2 : 0; this.starT = f & 32 ? 0.2 : 0;
    this.grounded = !!(f & 64); if (f & 128 && this.trickT <= 0) { this.trickT = 0.55; this.trickAxis = (f >> 10) & 3; this.trickDir = 1; }
    this.respawnT = f & 256 ? 0.2 : 0; this.shieldT = f & 512 ? 0.2 : 0; this.finished = !!(f & 16384);
    for (const key of ["spinT", "trickT", "talkT", "moodT", "landT"]) if (this[key] > 0) this[key] = Math.max(0, this[key] - dt);
    this.vel.set(0, 0, 0);
    this.animate(dt, 0);
  }
  animate(dt, steer) {
    const m = this.m, G = this.G, T = this.T, time = G.time;
    if (!this.remote) this.syncOrient(this.respawnT > 0 ? 1 : 1 - Math.exp(-dt * (this.grounded ? 16 : 5)));
    m.root.position.copy(this.pos); m.root.quaternion.copy(this.quat);
    m.plat.visible = this.inLift;
    const bike = this.v.bike;
    const tgtRoll = (this.drift ? -this.drift * 0.12 : 0) - steer * (bike ? 0.35 : 0.06) * Math.min(1, Math.abs(this.speed) / 30);
    m.tilt.rotation.z = lerp(m.tilt.rotation.z, tgtRoll, 1 - Math.exp(-dt * 10));
    m.tilt.rotation.x = lerp(m.tilt.rotation.x, this.grounded ? (this.boostT > 0 ? -0.06 : 0) : clamp(-this.vel.y * 0.01, -0.4, 0.4), 1 - Math.exp(-dt * 8));
    let sy = 1, sxz = 1, fy = 0, fx = 0, fz = 0;
    if (this.spinT > 0) fy = this.spinT * 14;
    if (this.flipT > 0) fx = (1 - this.flipT) * Math.PI * 2;
    if (this.trickT > 0) {
      const k = 1 - this.trickT / 0.55; const a = Math.PI * 2 * (k * k * (3 - 2 * k)) * this.trickDir;
      if (this.trickAxis === 0) fz = a; else if (this.trickAxis === 1) fy = a; else fx = -Math.abs(a);
    }
    if (this.drift) fy += this.drift * 0.35;
    if (this.squashT > 0) { sy = 0.25; sxz = 1.5; }
    if (this.landT > 0) { const k = this.landT; sy = Math.min(sy, 1 - k * 0.9); sxz = Math.max(sxz, 1 + k * 0.6); }
    if (!this.grounded && this.vel.y > 5) { sy *= 1.12; sxz *= 0.93; }
    if (this.hop > 0) { sy *= 1.08; }
    m.fx.rotation.set(fx, fy, fz);
    m.fx.position.y = this.grounded ? Math.abs(Math.sin(time * 18)) * Math.min(0.12, Math.abs(this.speed) / 400) + (CLS[this.cls] ? CLS[this.cls].bump * Math.abs(Math.sin(time * 31)) * Math.min(1, Math.abs(this.speed) / 30) : 0) : 0;
    const sc = this.v.scale || 1;
    tv.set(sxz * sc, sy * sc, sxz * sc); m.fx.scale.lerp(tv, 1 - Math.exp(-dt * 18));
    for (const w of m.wheels) { if (w.w.isHover) { w.w.rotation.y += dt * 6; continue; } if (!w.w.isTrack) w.w.rotation.x += this.speed * dt / w.r; if (w.front) w.piv.rotation.y = steer * 0.45 * (this.vehId === "stapler" ? -1.4 : 1); }
    m.wheelS.rotation.z = -steer * 1.2;
    const scared = this.mood === "scared", happy = this.mood === "happy" || this.boostT > 0 || this.trickT > 0, dizzy = this.mood === "dizzy";
    m.driver.rotation.z = lerp(m.driver.rotation.z, steer * 0.25 + (this.drift ? this.drift * 0.2 : 0) + (this.wallRide > 0.5 ? Math.sign(this.frame().r.y) * 0.5 : 0), 1 - Math.exp(-dt * 8));
    m.driver.rotation.x = lerp(m.driver.rotation.x, this.boostT > 0 ? -0.3 : 0, 1 - Math.exp(-dt * 6));
    for (const h of m.heads) {
      h.head.rotation.y = lerp(h.head.rotation.y, steer * 0.5 + (dizzy ? Math.sin(time * 5) * 0.4 : 0), 1 - Math.exp(-dt * 8));
      h.head.rotation.z = dizzy ? Math.sin(time * 4) * 0.3 : Math.sin(time * 9) * 0.03;
      h.head.position.y = 2.15 + (this.talkT > 0 ? Math.abs(Math.sin(time * 20)) * 0.15 : 0);
      const open = this.talkT > 0 ? 0.25 + Math.abs(Math.sin(time * 22)) * 0.6 : scared ? 0.7 : happy ? 0.35 : 0.08;
      h.mouth.scale.y = lerp(h.mouth.scale.y, open / 0.08, 0.4);
      h.mouth.scale.x = happy ? 1.4 : scared ? 0.8 : 1;
      for (let k = 0; k < 2; k++) {
        const e = h.eyes[k], side = k ? 1 : -1, es = scared ? 1.45 : happy ? 0.9 : 1;
        e.w.scale.set(es, es, 0.6 * es);
        if (dizzy) e.pu.position.set(Math.cos(time * 10 + k * 3) * 0.1, Math.sin(time * 10 + k * 3) * 0.1, 0.22);
        else e.pu.position.set(clamp(steer * 0.1, -0.1, 0.1), scared ? 0.06 : 0, 0.22);
        h.brows[k].rotation.z = (scared ? -0.4 : happy ? -0.15 : this.boostT > 0 ? 0.3 : 0.1) * side * -1;
        h.brows[k].position.y = scared ? 0.68 : 0.55;
      }
    }
    const flail = this.spinT > 0 || this.flipT > 0 || this.respawnT > 0 || (!this.grounded && this.airT > 0.9 && this.tricks === 0) || this.wallRide > 0.6;
    m.arms.forEach((a, k) => {
      const side = k ? 1 : -1;
      if (flail) { a.rotation.x = -2.2 + Math.sin(time * 25 + k * 2) * 0.8; a.rotation.z = side * (0.6 + Math.sin(time * 20 + k) * 0.5); }
      else if (this.trickT > 0 || (happy && this.talkT > 0 && k === 1)) { a.rotation.x = lerp(a.rotation.x, -2.6, 0.3); a.rotation.z = side * 0.4; }
      else { a.rotation.x = lerp(a.rotation.x, 0, 0.25); a.rotation.z = lerp(a.rotation.z, 0, 0.3); }
    });
    m.aura.visible = this.starT > 0 || this.phaseT > 0 || this.shieldT > 0 || this.anchorT > 0 || this.armorT > 0 || this.magT > 0;
    if (m.aura.visible) {
      m.aura.material.color.set(this.starT > 0 ? new THREE.Color().setHSL((time * 2) % 1, 1, 0.55) : this.phaseT > 0 ? 0x00ffcc : this.anchorT > 0 ? 0x0b3d91 : this.armorT > 0 ? 0xc0c8d0 : this.magT > 0 ? 0xff3355 : 0xffd23f);
      m.aura.scale.setScalar(1 + Math.sin(time * 12) * 0.06);
    }
    m.fx.visible = !(this.phaseT > 0 && Math.floor(time * 20) % 2 === 0 && this.respawnT <= 0);
    // shadow
    const sh = m.shadow;
    if (this.grounded && !this.inLift) {
      const F = this.frame(); T.place(this.pi, this.u, this.lat, 0.12, sh.position); sh.quaternion.setFromUnitVectors(tf.set(0, 0, 1), F.up);
      sh.scale.setScalar(Math.max(0.5, 1 - this.hop / 8)); sh.material.opacity = 0.35; sh.visible = true;
    } else if (!this.grounded) {
      if (((G.frameN + this.idx) & 3) === 0) this._shS = T.findSurface(this.pos, null, this.curLap, 80);
      const sS = this._shS;
      if (sS) { const hgt = this.pos.y - sS.s.y; T.place(sS.pi, sS.u, sS.lat, 0.12, sh.position); sh.position.x = this.pos.x; sh.position.z = this.pos.z; sh.quaternion.setFromUnitVectors(tf.set(0, 0, 1), sS.s.up); sh.scale.setScalar(Math.max(0.3, 1 - hgt / 40)); sh.material.opacity = 0.35 * Math.max(0.2, 1 - hgt / 40); sh.visible = true; }
      else sh.visible = false;
    } else sh.visible = false;
  }
  // ---------- AI ----------
  think(dt) {
    const G = this.G, T = this.T, ai = this.ai, path = T.paths[this.pi];
    const inp = { steer: 0, throttle: 1, drift: false, driftPressed: false, item: false, ability: false, back: false };
    if (!this.grounded) {
      if (this.canTrick && this.tricks < 2 && this.airT > 0.2 && this.trickT <= 0.05 && Math.random() < dt * 5 * ai.trick) inp.driftPressed = true;
      // steer toward road direction
      const F = this.frame(); const want = Math.atan2(F.t.x, F.t.z); inp.steer = clamp(angDiff(this.aYaw, want) * 2, -1, 1);
      return inp;
    }
    ai.laneT -= dt;
    if (ai.laneT <= 0) { ai.laneT = 1.5 + Math.random() * 3; ai.lane = (Math.random() - 0.5) * 0.9; }
    const look = Math.max(4, Math.floor(3 + Math.abs(this.speed) * 0.14));
    const N = path.N;
    const idxA = (k) => path.closed ? ((Math.floor(this.u) + k) % N + N) % N : Math.min(N - 1, Math.floor(this.u) + k);
    const s = path.S[idxA(look)];
    let tLat = ai.lane * s.hw;
    // shortcut decision on main
    if (this.pi === 0) {
      for (const fk of T.forks) {
        let d = fk.i - this.u; if (d < -N / 2) d += N; if (d > N / 2) d -= N;
        if (d > 45 || d < -14) continue;
        if (ai.take === null || ai.takeFork !== fk) {
          ai.takeFork = fk;
          const b = fk.b, g = b.gate;
          let ok = !g || gateOpen(T, g, this) || (g.kind === "smash" && (this.v.smash || this.boostT > 0)) || g.kind === "hidden";
          const diffc = b.def.risk || 0.3;
          ai.take = ok && Math.random() < (0.35 + ai.skill * 0.4 - diffc * 0.3 + (b.def.ai || 0));
        }
        if (ai.take && d < 10) { const e = s.hw + (s.sh ? s.shw : 0); tLat = fk.side * (e + 3); }
        break;
      }
    } else tLat = 0;
    for (const b of T.objs.boxes) { if (!b.active || this.item || b.pi !== this.pi) continue; const d = b.i - this.u; if (d > 3 && d < 30) { tLat = b.lat; break; } }
    for (const p of T.objs.pads) { if (p.pi !== this.pi || p.kind !== "boost") continue; const d = p.i - this.u; if (d > 2 && d < 22) { tLat = p.lat; break; } }
    for (const r of T.objs.ramps) { if (r.pi !== this.pi || !T.lapOk(r.f, this.curLap)) continue; const d = r.i - this.u; if (d > 0 && d < 26) { tLat = r.lat; break; } }
    for (const h of T.hazards) { if (!h.active || h.type === "bounce" || h.type === "switch") continue; if (h.pos.distanceToSquared(this.pos) < 900) { const pr = T.project(this.pi, h.pos, this.u, 6); tLat = pr.lat > 0 ? -s.hw * 0.6 : s.hw * 0.6; } }
    { const Lr = s.hw + (s.sh ? s.shw * 0.4 : 0) - 1.2, m = this.rad + 1.4;
      for (const o of T.objs.obst) { if (o.down || o.pi !== this.pi || o.brk && (this.v.smash || o.kind === "cone")) continue; let d = o.i - this.u; if (path.closed && d < -N / 2) d += N; if (d > -1 && d < 18 && Math.abs(o.lat - tLat) < o.r + m) { const sd = this.lat >= o.lat ? 1 : -1; let c = o.lat + sd * (o.r + m + 0.4); if (Math.abs(c) > Lr) c = o.lat - sd * (o.r + m + 0.4); tLat = c; } } }
    const L = s.hw + (s.sh ? s.shw * 0.4 : 0);
    // stuck recovery (slow, or no progress)
    if (G.racing && Math.abs(this.speed) < 6 && this.spinT <= 0 && this.squashT <= 0 && !this.inLift) ai.stuck = (ai.stuck || 0) + dt; else ai.stuck = Math.max(0, (ai.stuck || 0) - dt * 2);
    ai.progT = (ai.progT || 0) + dt;
    if (ai.progT > 2.5) { if (G.racing && this.progress - (ai.progP || 0) < 12 && !this.inLift) ai.stuck = Math.max(ai.stuck, 1.5); ai.progT = 0; ai.progP = this.progress; }
    if (ai.stuck > 1.4 && !(ai.backT > 0)) { ai.backT = 0.9; ai.backDir = this.lat > 0 ? 1 : -1; }
    if (ai.stuck > 7 && this.grounded) { ai.stuck = 0; this.startRespawn(); }
    if (ai.backT > 0) { ai.backT -= dt; inp.throttle = 0; inp.brake = 1; inp.steer = ai.backDir; return inp; }
    if (this.pi === 0 && !(ai.take && Math.abs(tLat) > L)) tLat = clamp(tLat, -L + 1.5, L - 1.5);
    const lookD = Math.max(8, Math.abs(this.speed) * 0.45);
    const want = -Math.atan2(tLat - this.lat, lookD);
    const ktA = path.S[idxA(Math.floor(look * 0.6))].kt || 0;
    // corner speed: ease off when the curvature ahead exceeds what we can turn
    let kMax = 0; for (let q = 2; q < look + 10; q += 2) kMax = Math.max(kMax, Math.abs(path.S[idxA(q)].kt || 0));
    const vCorner = (this.turn * (ai.driftT > 0 ? 1.45 : 1.13)) / Math.max(1e-3, kMax);
    if (Math.abs(this.speed) > vCorner * 1.3) { inp.throttle = 0; inp.brake = 1; } else if (Math.abs(this.speed) > vCorner) inp.throttle = 0;
    const ff = ktA * Math.abs(this.speed) / this.turn;
    inp.steer = clamp(ff + angDiff(this.mh, want) * 2.8, -1, 1);
    if (ai.driftT > 0) {
      ai.driftT -= dt; inp.drift = true;
      if (ai.driftT <= 0) inp.drift = false;
    } else if (Math.abs(ktA) > 0.012 && Math.abs(this.speed) > 32 && Math.random() < dt * 3 * ai.skill) {
      ai.driftT = 0.8 + Math.random() * 1.4; inp.driftPressed = true; inp.drift = true; inp.steer = Math.sign(ktA) || 1;
    }
    if (this.item && this.rouletteT <= 0) {
      ai.itemT += dt;
      const it = this.item;
      const ahead = G.karts.filter(k => k !== this && !k.finished && k.respawnT <= 0 && (k.progress - this.progress) > 2 && (k.progress - this.progress) < 44).sort((a, b) => a.progress - b.progress)[0];
      const behind = G.karts.filter(k => k !== this && !k.finished && k.respawnT <= 0 && (this.progress - k.progress) > 1 && (this.progress - k.progress) < 20).sort((a, b) => b.progress - a.progress)[0];
      const fwdI = ["pretzel", "potato", "boar", "stein", "duck", "train", "roller", "cuckoo", "magnet", "zeppelin", "dackel", "pretzel3"];
      const backI = ["cone", "barrier", "gnome", "sauerkraut", "fog", "stein"];
      const selfI = ["autobahn", "engineering", "wrench"];
      if (fwdI.includes(it) && ahead && ai.itemT > 0.35) inp.item = true;
      else if (backI.includes(it) && behind && ai.itemT > 0.45) { inp.item = true; inp.back = true; }
      else if (selfI.includes(it) && ai.itemT > 0.6) inp.item = true;
      else if (ai.itemT > 7) { inp.item = true; inp.back = Math.random() < 0.5; }
      if (inp.item) ai.itemT = 0;
    }
    if (this.ability >= 1) inp.ability = true;
    const ref = G.refKart ? G.refKart(this) : G.player;
    const gap = ref ? (ref.progress - this.progress) / T.N : 0;
    this.aiSpeedMul = clamp(1.35 + (ai.skill - 1) * 0.14 + gap * 2.2, 1.05, 1.78);
    return inp;
  }
}
