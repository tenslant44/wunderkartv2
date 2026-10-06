import { buildTrack } from "./js/track.js";
const { TRACK } = await import("./js/tracks.js");
const T = buildTrack(TRACK[process.argv[2]], null);
const b = T.paths[+process.argv[3]]; const u0 = +process.argv[4], u1 = +process.argv[5];
console.log("N", b.N, "i0", b.i0, "i1", b.i1, "side", b.side);
for (let i = u0; i <= Math.min(u1, b.N - 1); i += 2) { const s = b.S[i]; console.log(i, s.env, "hw", s.hw.toFixed(1), "shw", s.shw, "sh", s.sh, "wall", s.wallL, s.wallR, "open", s.openL, s.openR, "encl", s.encl, "xyz", s.x.toFixed(0), s.y.toFixed(1), s.z.toFixed(0), "up", s.up.y.toFixed(2), "kt", (s.kt||0).toFixed(3)); }
for (const o of T.objs.obst) if (o.pi === b.idx) console.log("obst", o.kind, o.i, o.lat);
for (const g of T.objs.gates) if (g.b === b) console.log("gate", g.kind, g.i);
