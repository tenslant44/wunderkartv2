import * as THREE from "three";
import { CHARACTERS, ITEMS, PHRASES } from "./data.js";
import { TRACKS, CUPS, TRACK } from "./tracks.js";
import { VEHICLES, VEH } from "./vehicles.js";
import { buildTrack } from "./track.js";
import { Kart, buildKartModel } from "./kart.js";
import { Items } from "./items.js";
import { FX } from "./fx.js";
import { Net } from "./net.js";
import { Audio, SFX, engineStart, engineUpdate, engineStop, musicStart, musicStop, musicFast } from "./audio.js";

const $ = (s) => document.querySelector(s);
const LAPS = 3, NKARTS = 8;
const POINTS = [15, 12, 10, 8, 6, 4, 2, 1];

const EMOTES = ["👍", "😂", "😡", "🥨", "🍺", "😎", "🤯", "👋"];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (t) => { const m = Math.floor(t / 60), s = t % 60; return m + ":" + (s < 10 ? "0" : "") + s.toFixed(2); };

// ---------- renderer ----------
const canvas = $("#c");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const camera = new THREE.PerspectiveCamera(72, 1, 0.5, 6000);
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener("resize", resize); resize();
if ("ontouchstart" in window || navigator.maxTouchPoints > 0) document.body.classList.add("touch");

// ---------- game context ----------
const G = {
  scene: null, track: null, karts: [], player: null, time: 0, racing: false, diff: 1, worldSlow: 0, worldSlowOwner: null,
  slowT: 0, shake: 0, fovKick: 0, raceTime: 0, state: "title", frameN: 0, net: null, timeTrial: false,
};
G.refKart = () => {
  let leader = null;
  for (const k of G.karts) if (!k.bot && (k.isPlayer || k.remote) && !k.finished && (!leader || k.progress > leader.progress)) leader = k;
  return leader || G.player;
};
let items, fx;
const net = new Net();
const codeFormat = $("#codeFormat");
const shortCodeOption = codeFormat.querySelector('[value="short"]'), compactCodeOption = codeFormat.querySelector('[value="compact"]');
let compactCodesAvailable = false;
try { new CompressionStream("deflate"); new DecompressionStream("deflate"); compactCodesAvailable = true; } catch {}
const signalingCodesAvailable = typeof globalThis.WebsimSocket?.joinRoom === "function";
const draftRoomRestricted = location.hostname.endsWith(".sandbox.websim.com");
shortCodeOption.disabled = !signalingCodesAvailable;
compactCodeOption.disabled = !compactCodesAvailable;
const fallbackCodeFormat = signalingCodesAvailable && !draftRoomRestricted ? "short" : compactCodesAvailable ? "compact" : "full";
const savedCodeFormat = localStorage.wkConnectionCodeMode;
codeFormat.value = ["short", "compact", "full"].includes(savedCodeFormat) && !codeFormat.querySelector('[value="' + savedCodeFormat + '"]').disabled ? savedCodeFormat : fallbackCodeFormat;
net.shortCodes = codeFormat.value === "short";
net.compactCodes = codeFormat.value === "compact";
function updateCodeFormatHint() {
  $("#codeFormatHint").textContent = codeFormat.value === "short"
    ? draftRoomRestricted ? "No Python or WebRTC. Websim relays the game; preview players must be project editors." : "No Python or WebRTC. Share one code; Websim relays the game."
    : codeFormat.value === "compact" ? "Compressed WebRTC: host shares an invite; each guest returns an answer code."
    : "Uncompressed WebRTC: host shares an invite; each guest returns an answer code.";
}
updateCodeFormatHint();
codeFormat.addEventListener("change", () => {
  net.shortCodes = codeFormat.value === "short";
  net.compactCodes = codeFormat.value === "compact";
  localStorage.wkConnectionCodeMode = codeFormat.value;
  updateCodeFormatHint();
});
let lanServerAddress = location.host;
const lanServerCheck = location.protocol === "http:" ? fetch("/lan-status", { cache: "no-store" }).then(async response => {
  if (!response.ok) return false;
  const status = await response.json();
  if (status.lan !== true) return false;
  net.lanServer = true;
  if (Array.isArray(status.urls) && status.urls.length) lanServerAddress = status.urls.join(" · ");
  $("#peerJoin").classList.add("hidden");
  $("#codeFormatRow").classList.add("hidden");
  $("#lanTip").classList.add("hidden");
  if (G.state === "online") openOnline();
  return true;
}).catch(() => false) : Promise.resolve(false);
let online = null; // { race, myKart } while an online race runs
let timeTrial = null;
let raceRecording = null, replayPlayback = null, pendingKillcam = null;
const KILLCAM_HALF_WINDOW = 2;
function showHitNotice(label, name) {
  const notice = $("#hitNotice");
  $("#hitNoticeLabel").textContent = label;
  $("#hitNoticeName").textContent = name;
  notice.classList.remove("hidden", "show");
  void notice.offsetWidth;
  notice.classList.add("show");
  notice.onanimationend = () => { notice.classList.remove("show"); notice.classList.add("hidden"); };
}

function captureRaceFrame(time = G.raceTime) {
  if (!raceRecording || online || !G.karts.length) return;
  const itemFrames = [];
  for (const p of items?.list || []) {
    if (!p.replayId) p.replayId = raceRecording.nextItemId++;
    if (!raceRecording.itemModels.has(p.replayId)) {
      const model = p.mesh.clone(true); model.visible = false;
      raceRecording.itemModels.set(p.replayId, model);
    }
    itemFrames.push({ id: p.replayId, p: p.mesh.position.toArray(), q: p.mesh.quaternion.toArray(), s: p.mesh.scale.toArray() });
  }
  raceRecording.frames.push({
    t: Math.max(0, time),
    k: G.karts.map(k => ({
      p: k.m.root.position.toArray(), q: k.m.root.quaternion.toArray(), speed: k.speed, drift: k.drift, grounded: k.grounded,
      tilt: [k.m.tilt.rotation.x, k.m.tilt.rotation.y, k.m.tilt.rotation.z],
      fx: {
        p: k.m.fx.position.toArray(), r: [k.m.fx.rotation.x, k.m.fx.rotation.y, k.m.fx.rotation.z],
        s: k.m.fx.scale.toArray(), visible: k.m.fx.visible,
      },
      lap: k.lap, place: k.place,
      sh: { p: k.m.shadow.position.toArray(), q: k.m.shadow.quaternion.toArray(), s: k.m.shadow.scale.toArray(), visible: k.m.shadow.visible },
    })),
    items: itemFrames,
  });
}
function addReplayModels() {
  if (!raceRecording || !G.scene) return;
  for (const model of raceRecording.itemModels.values()) { model.visible = false; G.scene.add(model); }
}
function hideReplayModels() {
  if (!raceRecording) return;
  for (const model of raceRecording.itemModels.values()) { model.visible = false; if (G.scene) G.scene.remove(model); }
}
function poseAt(frames, time) {
  if (time <= frames[0].t) return [frames[0], frames[0], 0];
  let lo = 0, hi = frames.length - 1;
  while (lo + 1 < hi) { const m = (lo + hi) >> 1; if (frames[m].t <= time) lo = m; else hi = m; }
  const a = frames[lo], b = frames[hi], span = b.t - a.t;
  return [a, b, span > 0 ? (time - a.t) / span : 0];
}
function applyReplayPose(frames, time) {
  const [a, b, f] = poseAt(frames, time);
  G.karts.forEach((k, i) => {
    const x = a.k[i], y = b.k[i] || x; if (!x) return;
    k.m.root.position.fromArray(x.p).lerp(new THREE.Vector3().fromArray(y.p), f);
    k.m.root.quaternion.fromArray(x.q).slerp(new THREE.Quaternion().fromArray(y.q), f);
    k.pos.copy(k.m.root.position); k.quat.copy(k.m.root.quaternion);
    if (x.tilt && y.tilt) {
      k.m.tilt.rotation.set(
        x.tilt[0] + (y.tilt[0] - x.tilt[0]) * f,
        x.tilt[1] + (y.tilt[1] - x.tilt[1]) * f,
        x.tilt[2] + (y.tilt[2] - x.tilt[2]) * f,
      );
    }
    if (x.fx && y.fx) {
      k.m.fx.position.fromArray(x.fx.p).lerp(new THREE.Vector3().fromArray(y.fx.p), f);
      k.m.fx.rotation.set(
        x.fx.r[0] + (y.fx.r[0] - x.fx.r[0]) * f,
        x.fx.r[1] + (y.fx.r[1] - x.fx.r[1]) * f,
        x.fx.r[2] + (y.fx.r[2] - x.fx.r[2]) * f,
      );
      k.m.fx.scale.fromArray(x.fx.s).lerp(new THREE.Vector3().fromArray(y.fx.s), f);
      k.m.fx.visible = f < 0.5 ? x.fx.visible : y.fx.visible;
    }
    const sh = x.sh; if (sh) { k.m.shadow.position.fromArray(sh.p); k.m.shadow.quaternion.fromArray(sh.q); k.m.shadow.scale.fromArray(sh.s); k.m.shadow.visible = sh.visible; }
    k.speed = x.speed + ((y.speed ?? x.speed) - x.speed) * f;
    k.drift = f < 0.5 ? x.drift : y.drift; k.grounded = f < 0.5 ? x.grounded : y.grounded;
  });
  if (raceRecording) for (const model of raceRecording.itemModels.values()) model.visible = false;
  const itemBlend = new Map(b.items.map(x => [x.id, x]));
  for (const x of a.items) {
    const model = raceRecording?.itemModels.get(x.id); if (!model) continue;
    const y = itemBlend.get(x.id) || x;
    model.position.fromArray(x.p).lerp(new THREE.Vector3().fromArray(y.p), f);
    model.quaternion.fromArray(x.q).slerp(new THREE.Quaternion().fromArray(y.q), f);
    model.scale.fromArray(x.s); model.visible = true;
  }
}
function finishReplay() {
  if (!replayPlayback) return;
  const playback = replayPlayback; replayPlayback = null; hideReplayModels();
  if (playback.kind !== "killcam") restoreReplayLivePose(playback);
  $("#killcamBox").classList.remove("show");
  $("#killcamBox").classList.add("hidden");
  $("#replayHud").classList.add("hidden");
  if (playback.kind === "killcam") { G.state = "race"; paused = false; return; }
  if (playback.returnTo === "results") { paused = true; show("#results"); $("#hud").classList.add("hidden"); G.state = "results"; }
  else { paused = true; show(null); $("#pause").classList.remove("hidden"); $("#hud").classList.remove("hidden"); G.state = "race"; }
}
function restoreReplayLivePose(playback) {
  playback.liveKarts?.forEach((s, i) => {
    const k = G.karts[i]; if (!k) return;
    k.m.root.position.copy(s.rootP); k.m.root.quaternion.copy(s.rootQ); k.m.shadow.position.copy(s.shadowP);
    k.m.shadow.quaternion.copy(s.shadowQ); k.m.shadow.scale.copy(s.shadowS); k.m.shadow.visible = s.shadowVisible;
    if (s.tilt) k.m.tilt.rotation.copy(s.tilt);
    if (s.fx) {
      k.m.fx.position.copy(s.fx.p); k.m.fx.rotation.copy(s.fx.r); k.m.fx.scale.copy(s.fx.s); k.m.fx.visible = s.fx.visible;
    }
    k.pos.copy(s.pos); k.quat.copy(s.quat); k.speed = s.speed; k.drift = s.drift; k.grounded = s.grounded;
  });
  playback.liveItems?.forEach(([mesh, visible]) => { mesh.visible = visible; });
  if (playback.cam) {
    cam.pos.copy(playback.cam.pos); cam.look.copy(playback.cam.look); cam.fwd.copy(playback.cam.fwd); cam.up.copy(playback.cam.up);
    camera.position.copy(playback.cam.viewPos); camera.quaternion.copy(playback.cam.viewQ); camera.up.copy(playback.cam.viewUp);
    camera.fov = playback.cam.fov; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  }
}
function startRaceReplay(frames = raceRecording?.frames, kind = "race", message = "ITEM HIT", focus = {}) {
  if (!frames || frames.length < 2 || !raceRecording) return;
  const returnTo = G.state === "results" ? "results" : "pause";
  const end = frames[frames.length - 1].t, duration = Math.max(0.1, end - frames[0].t);
  replayPlayback = {
    frames, kind, duration, t: 0, loops: 1, returnTo,
    liveKarts: G.karts.map(k => ({
      rootP: k.m.root.position.clone(), rootQ: k.m.root.quaternion.clone(), pos: k.pos.clone(), quat: k.quat.clone(),
      shadowP: k.m.shadow.position.clone(), shadowQ: k.m.shadow.quaternion.clone(), shadowS: k.m.shadow.scale.clone(),
      tilt: k.m.tilt.rotation.clone(),
      fx: { p: k.m.fx.position.clone(), r: k.m.fx.rotation.clone(), s: k.m.fx.scale.clone(), visible: k.m.fx.visible },
      shadowVisible: k.m.shadow.visible, speed: k.speed, drift: k.drift, grounded: k.grounded,
    })),
    liveItems: (items?.list || []).map(p => [p.mesh, p.mesh.visible]),
    cam: { pos: cam.pos.clone(), look: cam.look.clone(), fwd: cam.fwd.clone(), up: cam.up.clone(), viewPos: camera.position.clone(), viewQ: camera.quaternion.clone(), viewUp: camera.up.clone(), fov: camera.fov },
    currentTime: frames[0].t, message,
    focusIdx: Number.isInteger(focus.focusIdx) ? focus.focusIdx : G.player?.idx || 0,
    companionIdx: Number.isInteger(focus.companionIdx) ? focus.companionIdx : null,
  };
  paused = false; show(null); $("#pause").classList.add("hidden"); $("#hud").classList.remove("hidden"); G.state = "race";
  if (kind !== "killcam") for (const [mesh] of replayPlayback.liveItems || []) mesh.visible = false;
  addReplayModels();
  if (kind === "killcam") {
    $("#replayHud").classList.add("hidden");
    $("#killcamMessage").textContent = message;
    $("#killcamProgress").style.width = "0%";
    $("#killcamBox").classList.remove("hidden", "show");
    void $("#killcamBox").offsetWidth;
    $("#killcamBox").classList.add("show");
  } else {
    $("#replayHud").classList.remove("hidden");
    $("#replayLabel").textContent = "RACE REPLAY";
  }
  $("#replayProgress").style.width = "0%";
  if (kind !== "killcam") { applyReplayPose(frames, frames[0].t); updateCamera(0.05); }
}
function aimKillcamCamera(playback, aspect) {
  const focus = G.karts[playback.focusIdx] || G.player || G.karts[0];
  if (!focus) return;
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(focus.quat);
  const up = new THREE.Vector3(0, 1, 0);
  if (!focus.grounded || focus.respawnT > 0) forward.y *= 0.3;
  if (forward.lengthSq() < 0.001) forward.set(0, 0, 1);
  forward.normalize();
  if (focus.drift) forward.applyAxisAngle(up, focus.drift * 0.18);
  const speed = Math.abs(focus.speed || 0);
  let distance = 11 + speed * 0.05;
  let height = 5.4 + speed * 0.015;
  if (!focus.grounded) {
    height += Math.min(6, (focus.airT || 0) * 3);
    distance += Math.min(4, (focus.airT || 0) * 2);
  }
  camera.position.copy(focus.pos).addScaledVector(forward, -distance).addScaledVector(up, height);
  camera.up.copy(up);
  camera.fov = 70 + Math.min(14, speed * 0.12) + (focus.boostT > 0 ? 8 : 0);
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  const look = focus.pos.clone().addScaledVector(forward, 7).addScaledVector(up, 2.6);
  camera.lookAt(look);
}
function queueItemKillcam(message, subject, companion) {
  if (!raceRecording || !G.racing || replayPlayback || pendingKillcam) return;
  // Keep the impact itself even when it happens before the periodic recorder
  // has collected enough frames for a normal replay.
  captureRaceFrame(G.raceTime);
  pendingKillcam = {
    hitTime: G.raceTime, message, race: raceRecording,
    focusIdx: subject?.idx ?? G.player?.idx ?? 0,
    companionIdx: companion && companion !== subject ? companion.idx : null,
  };
}
function playPendingKillcam() {
  if (!pendingKillcam || !raceRecording || pendingKillcam.race !== raceRecording || replayPlayback) return;
  const hitTime = pendingKillcam.hitTime;
  const message = pendingKillcam.message || "ITEM HIT";
  const start = hitTime - KILLCAM_HALF_WINDOW, end = hitTime + KILLCAM_HALF_WINDOW;
  if (G.raceTime < end) return;
  captureRaceFrame(G.raceTime);
  const all = raceRecording.frames;
  const clipStart = Math.max(0, start);
  let clip = all.filter(f => Number.isFinite(f.t) && f.t >= clipStart && f.t <= end);
  if (!clip.length) {
    pendingKillcam = null;
    return;
  }
  const focus = { focusIdx: pendingKillcam.focusIdx, companionIdx: pendingKillcam.companionIdx };
  // Extend the first and last captured poses to the exact clip boundaries so
  // playback always has a full four second timeline, including early hits.
  if (clip[0].t > start) clip.unshift({ ...clip[0], t: start });
  if (clip[clip.length - 1].t < end) clip.push({ ...clip[clip.length - 1], t: end });
  if (clip.length < 2) {
    pendingKillcam = null;
    return;
  }
  clip = clip.map(f => ({ ...f, t: f.t - start }));
  pendingKillcam = null;
  startRaceReplay(clip, "killcam", message, focus);
}
function updateReplay(dt) {
  if (!replayPlayback) return false;
  const p = replayPlayback; p.t += dt;
  if (p.t >= p.duration * p.loops) {
    if (p.kind !== "killcam") applyReplayPose(p.frames, p.frames[p.frames.length - 1].t);
    finishReplay(); return true;
  }
  const cycle = Math.min(p.loops - 1, Math.floor(p.t / p.duration));
  const local = p.t - cycle * p.duration;
  p.currentTime = p.frames[0].t + local;
  if (p.kind !== "killcam") applyReplayPose(p.frames, p.currentTime);
  const [frame] = poseAt(p.frames, p.frames[0].t + local), player = frame.k[G.player?.idx || 0];
  if (player) { $("#placeN").textContent = player.place; $("#lap").textContent = "Lap " + Math.min(raceLaps, (player.lap || 0) + 1) + "/" + raceLaps; }
  $("#time").textContent = fmt(p.kind === "killcam" ? G.raceTime : p.frames[0].t + local);
  if (p.kind === "killcam") $("#killcamProgress").style.width = (local / p.duration * 100) + "%";
  else $("#replayProgress").style.width = (local / p.duration * 100) + "%";
  return true;
}
$("#replayExit").onclick = finishReplay;
$("#killcamExit").onclick = finishReplay;

function renderKillcamInset() {
  const p = replayPlayback;
  if (!p) return;
  const live = {
    karts: G.karts.map(k => ({
      rootP: k.m.root.position.clone(), rootQ: k.m.root.quaternion.clone(), pos: k.pos.clone(), quat: k.quat.clone(),
      tilt: k.m.tilt.rotation.clone(), fxP: k.m.fx.position.clone(), fxR: k.m.fx.rotation.clone(), fxS: k.m.fx.scale.clone(), fxVisible: k.m.fx.visible,
      shadowP: k.m.shadow.position.clone(), shadowQ: k.m.shadow.quaternion.clone(), shadowS: k.m.shadow.scale.clone(), shadowVisible: k.m.shadow.visible,
      speed: k.speed, drift: k.drift, grounded: k.grounded,
    })),
    items: (items?.list || []).map(x => ({ mesh: x.mesh, p: x.mesh.position.clone(), q: x.mesh.quaternion.clone(), s: x.mesh.scale.clone(), visible: x.mesh.visible })),
    cam: { pos: cam.pos.clone(), look: cam.look.clone(), fwd: cam.fwd.clone(), up: cam.up.clone(), viewPos: camera.position.clone(), viewQ: camera.quaternion.clone(), viewUp: camera.up.clone(), fov: camera.fov, shake: G.shake, fovKick: G.fovKick },
  };
  if (raceRecording) for (const model of raceRecording.itemModels.values()) model.visible = false;
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, innerWidth, innerHeight);
  renderer.render(G.scene, camera);

  applyReplayPose(p.frames, p.currentTime);
  const rect = $("#killcamViewport").getBoundingClientRect();
  const y = innerHeight - rect.bottom;
  aimKillcamCamera(p, rect.width / rect.height);
  renderer.setViewport(rect.left, y, rect.width, rect.height);
  renderer.setScissor(rect.left, y, rect.width, rect.height);
  renderer.setScissorTest(true);
  renderer.clear(true, true, true);
  renderer.render(G.scene, camera);
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, innerWidth, innerHeight);
  live.karts.forEach((s, i) => {
    const k = G.karts[i]; if (!k) return;
    k.m.root.position.copy(s.rootP); k.m.root.quaternion.copy(s.rootQ); k.pos.copy(s.pos); k.quat.copy(s.quat);
    k.m.tilt.rotation.copy(s.tilt); k.m.fx.position.copy(s.fxP); k.m.fx.rotation.copy(s.fxR); k.m.fx.scale.copy(s.fxS); k.m.fx.visible = s.fxVisible;
    k.m.shadow.position.copy(s.shadowP); k.m.shadow.quaternion.copy(s.shadowQ); k.m.shadow.scale.copy(s.shadowS); k.m.shadow.visible = s.shadowVisible;
    k.speed = s.speed; k.drift = s.drift; k.grounded = s.grounded;
  });
  live.items.forEach(s => { s.mesh.position.copy(s.p); s.mesh.quaternion.copy(s.q); s.mesh.scale.copy(s.s); s.mesh.visible = s.visible; });
  cam.pos.copy(live.cam.pos); cam.look.copy(live.cam.look); cam.fwd.copy(live.cam.fwd); cam.up.copy(live.cam.up);
  camera.position.copy(live.cam.viewPos); camera.quaternion.copy(live.cam.viewQ); camera.up.copy(live.cam.viewUp);
  camera.fov = live.cam.fov; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  G.shake = live.cam.shake; G.fovKick = live.cam.fovKick;
}

// ---------- portraits ----------
const portraits = {};
(function makePortraits() {
  const pr = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  pr.setSize(128, 116); pr.outputColorSpace = THREE.SRGBColorSpace;
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.6)); const dl = new THREE.DirectionalLight(0xffffff, 1.6); dl.position.set(3, 5, 6); sc.add(dl);
  const cam = new THREE.PerspectiveCamera(32, 128 / 116, 0.1, 100);
  for (const c of CHARACTERS) {
    const m = buildKartModel(c, "flitzer");
    sc.add(m.root); m.root.rotation.y = -0.45;
    cam.position.set(0, 4.6, 7.5); cam.lookAt(0, 3.4, 0);
    pr.render(sc, cam);
    portraits[c.id] = pr.domElement.toDataURL();
    sc.remove(m.root);
  }
  pr.dispose();
})();

// ---------- menu scene ----------
const menu = { scene: new THREE.Scene(), kart: null, t: 0 };
{
  const s = menu.scene;
  s.background = new THREE.Color(0x87c8ff);
  s.add(new THREE.HemisphereLight(0xffffff, 0x557744, 1.3));
  const dl = new THREE.DirectionalLight(0xffffff, 1.6); dl.position.set(5, 10, 6); s.add(dl);
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 1, 40), new THREE.MeshLambertMaterial({ color: 0xffce00 })); floor.position.y = -0.5; s.add(floor);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(9, 0.4, 8, 40), new THREE.MeshLambertMaterial({ color: 0xdd0000 })); ring.rotation.x = Math.PI / 2; s.add(ring);
  const g = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: 0x5aaa4a })); g.rotation.x = -Math.PI / 2; g.position.y = -1; s.add(g);
  for (let i = 0; i < 40; i++) { const a = Math.random() * 6.28, r = 30 + Math.random() * 80; const t = new THREE.Mesh(new THREE.ConeGeometry(3, 10, 7), new THREE.MeshLambertMaterial({ color: 0x2a6a35 })); t.position.set(Math.cos(a) * r, 4, Math.sin(a) * r); s.add(t); }
  for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28, r = 220; const m = new THREE.Mesh(new THREE.ConeGeometry(70, 150, 7), new THREE.MeshLambertMaterial({ color: 0x8899aa, flatShading: true })); m.position.set(Math.cos(a) * r, 60, Math.sin(a) * r); s.add(m); }
}
function setMenuKart() {
  if (menu.kart) menu.scene.remove(menu.kart.root);
  menu.kart = buildKartModel(selChar, selVeh.id);
  menu.scene.add(menu.kart.root);
}

// ---------- UI flow ----------
const params = new URLSearchParams(location.search);
let mode = "gp", gp = null;
let selChar = CHARACTERS.find(c => c.id === (params.get("char") || localStorage.wkChar)) || CHARACTERS[0];
let selVeh = VEH[params.get("veh") || localStorage.wkVeh] || VEHICLES[0];
const SCREENS = ["#title", "#controls", "#select", "#tracks", "#results", "#pause", "#online", "#websimSetup", "#lobby"];
let raceLaps = LAPS;
function show(id) { for (const s of SCREENS) $(s).classList.toggle("hidden", s !== id); }
let onlineSelectionReturn = null;
document.querySelectorAll("[data-go]").forEach(b => b.onclick = () => {
  Audio.init(); SFX.box(); mode = b.dataset.go;
  if (mode === "websimOnline" && typeof globalThis.WebsimSocket?.joinRoom !== "function") {
    show("#websimSetup"); G.state = "websimSetup"; $("#websimSetupMessage").textContent = "WebSim online doesn't work! LAN is in development."; return;
  }
  openSelect();
});
document.querySelectorAll("[data-back]").forEach(b => b.onclick = () => { SFX.tick(); show("#" + b.dataset.back); G.state = b.dataset.back; });

function openSelect() {
  show("#select"); G.state = "select";
  const grid = $("#grid"); grid.innerHTML = "";
  for (const c of CHARACTERS) {
    const d = document.createElement("div"); d.className = "card" + (c === selChar ? " sel" : "");
    d.innerHTML = '<img src="' + portraits[c.id] + '"><span>' + esc(c.short) + "</span>";
    d.onclick = () => { selChar = c; localStorage.wkChar = c.id; grid.querySelectorAll(".card").forEach(x => x.classList.remove("sel")); d.classList.add("sel"); showChar(c); SFX.horn(); };
    d.ondblclick = () => $("#cgo").onclick();
    grid.appendChild(d);
  }
  showChar(selChar);
}
function chooseOnlineCharacter() { onlineSelectionReturn = G.state; openSelect(); }
const stat = (n, v) => '<div class="stat"><b>' + n + '</b><i style="--v:' + Math.round(Math.max(0, Math.min(1, v)) * 100) + '%"></i></div>';
const vr = (k) => { const a = VEHICLES.map(v => v[k]); return [Math.min(...a), Math.max(...a)]; };
const VR = { spd: vr("spd"), acc: vr("acc"), hnd: vr("hnd"), wt: vr("wt"), grip: vr("grip") };
const nrm = (v, k) => v[k] === 0 ? 0 : 0.12 + 0.88 * (v[k] - VR[k][0]) / ((VR[k][1] - VR[k][0]) || 1);
function showChar(c) {
  $("#cname").textContent = c.name;
  $("#cclass").textContent = c.cls + " · Weight " + "●".repeat(c.wt) + "○".repeat(5 - c.wt);
  $("#cstats").innerHTML = stat("Speed", c.spd / 5) + stat("Accel.", c.acc / 5) + stat("Handling", c.hnd / 5);
  $("#cability").innerHTML = "<strong>★ " + esc(c.ability.name) + "</strong>" + esc(c.ability.desc);
  showVeh();
}
function showVeh() {
  const v = selVeh;
  $("#vname").textContent = v.name + " · " + v.cls;
  $("#vdesc").textContent = v.desc;
  $("#vstats").innerHTML = stat("Speed", nrm(v, "spd")) + stat("Accel.", nrm(v, "acc")) + stat("Handling", nrm(v, "hnd")) + stat("Traction", nrm(v, "grip")) + stat("Weight", nrm(v, "wt")) + stat("Off-road", v.off || 0);
  setMenuKart();
}
function stepVeh(d) { const i = VEHICLES.indexOf(selVeh); selVeh = VEHICLES[(i + d + VEHICLES.length) % VEHICLES.length]; localStorage.wkVeh = selVeh.id; SFX.tick(); showVeh(); }
$("#vprev").onclick = () => stepVeh(-1); $("#vnext").onclick = () => stepVeh(1);
$("#cgo").onclick = () => {
  SFX.box();
  if (onlineSelectionReturn) {
    const destination = onlineSelectionReturn; onlineSelectionReturn = null;
    net.profile(CHARACTERS.indexOf(selChar), VEHICLES.indexOf(selVeh), playerNameInput.value);
    if (destination === "race") { show(null); $("#hud").classList.remove("hidden"); G.state = "race"; }
    else if (destination === "results") { show("#results"); G.state = "results"; }
    else openLobby();
  } else if (mode === "online") openOnline();
  else if (mode === "websimOnline") openWebsimSetup();
  else openTracks();
};
function trackLen(t) { try { return t._len || (t._len = (buildTrack(t, null).main.L / 1000)); } catch (e) { return 0; } }
const GHOST_STEP = 0.125, GHOST_WORDS = 8;
const personalGhostKey = (trackId) => "wkGhost:" + trackId;
const challengeGhostKey = (trackId) => "wkGhostChoice:" + trackId;
const sharedGhostPrefix = (trackId) => "wkSharedGhost:" + encodeURIComponent(trackId) + ":";
function wordsToBase64(words) {
  const bytes = new Uint8Array(words.buffer, words.byteOffset, words.byteLength);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
function ghostWords(ghost) {
  try {
    const binary = atob(ghost.data), bytes = new Uint8Array(binary.length);
    if (!binary.length || binary.length % (GHOST_WORDS * 2)) return null;
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Int16Array(bytes.buffer);
  } catch { return null; }
}
function ghostInputWords(ghost) {
  try {
    if (!ghost?.inputData) return null;
    const binary = atob(ghost.inputData), bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return bytes.length % 2 ? null : new Uint16Array(bytes.buffer);
  } catch { return null; }
}
function ghostName(name) {
  const label = String(name || "Driver").trim() || "Driver";
  return /'s ghost$/i.test(label) ? label : label + "'s ghost";
}
function validGhost(ghost, trackId) {
  return !!ghost && ghost.version === 1 && ghost.trackId === trackId && !!TRACK[trackId] &&
    typeof ghost.name === "string" && Number.isInteger(ghost.char) && !!CHARACTERS[ghost.char] &&
    typeof ghost.vehicle === "string" && !!VEH[ghost.vehicle] && Number.isFinite(ghost.time) && ghost.time > 0 &&
    ghost.step === GHOST_STEP && Array.isArray(ghost.origin) && ghost.origin.length === 3 && ghost.origin.every(Number.isFinite) &&
    typeof ghost.data === "string" && ghost.data.length <= 56000 && !!ghostWords(ghost) &&
    (ghost.inputData === undefined || (typeof ghost.inputData === "string" && ghost.inputData.length <= 12000));
}
function loadPersonalGhost(trackId) {
  try { const ghost = JSON.parse(localStorage.getItem(personalGhostKey(trackId)) || "null"); return validGhost(ghost, trackId) ? { ...ghost, name: ghostName(ghost.name) } : null; }
  catch { return null; }
}
function loadSharedGhosts(trackId) {
  const prefix = sharedGhostPrefix(trackId), found = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(prefix)) continue;
    try { const ghost = JSON.parse(localStorage.getItem(key)); if (validGhost(ghost, trackId)) found.push({ ...ghost, name: ghostName(ghost.name) }); } catch {}
  }
  return found;
}
function loadTrackGhosts(trackId) {
  const all = [loadPersonalGhost(trackId), ...loadSharedGhosts(trackId)].filter(Boolean), seen = new Set();
  return all.filter(ghost => {
    const id = ghost.name + "|" + ghost.time + "|" + ghost.data;
    if (seen.has(id)) return false;
    seen.add(id); return true;
  }).sort((a, b) => a.time - b.time);
}
const ghostSelectionId = (ghost) => ghost.name + "|" + ghost.time + "|" + ghost.data;
function loadChallengeGhost(trackId) {
  try {
    const selectedKey = localStorage.getItem(challengeGhostKey(trackId));
    if (selectedKey) {
      const selected = JSON.parse(localStorage.getItem(selectedKey) || "null");
      if (validGhost(selected, trackId)) return { ...selected, name: ghostName(selected.name) };
    }
  } catch {}
  return [loadPersonalGhost(trackId), ...loadSharedGhosts(trackId)].filter(Boolean).sort((a, b) => a.time - b.time)[0] || null;
}
function storeSharedGhost(ghost, sharedBy) {
  if (!validGhost(ghost, ghost && ghost.trackId)) return false;
  const copy = { ...ghost, name: ghostName(ghost.name), sharedBy: sharedBy || ghost.name };
  const key = sharedGhostPrefix(ghost.trackId) + encodeURIComponent(copy.sharedBy).slice(0, 96) + ":" + Math.round(ghost.time * 1000);
  try { localStorage.setItem(key, JSON.stringify(copy)); localStorage.setItem(challengeGhostKey(ghost.trackId), key); return true; } catch { return false; }
}
function refreshGhostShare() {
  const select = $("#ghostShareTrack"), saved = TRACKS.map(t => ({ track: t, ghost: loadChallengeGhost(t.id) })).filter(x => x.ghost);
  select.innerHTML = "";
  for (const { track, ghost } of saved) select.add(new Option(track.name + " · " + ghost.name + " · " + fmt(ghost.time), track.id));
  $("#shareGhost").disabled = !saved.length;
  $("#ghostShareStatus").textContent = saved.length ? saved.length + " saved ghost" + (saved.length === 1 ? "" : "s") + " ready to share in this LAN room." : "Finish a Time Trial or load a ghost file first.";
}
function openTracks() {
  show("#tracks"); G.state = "tracks";
  $("#ghostImport").classList.toggle("hidden", mode !== "timeTrial");
  $("#trackh").textContent = mode === "gp" ? "Choose a Cup" : mode === "timeTrial" ? "Choose a Time Trial Track" : "Choose a Track";
  const el = $("#cups"); el.innerHTML = "";
  CUPS.forEach((cup) => {
    const cupTracks = cup.tracks;
    const d = document.createElement("div"); d.className = "cup" + (mode === "gp" ? " gp" : "");
    d.innerHTML = "<h3>" + cup.icon + " " + esc(cup.name) + "</h3>";
    for (const tid of cupTracks) {
      const t = TRACK[tid];
      const tk = document.createElement("div"); tk.className = "trk"; tk.innerHTML = "<b>" + esc(t.name) + "</b><small>" + (t.laps ? t.laps + " laps · " : "") + (t.events || []).length + " Ereignisse</small>";
      if (mode === "timeTrial") {
        const ghosts = loadTrackGhosts(t.id), selected = trialGhostSelection.get(t.id) || new Set(ghosts.map(ghostSelectionId));
        const chooser = document.createElement("div"); chooser.className = "trial-ghost-list";
        const label = document.createElement("small"); label.className = "trial-ghost-heading";
        label.textContent = ghosts.length ? "Ghosts to race · " + ghosts.length : "No ghosts yet · set a record"; chooser.appendChild(label);
        ghosts.forEach(ghost => {
          const row = document.createElement("label"); row.className = "trial-ghost-option";
          const id = ghostSelectionId(ghost), check = document.createElement("input"); check.type = "checkbox"; check.checked = selected.has(id);
          check.addEventListener("click", e => e.stopPropagation());
          check.addEventListener("change", e => {
            e.stopPropagation();
            const next = new Set(trialGhostSelection.get(t.id) || new Set(ghosts.map(ghostSelectionId)));
            if (check.checked) next.add(id); else next.delete(id);
            trialGhostSelection.set(t.id, next);
          });
          const name = document.createElement("span"); name.textContent = ghost.name + " · " + fmt(ghost.time);
          row.append(check, name); chooser.appendChild(row);
        });
        tk.appendChild(chooser);
      }
      if (mode === "single" || mode === "timeTrial") tk.onclick = (e) => { if (e.target.closest(".trial-ghost-option")) return; e.stopPropagation(); gp = null; mode === "timeTrial" ? startTimeTrial(t) : startRace(t); };
      d.appendChild(tk);
    }
    if (mode === "gp") d.onclick = () => {
      const rivals = CHARACTERS.filter(c => c !== selChar).sort(() => Math.random() - 0.5).slice(0, NKARTS - 1);
      gp = { cup: { ...cup, tracks: cupTracks }, idx: 0, rivals, rv: rivals.map(() => pick(VEHICLES).id), pts: {} };
      for (const c of [selChar, ...rivals]) gp.pts[c.id] = 0;
      startRace(TRACK[cupTracks[0]]);
    };
    el.appendChild(d);
  });
}
const trialGhostSelection = new Map();
Promise.all([
  ["assets/ghosts/tenslant-ski-jump.json", "schanze"],
  ["assets/ghosts/tenslant-gold-mine.json", "zeche"],
  ["assets/ghosts/tenslant-mainhattan.json", "skyline"],
].map(async ([path, trackId]) => {
  try {
    const response = await fetch(path), ghost = response.ok ? await response.json() : null;
    return ghost && validGhost(ghost, trackId) && storeSharedGhost(ghost, "Tenslant") ? ghost : null;
  } catch { return null; }
})).then(ghosts => {
  const ready = ghosts.filter(Boolean);
  if (G.state === "tracks" && mode === "timeTrial") openTracks();
  if (ready.length) $("#ghostLoadStatus").textContent = ready.length + " Tenslant time" + (ready.length === 1 ? " is" : "s are") + " ready to race on Ski Jump, Gold Mine, and Mainhattan.";
}).catch(() => {});
$("#ghostFile").addEventListener("change", async (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 60000) throw new Error("Ghost file is too large.");
    const ghost = JSON.parse(await file.text());
    if (!validGhost(ghost, ghost.trackId)) throw new Error("That file is not a valid Wunderkart ghost.");
    if (!storeSharedGhost(ghost, "Downloaded")) throw new Error("Could not save the ghost on this device.");
    $("#ghostLoadStatus").textContent = ghostName(ghost.name) + " loaded for " + TRACK[ghost.trackId].name + ". Select that track to race it.";
    openTracks();
  } catch (error) { $("#ghostLoadStatus").textContent = error.message || "Could not load that ghost file."; }
  event.target.value = "";
});
$("#mute").onclick = () => { Audio.init(); $("#mute").textContent = Audio.toggleMute() ? "🔇" : "🔊"; };
const showInputsToggle = $("#showInputs"), wholeKeyboardToggle = $("#wholeKeyboard");
showInputsToggle.checked = localStorage.wkShowInputs === "1";
wholeKeyboardToggle.checked = localStorage.wkWholeKeyboard === "1";
showInputsToggle.addEventListener("change", () => { localStorage.wkShowInputs = showInputsToggle.checked ? "1" : "0"; });
wholeKeyboardToggle.addEventListener("change", () => { localStorage.wkWholeKeyboard = wholeKeyboardToggle.checked ? "1" : "0"; });
$("#controlSetup").onclick = () => { show("#controls"); G.state = "controls"; };

// ---------- peer-hosted multiplayer UI ----------
G.net = null;
let lobPhaseShown = "";
const playerNameInput = $("#playerName"), ghostOwnerInput = $("#ghostOwnerName");
function setPlayerName(name) {
  const value = String(name || "Player").slice(0, 24);
  localStorage.wkPlayerName = value; playerNameInput.value = value; ghostOwnerInput.value = value;
}
const savedPlayerName = localStorage.wkPlayerName || "";
playerNameInput.value = ghostOwnerInput.value = savedPlayerName || "Player";
for (const input of [playerNameInput, ghostOwnerInput]) input.addEventListener("input", () => {
  localStorage.wkPlayerName = input.value;
  (input === playerNameInput ? ghostOwnerInput : playerNameInput).value = input.value;
});
if (!savedPlayerName && window.websim?.getUser) window.websim.getUser().then(user => {
  if (!localStorage.wkPlayerName && user?.username && user.username !== "anonymous") setPlayerName(user.username);
}).catch(() => {});
function myProfile() { net.profile(CHARACTERS.indexOf(selChar), VEHICLES.indexOf(selVeh), playerNameInput.value); }
const roomMode = $("#roomMode"), roomTrack = $("#roomTrack"), roomCup = $("#roomCup"), cpuEnabled = $("#cpuEnabled"), cpuCount = $("#cpuCount");
net.setCups(CUPS.map(cup => cup.tracks.map(id => TRACKS.findIndex(t => t.id === id)).filter(i => i >= 0)));
TRACKS.forEach((track, i) => roomTrack.add(new Option(track.name, i)));
CUPS.forEach((cup, i) => roomCup.add(new Option(cup.name, i)));
for (let i = 1; i <= 12; i++) cpuCount.add(new Option(i + " CPUs", i));
function updateRoomFields() {
  const mode = roomMode.value;
  const showTrack = mode === "track", showCup = mode === "grandPrix";
  $("#roomTrackLabel").classList.toggle("hidden", !showTrack); roomTrack.classList.toggle("hidden", !showTrack);
  $("#roomCupLabel").classList.toggle("hidden", !showCup); roomCup.classList.toggle("hidden", !showCup);
  cpuCount.disabled = !cpuEnabled.checked;
}
function syncRoomSettings() {
  const s = net.lobby?.settings || { mode: "randomTrack", track: 0, cup: 0, cpuEnabled: true, cpuCount: 12 };
  roomMode.value = s.mode; roomTrack.value = s.track; roomCup.value = s.cup;
  cpuEnabled.checked = s.cpuEnabled; cpuCount.value = s.cpuCount;
  updateRoomFields();
}
function applyRoomSettings() {
  updateRoomFields();
  if (net.isHost) net.setSettings({ mode: roomMode.value, track: roomTrack.value, cup: roomCup.value, cpuEnabled: cpuEnabled.checked, cpuCount: cpuCount.value });
}
for (const el of [roomMode, roomTrack, roomCup, cpuEnabled, cpuCount]) el.addEventListener("change", applyRoomSettings);
function openOnline() {
  show("#online"); G.state = "online";
  $("#onstatus").textContent = net.lanServer
    ? "IP LAN server active. Share " + lanServerAddress + " with players, then host a room here."
    : net.shortCodes ? "Host a room and share its short code. Players connect without WebRTC or an answer code."
    : "For a direct LAN connection, the host shares an invite and each guest returns an answer so both devices can connect.";
}
function openWebsimSetup() {
  show("#websimSetup"); G.state = "websimSetup";
  $("#websimPlayerName").value = playerNameInput.value;
  refreshWebsimServers();
}
async function refreshWebsimServers() {
  const list = $("#websimServers"); list.innerHTML = "";
  $("#websimSetupMessage").textContent = "Finding public servers…";
  try {
    const matches = await net.listOnline();
    $("#websimSetupMessage").textContent = matches.length ? "Public servers" : "No public servers yet. Create one to get started.";
    for (const match of matches) {
      const row = document.createElement("div"); row.className = "server-option";
      const title = document.createElement("span");
      title.textContent = (match.name || "Public server") + " · " + match.players + "/8 racers · " + (match.cpuEnabled ? match.cpuCount + " bots" : "no bots") + (match.phase === "wait" ? " · waiting" : " · racing");
      const join = document.createElement("button"); join.textContent = match.phase === "wait" ? "Join" : "Spectate";
      join.disabled = match.phase === "wait" && match.players >= 8;
      join.onclick = async () => {
        myProfile(); $("#websimSetupMessage").textContent = "Joining server…";
        try { await net.joinOnline(match.id); } catch (error) { $("#websimSetupMessage").textContent = error.message || "Could not join that server."; }
      };
      row.append(title, join); list.appendChild(row);
    }
  } catch (error) { $("#websimSetupMessage").textContent = error.message || "Could not load public servers."; }
}
async function createWebsimServer(publicServer) {
  myProfile(); $("#websimSetupMessage").textContent = "Setting up your server…";
  try { await net.hostOnline(publicServer); }
  catch (error) { $("#websimSetupMessage").textContent = error.message || "Could not create a server."; }
}
$("#websimPlayerName").addEventListener("input", () => setPlayerName($("#websimPlayerName").value));
$("#quickPlay").onclick = async () => {
  SFX.box(); myProfile(); $("#websimSetupMessage").textContent = "Finding the busiest open server with bots…";
  try { if (!await net.quickPlay()) $("#websimSetupMessage").textContent = "No open public server with bots is available. Create one or try again."; }
  catch (error) { $("#websimSetupMessage").textContent = error.message || "Quick Play could not connect."; }
};
$("#createPublic").onclick = () => { SFX.box(); createWebsimServer(true); };
$("#createPrivate").onclick = () => { SFX.box(); createWebsimServer(false); };
$("#refreshServers").onclick = refreshWebsimServers;
$("#copyWebsimCode").onclick = async () => {
  if (!net.serverCode) return;
  try { await navigator.clipboard.writeText(net.serverCode); $("#copyWebsimCode").textContent = "Copied!"; }
  catch { $("#websimRoomCode").textContent = "Private server code: " + net.serverCode; }
  setTimeout(() => { $("#copyWebsimCode").textContent = "Copy Private Code"; }, 1000);
};
$("#changeWebsimCharacter").onclick = () => chooseOnlineCharacter();
$("#leaveWebsim").onclick = () => leaveOnline();
$("#joinPrivate").onclick = async () => {
  SFX.box(); myProfile(); $("#websimSetupMessage").textContent = "Joining private server…";
  try { await net.joinOnline($("#websimCode").value, true); }
  catch (error) { $("#websimSetupMessage").textContent = error.message || "Could not join that private server."; }
};
function openLobby() {
  show("#lobby"); G.state = "lobby"; $("#chat").classList.remove("hidden");
  $("#lobnetwork").classList.toggle("hidden", !net.isHost || net.lan || net.online);
  $("#websimRoom").classList.toggle("hidden", !net.online);
  $("#websimRoomCode").textContent = net.serverCode ? "Private server code: " + net.serverCode : net.online ? "Public server · bots enabled for normal matches" : "";
  $("#copyWebsimCode").disabled = !net.serverCode;
  $("#roomSettings").classList.toggle("hidden", !net.isHost);
  $("#manualAnswer").classList.toggle("hidden", net.lan || net.shortCodes);
  $("#shortCodeNote").classList.toggle("hidden", net.lan || !net.shortCodes);
  $("#lobanswer").classList.toggle("hidden", net.lan || net.isHost || !$("#lobAnswer").value);
  if (net.isHost) syncRoomSettings();
  refreshGhostShare();
  renderLobby();
}
function renderLobby() {
  const L = net.lobby; if (!L || G.state !== "lobby") return;
  $("#lobh").textContent = L.name || "LAN Room";
  const s = L.settings || { mode: "randomTrack", track: 0, cup: 0, cpuEnabled: true, cpuCount: 12 };
  const format = s.mode === "track" ? TRACKS[s.track]?.name || "Selected track" : s.mode === "grandPrix" ? CUPS[s.cup]?.name || "Grand Prix" : s.mode === "randomPrix" ? "Random Prix" : "Random track";
  const ncpu = s.cpuEnabled ? s.cpuCount : 0, spectators = L.players.filter(p => p.spec).length;
  const round = L.series ? " · Race " + (L.series.index + 1) + "/" + L.series.tracks.length : "";
  $("#roomSummary").textContent = format + " · " + ncpu + " CPUs" + (spectators ? " · " + spectators + " spectating" : "") + round;
  const pl = $("#lobplayers"); pl.innerHTML = "";
  for (const p of L.players) {
    const c = CHARACTERS[p.char] || CHARACTERS[0], v = VEHICLES[p.veh] || VEHICLES[0];
    const d = document.createElement("div"); d.className = "pl" + (p.id === net.id ? " me" : "");
    d.innerHTML = '<img class="pimg" src="' + portraits[c.id] + '">' + esc(p.name) + (p.id === L.host ? " 👑" : "") + "<small>" + (p.spec ? "Spectating · " : "") + esc(c.short) + " · " + esc(v.name) + "</small>";
    pl.appendChild(d);
  }
  $("#startRoom").classList.toggle("hidden", !net.isHost || L.phase !== "wait");
}
function lobbyPhaseText() {
  const L = net.lobby; if (!L) return "";
  return L.phase === "wait" ? "Waiting for the host to start the race" : L.phase === "results" ? "Returning to the lobby…" : "Race starting…";
}
async function copyCode(field) {
  field.focus(); field.select();
  try { await navigator.clipboard.writeText(field.value); } catch { document.execCommand("copy"); }
  const button = field.nextElementSibling, label = button.textContent;
  button.textContent = "Copied!";
  setTimeout(() => button.textContent = label, 1000);
}
$("#hostGame").onclick = async () => {
  SFX.box(); myProfile(); await lanServerCheck;
  $("#onstatus").textContent = net.lanServer ? "Connecting to the IP LAN server…" : net.shortCodes ? "Creating a room relay code…" : "Creating a direct WebRTC invite…";
  if (!await net.host()) $("#onstatus").textContent = "Could not start a room. Check the LAN server or browser support.";
};
$("#joinGame").onclick = async () => {
  SFX.box(); myProfile(); await lanServerCheck;
  if (net.lanServer) {
    $("#onstatus").textContent = "Joining the room on " + location.host + "…";
    try { await net.joinLan(); $("#onstatus").textContent = "Waiting for the room host…"; }
    catch (error) { $("#onstatus").textContent = error.message || "Could not join this room."; }
    return;
  }
  const invite = $("#joinInvite").value;
  const isRoomCode = /^[A-HJ-NP-Z2-9]{8}$/i.test(invite.replace(/\s/g, ""));
  $("#onstatus").textContent = isRoomCode ? "Joining through the Websim room relay…" : "Creating your answer code…";
  try {
    const answerCode = await net.joinWithOffer(invite);
    $("#onstatus").textContent = answerCode === null ? "Room code accepted. Connecting to the host…" : net.lastIceComplete
      ? "Send your answer code to the host. Waiting for them to connect you…"
      : "Answer ready with available candidates. Send it; if it will not connect, use the 8-character relay or IP LAN server.";
  } catch (error) { $("#onstatus").textContent = error.message || "Could not join this room."; }
};
$("#copyInvite").onclick = () => copyCode($("#lobInvite"));
$("#copyAnswer").onclick = () => copyCode($("#joinAnswer"));
$("#copyLobbyAnswer").onclick = () => copyCode($("#lobAnswer"));
$("#newInvite").onclick = async () => { try { await net.createInvite(); } catch (error) { $("#lobphase").textContent = error.message; } };
$("#acceptAnswer").onclick = async () => {
  try { await net.acceptAnswer($("#hostAnswer").value); $("#hostAnswer").value = ""; $("#lobphase").textContent = "Connecting player…"; }
  catch (error) { $("#lobphase").textContent = error.message; }
};
$("#shareGhost").onclick = () => {
  const ghost = loadChallengeGhost($("#ghostShareTrack").value);
  if (!ghost) { $("#ghostShareStatus").textContent = "No saved ghost for that track."; refreshGhostShare(); return; }
  net.shareGhost(ghost);
  $("#ghostShareStatus").textContent = net.isHost ? "Ghost shared with LAN room." : "Sending ghost to the room host…";
};
$("#startRoom").onclick = () => { SFX.box(); net.startNow(); };
$("#onback").onclick = () => { SFX.tick(); if (net.role) net.leave(); show("#title"); G.state = "title"; };
$("#lobback").onclick = () => { SFX.tick(); leaveOnline(); };
function leaveOnline() {
  net.leave(); if (G.state === "race" || G.state === "results") exitRace(); online = null; G.net = null;
  onlineSelectionReturn = null; $("#chat").classList.add("hidden"); $("#lobInvite").value = ""; $("#hostAnswer").value = "";
  if (mode === "websimOnline") openWebsimSetup(); else openOnline();
}
net.on("error", (m) => { $("#onstatus").textContent = m.text; if (G.state === "lobby") $("#lobphase").textContent = m.text; if (G.state === "websimSetup") $("#websimSetupMessage").textContent = m.text; });
net.on("full", () => { $("#onstatus").textContent = "This room is full or a race is already underway."; });
net.on("invite", (m) => {
  $("#lobInvite").value = m.code;
  $("#manualAnswer").classList.toggle("hidden", net.lan || m.short);
  $("#shortCodeNote").classList.toggle("hidden", net.lan || !m.short);
  if (!m.short) $("#lobphase").textContent = m.iceComplete
    ? "Invite ready. Share it with a guest; they return an answer code for you to paste here."
    : "Invite ready with available network candidates. Share it; if it will not connect, use the 8-character relay or IP LAN server.";
});
net.on("ghost", (m) => {
  const track = TRACK[m.ghost.trackId], saved = m.from === net.id || storeSharedGhost(m.ghost, m.name);
  const message = saved ? m.name + " shared a ghost for " + (track ? track.name : m.ghost.trackId) + ". Start Time Trial to challenge it." : "Could not save the shared ghost.";
  if (G.state === "lobby") $("#ghostShareStatus").textContent = message;
  else addChat(m.name, "shared a ghost for " + (track ? track.name : m.ghost.trackId));
});
net.on("ghostSent", (m) => { $("#ghostShareStatus").textContent = "Ghost sent to the LAN room for " + (TRACK[m.trackId]?.name || "this track") + "."; });
net.on("ghostError", (m) => { $("#ghostShareStatus").textContent = m.text; });
net.on("answer", (m) => {
  $("#joinAnswer").value = m.code; $("#lobAnswer").value = m.code; $("#answerPanel").classList.remove("hidden");
  if (!m.iceComplete) $("#onstatus").textContent = "Answer ready with available network candidates. If it will not connect, use the 8-character relay or IP LAN server.";
});
net.on("peeropen", () => { if (G.state === "lobby") $("#lobphase").textContent = "Player connected."; });
net.on("joined", (m) => {
  G.net = net;
  if (m.lobby.phase === "race" || m.lobby.phase === "count") {
    if (m.lobby.grid && m.lobby.grid.length && m.lobby.track >= 0) startOnlineRace({ track: m.lobby.track, grid: m.lobby.grid, host: m.lobby.host, spectate: true, raceT: m.lobby.raceT });
    else openLobby();
  } else openLobby();
});
$("#spectatePick").onclick = () => chooseOnlineCharacter();
$("#ghostSpectate").onclick = () => {
  if (!timeTrial?.ghostModels?.length) return;
  if (!timeTrial.spectatingGhost) { timeTrial.spectatingGhost = true; timeTrial.ghostIndex = 0; }
  else if (timeTrial.ghostIndex + 1 < timeTrial.ghostModels.length) timeTrial.ghostIndex++;
  else timeTrial.spectatingGhost = false;
  const selected = timeTrial.ghostModels[timeTrial.ghostIndex];
  $("#ghostSpectate").textContent = timeTrial.spectatingGhost ? "Following · " + selected.ghost.name : "Spectate Ghost";
};
for (const ev of ["pjoin", "pupd", "settings"]) net.on(ev, renderLobby);
net.on("left", () => { renderLobby(); });
net.on("lobby", () => { if (G.state === "race" || G.state === "results") { exitRace(); online = null; } openLobby(); });
net.on("race", (m) => startOnlineRace({ track: m.track, grid: m.grid, host: m.host, countT: m.t }));
net.on("go", () => { if (online) online.go = true; });
net.on("snap", (m) => { if (!online) return; const now = performance.now(); for (const a of m.k) { const k = online.byNid.get(a[0]); if (k && k.remote) k.netPush(a, now); } });
net.on("fin", (m) => { if (!online) return; const k = online.byNid.get(m.nid); if (k && k.remote && !k.finished) { k.finished = true; k.finishTime = m.time; } });
net.on("ev", (m) => {
  if (!online) return; const e = m.e, k = online.byNid.get(e.nid); if (!k || !k.remote) return;
  if (e.k === "item" && ITEMS[e.it]) items.use(k, e.back, e.it);
  else if (e.k === "abil") items.ability(k);
});
net.on("results", (m) => { if (online) showOnlineResults(m.list, m.series); });
net.on("chat", (m) => addChat(m.name, m.text));
net.on("emote", (m) => { if (!online) { const p = net.lobby && net.lobby.players.find(x => x.id === m.from); addChat(p ? p.name : "?", EMOTES[m.e]); return; } for (const k of G.karts) if (k.owner === m.from) showEmote(k, EMOTES[m.e]); });
function addChat(name, text) {
  const d = document.createElement("div"); d.innerHTML = "<b>" + esc(name) + ":</b> " + esc(text);
  const log = $("#chatlog"); log.appendChild(d); while (log.children.length > 6) log.firstChild.remove();
  setTimeout(() => d.remove(), 12000);
}
$("#chatin").addEventListener("keydown", (e) => {
  e.stopPropagation();
  if (e.key === "Enter") { const t = e.target.value.trim(); if (t) net.chat(t); e.target.value = ""; e.target.blur(); }
  if (e.key === "Escape") e.target.blur();
});

// LAN voice uses the existing peer-to-peer WebRTC connection; the mic is opt-in.
let voiceStream = null, voiceEnabled = false;
const voiceAudio = new Map();
async function waitVoiceIce(pc) {
  if (pc.iceGatheringState === "complete") return;
  await new Promise(resolve => {
    const done = () => { if (pc.iceGatheringState === "complete") { pc.removeEventListener("icegatheringstatechange", done); resolve(); } };
    pc.addEventListener("icegatheringstatechange", done);
    setTimeout(() => { pc.removeEventListener("icegatheringstatechange", done); resolve(); }, 7000);
  });
}
async function voiceOffer(peer) {
  if ((!voiceEnabled && !peer?.voiceForwarded?.size) || !peer?.pc || peer.pc.signalingState !== "stable") return;
  try {
    const offer = await peer.pc.createOffer();
    await peer.pc.setLocalDescription(offer); await waitVoiceIce(peer.pc);
    net.voiceSignal(peer.id, { description: peer.pc.localDescription });
  } catch (error) { $("#voiceStatus").textContent = "Voice connection failed: " + (error.message || "try again"); }
}
function addVoiceTracks(peer) {
  if (!peer?.pc) return;
  if (!peer.voiceHandlersReady) {
    peer.voiceHandlersReady = true;
    peer.pc.onnegotiationneeded = () => { if (net.isHost) voiceOffer(peer); };
  peer.pc.ontrack = event => {
    let audio = voiceAudio.get(peer.id);
    if (!audio) { audio = document.createElement("audio"); audio.autoplay = true; audio.playsInline = true; document.body.appendChild(audio); voiceAudio.set(peer.id, audio); }
    audio.srcObject = event.streams[0] || new MediaStream([event.track]);
    audio.play().catch(() => {});
    if (net.isHost) for (const other of net.peers.values()) {
      if (other === peer || !other.pc) continue;
      other.voiceForwarded ||= new Set();
      const trackKey = peer.id + ":" + event.track.id;
      if (other.voiceForwarded.has(trackKey)) continue;
      other.voiceForwarded.add(trackKey);
      other.pc.addTrack(event.track, event.streams[0] || new MediaStream([event.track]));
    }
  };
  }
  if (!voiceStream || peer.voiceTracksAdded) return;
  peer.voiceTracksAdded = true;
  for (const track of voiceStream.getTracks()) peer.pc.addTrack(track, voiceStream);
}
async function handleVoiceSignal({ from, signal }) {
  const peer = net.isHost ? net.peers.get(from) : net.peers.get("host");
  if (!peer?.pc || !signal) return;
  addVoiceTracks(peer);
  if (signal.ready && net.isHost) { await voiceOffer(peer); return; }
  try {
    if (signal.description?.type === "offer") {
      await peer.pc.setRemoteDescription(signal.description);
      const answer = await peer.pc.createAnswer(); await peer.pc.setLocalDescription(answer);
      await waitVoiceIce(peer.pc); net.voiceSignal(peer.id, { description: peer.pc.localDescription });
    } else if (signal.description?.type === "answer") await peer.pc.setRemoteDescription(signal.description);
  } catch (error) { $("#voiceStatus").textContent = "Voice connection failed: " + (error.message || "try again"); }
}
net.on("voiceSignal", handleVoiceSignal);
net.on("peeropen", ({ id }) => addVoiceTracks(net.peers.get(id)));
$("#voiceToggle").onclick = async () => {
  if (voiceEnabled) {
    voiceEnabled = false; voiceStream?.getTracks().forEach(track => track.stop()); voiceStream = null;
    for (const audio of voiceAudio.values()) audio.remove(); voiceAudio.clear();
    $("#voiceToggle").textContent = "Join Voice Chat"; $("#voiceStatus").textContent = "Voice chat is off."; return;
  }
  if (net.online || net.lan || net.roomRelay) { $("#voiceStatus").textContent = "Voice chat is available in direct WebRTC LAN rooms (compressed or full SDP codes)."; return; }
  if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) { $("#voiceStatus").textContent = "Voice chat needs microphone access and WebRTC."; return; }
  try {
    voiceStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false }); voiceEnabled = true;
    for (const peer of net.peers.values()) addVoiceTracks(peer);
    $("#voiceToggle").textContent = "Leave Voice Chat"; $("#voiceStatus").textContent = "Microphone on · connected room members can hear you.";
    if (!net.isHost) await voiceOffer(net.peers.get("host"));
  } catch (error) { $("#voiceStatus").textContent = error.message || "Microphone permission was not granted."; }
};

// ---------- input ----------
const keys = {}, pressed = {};
addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea, select") || e.target.isContentEditable) return;
  if (e.repeat) { if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault(); return; }
  keys[e.code] = true; pressed[e.code] = true;
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  if (e.code === "Escape" && G.state === "race") togglePause();
  if (e.code === "KeyM") $("#mute").onclick();
  if (G.net && net.lobby) {
    if (e.code === "KeyT") { e.preventDefault(); $("#chat").classList.remove("hidden"); $("#chatin").focus(); }
    const n = +e.key; if (n >= 1 && n <= 8 && !e.ctrlKey) { net.emote(n - 1); if (G.player && online) showEmote(G.player, EMOTES[n - 1]); }
  }
});
addEventListener("keyup", (e) => { keys[e.code] = false; });
addEventListener("blur", () => { for (const k in keys) keys[k] = false; });
const tiltToggle = $("#tiltEnabled"), tiltStatus = $("#tiltStatus"), controllerStatus = $("#controllerStatus");
let tiltActive = false, tiltSteer = 0, tiltCenter = null;
function deviceRoll(e) {
  const angle = Number(screen.orientation?.angle ?? window.orientation ?? 0);
  if (angle === 90) return e.beta;
  if (angle === 270 || angle === -90) return -e.beta;
  if (angle === 180) return -e.gamma;
  return e.gamma;
}
function onDeviceTilt(e) {
  if (!tiltActive) return;
  const roll = deviceRoll(e);
  if (!Number.isFinite(roll)) return;
  if (tiltCenter === null) { tiltCenter = roll; tiltStatus.textContent = "Tilt ready · lean left or right to steer."; return; }
  const delta = roll - tiltCenter, magnitude = Math.max(0, Math.abs(delta) - 2.5);
  tiltSteer = Math.max(-1, Math.min(1, -Math.sign(delta) * magnitude / 22));
}
async function setTiltEnabled(enabled) {
  if (!enabled) {
    tiltActive = false; tiltSteer = 0; tiltCenter = null;
    removeEventListener("deviceorientation", onDeviceTilt);
    localStorage.wkTilt = "0"; tiltStatus.textContent = "Tilt steering is off.";
    return;
  }
  if (!window.DeviceOrientationEvent) {
    tiltToggle.checked = false; localStorage.wkTilt = "0"; tiltStatus.textContent = "Motion sensors are unavailable in this browser.";
    return;
  }
  try {
    if (typeof window.DeviceOrientationEvent.requestPermission === "function" && await window.DeviceOrientationEvent.requestPermission() !== "granted") throw new Error("Motion permission was not granted.");
    tiltActive = true; tiltCenter = null; tiltSteer = 0;
    addEventListener("deviceorientation", onDeviceTilt, { passive: true });
    localStorage.wkTilt = "1"; tiltStatus.textContent = "Tilt enabled · hold your phone comfortably to calibrate.";
  } catch (error) {
    tiltToggle.checked = false; localStorage.wkTilt = "0";
    tiltStatus.textContent = error.message || "Could not enable motion controls.";
  }
}
tiltToggle.addEventListener("change", () => setTiltEnabled(tiltToggle.checked));
if (localStorage.wkTilt === "1") {
  if (typeof window.DeviceOrientationEvent?.requestPermission === "function") tiltStatus.textContent = "Tap Tilt steering to grant motion access.";
  else { tiltToggle.checked = true; setTiltEnabled(true); }
}
addEventListener("orientationchange", () => { tiltCenter = null; tiltSteer = 0; });
const gamepadInput = { connected: false, steer: 0, throttle: 0, brake: false, drift: false, driftPressed: false, item: false, ability: false, pause: false };
let gamepadId = null, previousPadButtons = [];
function updateControllerStatus(pad) {
  const id = pad ? pad.index + ":" + pad.id : "";
  if (id === gamepadId) return;
  gamepadId = id;
  controllerStatus.textContent = pad ? "Controller connected: " + (pad.id || "Gamepad") : navigator.getGamepads ? "No controller detected · connect a Bluetooth or USB gamepad." : "This browser does not expose gamepad controls.";
}
function updateGamepadInput() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const pad = Array.from(pads || []).find(p => p && p.connected) || null;
  updateControllerStatus(pad);
  if (!pad) {
    previousPadButtons = [];
    Object.assign(gamepadInput, { connected: false, steer: 0, throttle: 0, brake: false, drift: false, driftPressed: false, item: false, ability: false, pause: false });
    return;
  }
  if (gamepadInput.index !== pad.index) previousPadButtons = [];
  const buttons = Array.from(pad.buttons || []);
  const downs = buttons.map(b => !!(b && (b.pressed || b.value > 0.5)));
  const edge = (i) => !!downs[i] && !previousPadButtons[i];
  const down = (i) => !!downs[i];
  let steer = Number(pad.axes?.[0]) || 0;
  const dead = 0.16;
  steer = Math.abs(steer) <= dead ? 0 : Math.sign(steer) * (Math.abs(steer) - dead) / (1 - dead);
  steer = -steer + (down(14) ? 1 : 0) - (down(15) ? 1 : 0);
  const trigger = buttons[7];
  Object.assign(gamepadInput, {
    connected: true, index: pad.index, steer: Math.max(-1, Math.min(1, steer)),
    throttle: Math.max(down(0) ? 1 : 0, trigger ? Math.max(trigger.value || 0, trigger.pressed ? 1 : 0) : 0),
    brake: down(1) || down(6), drift: down(4), driftPressed: edge(4), item: edge(2), ability: edge(3), pause: edge(9),
  });
  previousPadButtons = downs;
  if (gamepadInput.pause && G.state === "race") togglePause();
}
addEventListener("gamepadconnected", (e) => updateControllerStatus(e.gamepad));
addEventListener("gamepaddisconnected", () => { gamepadId = null; previousPadButtons = []; });
const touch = { steer: 0, D: false, I: false, A: false };
const steerPad = $("#steerPad"), steerKnob = $("#steerKnob");
let steerPointer = null;
function moveSteer(e) {
  const r = steerPad.getBoundingClientRect(), max = r.width * 0.29;
  let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  const dist = Math.hypot(dx, dy);
  if (dist > max) { dx *= max / dist; dy *= max / dist; }
  const raw = Math.max(-1, Math.min(1, -dx / max));
  touch.steer = Math.abs(raw) < 0.07 ? 0 : (raw - Math.sign(raw) * 0.07) / 0.93;
  steerKnob.style.transform = "translate(calc(-50% + " + dx + "px), calc(-50% + " + dy + "px))";
}
function resetSteer() {
  touch.steer = 0; steerPointer = null;
  steerPad.classList.remove("active");
  steerKnob.style.transform = "translate(-50%, -50%)";
}
steerPad.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (steerPointer !== null) return;
  steerPointer = e.pointerId; steerPad.setPointerCapture(e.pointerId); steerPad.classList.add("active"); moveSteer(e); Audio.init();
});
steerPad.addEventListener("pointermove", (e) => { if (e.pointerId === steerPointer) moveSteer(e); });
for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) steerPad.addEventListener(ev, (e) => { if (e.pointerId === steerPointer) resetSteer(); });
function bindTouch(id, k) {
  const el = $(id), active = new Set();
  el.addEventListener("pointerdown", (e) => {
    e.preventDefault(); el.setPointerCapture(e.pointerId); active.add(e.pointerId);
    touch[k] = true; pressed["T" + k] = true; Audio.init();
  });
  const release = (e) => { active.delete(e.pointerId); touch[k] = active.size > 0; };
  for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) el.addEventListener(ev, release);
}
bindTouch("#tDr", "D"); bindTouch("#tIt", "I"); bindTouch("#tAb", "A");
let steerSm = 0;
function playerInput(dt) {
  const isT = document.body.classList.contains("touch");
  let st = touch.steer + tiltSteer + gamepadInput.steer;
  if (keys.KeyA || keys.ArrowLeft) st += 1;
  if (keys.KeyD || keys.ArrowRight) st -= 1;
  st = Math.max(-1, Math.min(1, st));
  steerSm += (st - steerSm) * Math.min(1, dt * 14);
  const inp = {
    steer: steerSm,
    throttle: Math.max(keys.KeyW || keys.ArrowUp ? 1 : 0, gamepadInput.throttle, isT && !gamepadInput.connected ? 1 : 0),
    brake: !!(keys.KeyO || keys.KeyS || keys.ArrowDown || gamepadInput.brake),
    drift: !!(keys.Space || keys.ShiftLeft || keys.ShiftRight || touch.D || gamepadInput.drift),
    driftPressed: !!(pressed.Space || pressed.ShiftLeft || pressed.ShiftRight || pressed.TD || gamepadInput.driftPressed),
    item: !!(pressed.KeyE || pressed.KeyQ || pressed.Enter || pressed.KeyX || pressed.TI || gamepadInput.item),
    ability: !!(pressed.KeyC || pressed.TA || gamepadInput.ability),
    back: !!(keys.KeyQ || keys.KeyS || keys.ArrowDown || gamepadInput.brake),
  };
  if (gamepadInput.connected && inp.brake) inp.throttle = 0;
  else if (inp.brake && inp.throttle && !isT) inp.brake = false;
  return inp;
}

// ---------- HUD ----------
const hud = {
  setItem(it, spinning) {
    $("#itemicon").textContent = it && ITEMS[it] ? ITEMS[it].icon : "";
    $("#itembox").classList.toggle("spin", !!spinning);
    $("#itembox").classList.remove("trial-boost", "empty-boost");
    $("#boostCount").classList.add("hidden");
    const button = $("#tIt");
    button.setAttribute("aria-label", "Use item");
    button.querySelector("span").textContent = "🎁";
    button.querySelector("small").textContent = "ITEM";
  },
  setTrialBoosts(count) {
    $("#itemicon").textContent = "⚡";
    $("#boostCount").textContent = count;
    $("#boostCount").classList.remove("hidden");
    $("#itembox").classList.add("trial-boost");
    $("#itembox").classList.toggle("empty-boost", count === 0);
    $("#itembox").classList.remove("spin");
    const button = $("#tIt");
    button.setAttribute("aria-label", "Use boost · " + count + " remaining");
    button.querySelector("span").textContent = "⚡";
    button.querySelector("small").textContent = "BOOST " + count;
  },
};
G.hud = hud;
const mm = $("#minimap"), mctx = mm.getContext("2d");
let mmBase = null, mmT = null;
function buildMinimap() {
  const T = G.track;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of T.paths) for (const s of p.S) { x0 = Math.min(x0, s.x); x1 = Math.max(x1, s.x); z0 = Math.min(z0, s.z); z1 = Math.max(z1, s.z); }
  const sc = 180 / Math.max(x1 - x0, z1 - z0);
  // world x grows to the right when looking along +z from above with x mirrored
  mmT = (x, z) => [10 + (x1 - x) * sc + (180 - (x1 - x0) * sc) / 2, 10 + (z1 - z) * sc + (180 - (z1 - z0) * sc) / 2];
  mmBase = document.createElement("canvas"); mmBase.width = mmBase.height = 200;
  const c = mmBase.getContext("2d");
  c.lineJoin = "round"; c.lineCap = "round";
  const line = (S, closed) => { c.beginPath(); S.forEach((s, i) => { const [x, y] = mmT(s.x, s.z); i ? c.lineTo(x, y) : c.moveTo(x, y); }); if (closed) c.closePath(); };
  for (const b of T.branches) { c.strokeStyle = "#111"; c.lineWidth = 7; line(b.S); c.stroke(); c.strokeStyle = "#9ad"; c.lineWidth = 3; line(b.S); c.stroke(); }
  c.strokeStyle = "#111"; c.lineWidth = 11; line(T.S, true); c.stroke();
  c.strokeStyle = "#fff"; c.lineWidth = 6; line(T.S, true); c.stroke();
  const [sx, sy] = mmT(T.S[0].x, T.S[0].z); c.fillStyle = "#111"; c.fillRect(sx - 5, sy - 5, 10, 10); c.fillStyle = "#fff"; c.fillRect(sx - 5, sy - 5, 5, 5); c.fillRect(sx, sy, 5, 5);
}
function drawMinimap() {
  mctx.clearRect(0, 0, 200, 200); mctx.drawImage(mmBase, 0, 0);
  for (const k of [...G.karts].reverse()) {
    const [x, y] = mmT(k.pos.x, k.pos.z);
    mctx.fillStyle = "#" + new THREE.Color(k.char.look.kart).getHexString();
    mctx.strokeStyle = k === G.player ? "#ffce00" : k.remote && !k.bot ? "#fff" : "#111"; mctx.lineWidth = k === G.player ? 4 : 2;
    mctx.beginPath(); mctx.arc(x, y, k === G.player ? 7 : 5, 0, 7); mctx.fill(); mctx.stroke();
  }
}
G.banner = (text, dur = 1.6, showIt = true) => {
  if (!showIt) return;
  const b = $("#banner"); b.textContent = text; b.classList.remove("show"); void b.offsetWidth; b.style.setProperty("--d", dur + "s"); b.classList.add("show");
};
let styleT = 0, styleScore = 0;
function styleMsg(text, pts) { styleScore += pts || 0; const el = $("#style"); el.textContent = text + (styleScore ? "  +" + styleScore : ""); el.classList.add("on"); styleT = 1.4; }
const bubbles = [];
const v3 = new THREE.Vector3();
G.say = (kart, text) => {
  const camD = kart.pos.distanceTo(camera.position);
  if (camD > 140 && kart !== G.player) return;
  const el = document.createElement("div"); el.className = "bub" + (kart === G.player ? " me" : "");
  el.innerHTML = "<b>" + esc(kart.name || kart.char.short) + "</b>" + esc(text);
  $("#bubbles").appendChild(el);
  for (const b of bubbles) if (b.kart === kart) b.t = Math.min(b.t, 0.05);
  bubbles.push({ el, kart, t: 1.7 });
};
function showEmote(kart, e) {
  const el = document.createElement("div"); el.className = "emote"; el.textContent = e;
  $("#bubbles").appendChild(el); bubbles.push({ el, kart, t: 2.2, h: 9 });
}
function updateBubbles(dt) {
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i]; b.t -= dt;
    if (b.t <= 0) { b.el.remove(); bubbles.splice(i, 1); continue; }
    v3.copy(b.kart.pos); v3.y += b.h || 6.5; v3.project(camera);
    const vis = v3.z < 1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1;
    b.el.style.display = vis ? "block" : "none";
    b.el.style.left = ((v3.x + 1) / 2 * innerWidth) + "px"; b.el.style.top = ((1 - v3.y) / 2 * innerHeight) + "px";
    b.el.style.opacity = Math.min(1, b.t * 4);
  }
}

// ---------- event hooks ----------
const isP = (k) => k === G.player;
const near = (k, d = 60) => k.pos.distanceTo(camera.position) < d;
G.onBoost = (k) => { if (isP(k)) { SFX.boost(); G.fovKick = Math.max(G.fovKick, 12); } };
G.onHit = (k, type) => {
  if (isP(k)) { SFX.hit(); G.shake = 1.15; G.fovKick = Math.max(G.fovKick, 10); } else if (near(k)) SFX.hit();
  fx.burst(k.pos, 0xffee88, 25, 14); if (type === "launch") fx.burst(k.pos, 0xff5500, 30, 18);
};
G.onItemHit = (k, item) => {
  if (online) return;
  const owner = item.owner;
  item._noticeKarts ||= new Set();
  const firstHit = !item._noticeKarts.has(k);
  item._noticeKarts.add(k);
  const victimName = k.char?.short || "Racer", ownerName = owner?.char?.short || "Racer";
  let message = "ITEM HIT";
  if (owner === G.player && k !== G.player) { message = "You hit " + victimName + "!"; if (firstHit) showHitNotice("YOU HIT", victimName); }
  else if (k === G.player && owner && owner !== G.player) { message = ownerName + " hit you!"; if (firstHit) showHitNotice("HIT BY", ownerName); }
  if (firstHit && (isP(k) || owner === G.player)) {
    // Follow the person who was hit; keep the other participant in frame.
    queueItemKillcam(message, k, owner);
  }
};
G.onDriftLevel = (k, l) => { if (isP(k)) SFX.drift(l); };
G.onDriftBoost = (k, l) => { if (l >= 2) k.shout("boost"); if (l >= 3) k.setMood("happy", 1); if (isP(k) && l >= 3) styleMsg("TURBO-DRIFT", 30); };
G.onTrick = (k) => { if (isP(k)) SFX.trick(); fx.burst(k.pos, 0xffffff, 12, 8, 0.8, 0); };
G.onTrickLand = (k, n, perfect) => { fx.burst(k.pos, 0xffce00, 25, 12); if (isP(k)) styleMsg((n >= 3 ? "TRIPLE TRICK" : n === 2 ? "DOUBLE TRICK" : "TRICK") + (perfect ? " · PERFECT!" : ""), n * 40 + (perfect ? 50 : 0)); };
G.onBigLand = (k, imp) => { if (isP(k)) { SFX.bigland(); G.shake = Math.min(1.2, imp / 50); } fx.burst(k.pos, 0xcccccc, 30, 14, 1.6, 10); k.landT = 0.45; };
G.onRamp = (k) => { if (isP(k)) SFX.jump(); if (Math.random() < 0.4) k.shout(["Whee!", "Woohoo!", "Let's go!", "Takeoff!"]); };
G.onPad = (k) => { fx.burst(k.pos, 0xffaa00, 10, 6); };
G.onBounce = (k) => { if (isP(k)) SFX.jump(); k.shout(["Boing!", "Wheee!", "Way up high!"]); };
G.onItemBox = (k) => { if (isP(k)) { SFX.box(); hud.setItem(null, true); } };
G.finishRoulette = (k) => { k.item = items.roll(k); if (isP(k)) { SFX.got(); hud.setItem(k.item); } if (Math.random() < 0.3) k.shout("item"); };
G.useItem = (k, back) => items.use(k, back);
G.useAbility = (k) => items.ability(k);
function useTrialBoostEffect(kart) {
  kart.addBoost(1.8, 1.7);
  SFX.boost(); G.fovKick = Math.max(G.fovKick, 8);
  fx.burst(kart.pos, 0xffce00, 20, 10);
}
function useTrialBoost(kart) {
  if (!timeTrial || timeTrial.boosts <= 0) return;
  timeTrial.boosts--;
  hud.setTrialBoosts(timeTrial.boosts);
  if (!G.racing) { timeTrial.pendingBoost = true; return; }
  useTrialBoostEffect(kart);
}
G.onAbility = (k) => { G.banner("★ " + k.char.ability.name.toUpperCase() + "!", 1.3, isP(k)); if (isP(k)) SFX.sting(k.char.id); fx.burst(k.pos, 0x7ad0ff, 40, 16); k.setMood && k.setMood("happy", 2); };
G.onEnvHit = (pos, kind) => { if (pos.distanceTo(camera.position) < 80) { (kind === "bomb" ? SFX.boom : SFX.smash)(); G.shake = Math.max(G.shake, 0.4); } fx.burst(pos, 0xff8800, 30, 16); };
G.onWall = (k, hard) => {
  if (hard) { if (isP(k)) { SFX.wall(); G.shake = 0.4; } fx.burst(k.pos, 0xffcc66, 12, 10, 0.8); }
  else if (Math.random() < 0.5) { fx.spawn(k.pos.x, k.pos.y + 0.6, k.pos.z, (Math.random() - 0.5) * 6, 4 + Math.random() * 4, (Math.random() - 0.5) * 6, 0xffcc33, 0.6, 0.4, 25); if (isP(k) && Math.random() < 0.2) SFX.scrape(); }
};
G.onSmash = (k, p, gate) => { if (isP(k)) { SFX.smash(); G.shake = 0.35; } fx.burst(p, 0xff6600, 20, 14); if (Math.random() < 0.5) k.shout(["Construction zone? No problem!", "Right through!", "Detour? No thanks!", "Smashed!"]); if (gate && isP(k)) styleMsg("BREAKTHROUGH", 0); };
G.onFall = (k) => { if (isP(k)) { SFX.fall(); styleScore = 0; } };
G.onEdge = (k) => { if (isP(k) && Math.random() < 0.5) k.shout(["Whoa!", "Where did the road go?!", "Don't look down!"], true); };
G.onDetach = () => {};
G.onBush = (k) => { if (isP(k) && Math.random() < 0.02) SFX.scrape(); };
G.onCow = (k) => { SFX.oink && near(k) && SFX.oink(); k.shout(["Moo!", "A cow!", "Move over, cow!"]); };
G.onSurface = () => {};
G.onLift = (k) => { if (isP(k)) { SFX.horn(); k.shout(["Elevator!", "All aboard!", "Next stop: up!"]); } };
G.onBotch = (k) => { if (isP(k)) { SFX.wall(); styleScore = 0; styleMsg("BOTCHED!", 0); } k.shout(["Ouch!", "That was rough!", "Darn!"]); };
G.onStyle = (k, text, pts) => { if (isP(k)) styleMsg(text, pts); };
G.onShortcut = (k, path) => { if (isP(k) && path.label) { G.banner(path.label.toUpperCase() + "!", 1.2); styleMsg("SHORTCUT", 40); } };
G.onLap = (k) => {
  if (k.lap >= raceLaps && !k.finished) {
    k.finished = true; k.finishTime = G.raceTime;
    if (online && !k.remote) net.finish(k, G.raceTime);
    if (isP(k)) finishPlayer();
    return;
  }
  if (!isP(k) || k.lap < 1) return;
  if (k.lap === raceLaps - 1) { G.banner("FINAL LAP!!!", 2); SFX.final(); musicFast(); }
  else { G.banner("LAP " + (k.lap + 1), 1.2); SFX.lap(); }
};
G.onTrigger = (k, tr) => {
  const f = tr.f, t = tr.type;
  if (t === "splash") { fx.burst(k.pos, 0x9fe3ff, 30, 12, 1.4); if (isP(k)) { SFX.splash(); k.shout(["Wet!", "Soaked!", "Water!"]); } return; }
  if (!G.track.lapOk(f, k.curLap)) return;
  if (t === "banner" && isP(k)) { G.banner(f.text, 1.8); }
  if (t === "cheer" && isP(k)) { SFX.win(); }
  if (t === "slowmo") {
    if (isP(k)) { G.slowT = 0.9; G.fovKick = 14; G.shake = 0.5; setTimeout(() => k.shout("big", true), 150); }
    else if (Math.random() < 0.4) k.shout("big");
  }
};
// dynamic hazards vs karts (local karts only; remotes resolve on their own client)
function hazardHits() {
  const T = G.track;
  for (const h of T.hazards) {
    if (!h.active) continue;
    for (const k of G.karts) {
      if (k.remote || k.respawnT > 0 || k.finished && !k.isBot) continue;
      let hit;
      if (h.custom) hit = h.custom(k);
      else { const rr = (h.r || 2) + k.rad; hit = k.pos.distanceToSquared(h.pos) < rr * rr; }
      if (!hit) continue;
      if (h.type === "switch") { if (h.gate && !(h.gate.switched > 0)) { h.gate.switched = 15; if (isP(k)) { SFX.tick(); G.banner("SWITCH FLIPPED!", 1.2); } } continue; }
      if (h.type === "bounce") { if (k.grounded) { k.launch(h.p || 24); k.canTrick = true; G.onBounce(k); } continue; }
      if (k.starT > 0 || k.phaseT > 0) { fx.burst(h.pos, 0xffffff, 12, 10); continue; }
      if ((h.hitCD || 0) > G.time && h.lastK === k) continue;
      h.hitCD = G.time + 1.2; h.lastK = k;
      if (k.hit(HIT_TYPES.has(h.type) ? h.type : "spin")) {
        if (h.type === "squash") k.shout(["Flattened!", "I'm a flatfish!", "Ouch!"], true);
        if (h.kind === "snowball") k.shout(["Avalanche!!!", "Snow! Snow everywhere!"], true);
        if (h.kind === "car") k.shout(["Beep beep!", "Wrong-way driver!", "Right of way!"], true);
      }
    }
  }
}

// ---------- race ----------
let curTrack = null, countT = 0, lastCount = -1, finishT = 0, lastPlace = 1;
const cam = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fwd: new THREE.Vector3(0, 0, 1), up: new THREE.Vector3(0, 1, 0) };
const HIT_TYPES = new Set(["spin", "launch", "bump", "squash", "reverse", "side", "slow", "fog"]);
function clearRace() {
  hideReplayModels(); replayPlayback = null; raceRecording = null; pendingKillcam = null;
  $("#killcamBox").classList.remove("show"); $("#killcamBox").classList.add("hidden");
  if (items) items.clear();
  if (timeTrial?.ghostModels) { for (const model of timeTrial.ghostModels) disposeGhostModel(model); timeTrial.ghostModels = []; }
  for (const k of G.karts) { G.scene.remove(k.m.root); G.scene.remove(k.m.shadow); }
  if (G.track) G.track.dispose();
  G.track = null;
  for (const b of bubbles) b.el.remove(); bubbles.length = 0;
  G.karts = []; G.player = null;
}
function setupScene(def) {
  Audio.init();
  clearRace();
  paused = false;
  $("#ghostSpectate").classList.add("hidden");
  curTrack = def;
  G.timeTrial = mode === "timeTrial";
  document.body.classList.toggle("trial-mode", G.timeTrial);
  $("#hint").textContent = G.timeTrial ? "W/↑ accelerate · A/D steer · O brake · SPACE drift/jump · E / X boost · 3 charges · Esc pause" : "W/↑ accelerate · A/D steer · O brake · SPACE drift/jump · E item · Q throw backward · C ability";
  show(null); $("#hud").classList.remove("hidden"); $("#spec").classList.add("hidden"); $("#trialLabel").classList.add("hidden");
  const scene = new THREE.Scene(); G.scene = scene;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x667755, 1.15));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5); sun.position.set(200, 400, 120); scene.add(sun);
  G.track = buildTrack(def, scene);
  const T = G.track;
  if (G.timeTrial) for (const b of T.objs.boxes) { b.active = false; if (b.mesh) b.mesh.visible = false; }
  fx = new FX(scene); G.fx = fx;
  items = new Items(G); G.items = items;
  startArch(T);
  T.onBreak = (sec) => { for (let i = sec.i0 || 0; i < (sec.i1 || 0); i += 3) { const s = T.S[i % T.N]; if (s) fx.burst(new THREE.Vector3(s.x, s.y, s.z), 0xb0a890, 6, 8, 2, 30); } SFX.bigland(); G.shake = 0.6; if (sec.sign) G.banner(sec.sign, 1.4); };
  T.onSmash = (pos) => { if (pos.distanceTo(camera.position) < 60) SFX.smash(); fx.burst(pos, 0xffaa44, 14, 12); };
  T.onAvalanche = () => { G.banner("AVALANCHE!!!", 1.6); SFX.bigland(); G.shake = 0.8; };
  G.racing = false; G.raceTime = 0; G.time = 0; lastCount = -1; finishT = 0; G.worldSlow = 0; G.slowT = 0; styleScore = 0;
  raceRecording = { frames: [], accum: 0, nextItemId: 1, itemModels: new Map() };
  G.state = "race";
  hud.setItem(null);
  if (G.timeTrial) hud.setTrialBoosts(timeTrial?.boosts ?? 3);
}
function startArch(T) {
  const s = T.S[0];
  const c = document.createElement("canvas"); c.width = 256; c.height = 32; const g = c.getContext("2d");
  for (let x = 0; x < 32; x++) for (let y = 0; y < 4; y++) { g.fillStyle = (x + y) % 2 ? "#111" : "#fff"; g.fillRect(x * 8, y * 8, 8, 8); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const grp = new THREE.Group();
  const ban = new THREE.Mesh(new THREE.BoxGeometry(s.hw * 2 + 4, 3, 0.5), new THREE.MeshBasicMaterial({ map: tex })); ban.position.y = 12; grp.add(ban);
  for (const x of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(1, 13.5, 1), new THREE.MeshLambertMaterial({ color: 0xdd0000 })); p.position.set(x * (s.hw + 1.5), 6.5, 0); grp.add(p); }
  const line = new THREE.Mesh(new THREE.PlaneGeometry(s.hw * 2, 3), new THREE.MeshBasicMaterial({ map: tex })); line.rotation.x = -Math.PI / 2; line.position.y = 0.12; grp.add(line);
  grp.position.set(s.x, s.y, s.z); grp.rotation.y = Math.atan2(s.t.x, s.t.z);
  T.group.add(grp);
}
function gridSlot(T, i, count = NKARTS) { const row = Math.floor((count - 1 - i) / 2), col = (count - 1 - i) % 2; const si = ((T.N - 6 - row * 5) % T.N + T.N) % T.N; return [si, (col ? 1 : -1) * T.S[si].hw * 0.38]; }
const ghostP0 = new THREE.Vector3(), ghostP1 = new THREE.Vector3();
const ghostQ0 = new THREE.Quaternion(), ghostQ1 = new THREE.Quaternion();
function disposeGhostModel(model) {
  if (!model) return;
  G.scene?.remove(model.root); G.scene?.remove(model.shadow);
  const dispose = (obj) => {
    if (!obj) return;
    obj.traverse?.(child => {
      if (!child.isMesh) return;
      child.geometry?.dispose();
      for (const material of Array.isArray(child.material) ? child.material : [child.material]) material?.dispose();
    });
    obj.geometry?.dispose(); obj.material?.dispose();
  };
  dispose(model.root); dispose(model.shadow);
}
function recordGhostPose(trial, kart, time) {
  if (!trial.origin) trial.origin = [kart.pos.x, kart.pos.y, kart.pos.z];
  const q = kart.quat, o = trial.origin;
  const quant = (v) => Math.max(-32767, Math.min(32767, Math.round(v)));
  const frame = [Math.round(time / GHOST_STEP), quant((kart.pos.x - o[0]) * 4), quant((kart.pos.y - o[1]) * 4), quant((kart.pos.z - o[2]) * 4), quant(q.x * 32767), quant(q.y * 32767), quant(q.z * 32767), quant(q.w * 32767)];
  const last = trial.frames.length - GHOST_WORDS;
  if (last >= 0 && trial.frames[last] === frame[0]) {
    trial.frames.splice(last, GHOST_WORDS, ...frame);
    trial.inputFrames[Math.floor(last / GHOST_WORDS)] = kart.inputBits || 0;
  } else {
    trial.frames.push(...frame);
    trial.inputFrames.push(kart.inputBits || 0);
  }
}
function captureTrialFrame(trial, kart, dt) {
  if (!trial.recording || !G.racing) return;
  trial.accumulator += dt;
  if (trial.accumulator >= GHOST_STEP) { trial.accumulator -= GHOST_STEP; recordGhostPose(trial, kart, G.raceTime); }
  if (kart.finished) {
    recordGhostPose(trial, kart, kart.finishTime);
    trial.time = kart.finishTime; trial.completed = true; trial.recording = false;
  }
}
function updateTrialGhost(trial, elapsed) {
  if (!trial?.ghostModels) return;
  trial.watchedGhostBits = null; trial.watchedGhostName = "";
  const target = elapsed / GHOST_STEP;
  for (let playbackIndex = 0; playbackIndex < trial.ghostModels.length; playbackIndex++) {
  const playback = trial.ghostModels[playbackIndex];
  const data = playback.playFrames, count = data.length / GHOST_WORDS;
  const root = playback.model.root;
  if (elapsed > playback.ghost.time || !count) { root.visible = false; continue; }
  root.visible = true;
  let lo = 0, hi = count - 1;
  while (lo + 1 < hi) { const mid = (lo + hi) >> 1; if (data[mid * GHOST_WORDS] <= target) lo = mid; else hi = mid; }
  const i0 = lo;
  const i1 = target >= data[hi * GHOST_WORDS] ? hi : Math.min(hi, lo + 1);
  const t0 = data[i0 * GHOST_WORDS], t1 = data[i1 * GHOST_WORDS];
  const f = t1 > t0 ? Math.max(0, Math.min(1, (target - t0) / (t1 - t0))) : 0;
  const inputs = playback.inputFrames || (playback.inputFrames = ghostInputWords(playback.ghost));
  playback.inputBits = inputs ? (inputs[i0] || 0) : null;
  if (playbackIndex === (trial.ghostIndex || 0)) {
    trial.watchedGhostBits = playback.inputBits;
    trial.watchedGhostName = playback.ghost.name;
  }
  const pose = (i, p, q) => {
    const at = i * GHOST_WORDS, o = playback.ghost.origin;
    p.set(o[0] + data[at + 1] / 4, o[1] + data[at + 2] / 4, o[2] + data[at + 3] / 4);
    q.set(data[at + 4] / 32767, data[at + 5] / 32767, data[at + 6] / 32767, data[at + 7] / 32767).normalize();
  };
  pose(i0, ghostP0, ghostQ0); pose(i1, ghostP1, ghostQ1);
  root.position.lerpVectors(ghostP0, ghostP1, f); root.quaternion.copy(ghostQ0).slerp(ghostQ1, f);
  }
}
function installTrialGhost(trial) {
  trial.ghostModels = [];
  trial.ghostIndex = 0; trial.spectatingGhost = false;
  for (const ghost of trial.ghosts || []) {
    const frames = ghostWords(ghost);
    if (!frames) continue;
    const model = buildKartModel(CHARACTERS[ghost.char], ghost.vehicle), materials = new Set();
    model.root.traverse(obj => {
      if (!obj.isMesh) return;
      const clone = (material) => {
        if (!material) return material;
        materials.add(material);
        const copy = material.clone(); copy.transparent = true; copy.opacity = (Number.isFinite(material.opacity) ? material.opacity : 1) * 0.42; copy.depthWrite = false;
        return copy;
      };
      obj.material = Array.isArray(obj.material) ? obj.material.map(clone) : clone(obj.material);
      obj.renderOrder = 2;
    });
    for (const material of materials) material.dispose();
    G.scene.add(model.root);
    trial.ghostModels.push({ ghost, playFrames: frames, model });
  }
  $("#ghostSpectate").classList.toggle("hidden", !trial.ghostModels.length);
  $("#ghostSpectate").textContent = "Spectate Ghost";
  updateTrialGhost(trial, 0);
}
function saveTrialGhost(trial) {
  if (!trial?.completed || trial.finalized) return;
  trial.finalized = true;
  const previous = loadPersonalGhost(trial.trackId), words = new Int16Array(trial.frames);
  trial.beatGhost = !trial.best || trial.time < trial.best.time;
  trial.personalSaved = !previous || trial.time < previous.time;
  trial.gap = trial.best ? Math.abs(trial.best.time - trial.time) : 0;
  if (!trial.personalSaved) return;
  const ghost = { version: 1, trackId: trial.trackId, name: ghostName(localStorage.wkPlayerName || ghostOwnerInput.value || selChar.short), char: CHARACTERS.indexOf(selChar), vehicle: selVeh.id, time: trial.time, step: GHOST_STEP, origin: trial.origin, data: wordsToBase64(words) };
  if (trial.inputFrames?.length) ghost.inputData = wordsToBase64(new Uint16Array(trial.inputFrames));
  try { localStorage.setItem(personalGhostKey(trial.trackId), JSON.stringify(ghost)); localStorage.setItem(challengeGhostKey(trial.trackId), personalGhostKey(trial.trackId)); trial.savedGhost = ghost; }
  catch { trial.saveError = true; }
}
function downloadGhost(ghost) {
  const blob = new Blob([JSON.stringify(ghost)], { type: "application/json" });
  const url = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = url; link.download = "Wunderkart-Ghost-" + ghost.trackId + "-" + ghost.time.toFixed(2).replace(".", "-") + ".json";
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function showTrialNotice(trial) {
  const notice = $("#trialNotice");
  if (!trial?.completed) { notice.classList.add("hidden"); return; }
  saveTrialGhost(trial);
  let text;
  if (trial.beatGhost) text = trial.best ? "GHOST BEATEN · " + fmt(trial.gap) + " faster than " + trial.best.name + ". " : "NEW GHOST EARNED · ";
  else text = (trial.best.sharedBy ? trial.best.name + "'s ghost" : "Your ghost") + " held the lead by " + fmt(trial.gap) + ". ";
  if (trial.personalSaved) text += trial.saveError ? "Could not save your new ghost." : "New ghost saved. Share it from a LAN lobby.";
  else if (trial.beatGhost) text += "Ghost beaten.";
  notice.textContent = text; notice.classList.remove("hidden");
}
function afterSetup(def) {
  buildMinimap();
  lastPlace = G.karts.length;
  $("#hint").style.display = G.player ? "" : "none";
  $("#ability").style.display = G.player ? "" : "none";
  if (G.player) $("#abname").textContent = "★ " + G.player.char.ability.name;
  musicStart(TRACKS.indexOf(def) % 4);
  if (G.player) engineStart();
  const p = G.player || G.karts[0];
  cam.pos.set(p.pos.x + 40, p.pos.y + 25, p.pos.z + 40); cam.look.copy(p.pos);
  G.banner(def.name.toUpperCase(), 2.2);
  
}
function startTimeTrial(def) {
  if (timeTrial?.ghostModels) { for (const model of timeTrial.ghostModels) disposeGhostModel(model); timeTrial.ghostModels = []; }
  const available = loadTrackGhosts(def.id), chosen = trialGhostSelection.get(def.id);
  const ghosts = chosen ? available.filter(ghost => chosen.has(ghostSelectionId(ghost))) : available;
  timeTrial = { trackId: def.id, ghosts, best: ghosts[0] || null, frames: [], inputFrames: [], recording: true, accumulator: 0, origin: null, completed: false, boosts: 3, pendingBoost: false };
  startRace(def);
}
function startRace(def) {
  online = null; G.net = null;
  raceLaps = def.laps || LAPS;
  setupScene(def);
  const T = G.track;
  const rivals = gp ? gp.rivals : mode === "timeTrial" ? [] : CHARACTERS.filter(c => c !== selChar).sort(() => Math.random() - 0.5).slice(0, NKARTS - 1);
  const rv = gp ? gp.rv : rivals.map(() => pick(VEHICLES).id);
  [selChar, ...rivals].forEach((c, i) => {
    const k = new Kart(c, i === 0 ? selVeh.id : rv[i - 1], i === 0, G, i);
    k.setStart(...gridSlot(T, i, mode === "timeTrial" ? 1 : NKARTS));
    G.karts.push(k);
    if (i === 0) G.player = k;
  });
  if (mode === "timeTrial" && timeTrial) {
    timeTrial.frames = []; timeTrial.inputFrames = []; timeTrial.watchedGhostBits = null; timeTrial.watchedGhostName = ""; timeTrial.origin = null; timeTrial.accumulator = 0; timeTrial.recording = true; timeTrial.completed = false;
    installTrialGhost(timeTrial);
    $("#trialLabel").textContent = timeTrial.ghosts.length
      ? "RACING " + timeTrial.ghosts.length + " GHOST" + (timeTrial.ghosts.length === 1 ? "" : "S") + " · " + timeTrial.ghosts.map(g => g.name).join(", ")
      : "TIME TRIAL · SET A GHOST";
    $("#trialLabel").classList.remove("hidden");
  }
  countT = 4.2;
  afterSetup(def);
}
function startOnlineRace(m) {
  const def = TRACKS[m.track]; if (!def) return;
  raceLaps = def.laps || LAPS;
  gp = null;
  setupScene(def);
  const T = G.track;
  online = { byNid: new Map(), host: m.host, startAt: performance.now() + (m.countT || 0) * 1000, go: !!m.spectate, spectate: !!m.spectate, specIdx: 0 };
  G.net = net;
  $("#spectatePick").classList.toggle("hidden", !m.spectate);
  m.grid.forEach((g, i) => {
    const c = CHARACTERS[g.char] || CHARACTERS[0], v = VEHICLES[g.veh] || VEHICLES[0];
    const mine = !m.spectate && g.owner === net.id, localBot = !m.spectate && g.bot && m.host === net.id;
    const k = new Kart(c, v.id, mine, G, i, { remote: !mine && !localBot, netId: g.nid, name: g.name });
    k.owner = g.owner; k.bot = g.bot;
    k.setStart(...gridSlot(T, i, m.grid.length));
    G.karts.push(k); online.byNid.set(g.nid, k);
    if (mine) G.player = k;
  });
  if (m.spectate) { G.racing = true; G.raceTime = m.raceT || 0; G.time = G.raceTime; countT = 0; $("#spec").classList.remove("hidden"); $("#spec").textContent = "👀 Spectating · next race soon"; }
  else countT = m.countT || 5;
  $("#chat").classList.remove("hidden");
  afterSetup(def);
}
function finishPlayer() {
  const p = G.player;
  G.banner(p.place === 1 ? "CHAMPION!!!" : p.place + ". PLACE!", 2.6);
  p.shout(p.place <= 3 ? "win" : "lose", true);
  SFX.win(); fx.confetti(p.pos, 150);
  finishT = 4;
}
const ranked = () => [...G.karts].sort((a, b) => (b.finished - a.finished) || (a.finished && b.finished ? a.finishTime - b.finishTime : b.progress - a.progress));
function resRow(i, k, c, name, time, pts, me) {
  const r = document.createElement("div"); r.className = "rrow" + (me ? " me" : ""); r.style.animationDelay = (i * 0.07) + "s";
  r.innerHTML = '<span class="pn">' + (i + 1) + '.</span><img src="' + portraits[c.id] + '"><span class="nm">' + esc(name) + '</span><span class="tm">' + (time !== null && time !== undefined ? fmt(time) : "--:--.--") + "</span>" + (pts !== null ? '<span class="pts">+' + pts + "</span>" : "");
  return r;
}
function showResults() {
  captureRaceFrame(G.raceTime);
  G.state = "results";
  $("#seriesStatus").classList.add("hidden");
  if (mode === "timeTrial") showTrialNotice(timeTrial); else $("#trialNotice").classList.add("hidden");
  const order = ranked();
  const list = $("#reslist"); list.innerHTML = "";
  if (gp) order.forEach((k, i) => gp.pts[k.char.id] += POINTS[i] || 0);
  order.forEach((k, i) => list.appendChild(resRow(i, k, k.char, k.char.short, k.finished ? k.finishTime : null, gp ? POINTS[i] || 0 : null, isP(k))));
  $("#resh").textContent = mode === "timeTrial" ? "Time Trial · " + curTrack.name : curTrack.name;
  const btns = $("#resbtns"); btns.innerHTML = "";
  const btn = (t, fn) => { const b = document.createElement("button"); b.textContent = t; b.onclick = () => { SFX.box(); fn(); }; btns.appendChild(b); };
  if (mode === "timeTrial") {
    btn("Replay Race", () => startRaceReplay());
    btn("Tracks", () => { exitRace(); openTracks(); });
    const ghost = loadPersonalGhost(timeTrial.trackId);
    if (ghost) btn("Download Ghost", () => downloadGhost(ghost));
  }
  else if (gp && gp.idx < gp.cup.tracks.length - 1) { btn("Replay Race", () => startRaceReplay()); btn("Next ▶", () => { gp.idx++; startRace(TRACK[gp.cup.tracks[gp.idx]]); }); }
  else if (gp) { btn("Replay Race", () => startRaceReplay()); btn("Final Standings ▶", showStandings); }
  else { btn("Replay Race", () => startRaceReplay()); btn("Tracks", () => { exitRace(); openTracks(); }); }
  btn("Menu", () => { exitRace(); show("#title"); G.state = "title"; });
  show("#results");
}
function showOnlineResults(list, series) {
  G.state = "results"; $("#spec").classList.add("hidden"); $("#trialNotice").classList.add("hidden");
  const el = $("#reslist"); el.innerHTML = "";
  const me = list.findIndex(r => r.owner === net.id);
  const displayed = series?.complete ? series.standings : list;
  displayed.forEach((r, i) => {
    const row = resRow(i, null, CHARACTERS[r.char] || CHARACTERS[0], r.name, series?.complete ? null : r.time, series?.complete ? null : r.pts, r.owner === net.id);
    if (series?.complete) row.querySelector(".tm").textContent = r.points + " pts";
    el.appendChild(row);
  });
  const status = $("#seriesStatus");
  if (series) {
    const cup = CUPS[series.cup];
    $("#resh").textContent = (cup ? cup.icon + " " + cup.name : "Grand Prix") + " · " + (series.complete ? "Final Standings" : "Race " + series.round + "/" + series.rounds);
    status.textContent = series.complete ? "Grand Prix complete · " + series.rounds + " races" : "Standings: " + series.standings.slice(0, 4).map((r, i) => (i + 1) + ". " + r.name + " " + r.points).join(" · ");
    status.classList.remove("hidden");
  } else {
    $("#resh").textContent = curTrack.name + (me >= 0 ? " · " + (me + 1) + ". Place" : "");
    status.classList.add("hidden");
  }
  const btns = $("#resbtns"); btns.innerHTML = "<small style='font-family:Arial;opacity:.8'>Back to the lobby shortly · host starts the next race</small>";
  const pickButton = document.createElement("button"); pickButton.textContent = "Choose Character"; pickButton.onclick = () => { SFX.box(); chooseOnlineCharacter(); }; btns.appendChild(pickButton);
  const b = document.createElement("button"); b.textContent = "Leave Room"; b.onclick = () => { SFX.box(); leaveOnline(); }; btns.appendChild(b);
  show("#results");
}
function showStandings() {
  const list = $("#reslist"); list.innerHTML = "";
  const all = [selChar, ...gp.rivals].sort((a, b) => gp.pts[b.id] - gp.pts[a.id]);
  all.forEach((c, i) => { const r = resRow(i, null, c, c.short, null, null, c === selChar); r.querySelector(".tm").textContent = gp.pts[c.id] + " pts"; list.appendChild(r); });
  const myPlace = all.indexOf(selChar) + 1;
  $("#resh").textContent = gp.cup.icon + " " + gp.cup.name + " — " + (myPlace === 1 ? "WIN!" : myPlace + ". Place");
  
  const btns = $("#resbtns"); btns.innerHTML = "";
  const b = document.createElement("button"); b.textContent = "Menu"; b.onclick = () => { exitRace(); show("#title"); G.state = "title"; }; btns.appendChild(b);
  gp = null;
}
function exitRace() {
  clearRace(); G.scene = null; timeTrial = null;
  G.timeTrial = false; document.body.classList.remove("trial-mode");
  $("#spectatePick").classList.add("hidden");
  $("#ghostSpectate").classList.add("hidden");
  $("#hud").classList.add("hidden"); $("#spec").classList.add("hidden"); $("#trialNotice").classList.add("hidden"); musicStop(); engineStop();
  paused = false; $("#pause").classList.add("hidden"); $("#prestart").classList.add("hidden");
}
let paused = false;
function togglePause() {
  if (replayPlayback) { finishReplay(); return; }
  if (online) { $("#pause").classList.toggle("hidden"); return; } // online: menu only, the race keeps running
  paused = !paused; $("#pause").classList.toggle("hidden", !paused);
  $("#prestart").classList.toggle("hidden", !paused || !curTrack || (raceRecording?.frames.length || 0) < 2);
  if (paused) { musicStop(); engineUpdate(0, 0, 0, 0); } else musicStart(TRACKS.indexOf(curTrack) % 4);
}
$("#presume").onclick = togglePause;
$("#prestart").onclick = () => {
  if (!curTrack || !raceRecording?.frames.length) return;
  SFX.box(); startRaceReplay();
};
$("#pquit").onclick = () => { $("#pause").classList.add("hidden"); if (online) { leaveOnline(); return; } paused = false; exitRace(); gp = null; show("#title"); G.state = "title"; };

// ---------- kart vs kart ----------
function kartCollisions() {
  const K = G.karts;
  for (let i = 0; i < K.length; i++) for (let j = i + 1; j < K.length; j++) {
    const a = K[i], b = K[j];
    if (a.remote && b.remote) continue;
    if (a.respawnT > 0 || b.respawnT > 0) continue;
    const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, dy = b.pos.y - a.pos.y;
    const R = a.rad + b.rad, d2 = dx * dx + dz * dz;
    if (d2 > R * R || Math.abs(dy) > 2.5) continue;
    const d = Math.sqrt(d2) || 0.01, nx = dx / d, nz = dz / d, ov = R - d;
    if (a.starT > 0 && b.starT <= 0) { b.hit("launch", a); continue; }
    if (b.starT > 0 && a.starT <= 0) { a.hit("launch", b); continue; }
    let wa = Math.max(0.5, a.weight + (a.anchorT > 0 ? 20 : 0) + (a.shieldT > 0 ? 10 : 0)), wb = Math.max(0.5, b.weight + (b.anchorT > 0 ? 20 : 0) + (b.shieldT > 0 ? 10 : 0));
    if (a.remote) wa = 1e3; if (b.remote) wb = 1e3;
    const ra = wb / (wa + wb), rb = wa / (wa + wb);
    if (!a.remote) { a.lat -= (nx * a.frame().r.x + nz * a.frame().r.z) * ov * ra; a.knock.x -= nx * 10 * ra; a.knock.z -= nz * 10 * ra; }
    if (!b.remote) { b.lat += (nx * b.frame().r.x + nz * b.frame().r.z) * ov * rb; b.knock.x += nx * 10 * rb; b.knock.z += nz * 10 * rb; }
    if (a.anchorT > 0) b.hit("bump", a); if (b.anchorT > 0) a.hit("bump", b);
    if ((isP(a) || isP(b)) && Math.random() < 0.3) SFX.wall();
    if (Math.random() < 0.15) (Math.random() < 0.5 ? a : b).shout(["Make way!", "Hey!", "Watch where you're going!", "Rude!", "Watch out!"]);
  }
}

// ---------- camera ----------
const _f = new THREE.Vector3(), _u = new THREE.Vector3(), _t = new THREE.Vector3(), _l = new THREE.Vector3();
function camTarget() {
  if (timeTrial?.spectatingGhost) {
    const playback = timeTrial.ghostModels?.[timeTrial.ghostIndex];
    if (playback?.model.root.visible) {
      const target = timeTrial.cameraTarget || (timeTrial.cameraTarget = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), grounded: true, speed: 52, drift: 0, respawnT: 0, airT: 0 });
      target.pos.copy(playback.model.root.position); target.quat.copy(playback.model.root.quaternion); return target;
    }
  }
  if (G.player) return G.player;
  const order = ranked(), index = Math.max(0, online?.specIdx || 0);
  if (online) online.specIdx = Math.min(index, order.length - 1);
  return order[index] || G.karts[0];
}
function updateCamera(dt) {
  const p = camTarget(); if (!p) return;
  const intro = G.racing ? 0 : Math.max(0, Math.min(1, (countT - 2.6) / 1.6));
  _f.set(0, 0, 1).applyQuaternion(p.quat); _u.set(0, 1, 0).applyQuaternion(p.quat);
  if (!p.grounded || p.respawnT > 0) { _f.y *= 0.3; _u.set(0, 1, 0); }
  if (_u.y > 0.55) _u.lerp(new THREE.Vector3(0, 1, 0), 0.75);
  _f.normalize(); _u.normalize();
  if (p.drift) _f.applyAxisAngle(_u, p.drift * 0.18);
  cam.fwd.lerp(_f, 1 - Math.exp(-dt * (p.grounded ? 7 : 2.5))).normalize();
  cam.up.lerp(_u, 1 - Math.exp(-dt * 5)).normalize();
  const sp = Math.abs(p.speed);
  let dist = 11 + sp * 0.05, h = 5.4 + sp * 0.015;
  if (!p.grounded) { h += Math.min(6, p.airT * 3); dist += Math.min(4, p.airT * 2); }
  _t.copy(p.pos).addScaledVector(cam.fwd, -dist).addScaledVector(cam.up, h);
  if (intro > 0) { const a = G.time * 0.5; _l.set(p.pos.x + Math.sin(a) * 30, p.pos.y + 20, p.pos.z + Math.cos(a) * 30); _t.lerp(_l, intro); }
  if (p.respawnT > 0) _t.copy(cam.pos);
  if (finishT > 0 || (p.finished && G.player === p)) { const a = G.time * 0.4; _t.set(p.pos.x + Math.sin(a) * 16, p.pos.y + 7, p.pos.z + Math.cos(a) * 16); }
  cam.pos.lerp(_t, 1 - Math.exp(-dt * (p.grounded ? 10 : 5)));
  if (cam.pos.distanceTo(_t) > 80) cam.pos.copy(_t);
  _l.copy(p.pos).addScaledVector(cam.fwd, 7).addScaledVector(cam.up, 2.6);
  cam.look.lerp(_l, 1 - Math.exp(-dt * 14));
  camera.position.copy(cam.pos);
  if (G.shake > 0) { camera.position.x += (Math.random() - 0.5) * G.shake * 1.5; camera.position.y += (Math.random() - 0.5) * G.shake * 1.5; G.shake = Math.max(0, G.shake - dt * 2); }
  camera.up.copy(intro > 0 ? _u.set(0, 1, 0) : cam.up);
  camera.lookAt(cam.look);
  if (p.reverseT > 0) camera.rotateZ(Math.sin(G.time * 2) * 0.06);
  const fov = 70 + Math.min(14, sp * 0.12) + (p.boostT > 0 ? 8 : 0) + G.fovKick;
  G.fovKick = Math.max(0, G.fovKick - dt * 10);
  camera.fov += (fov - camera.fov) * Math.min(1, dt * 6); camera.updateProjectionMatrix();
}

// ---------- kart particles ----------
function kartFX(k, dt) {
  if (k.pos.distanceToSquared(camera.position) > 160 * 160) return;
  _f.set(0, 0, 1).applyQuaternion(k.quat); const fx_ = _f.x, fz = _f.z, rx = fz, rz = -fx_;
  const back = (off, side) => [k.pos.x - fx_ * off + rx * side, k.pos.z - fz * off + rz * side];
  if (k.drift && k.grounded) {
    const col = [0xdddddd, 0x3aa0ff, 0xff8a00, 0xd040ff][k.driftLvl | 0];
    for (const side of [-1.4, 1.4]) { const [x, z] = back(1.6, side); for (let i = 0; i < (k.driftLvl ? 2 : 1); i++) fx.spawn(x, k.pos.y + 0.4, z, (Math.random() - 0.5) * 8, 3 + Math.random() * 5, (Math.random() - 0.5) * 8, col, k.driftLvl ? 0.7 : 1.1, 0.3, 30); }
  }
  if (k.boostT > 0) for (const side of [-0.5, 0.5]) { const [x, z] = back(2.8, side); fx.spawn(x, k.pos.y + 1.1, z, -fx_ * 10 + (Math.random() - 0.5) * 3, 1, -fz * 10, Math.random() < 0.5 ? 0xffcc00 : 0xff4400, 1.3, 0.25, 0, -0.5); }
  if (k.starT > 0 && Math.random() < 0.8) fx.spawn(k.pos.x, k.pos.y + 1.5, k.pos.z, 0, 2, 0, new THREE.Color().setHSL(Math.random(), 1, 0.6).getHex(), 1.6, 0.6, 0);
  if (k.reverseT > 0 && Math.random() < dt * 10) fx.spawn(k.pos.x + Math.cos(G.time * 6) * 2, k.pos.y + 5.5, k.pos.z + Math.sin(G.time * 6) * 2, 0, 0, 0, 0xffd23f, 1, 0.4, 0);
  if (k.spinT > 0 && Math.random() < dt * 20) fx.spawn(k.pos.x + Math.cos(G.time * 9) * 1.6, k.pos.y + 5.5, k.pos.z + Math.sin(G.time * 9) * 1.6, 0, 0, 0, 0xffff66, 0.9, 0.3, 0);
  if (k.slowT > 0 && Math.random() < dt * 10) fx.spawn(k.pos.x, k.pos.y + 2, k.pos.z, 0, 2, 0, 0x66ff66, 1.2, 0.6, 0);
  if (k.slipT > 0 && Math.random() < dt * 10) fx.spawn(k.pos.x, k.pos.y + 0.5, k.pos.z, (Math.random() - 0.5) * 4, 2, (Math.random() - 0.5) * 4, 0xd8d080, 0.8, 0.5, 10);
  if (k.grounded && Math.abs(k.speed) > 20 && Math.random() < dt * 4) { const [x, z] = back(2, 0); fx.spawn(x, k.pos.y + 0.3, z, 0, 1, 0, 0xbbbbbb, 1.4, 0.5, 0, 1.5); }
}

// ---------- HUD per frame ----------
function updateHUD(dt) {
  const p = G.player;
  const order = ranked();
  order.forEach((k, i) => k.place = i + 1);
  if (styleT > 0) { styleT -= dt; if (styleT <= 0) { $("#style").classList.remove("on"); styleScore = 0; } }
  $("#rankbox").innerHTML = order.map((k, i) => '<div class="' + (isP(k) ? "me" : "") + '">' + (i + 1) + ". " + esc(k.name || k.char.short) + "</div>").join("");
  const ghostWatching = !!(G.timeTrial && timeTrial?.spectatingGhost);
  const selectedGhost = timeTrial?.ghostModels?.[timeTrial.ghostIndex || 0];
  const watched = ghostWatching ? null : online?.spectate
    ? order[Math.min(online.specIdx || 0, order.length - 1)]
    : p;
  const inputKeys = ["KeyW", "KeyA", "KeyS", "KeyD", "KeyO", "ShiftLeft", "ShiftRight", "Enter", "KeyE", "KeyQ", "KeyC"];
  const inputNames = ["W", "A", "S", "D", "O", "Shift", "LShift", "Enter", "E", "Q", "C"];
  const keyboardRows = [["Escape","1","2","3","4","5","6","7","8","9","0","-","=","Backspace"],["Tab","Q","W","E","R","T","Y","U","I","O","P","[","]"],["CapsLock","A","S","D","F","G","H","J","K","L",";","'"],["Shift","Z","X","C","V","B","N","M",",",".","/","Enter"],["Ctrl","Alt","Space","Alt","Ctrl","←","↓","↑","→"]];
  const keyCode = name => ({ "Space":"Space", "Enter":"Enter", "Shift":"ShiftLeft", "←":"ArrowLeft", "→":"ArrowRight", "↑":"ArrowUp", "↓":"ArrowDown" })[name] || (/^\d$/.test(name) ? "Digit" + name : "Key" + name);
  const bits = ghostWatching ? selectedGhost?.inputBits || 0 : watched === p ? inputKeys.reduce((mask, code, i) => mask | (keys[code] ? 1 << i : 0), 0) : watched?.inputBits || 0;
  const display = $("#inputDisplay");
  display.classList.toggle("hidden", !G.racing || localStorage.wkShowInputs !== "1");
  if (localStorage.wkShowInputs === "1") {
    display.innerHTML = localStorage.wkWholeKeyboard === "1"
      ? '<div class="input-source">' + esc(ghostWatching ? selectedGhost?.ghost.name + " · ghost" : watched?.name || "Your inputs") + '</div><div class="key-grid">' + keyboardRows.map(row => '<div class="key-row">' + row.map(name => { const i = inputKeys.indexOf(keyCode(name)); const down = i >= 0 ? !!(bits & (1 << i)) : !ghostWatching && watched === p && !!keys[keyCode(name)]; return '<span class="' + (down ? "down" : "") + '">' + name + '</span>'; }).join("") + '</div>').join("") + '</div>'
      : '<div class="input-source">' + esc(ghostWatching ? selectedGhost?.ghost.name + " · ghost" : watched?.name || "Your inputs") + '</div>' + inputNames.map((name, i) => bits & (1 << i) ? '<span class="input-key">' + name + "</span>" : "").join("");
    const playback = ghostWatching ? null : selectedGhost;
    if (playback) {
      const ghostBits = playback.inputBits;
      display.innerHTML += '<div class="input-source ghost-input-source">' + esc(playback.ghost.name) + ' · ghost</div>' +
        (ghostBits === null ? '<small>Input history unavailable for this older ghost.</small>' : inputNames.map((name, i) => ghostBits & (1 << i) ? '<span class="input-key">' + name + "</span>" : "").join(""));
    }
  }
  if (!p) { $("#placeN").textContent = "–"; $("#lap").textContent = ""; $("#time").textContent = fmt(G.raceTime); return; }
  if (p.place < lastPlace && G.racing && G.raceTime > 3) { p.shout("pass"); $("#place").classList.add("pop"); setTimeout(() => $("#place").classList.remove("pop"), 180); }
  lastPlace = p.place;
  $("#placeN").textContent = p.place;
  $("#lap").textContent = "Lap " + Math.min(raceLaps, p.curLap) + "/" + raceLaps;
  $("#time").textContent = fmt(p.finished ? p.finishTime : G.raceTime);
  $("#abbar i").style.width = (p.ability * 100) + "%";
  $("#ability").classList.toggle("ready", p.ability >= 1);
  $("#speedlines").classList.toggle("on", p.boostT > 0 || Math.abs(p.speed) > 72);
  $("#fogfx").classList.toggle("on", p.fogT > 0);
  if (G.racing && G.raceTime > 6) $("#hint").style.display = "none";
  engineUpdate(Math.abs(p.speed), p.boostT > 0 ? 1 : 0, p.drift ? 1 : 0, p.grounded ? 0 : 1);
}

// ---------- main loop ----------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  frameInner(now);
}
function frameInner(now) {
  let rdt = Math.min(0.05, (now - last) / 1000); last = now;
  updateGamepadInput();
  net.hostTick(rdt);
  if (G.state !== "race" && G.state !== "results" || !G.track) {
    for (const k in pressed) delete pressed[k];
    menu.t += rdt;
    if (menu.kart) { menu.kart.root.rotation.y = menu.t * 0.6; }
    camera.up.set(0, 1, 0); camera.position.set(Math.sin(menu.t * 0.1) * 2, 5, 12); camera.lookAt(0, 2, 0); camera.fov = 50; camera.updateProjectionMatrix();
    if (G.state === "lobby") { const t = lobbyPhaseText(); if (t !== lobPhaseShown) { lobPhaseShown = t; $("#lobphase").textContent = t; } }
    renderer.render(menu.scene, camera);
    return;
  }
  if (replayPlayback?.kind === "killcam") updateReplay(rdt);
  else if (replayPlayback) {
    updateReplay(rdt);
    if (replayPlayback) { updateCamera(rdt); renderer.render(G.scene, camera); }
    else renderer.render(G.scene, camera);
    return;
  }
  if (paused) { renderer.render(G.scene, camera); return; }
  let dt = rdt;
  if (G.slowT > 0) { G.slowT -= rdt; dt *= 0.35; }
  if (G.worldSlow > 0) G.worldSlow = Math.max(0, G.worldSlow - dt);
  G.time += dt; G.frameN++;
  const T = G.track;
  // countdown
  if (!G.racing) {
    if (online && !online.spectate) countT = Math.max(0, (online.startAt - now) / 1000);
    else countT -= dt;
    const c = Math.ceil(countT);
    if (c !== lastCount && c <= 3) {
      lastCount = c;
      const el = $("#count");
      if (c > 0) { el.className = ""; el.innerHTML = '<span class="pop">' + c + "</span>"; SFX.count(); }
      else { el.className = "go"; el.innerHTML = '<span class="pop">GO!</span>'; SFX.go(); }
    }
    const p = G.player;
    if (p) { const thr = keys.KeyW || keys.ArrowUp || gamepadInput.throttle || (document.body.classList.contains("touch") && !gamepadInput.connected); if (thr && countT < 1.2) p.startCharge = (p.startCharge || 0) + dt; else if (!thr) p.startCharge = 0; }
    if (countT <= 0 && (!online || online.go || online.startAt <= now)) {
      G.racing = true; G.raceTime = 0;
      if (timeTrial && p) recordGhostPose(timeTrial, p, 0);
      const pressedTrialBoost = pressed.KeyE || pressed.Enter || pressed.KeyX || pressed.TI || gamepadInput.item;
      if (G.timeTrial && p && timeTrial.pendingBoost) { timeTrial.pendingBoost = false; useTrialBoostEffect(p); G.banner("TURBO START!", 1); }
      else if (G.timeTrial && p && !pressedTrialBoost && p.startCharge > 0.25 && p.startCharge < 1.0) { useTrialBoostEffect(p); G.banner("TURBO START!", 1); }
      else if (!G.timeTrial && p && p.startCharge > 0.25 && p.startCharge < 1.0) { p.addBoost(1.2, 1.5); G.banner("ROCKET START!", 1); }
      else if (!G.timeTrial && p && p.startCharge >= 1.0) { p.spinT = 0.8; p.shout(["Stalled!", "Darn!"], true); }
      for (const k of G.karts) if (k.isBot && Math.random() < 0.5) k.addBoost(0.8, 1.3);
    }
  } else G.raceTime += dt;
  // karts
  for (const k of G.karts) {
    if (k.remote) { k.netUpdate(dt, now); continue; }
    const inp = k.isPlayer && !k.finished ? playerInput(dt) : k.think(dt);
    if (k.isPlayer) k.inputBits = ["KeyW", "KeyA", "KeyS", "KeyD", "KeyO", "ShiftLeft", "ShiftRight", "Enter", "KeyE", "KeyQ", "KeyC"].reduce((mask, code, i) => mask | (keys[code] ? 1 << i : 0), 0);
    if (k.isPlayer && G.timeTrial) {
      if (inp.item) useTrialBoost(k);
      inp.item = false; inp.ability = false;
    }
    k.update(dt, inp);
    kartFX(k, dt);
  }
  for (const k of G.karts) if (k.remote) kartFX(k, dt);
  if (timeTrial && G.player) { if (G.racing) captureTrialFrame(timeTrial, G.player, dt); updateTrialGhost(timeTrial, G.raceTime); }
  for (const k in pressed) delete pressed[k];
  kartCollisions();
  hazardHits();
  items.update(dt);
  T.update(dt, G.time, Math.max(1, ...G.karts.map(k => k.curLap)));
  fx.update(dt);
  if (online) net.tick(rdt, G.karts);
  updateHUD(dt);
  updateCamera(rdt);
  updateBubbles(rdt);
  if (G.frameN % 3 === 0) drawMinimap();
  // local race end
  if (!online && finishT > 0) { finishT -= rdt; if (finishT <= 0) { engineStop(); showResults(); } }
  if (online && online.spectate) { if (pressed.ArrowRight || keys.KeyD && G.frameN % 30 === 0) online.specIdx++; }
  if (!online && G.state === "race" && G.racing && raceRecording && !replayPlayback) {
    raceRecording.accum += rdt;
    if (raceRecording.accum >= 0.05) { raceRecording.accum %= 0.05; captureRaceFrame(G.raceTime); }
    playPendingKillcam();
  }
  if (replayPlayback?.kind === "killcam") renderKillcamInset();
  else renderer.render(G.scene, camera);
}
requestAnimationFrame(frame);

// ---------- deep link ----------
if (params.get("track") && TRACK[params.get("track")]) { mode = "single"; startRace(TRACK[params.get("track")]); }
