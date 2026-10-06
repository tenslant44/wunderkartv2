import * as THREE from "three";
import { PS } from "./track.js";
import { OBST, breakGate, textTex } from "./trackfeat.js";

const V3 = THREE.Vector3;
const L = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
const box = (w, h, d, c) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof c === "number" ? L(c) : c);
const sstep = (x) => x * x * (3 - 2 * x);
function orient(m, s, lat, h) { PS(s, lat, h, m.position); const left = new V3().crossVectors(s.up, s.t).normalize(); m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(left, s.up, s.t)); return m; }

export function buildEvents(T, events, grp) {
  const list = [], H = T.hazards, main = T.main, N = main.N;
  const idx = (e) => T.idxOf(e.seg, e.at || 0);
  const S = (i) => main.S[((i % N) + N) % N];
  const vis = !!grp;
  for (const e of events) {
    const i0 = idx(e);
    switch (e.t) {
      case "collapse": {
        const len = Math.ceil((e.len || 30) / main.sp);
        const sec = { id: T.gapSecs.length, pi: 0, i0, i1: i0 + len, lap: e.lap || 2, broken: false, f: e };
        T.gapSecs.push(sec);
        for (let k = 0; k < len; k++) { const s = S(i0 + k); s.gapSec = sec; s.gapId = sec.id; }
        T.objs.ramps.push({ pi: 0, i: ((i0 - 2) % N + N) % N, lat: 0, w: S(i0).hw * 2, p: e.p || 21, f: { lap: e.lap || 2 } });
        const ev = { e, sec, vy: 0, t: 0, update(dt, time, lap) {
          if (!sec.broken && lap >= sec.lap) { sec.broken = true; ev.t = 0; if (T.onBreak) T.onBreak(sec); }
          if (sec.broken && sec.group) { ev.t += dt; ev.vy -= 30 * dt; sec.group.position.y += ev.vy * dt; sec.group.rotation.z = Math.min(0.4, ev.t * 0.1); if (ev.t > 6) sec.group.visible = false; }
        } };
        list.push(ev);
        // warning sign
        if (vis && e.sign !== false) T.objs.signs.push(addSign(grp, S(i0 - 30), e.sign || "EINSTURZGEFAHR!", "#cc1111"));
        break;
      }
      case "flood": {
        const len = Math.ceil((e.len || 60) / main.sp), fl = { level: 0 };
        for (let k = 0; k < len; k++) S(i0 + k).flood = fl;
        let mesh = null;
        if (vis) {
          const a = S(i0), b = S(i0 + len), mid = S(i0 + (len >> 1));
          const w = Math.hypot(a.x - b.x, a.z - b.z) + 80;
          mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, w), new THREE.MeshLambertMaterial({ color: 0x3a8ad8, transparent: true, opacity: 0.7 }));
          mesh.rotation.x = -Math.PI / 2; mesh.position.set(mid.x, mid.y - 6, mid.z); grp.add(mesh);
          T.objs.signs.push(addSign(grp, S(i0 - 20), e.sign || "HOCHWASSER!", "#1d5fb4"));
        }
        let minY = Infinity; for (let k = 0; k < len; k++) minY = Math.min(minY, S(i0 + k).y);
        list.push({ update(dt, time, lap) { const tgt = lap >= (e.lap || 2) ? 1 : 0; fl.level += (tgt - fl.level) * Math.min(1, dt * 0.4); if (mesh) { mesh.position.y = minY - 6 + fl.level * 6.5 + Math.sin(time * 1.5) * 0.15; mesh.visible = fl.level > 0.02; } } });
        break;
      }
      case "avalanche": {
        const len = Math.ceil((e.len || 60) / main.sp), sn = { on: false };
        for (let k = 0; k < len; k++) S(i0 + k).snowed = sn;
        const balls = [];
        for (let b = 0; b < (e.n || 5); b++) {
          const hz = { kind: "snowball", type: "launch", pos: new V3(), r: 2.6, active: false, t: -b * 1.3, i: 0 };
          if (vis) { hz.mesh = new THREE.Mesh(new THREE.SphereGeometry(2.6, 12, 9), L(0xffffff)); hz.mesh.visible = false; grp.add(hz.mesh); }
          balls.push(hz); H.push(hz);
        }
        let cover = null;
        if (vis) { cover = new THREE.Group(); for (let k = 0; k < len; k += 4) { const s = S(i0 + k); const m = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), L(0xffffff)); m.scale.set(s.hw * 1.2, 0.6, 4); orient(m, s, (Math.random() - 0.5) * s.hw, 0); cover.add(m); } cover.visible = false; grp.add(cover); }
        list.push({ update(dt, time, lap) {
          const on = lap >= (e.lap || 2);
          if (on && !sn.on && T.onAvalanche) T.onAvalanche(S(i0));
          sn.on = on; if (cover) cover.visible = on;
          for (const b of balls) {
            if (!on) { b.active = false; if (b.mesh) b.mesh.visible = false; continue; }
            b.t += dt; const dur = 4;
            if (b.t > dur) b.t = -Math.random() * 3;
            if (b.t < 0) { b.active = false; if (b.mesh) b.mesh.visible = false; continue; }
            const k = b.t / dur, i = i0 + Math.floor(len * ((b.i = (b.i || Math.random())) )), s = S(i);
            const lat = (k * 2 - 1) * (s.hw + 20) * (e.dir || 1);
            PS(s, lat, 2.6 + Math.max(0, (1 - k) * 18 - 9), b.pos); b.active = Math.abs(lat) < s.hw + 3;
            if (b.mesh) { b.mesh.visible = true; b.mesh.position.copy(b.pos); b.mesh.rotation.x += dt * 4; const sc = 0.6 + k * 0.8; b.mesh.scale.setScalar(sc); b.r = 2.6 * sc; }
          }
        } });
        break;
      }
      case "train": {
        const s = S(i0), period = e.period || 10, hz = { kind: "train", type: "launch", pos: new V3(), r: 5, active: false, big: true };
        const L2 = 70;
        let g = null, lights = [];
        if (vis) {
          g = new THREE.Group();
          for (let c = 0; c < 4; c++) { const car = box(4.2, 5, 17, 0xf4f4f4); car.position.set(0, 3, -c * 18); const stripe = box(4.25, 0.7, 17, 0xdd0000); stripe.position.set(0, 2, -c * 18); const win = box(4.3, 1.1, 15, 0x223344); win.position.set(0, 4, -c * 18); g.add(car, stripe, win); }
          const nose = new THREE.Mesh(new THREE.SphereGeometry(2.4, 12, 8), L(0xf4f4f4)); nose.scale.set(0.9, 1, 2.2); nose.position.set(0, 2.8, 9); g.add(nose);
          grp.add(g);
          for (const sd of [-1, 1]) { const p = new THREE.Group(); const pole = box(0.4, 4, 0.4, 0xffffff); pole.position.y = 2; const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshBasicMaterial({ color: 0x440000 })); lamp.position.y = 4.2; p.add(pole, lamp); orient(p, s, sd * (s.hw + 1.5), 0); grp.add(p); lights.push(lamp); }
        }
        // tracks (rails) across road
        if (vis) { const rails = box(4, 0.15, 260, 0x777777); orient(rails, s, 0, 0.05); rails.rotateY(Math.PI / 2); grp.add(rails); }
        const left = new V3();
        H.push(hz);
        list.push({ update(dt, time) {
          const ph = ((time + (e.off || 0)) % period) / period, k = (ph - 0.55) / 0.3;
          const warn = ph > 0.35 && ph < 0.9;
          lights.forEach(l => l.material.color.set(warn && Math.floor(time * 6) % 2 ? 0xff2020 : 0x440000));
          const dir = e.dir || 1;
          if (k < 0 || k > 1) { hz.active = false; if (g) g.visible = false; return; }
          const lat = (k * 2 - 1) * 130 * dir;
          PS(s, lat, 0, hz.pos); hz.active = Math.abs(lat) < s.hw + 40;
          hz.lat = lat; hz.s = s;
          if (g) { g.visible = true; orient(g, s, lat, 0); g.rotateY(dir > 0 ? -Math.PI / 2 : Math.PI / 2); }
        }, hz, s, len: L2 });
        hz.custom = (k) => { const fr = T.project(0, k.pos, s.i, 4); if (Math.abs(fr.u - s.i) < 2.2 && Math.abs(fr.lat - hz.lat) < 40 && Math.abs(fr.lat - hz.lat) > -1 && Math.abs(fr.h) < 6) { const d = fr.lat - hz.lat; return (e.dir || 1) > 0 ? d < 2 && d > -36 : d > -2 && d < 36; } return false; };
        break;
      }
      case "crane": {
        const s = S(i0), side = e.side || 1, hz = { kind: "container", type: "squash", pos: new V3(), r: 3.6, active: true };
        let rope = null, cont = null;
        const base = PS(s, side * (s.hw + s.shw + 8), 0, new V3());
        if (vis) {
          const tw = box(2, 34, 2, 0xffcc00); tw.position.set(base.x, base.y + 17, base.z); grp.add(tw);
          const arm = box(2, 1.5, 2, 0xffcc00); grp.add(arm);
          const armLen = s.hw + s.shw + 12; arm.scale.x = 1; arm.geometry = new THREE.BoxGeometry(armLen * 2, 1.4, 1.4); const mid = PS(s, 0, 34, new V3()); arm.position.copy(mid); arm.lookAt(base.x, mid.y, base.z); arm.rotateY(Math.PI / 2);
          cont = box(3.4, 3, 9, 0xc0392b); grp.add(cont);
          rope = box(0.15, 1, 0.15, 0x222222); grp.add(rope);
        }
        const st = { drop: 0, landed: 0 };
        H.push(hz);
        const ev = { update(dt, time) {
          if (st.landed > 0) { st.landed -= dt; if (st.landed <= 0) st.drop = 0; return; }
          const sw = Math.sin(time * 0.9 + (e.off || 0));
          const lat = sw * s.hw * 0.9;
          let h = 7 + Math.cos(time * 0.9 * 2) * 1.2;
          if (st.drop > 0) { st.drop += dt; h = Math.max(1.5, 26 * (1 - st.drop * 1.6)); if (h <= 1.5 && st.landed <= 0) { st.landed = 18; hz.type = "launch"; T.objs.ramps.push({ pi: 0, i: s.i, lat, w: 9, p: 22, f: {}, temp: 18 }); if (T.onSmash) T.onSmash(hz.pos); } }
          else hz.type = "squash";
          PS(s, lat, h, hz.pos); hz.active = h < 6;
          if (cont) { cont.position.copy(hz.pos); cont.position.y += 1.5; orient(cont, s, lat, h); }
          if (rope) { const top = PS(s, lat, 34, new V3()); rope.position.copy(top).lerp(hz.pos, 0.5); rope.scale.y = 34 - h; }
        }, hit: (p) => { if (st.drop > 0 || st.landed > 0) return false; if (p.distanceTo(hz.pos) < 14) { st.drop = 0.001; return true; } return false; } };
        list.push(ev);
        break;
      }
      case "traffic": {
        const len = Math.ceil((e.len || 200) / main.sp), n = e.n || 5, sp = (e.speed || 18) / main.sp, dir = e.dir || 1;
        const cars = [];
        for (let c = 0; c < n; c++) {
          const hz = { kind: "car", type: e.type || "spin", pos: new V3(), r: 2.6, active: true, u: (c / n) * len, lat: ((c % 3) - 1) * 0.55 };
          if (vis) { hz.mesh = (e.kind === "cow" ? OBST.cow : OBST.car).mk(); grp.add(hz.mesh); }
          cars.push(hz); H.push(hz);
        }
        list.push({ update(dt, time, lap) {
          const d2 = e.flip && lap >= e.flip ? -dir : dir;
          for (const c of cars) {
            c.u = ((c.u + d2 * sp * dt) % len + len) % len;
            const s = S(i0 + Math.floor(c.u)); PS(s, c.lat * s.hw, 0, c.pos);
            if (c.mesh) { orient(c.mesh, s, c.lat * s.hw, 0); if (d2 < 0) c.mesh.rotateY(Math.PI); }
          }
        } });
        break;
      }
      case "boulder": case "barrels": {
        const len = Math.ceil((e.len || 120) / main.sp), n = e.n || 3, isB = e.t === "barrels";
        const rs = [];
        for (let c = 0; c < n; c++) {
          const hz = { kind: e.t, type: isB ? "spin" : "launch", pos: new V3(), r: isB ? 1.6 : 3.2, active: true, u: len * c / n, lat: (Math.random() - 0.5) };
          if (vis) { hz.mesh = isB ? OBST.barrel.mk() : new THREE.Mesh(new THREE.DodecahedronGeometry(3.2, 0), L(0x8a8478, { flatShading: true })); grp.add(hz.mesh); }
          rs.push(hz); H.push(hz);
        }
        list.push({ update(dt, time) {
          for (const c of rs) {
            c.u -= (e.speed || 20) / main.sp * dt; if (c.u < 0) { c.u = len; c.lat = (Math.random() - 0.5) * 1.6; }
            const s = S(i0 + Math.floor(c.u)); PS(s, c.lat * s.hw * 0.8, c.r, c.pos);
            if (c.mesh) { c.mesh.position.copy(c.pos); if (isB) c.mesh.position.y -= 1; c.mesh.rotation.x -= dt * 5; }
          }
        } });
        break;
      }
      case "swing": {
        const s = S(i0), R = e.r || 12, hz = { kind: "hammer", type: "launch", pos: new V3(), r: 2.8, active: true };
        let g = null;
        if (vis) {
          g = new THREE.Group(); const arm = box(0.5, R, 0.5, 0x555555); arm.position.y = -R / 2; g.add(arm);
          const head = e.kind === "ball" ? new THREE.Mesh(new THREE.SphereGeometry(2.8, 12, 10), L(0x333333)) : e.kind === "axe" ? box(1, 4, 6, 0xaaaaaa) : box(6, 3, 3, 0x8a5a2a);
          head.position.y = -R; g.add(head);
          const top = PS(s, 0, R + 2.5, new V3()); g.position.copy(top);
          const frame = box(s.hw * 2 + 4, 1, 1, 0x555555); orient(frame, s, 0, R + 2.5); frame.rotateY(0); grp.add(frame);
          grp.add(g);
        }
        list.push({ update(dt, time) {
          const a = Math.sin(time * (e.speed || 1.8) + (e.off || 0)) * 1.15;
          const lat = Math.sin(a) * R, h = R + 2.5 - Math.cos(a) * R;
          PS(s, lat, h, hz.pos); hz.active = h < 4.5;
          if (g) { orient(g, s, 0, R + 2.5); g.rotateZ(a); }
        } });
        H.push(hz);
        break;
      }
      case "crusher": {
        const s = S(i0), hz = { kind: "crusher", type: "squash", pos: new V3(), r: s.hw * 0.5, active: false };
        let m = null;
        if (vis) { m = box(s.hw * 1.2, 4, 6, 0x666a70); grp.add(m); const st = textTex("CAUTION", "#e8c020", "#111", 256, 64); const lab = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshBasicMaterial({ map: st })); lab.position.set(0, 0, 3.05); m.add(lab); }
        list.push({ update(dt, time) {
          const ph = ((time + (e.off || 0)) % 3) / 3, h = ph < 0.15 ? 12 * (1 - ph / 0.15) + 2 : ph < 0.3 ? 2 : 2 + 10 * sstep((ph - 0.3) / 0.7);
          PS(s, e.lat || 0, h, hz.pos); hz.active = h < 3.5;
          if (m) orient(m, s, e.lat || 0, h);
        } });
        H.push(hz);
        break;
      }
      case "drawbridge": {
        const len = Math.ceil((e.len || 16) / main.sp), dg = { open: false };
        for (let k = 0; k < len; k++) { const s = S(i0 + k); s.dynGap = dg; s.hide = true; }
        T.objs.ramps.push({ pi: 0, i: ((i0 - 2) % N + N) % N, lat: 0, w: S(i0).hw * 2, p: e.p || 18, f: {}, dyn: dg });
        const leaves = [];
        if (vis) for (const end of [0, 1]) {
          const s = S(i0 + end * len), m = new THREE.Group(); const plank = box(s.hw * 2, 0.8, len * main.sp / 2, 0x7a5a3a); plank.position.z = (end ? -1 : 1) * len * main.sp / 4; m.add(plank);
          orient(m, s, 0, 0); grp.add(m); leaves.push({ m, end, q: m.quaternion.clone() });
        }
        list.push({ update(dt, time) {
          const ph = ((time + (e.off || 0)) % (e.period || 8)) / (e.period || 8), a = ph < 0.5 ? 0 : Math.sin((ph - 0.5) * 2 * Math.PI) * 0.9;
          dg.open = a > 0.08;
          for (const l of leaves) { l.m.quaternion.copy(l.q); l.m.rotateX((l.end ? 1 : -1) * a); }
        } });
        break;
      }
      case "rotor": {
        const s = S(i0), R = e.r || s.hw + 2, hub = PS(s, 0, R + 2, new V3()), blades = [];
        let g = null;
        if (vis) { g = new THREE.Group(); for (let b = 0; b < 4; b++) { const bl = box(1.4, R, 0.6, b % 2 ? 0xffffff : 0xdd2222); bl.position.y = R / 2; const pv = new THREE.Group(); pv.rotation.z = b * Math.PI / 2; pv.add(bl); g.add(pv); } const tw = box(3, R + 2 + 20, 3, 0xf0e0c0); tw.position.y = -(R + 2) / 2 + 10; g.position.copy(hub); grp.add(g); const tw2 = box(4, R + 30, 4, 0xe8dcc8); orient(tw2, s, (s.hw + s.shw + 4), (R + 2) / 2); grp.add(tw2); }
        for (let b = 0; b < 4; b++) for (let p = 0; p < 3; p++) { const hz = { kind: "rotor", type: "spin", pos: new V3(), r: 1.6, active: true }; blades.push({ hz, b, p }); H.push(hz); }
        const tmp = new V3();
        list.push({ update(dt, time) {
          const a0 = time * (e.speed || 1.2);
          for (const bl of blades) { const a = a0 + bl.b * Math.PI / 2, rr = R * (0.45 + bl.p * 0.27); const lat = -Math.sin(a) * rr, h = R + 2 + Math.cos(a) * rr; PS(s, lat, h, bl.hz.pos); bl.hz.active = h < 3.5; }
          if (g) { orient(g, s, 0, R + 2); g.rotateZ(a0); }
        } });
        break;
      }
      case "geyser": {
        const s = S(i0), hz = { kind: "geyser", type: "bounce", pos: PS(s, e.lat || 0, 0, new V3()), r: 3, active: false, p: e.p || 30 };
        let col = null;
        if (vis) { col = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.4, 1, 10), new THREE.MeshLambertMaterial({ color: e.c || 0xbfe8ff, transparent: true, opacity: 0.7 })); grp.add(col); const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.4, 6, 16), L(0x666666)); ring.rotation.x = Math.PI / 2; ring.position.copy(hz.pos); grp.add(ring); }
        list.push({ update(dt, time) {
          const ph = ((time + (e.off || 0)) % (e.period || 4)) / (e.period || 4), on = ph < 0.4;
          hz.active = on;
          if (col) { const h = on ? 14 * Math.sin(ph / 0.4 * Math.PI) + 1 : 0.5; col.scale.y = h; col.position.copy(hz.pos); col.position.y += h / 2; }
        } });
        H.push(hz);
        break;
      }
      case "debris": {
        const len = Math.ceil((e.len || 80) / main.sp), rocks = [];
        for (let c = 0; c < (e.n || 4); c++) {
          const hz = { kind: "debris", type: "squash", pos: new V3(), r: 2.6, active: false, t: -c * 0.9, g: new V3() };
          if (vis) { hz.mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(2.2, 0), L(e.c || 0xb8a888, { flatShading: true })); hz.shadow = new THREE.Mesh(new THREE.CircleGeometry(2.6, 14), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false })); grp.add(hz.mesh, hz.shadow); }
          rocks.push(hz); H.push(hz);
        }
        list.push({ update(dt, time, lap) {
          const on = lap >= (e.lap || 1);
          for (const r of rocks) {
            if (!on) { if (r.mesh) r.mesh.visible = r.shadow.visible = false; continue; }
            r.t += dt;
            if (r.t > 1.6) { r.t = -Math.random() * 2; const s = S(i0 + Math.floor(Math.random() * len)); PS(s, (Math.random() - 0.5) * s.hw * 1.6, 0, r.g); r.s = s; }
            if (r.t < 0 || !r.s) { r.active = false; if (r.mesh) r.mesh.visible = r.shadow.visible = false; continue; }
            const h = Math.max(1.5, 40 * (1 - r.t / 1.1));
            r.pos.copy(r.g).addScaledVector(r.s.up, h); r.active = h < 4 && r.t < 1.4;
            if (r.mesh) { r.mesh.visible = r.shadow.visible = true; r.mesh.position.copy(r.pos); r.mesh.rotation.x += dt * 3; r.shadow.position.copy(r.g).addScaledVector(r.s.up, 0.08); r.shadow.quaternion.setFromUnitVectors(new V3(0, 0, 1), r.s.up); r.shadow.scale.setScalar(0.4 + r.t * 0.6); }
          }
        } });
        break;
      }
      case "switch": {
        const b = T.branches[e.branch], g = b && b.gate;
        if (!g) break;
        const s = S(b.i0 - Math.ceil(30 / main.sp));
        const hz = { kind: "switch", type: "switch", pos: PS(s, (b.side) * (s.hw + s.shw - 1.2), 0, new V3()), r: 2.2, active: true, gate: g };
        if (vis) { const p = new THREE.Group(); const pole = box(0.5, 3, 0.5, 0x333333); pole.position.y = 1.5; const lever = box(0.3, 2.2, 0.3, 0xffd23f); lever.position.y = 3.6; lever.rotation.z = 0.5; const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.2), new THREE.MeshBasicMaterial({ map: textTex("SWITCH ⇄", "#ffd23f", "#111", 256, 72), side: THREE.DoubleSide })); sign.position.y = 5.4; p.add(pole, lever, sign); p.position.copy(hz.pos); p.rotation.y = Math.atan2(s.t.x, s.t.z) + Math.PI; grp.add(p); hz.lever = lever; }
        H.push(hz);
        list.push({ update() { if (hz.lever) hz.lever.rotation.z = g.switched > 0 ? -0.5 : 0.5; }, hit: (p) => { if (p.distanceTo(hz.pos) < 6) { g.switched = 15; return true; } return false; } });
        break;
      }
    }
  }
  const api = {
    list,
    update(dt, time, lap) { for (const ev of list) ev.update(dt, time, lap); for (let k = T.objs.ramps.length - 1; k >= 0; k--) { const r = T.objs.ramps[k]; if (r.temp !== undefined) { r.temp -= dt; if (r.temp <= 0) T.objs.ramps.splice(k, 1); } } },
    // projectile / explosion interacting with environment
    hitAt(p, r = 4, heavy = false) {
      let any = false;
      for (const ev of list) if (ev.hit && ev.hit(p)) any = true;
      for (const o of T.objs.obst) if (o.brk && !o.down && o.pos.distanceTo(p) < r + o.r) { smashObst(T, o, new V3(0, 0, 0)); any = true; }
      for (const g of T.objs.gates) if (g.broken <= 0 && (g.kind === "bomb" || g.kind === "smash" || g.kind === "hidden" || (g.kind === "switch")) && g.pos.distanceTo(p) < r + g.w + 2) {
        if (g.kind === "switch") g.switched = 15; else if (g.kind !== "bomb" || heavy) breakGate(T, g); else breakGate(T, g);
        any = true;
      }
      return any;
    },
  };
  return api;
}
export function smashObst(T, o, vel) {
  o.down = true; o.respT = o.resp || 18; o.fly = 2.2;
  o.vel.set(vel.x * 0.8 + (Math.random() - 0.5) * 10, 16 + Math.random() * 10, vel.z * 0.8 + (Math.random() - 0.5) * 10);
  o.spin = 6 + Math.random() * 8;
  if (T.onSmash) T.onSmash(o.pos, o);
}
function addSign(grp, s, text, bg) {
  const g = new THREE.Group(); const w = Math.min(s.hw * 2 + 3, 22);
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, 3.2, 0.4), new THREE.MeshBasicMaterial({ map: textTex(text, bg, "#fff") })); b.position.y = 8; g.add(b);
  for (const x of [-1, 1]) { const p = box(0.5, 9.6, 0.5, 0x888888); p.position.set(x * w / 2, 4.8, 0); g.add(p); }
  orient(g, s, 0, 0); g.rotateY(Math.PI); grp.add(g); return g;
}
