// ===== audio: synthesized sfx, engine, oompah music =====
let ctx, master, musicGain, sfxGain, engine, noiseBuf;
let muted = false;
export const Audio = {
  init() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.22; musicGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.55; sfxGain.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  },
  get ctx() { return ctx; },
  toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.7;  return muted; },
  get muted() { return muted; },
};
function env(g, t, a, peak, dcy) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy); }
function tone(type, f0, f1, dur, vol = 0.3, when = 0, dest) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  env(g, t, 0.008, vol, dur); o.connect(g); g.connect(dest || sfxGain); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, f0, f1, vol = 0.3, when = 0, type = "bandpass", q = 1) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  const g = ctx.createGain(); env(g, t, 0.01, vol, dur);
  s.connect(f); f.connect(g); g.connect(sfxGain); s.start(t); s.stop(t + dur + 0.05);
}
const N = (n) => 440 * Math.pow(2, (n - 69) / 12);
export const SFX = {
  boost() { noise(0.6, 400, 3000, 0.35); tone("sawtooth", 200, 600, 0.4, 0.12); },
  jump() { tone("square", 300, 900, 0.18, 0.12); },
  hop() { tone("sine", 400, 700, 0.08, 0.1); },
  land() { noise(0.15, 300, 80, 0.4, 0, "lowpass"); tone("sine", 120, 50, 0.15, 0.3); },
  bigland() { noise(0.4, 600, 60, 0.6, 0, "lowpass"); tone("sine", 90, 30, 0.35, 0.5); },
  box() { [72, 76, 79, 84].forEach((n, i) => tone("triangle", N(n), N(n), 0.12, 0.18, i * 0.05)); },
  tick() { tone("square", 1200, 1200, 0.03, 0.06); },
  got() { tone("triangle", N(84), N(91), 0.2, 0.2); },
  hit() { noise(0.5, 2000, 200, 0.5); tone("sawtooth", 500, 60, 0.5, 0.2); },
  throw() { noise(0.25, 800, 2500, 0.25); },
  smash() { noise(0.35, 3000, 400, 0.5); tone("square", 200, 80, 0.2, 0.15); },
  drift(l) { tone("sine", [0, 900, 1200, 1600][l], [0, 1100, 1500, 2000][l], 0.15, 0.15); },
  trick() { tone("sine", 600, 1400, 0.25, 0.18); tone("sine", 900, 1800, 0.2, 0.1, 0.08); },
  lap() { [67, 72, 76, 79].forEach((n, i) => tone("square", N(n), N(n), 0.18, 0.12, i * 0.12)); },
  final() { [72, 72, 72, 77, 81].forEach((n, i) => tone("sawtooth", N(n), N(n), 0.22, 0.12, i * 0.14)); },
  count() { tone("square", N(69), N(69), 0.25, 0.18); },
  go() { tone("square", N(81), N(81), 0.6, 0.2); tone("square", N(76), N(76), 0.6, 0.12); },
  splash() { noise(0.8, 1200, 300, 0.45); },
  train() { tone("square", N(62), N(62), 0.5, 0.12); tone("square", N(66), N(66), 0.5, 0.1); },
  oink() { tone("sawtooth", 300, 180, 0.15, 0.2); tone("sawtooth", 320, 160, 0.15, 0.2, 0.18); },
  cuckoo() { tone("sine", N(79), N(79), 0.2, 0.25); tone("sine", N(75), N(75), 0.3, 0.25, 0.25); },
  glug() { for (let i = 0; i < 5; i++) tone("sine", 200 + Math.random() * 300, 100, 0.08, 0.2, i * 0.07); },
  wall() { noise(0.12, 1500, 500, 0.25); },
  scrape() { noise(0.1, 3000, 2500, 0.08, 0, "highpass"); },
  fall() { tone("sine", 900, 120, 1.0, 0.18); },
  win() { [72, 76, 79, 84, 79, 84].forEach((n, i) => tone("square", N(n), N(n), 0.25, 0.12, i * 0.15)); },
  sting(kind) { // dramatic character stings
    if (kind === "beethoven") { [67, 67, 67, 63].forEach((n, i) => tone("sawtooth", N(n - 12), N(n - 12), i === 3 ? 0.9 : 0.15, 0.2, i * 0.18)); }
    else if (kind === "wagner") { [57, 62, 65, 69, 74].forEach((n, i) => tone("sawtooth", N(n), N(n), 0.5, 0.12, i * 0.15)); }
    else { [72, 79, 84].forEach((n, i) => tone("triangle", N(n), N(n), 0.25, 0.15, i * 0.08)); }
  },
  boom() { noise(0.9, 900, 60, 0.7, 0, "lowpass"); tone("sawtooth", 120, 40, 0.6, 0.3); },
  bark() { tone("square", 520, 380, 0.09, 0.18); tone("square", 560, 400, 0.09, 0.15, 0.14); },
  squeak() { tone("sine", 1200, 1800, 0.12, 0.15); tone("sine", 1800, 1100, 0.1, 0.12, 0.12); },
  horn() { tone("square", N(64), N(64), 0.3, 0.15); tone("square", N(68), N(68), 0.3, 0.12); },
};

// engine (player)
export function engineStart() {
  if (!ctx || engine) return;
  const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  o1.type = "sawtooth"; o2.type = "square"; f.type = "lowpass"; f.frequency.value = 900; g.gain.value = 0.0;
  o1.connect(f); o2.connect(f); f.connect(g); g.connect(sfxGain); o1.start(); o2.start();
  const ns = ctx.createBufferSource(); ns.buffer = noiseBuf; ns.loop = true;
  const nf = ctx.createBiquadFilter(); nf.type = "bandpass"; nf.frequency.value = 2500; nf.Q.value = 3;
  const ng = ctx.createGain(); ng.gain.value = 0; ns.connect(nf); nf.connect(ng); ng.connect(sfxGain); ns.start();
  engine = { o1, o2, f, g, ng, nf };
}
export function engineUpdate(speed, boost, drift, air) {
  if (!engine) return;
  const t = ctx.currentTime;
  const f = 55 + Math.abs(speed) * 2.2 + (boost ? 40 : 0) + (air ? 30 : 0);
  engine.o1.frequency.setTargetAtTime(f, t, 0.05); engine.o2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
  engine.f.frequency.setTargetAtTime(500 + Math.abs(speed) * 25, t, 0.1);
  engine.g.gain.setTargetAtTime(0.07 + Math.min(0.08, Math.abs(speed) / 800), t, 0.1);
  engine.ng.gain.setTargetAtTime(drift ? 0.06 : 0, t, 0.05);
  engine.nf.frequency.setTargetAtTime(drift ? 1800 + drift * 600 : 2500, t, 0.05);
}
export function engineStop() { if (!engine) return; try { engine.o1.stop(); engine.o2.stop(); } catch (e) {} engine.g.disconnect(); engine.ng.disconnect(); engine = null; }

// oompah music
let seqTimer = null, nextT = 0, step = 0, song = null, tempoMul = 1;
function rng(seed) { let s = seed * 9301 + 49297; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
function makeSong(idx) {
  const r = rng(idx * 77 + 13);
  const roots = [60, 62, 65, 67, 58, 63, 64, 57];
  const root = roots[idx % roots.length];
  const scale = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16];
  const prog = [[0, 4, 7], [0, 4, 7], [7, 11, 14], [7, 11, 14], [5, 9, 12], [0, 4, 7], [7, 11, 14], [0, 4, 7]];
  const mel = [];
  let deg = 4;
  for (let i = 0; i < 64; i++) {
    if (r() < 0.75) { deg = Math.max(0, Math.min(scale.length - 1, deg + Math.floor(r() * 5) - 2)); mel.push(scale[deg]); }
    else mel.push(null);
  }
  return { root, prog, mel, bpm: 150 + (idx % 4) * 8 };
}
function schedule() {
  const lookahead = 0.15;
  while (nextT < ctx.currentTime + lookahead) {
    const spb = 60 / (song.bpm * tempoMul) / 2; // eighth notes
    const bar = Math.floor(step / 4) % 8, beat = step % 4;
    const ch = song.prog[bar];
    const when = nextT - ctx.currentTime;
    if (beat === 0) tone("triangle", N(song.root - 24 + ch[0]), N(song.root - 24 + ch[0]), spb * 1.6, 0.5, when, musicGain);
    if (beat === 2) tone("triangle", N(song.root - 24 + ch[0] - 5 + 12 * (ch[0] < 5 ? 0 : 0)), N(song.root - 29 + ch[0]), spb * 1.6, 0.45, when, musicGain);
    if (beat === 1 || beat === 3) for (const n of ch) tone("square", N(song.root + n - 12), N(song.root + n - 12), spb * 0.6, 0.05, when, musicGain);
    const m = song.mel[step % 64];
    if (m !== null && m !== undefined) { tone("sawtooth", N(song.root + m + 12), N(song.root + m + 12), spb * 0.9, 0.06, when, musicGain); tone("square", N(song.root + m + 12) * 1.005, N(song.root + m + 12), spb * 0.9, 0.04, when, musicGain); }
    if (beat === 0 || beat === 2) noise(0.05, 4000, 3000, 0.04, when, "highpass");
    nextT += spb; step++;
  }
}
export function musicStart(idx) {
  if (!ctx) return;
  musicStop();
  song = makeSong(idx); step = 0; nextT = ctx.currentTime + 0.1; tempoMul = 1;
  seqTimer = setInterval(schedule, 40);
}
export function musicFast() { tempoMul = 1.15; }
export function musicStop() { if (seqTimer) clearInterval(seqTimer); seqTimer = null; }

