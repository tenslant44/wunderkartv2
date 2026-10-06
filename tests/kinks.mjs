import { buildTrack } from "./js/track.js";
const { TRACKS } = await import("./js/tracks.js");
for (const def of TRACKS) {
  const T = buildTrack(def, null); const out = [];
  T.paths.forEach((p, pi) => { if (!pi) return; let worst = 0, wi = 0;
    for (let i = 1; i < p.N - 1; i++) { const a = p.S[i - 1].t, b = p.S[i + 1].t; const ang = Math.acos(Math.max(-1, Math.min(1, (a.x * b.x + a.y * b.y + a.z * b.z) / (a.length() * b.length() || 1)))); if (ang > worst) { worst = ang; wi = i; } }
    if (worst > 0.35) out.push(pi + "@" + wi + "/" + p.N + " " + (worst * 57.3).toFixed(0) + "deg"); });
  console.log(def.id, out.join("  "));
}
