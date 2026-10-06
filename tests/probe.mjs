import { buildTrack } from "./js/track.js";
const { TRACK } = await import("./js/tracks.js");
const T = buildTrack(TRACK[process.argv[2]], null);
const u0 = +process.argv[3], u1 = +process.argv[4];
const S = T.main.S;
for (const o of T.objs.obst) { const s = S[o.i] || {}; if (o.pi === 0 && o.i >= u0 && o.i <= u1 || (o.pos && T.project && false)) console.log("obst", o.kind, o.i, o.lat, o.r); }
for (const o of T.objs.obst) if (o.pi === undefined || o.i === undefined) { console.log("obst?", Object.keys(o).join(","), o.pos && o.pos.toArray().map(v=>v.toFixed(0)).join(",")); break; }
for (const g of T.objs.gates) console.log("gate", g.kind, g.pi, g.i, g.lat, Object.keys(g).join(","));
for (const h of T.hazards) console.log("haz", h.kind, h.type, h.pos && h.pos.toArray().map(v=>v.toFixed(0)).join(","));
for (let i = u0; i <= u1; i += 2) { const s = S[i]; console.log(i, s.seg, s.env, "hw", s.hw.toFixed(1), "shw", s.shw, "wall", s.wallL, s.wallR, "open", s.openL, s.openR, "xyz", s.x.toFixed(0), s.y.toFixed(1), s.z.toFixed(0)); }
for (const b of T.branches) console.log("br", b.id, b.i0, b.i1, b.side);
