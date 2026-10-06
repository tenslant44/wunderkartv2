// headless sim: node tests/sim.mjs (run from /tmp/kt with js copied)
import * as THREE from "three";
{ let a = +(process.env.SEED || 1) >>> 0; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
import { buildTrack } from "./js/track.js";
import { Kart } from "./js/kart.js";
import { CHARACTERS, ITEMS } from "./js/data.js";
import { Items } from "./js/items.js";
const defs = (await import("./js/tracks.js").catch(() => null))?.TRACKS;
const test = { id: "test", name: "Test", hw: 11, start: { h: 0 },
  segs: [ { k: "S", len: 120, env: "city" }, { k: "T", ang: 90, r: 60, env: "city", dy: 10 }, { k: "S", len: 80, env: "tunnel", f: [{ t: "box", at: 0.5 }] },
    { k: "LOOP", r: 14, env: "city" }, { k: "T", ang: 120, r: 50, env: "mountain", dy: 20 }, { k: "LIFT", h: 25, env: "elevator" }, { k: "S", len: 60, env: "mountain", f: [{ t: "gap", at: 0.4, len: 18 }] },
    { k: "T", ang: -150, r: 70, env: "city", dy: -40 }, { k: "S", len: 150, env: "city" }, { k: "T", ang: 180, r: 80, env: "city", dy: -15 } ],
  branches: [{ from: 0.03, to: 0.12, side: 1, env: "dirt", pts: [[0.5, 30, 2]], label: "Shortcut" }] };
let list = process.argv[2] === "all" && defs ? defs : [test];
if (process.env.ONLY) list = list.filter(d => process.env.ONLY.split(",").includes(d.id));
for (const def of list) {
  const T = buildTrack(def, null);
  const G = { scene: new THREE.Scene(), track: T, time: 0, racing: true, diff: 1, worldSlow: 0, frameN: 0, karts: [], fx: { burst() {}, spawn() {} }, say() {}, banner() {} };
  const ev = {};
  for (const n of ["onBoost","onHit","onLap","onShortcut","onDriftLevel","onDriftBoost","onWall","onRamp","onPad","onBounce","onTrigger","onSmash","onItemBox","onTrick","onTrickLand","onBigLand","onFall","onLift","onDetach","onEdge","onBush","onStyle","onBotch","onCow","onSurface",]) G[n] = () => { ev[n] = (ev[n] || 0) + 1; };
  const ks = [];
  for (let i = 0; i < 6; i++) { const k = new Kart(CHARACTERS[i], ["flitzer","unimog","hover","boxer","ice","knirps"][i], false, G, i); k.setStart(T.N - 4 - i * 3, (i % 2 ? 1 : -1) * 3); ks.push(k); G.karts.push(k); }
  G.player = ks[0];
  const IT = new Items(G); G.items = IT; G.hud = { setItem() {} }; G.onAbility = () => {}; G.shake = 0;
  const used = {};
  G.useItem = (k, back) => { used[k.item] = (used[k.item] || 0) + 1; IT.use(k, back); };
  G.useAbility = (k) => { used["A:" + k.char.ability.type] = 1; IT.ability(k); };
  const ids = Object.keys(ITEMS); let ri = 0;
  G.finishRoulette = (k) => { k.item = ids[ri++ % ids.length]; };
  if (process.env.ITEMTEST) { const k0 = ks[0]; for (const id of ids) { for (const back of [false, true]) { try { IT.use(k0, back, id); for (let j = 0; j < 120; j++) { G.time += 1/60; IT.update(1/60); for (const k of ks) k.update(1/60, k.think(1/60)); } } catch (e) { console.log("ITEM FAIL", id, back, e.stack.split("\n").slice(0,3).join(" | ")); } } }
    const types = [...new Set(CHARACTERS.map(c => c.ability.type))]; for (const ty of types) { try { const c = k0.char; k0.char = { ...c, ability: { ...c.ability, type: ty } }; IT.ability(k0); for (let j = 0; j < 120; j++) { G.time += 1/60; IT.update(1/60); for (const k of ks) k.update(1/60, k.think(1/60)); } k0.char = c; } catch (e) { console.log("ABIL FAIL", ty, e.stack.split("\n").slice(0,3).join(" | ")); } }
    console.log("itemtest done nan", ks.filter(k => !isFinite(k.pos.x + k.pos.y + k.pos.z)).length, "live", IT.list.length); continue; }
  const slow = {}, falls = {};
  const of = G.onFall; G.onFall = (k) => { const key = k.pi + ":" + Math.floor(k.u / 10) * 10; falls[key] = (falls[key] || 0) + 1; };
  if (process.env.WALLDBG) { const ow = G.onWall; G.onWall = (k, hard) => { if (k === ks[+process.env.WATCH || 0] && hard && G.time > +process.env.DBG0 && G.time < +process.env.DBG) console.log("WALL", G.time.toFixed(2), k.u.toFixed(1), k.lat.toFixed(1), new Error().stack.split("\n").slice(2, 4).join(" | ")); }; }
  const dt = 1 / 60; let t = 0; const maxT = 240;
  while (t < maxT && ks.some(k => k.lap < 3)) { G.time = t; G.frameN++; T.update(dt, t, Math.max(...ks.map(k => k.curLap))); IT.update(dt); for (const k of ks) { const inp = k.think(dt); k.update(dt, inp); if (Math.abs(k.speed) < 10 && k.lap < 3) { const key = k.pi + ":" + Math.floor(k.u / 10) * 10; slow[key] = (slow[key] || 0) + dt; } } t += dt;
    if (process.env.DBG && Math.round(t * 60) % (+process.env.DBGN || 30) === 0 && t < +process.env.DBG && t > +(process.env.DBG0 || 0)) { const k = ks[+(process.env.WATCH || 0)]; const s = T.paths[k.pi].S[Math.floor(k.u) % T.paths[k.pi].N]; console.log(t.toFixed(1), "pi", k.pi, "u", k.u.toFixed(1), "lat", k.lat.toFixed(1), "sp", k.speed.toFixed(1), "gr", k.grounded, "resp", k.respawnT.toFixed(1), "seg", s && s.seg, "env", s && s.env, "y", k.pos.y.toFixed(1), "sy", s && s.y.toFixed(1), "upy", s && s.up.y.toFixed(2), "hdg", k.hdg.toFixed(2), "mh", k.mh.toFixed(2), "st", (k.ai.stuck||0).toFixed(1)); } }
  const nanK = ks.filter(k => !isFinite(k.pos.x + k.pos.y + k.pos.z)).length;
  console.log(def.id, "N", T.N, "L", T.main.L.toFixed(0), "bumps", T.bumps, "close", T.gm.closeLen.toFixed(0), "t", t.toFixed(1), "laps", ks.map(k => k.lap + "/" + k.vehId).join(" "), "nan", nanK);
  console.log("  ev", JSON.stringify(ev));
  const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => k + "=" + (+v).toFixed(0)).join(" ");
  console.log("  slow", top(slow), "| falls", top(falls));
  if (0) console.log("  used", JSON.stringify(used), "live", IT.list.length);
}
