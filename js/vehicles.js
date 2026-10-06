import * as THREE from "three";
// ======================= VEHICLES =======================
// stats: spd top speed (m/s), acc (m/s^2), hnd turn rate, wt weight 1-6, drift (drift turn & charge), off (0-1 offroad skill),
// air (0-1 air control), boost (boost power mult), bdur (boost duration mult), grip (road grip), terr overrides (penalty multiplier per surface class)
// parts: [type, sx, sy, sz, x, y, z, color, rx, ry, rz]  type: b box, c cylinder(y), s sphere, k cone, t torus
// color "K" = kart color, "A" = accent, "D" = dark, "G" = glass, "C" = chrome
export const VEHICLES = [
  { id: "flitzer", name: "Speedster", cls: "Standard Kart", desc: "The all-rounder. A little bit of everything.",
    spd: 55, acc: 26, hnd: 2.3, wt: 3, drift: 1, off: 0.35, air: 0.5, boost: 1, bdur: 1, grip: 1,
    wheels: { kind: "std", r: 0.62, pos: [[1.45, 1.5, 1], [-1.45, 1.5, 1], [1.5, -1.5, 0], [-1.5, -1.5, 0]] }, seat: [0, 1.35, -0.6],
    parts: [["b", 2.6, 0.7, 4, 0, 0.75, 0, "K"], ["b", 2, 0.5, 1.4, 0, 0.7, 2.4, "K"], ["b", 2.8, 0.4, 0.5, 0, 0.55, 3.15, "D"], ["b", 0.4, 0.5, 2.4, 1.4, 0.95, 0, "A"], ["b", 0.4, 0.5, 2.4, -1.4, 0.95, 0, "A"], ["b", 1.8, 0.9, 1, 0, 1.25, -1.9, 0x555555], ["b", 2.8, 0.15, 0.7, 0, 2, -2.5, "K"], ["b", 0.15, 0.6, 0.3, 1.1, 1.7, -2.5, "D"], ["b", 0.15, 0.6, 0.3, -1.1, 1.7, -2.5, "D"]] },
  { id: "knirps", name: "Tiny Kart", cls: "Lightweight", desc: "Tiny and nimble, with wild acceleration. Flies after every bump.",
    spd: 52, acc: 40, hnd: 2.7, wt: 1, drift: 1.15, off: 0.3, air: 0.7, boost: 1, bdur: 1, grip: 1.05, tiny: true,
    wheels: { kind: "std", r: 0.45, pos: [[1, 1.1, 1], [-1, 1.1, 1], [1.05, -1.1, 0], [-1.05, -1.1, 0]] }, seat: [0, 1.0, -0.5], scale: 0.85,
    parts: [["b", 1.8, 0.5, 3, 0, 0.6, 0, "K"], ["b", 1.4, 0.4, 0.8, 0, 0.55, 1.7, "A"], ["c", 0.25, 1.4, 0.25, 0, 1.4, -1.4, "C"], ["b", 0.9, 0.6, 0.06, 0, 2.2, -1.4, "A"]] },
  { id: "kaefer", name: "Beetle", cls: "Classic Car", desc: "Keeps going and going. Tough on gravel.",
    spd: 53, acc: 24, hnd: 2.2, wt: 3.5, drift: 0.95, off: 0.55, air: 0.4, boost: 1, bdur: 1.1, grip: 0.98,
    wheels: { kind: "std", r: 0.7, pos: [[1.35, 1.6, 1], [-1.35, 1.6, 1], [1.4, -1.5, 0], [-1.4, -1.5, 0]] }, seat: [0, 1.15, -0.3],
    parts: [["s", 2.9, 1.9, 4.6, 0, 1.15, 0, "K"], ["s", 1.2, 0.6, 1.0, 1.25, 0.9, 1.6, "K"], ["s", 1.2, 0.6, 1.0, -1.25, 0.9, 1.6, "K"], ["s", 0.5, 0.5, 0.2, 0.7, 1.2, 2.25, 0xffffcc], ["s", 0.5, 0.5, 0.2, -0.7, 1.2, 2.25, 0xffffcc], ["b", 2.6, 0.25, 0.3, 0, 0.6, 2.4, "C"], ["b", 2.6, 0.25, 0.3, 0, 0.6, -2.4, "C"]], open: [0, 1.9, -0.3, 1.9, 1.6] },
  { id: "trabbi", name: "Trabant", cls: "Classic Car", desc: "A cardboard classic. Quick off the line, with plenty of character.",
    spd: 50, acc: 32, hnd: 2.35, wt: 2, drift: 1.1, off: 0.45, air: 0.5, boost: 1.05, bdur: 1, grip: 1, smoke: true,
    wheels: { kind: "std", r: 0.55, pos: [[1.35, 1.7, 1], [-1.35, 1.7, 1], [1.35, -1.6, 0], [-1.35, -1.6, 0]] }, seat: [0, 1.0, -0.4],
    parts: [["b", 2.8, 1.0, 5, 0, 0.95, 0, "K"], ["b", 2.5, 0.2, 2.2, 0, 2.4, -0.6, "A"], ["b", 0.2, 1, 0.2, 1.2, 1.9, 0.5, "A"], ["b", 0.2, 1, 0.2, -1.2, 1.9, 0.5, "A"], ["b", 2.9, 0.3, 0.3, 0, 0.6, 2.55, "C"], ["b", 0.5, 0.35, 0.1, 0.8, 1.15, 2.52, 0xffffcc], ["b", 0.5, 0.35, 0.1, -0.8, 1.15, 2.52, 0xffffcc]] },
  { id: "isetta", name: "Isetta", cls: "Three-Wheeler", desc: "A tiny bubble car with a front door. Turns on a dime.",
    spd: 49, acc: 30, hnd: 3.0, wt: 1.5, drift: 1.2, off: 0.3, air: 0.6, boost: 1, bdur: 1, grip: 1.08, tiny: true,
    wheels: { kind: "std", r: 0.5, pos: [[1.2, 1.1, 1], [-1.2, 1.1, 1], [0.3, -1.4, 0], [-0.3, -1.4, 0]] }, seat: [0, 1.1, -0.2],
    parts: [["s", 2.6, 2.4, 3.6, 0, 1.4, 0, "K"], ["s", 2.1, 1.3, 1.2, 0, 1.8, 1.25, "G"], ["b", 2.4, 0.18, 0.5, 0, 0.8, 1.7, "C"], ["s", 0.4, 0.4, 0.2, 0.9, 1.2, 1.7, 0xffffcc], ["s", 0.4, 0.4, 0.2, -0.9, 1.2, 1.7, 0xffffcc]], open: [0, 2.2, -0.3, 1.4, 1.4] },
  { id: "kabine", name: "Cabin Scooter", cls: "Three-Wheeler", desc: "A Messerschmitt bubble canopy. Pointy, fast, and twitchy.",
    spd: 57, acc: 27, hnd: 2.75, wt: 1.5, drift: 1.1, off: 0.2, air: 0.75, boost: 1.05, bdur: 1, grip: 0.95, tiny: true,
    wheels: { kind: "std", r: 0.5, pos: [[1.15, 1.2, 1], [-1.15, 1.2, 1], [0, -1.8, 0]] }, seat: [0, 0.95, 0],
    parts: [["s", 2, 1.3, 5.2, 0, 0.95, 0, "K"], ["s", 1.5, 1.4, 3.4, 0, 1.6, 0, "G"], ["k", 0.6, 1.2, 0.6, 0, 0.95, 2.8, "K", Math.PI / 2], ["b", 0.2, 0.6, 1, 0, 1.4, -2.4, "A"]] },
  { id: "silber", name: "Silver Arrow", cls: "Race Car", desc: "A 1934 speed demon. Blisteringly fast, low grip, no off-road ability.",
    spd: 64, acc: 22, hnd: 1.95, wt: 3, drift: 0.9, off: 0.05, air: 0.35, boost: 1.1, bdur: 1, grip: 0.86, terr: { dirt: 1.3, grass: 1.3, sand: 1.3, mud: 1.2 },
    wheels: { kind: "spoke", r: 0.75, pos: [[1.35, 2.0, 1], [-1.35, 2.0, 1], [1.35, -1.7, 0], [-1.35, -1.7, 0]] }, seat: [0, 1.05, -0.8],
    parts: [["c", 0.95, 5.6, 0.95, 0, 1.05, 0.3, 0xd8dde4, Math.PI / 2], ["k", 0.95, 1.4, 0.95, 0, 1.05, -3.2, 0xd8dde4, -Math.PI / 2], ["s", 0.9, 0.9, 0.9, 0, 1.05, 3.1, 0xd8dde4], ["b", 0.9, 0.6, 0.08, 0, 1.15, 3.6, "D"], ["c", 0.1, 1.8, 0.1, 0.9, 1.0, 1.8, "C", 0, 0, Math.PI / 2], ["b", 0.12, 0.8, 0.8, 0, 1.9, -1.3, "K"]] },
  { id: "manta", name: "Manta", cls: "Muscle Car", desc: "Shag carpet, lowered stance, and heavy as concrete. Rams everything aside.",
    spd: 60, acc: 21, hnd: 1.95, wt: 5, drift: 1.05, off: 0.25, air: 0.3, boost: 1.05, bdur: 1, grip: 0.95,
    wheels: { kind: "fat", r: 0.75, pos: [[1.55, 1.8, 1], [-1.55, 1.8, 1], [1.6, -1.7, 0], [-1.6, -1.7, 0]] }, seat: [0, 1.2, -0.6],
    parts: [["b", 3.2, 1.0, 5.6, 0, 1.05, 0, "K"], ["b", 2.8, 0.3, 2.6, 0, 1.7, 0.6, "D"], ["b", 3.3, 0.3, 0.4, 0, 0.75, 2.85, "D"], ["b", 0.6, 0.3, 0.1, 1.0, 1.2, 2.82, 0xffffcc], ["b", 0.6, 0.3, 0.1, -1.0, 1.2, 2.82, 0xffffcc], ["b", 3.4, 0.15, 0.8, 0, 2.2, -2.6, "A"], ["k", 0.3, 1.6, 0.3, 1.4, 2.4, 2.1, 0xff8a1a, -1.2], ["b", 1.2, 0.5, 1.1, 0, 1.75, 1.8, 0x444444]] },
  { id: "quattro", name: "Rally Quattro", cls: "Rally", desc: "All-wheel drive! Gravel, snow, and mud feel like pavement.",
    spd: 56, acc: 27, hnd: 2.3, wt: 3.5, drift: 1.2, off: 0.8, air: 0.5, boost: 1, bdur: 1, grip: 0.97, terr: { dirt: -0.1, snow: 0.15, ice: 0.6 },
    wheels: { kind: "rally", r: 0.7, pos: [[1.5, 1.8, 1], [-1.5, 1.8, 1], [1.5, -1.7, 0], [-1.5, -1.7, 0]] }, seat: [0, 1.25, -0.5],
    parts: [["b", 3.0, 1.1, 5.2, 0, 1.15, 0, "K"], ["b", 2.6, 0.9, 2.4, 0, 2.1, -0.4, "G"], ["b", 3.1, 0.25, 5.3, 0, 1.1, 0, "A"], ["b", 3.1, 0.12, 0.8, 0, 2.7, -2.3, "K"], ["s", 0.4, 0.4, 0.2, 0.6, 1.4, 2.7, 0xffff88], ["s", 0.4, 0.4, 0.2, -0.6, 1.4, 2.7, 0xffff88], ["s", 0.4, 0.4, 0.2, 0, 1.4, 2.7, 0xffff88], ["b", 1, 1, 0.05, 1.52, 1.3, 0.2, 0xffffff]] },
  { id: "buggy", name: "Dune Buggy", cls: "Offroad", desc: "At home in the sand. Loves to fly and lands softly.",
    spd: 54, acc: 28, hnd: 2.4, wt: 2.5, drift: 1.1, off: 0.9, air: 0.85, boost: 1, bdur: 1, grip: 0.95, terr: { sand: -0.12, dirt: -0.05 },
    wheels: { kind: "knobby", r: 0.95, pos: [[1.7, 1.7, 1], [-1.7, 1.7, 1], [1.8, -1.6, 0], [-1.8, -1.6, 0]] }, seat: [0, 1.45, -0.4],
    parts: [["b", 2.2, 0.5, 3.8, 0, 1.0, 0, "K"], ["c", 0.12, 2.6, 0.12, 1.0, 2.2, -1.0, "C"], ["c", 0.12, 2.6, 0.12, -1.0, 2.2, -1.0, "C"], ["b", 2.2, 0.15, 0.15, 0, 3.4, -1.0, "C"], ["b", 2.2, 0.15, 2.2, 0, 3.4, 0.1, "A"], ["c", 0.12, 2.6, 0.12, 1.0, 2.2, 1.0, "C"], ["c", 0.12, 2.6, 0.12, -1.0, 2.2, 1.0, "C"], ["b", 1.6, 1, 1, 0, 1.6, -2.2, 0x666666], ["s", 0.35, 0.35, 0.2, 0.6, 3.6, 1.2, 0xffff88], ["s", 0.35, 0.35, 0.2, -0.6, 3.6, 1.2, 0xffff88]] },
  { id: "unimog", name: "Monster Unimog", cls: "Monster Truck", desc: "Tires as big as a house. Crushes obstacles flat.",
    spd: 51, acc: 19, hnd: 1.9, wt: 6, drift: 0.85, off: 0.95, air: 0.4, boost: 1, bdur: 1, grip: 0.95, smash: true, terr: { mud: 0.05, rock: 0 },
    wheels: { kind: "monster", r: 1.6, pos: [[2.1, 2.1, 1], [-2.1, 2.1, 1], [2.1, -2.0, 0], [-2.1, -2.0, 0]] }, seat: [0, 2.9, 0.3], scale: 1.05,
    parts: [["b", 3.2, 0.8, 5.8, 0, 2.2, 0, 0x333333], ["b", 3.0, 1.7, 2.2, 0, 3.4, 1.4, "K"], ["b", 2.8, 0.9, 1.5, 0, 4.5, 1.2, "G"], ["b", 3.2, 1.0, 2.8, 0, 3.1, -1.6, "A"], ["b", 3.4, 0.4, 0.4, 0, 2.6, 2.9, "C"], ["s", 0.35, 0.35, 0.2, 0.9, 3.5, 2.55, 0xffff88], ["s", 0.35, 0.35, 0.2, -0.9, 3.5, 2.55, 0xffff88]], open: [0, 4.6, 0.8, 1.7, 1.6] },
  { id: "hover", name: "Hover Kart", cls: "Hover", desc: "Floats over water and mud. Slippery as soap.",
    spd: 56, acc: 25, hnd: 2.35, wt: 2.5, drift: 1.25, off: 0.6, air: 0.95, boost: 1.05, bdur: 1, grip: 0.8, hover: true, terr: { water: -0.08, mud: 0, sand: 0.15, snow: 0.1, ice: 0, grass: 0.1, dirt: 0.1, rock: 0.2 },
    wheels: { kind: "hover", r: 0.7, pos: [[1.4, 1.5, 1], [-1.4, 1.5, 1], [1.4, -1.5, 0], [-1.4, -1.5, 0]] }, seat: [0, 1.4, -0.5],
    parts: [["s", 3.0, 0.9, 5, 0, 1.0, 0, "K"], ["s", 2.4, 0.4, 4.2, 0, 1.4, 0, "A"], ["t", 0.9, 0.14, 0.9, 0, 0.7, -2.3, 0x00f0ff, Math.PI / 2], ["b", 3.6, 0.1, 0.8, 0, 1.6, -2.2, "K"], ["s", 0.35, 0.35, 0.35, 1.4, 1.1, 2.0, 0x00f0ff], ["s", 0.35, 0.35, 0.35, -1.4, 1.1, 2.0, 0x00f0ff]] },
  { id: "boxer", name: "Firebike", cls: "Motorcycle", desc: "A boxer motorcycle. Lightning fast, narrow, and great in the air.",
    spd: 60, acc: 29, hnd: 2.55, wt: 1.5, drift: 1.2, off: 0.4, air: 0.95, boost: 1.05, bdur: 1, grip: 0.92, tiny: true, bike: true,
    wheels: { kind: "thin", r: 0.85, pos: [[0, 1.8, 1], [0, -1.6, 0]] }, seat: [0, 1.6, -0.5],
    parts: [["b", 0.7, 0.8, 2.6, 0, 1.5, 0.1, "K"], ["c", 0.4, 1.1, 0.4, 0.75, 1.0, 0.5, "C", 0, 0, Math.PI / 2], ["c", 0.4, 1.1, 0.4, -0.75, 1.0, 0.5, "C", 0, 0, Math.PI / 2], ["b", 0.9, 0.3, 1.4, 0, 1.95, -0.6, "D"], ["c", 0.06, 1.9, 0.06, 0, 2.2, 1.3, "C", 0, 0, Math.PI / 2], ["s", 0.35, 0.35, 0.2, 0, 1.9, 1.7, 0xffff88]] },
  { id: "beiwagen", name: "Sidecar", cls: "Motorcycle", desc: "A motorcycle with a sidecar. Pulls slightly right. Full of character!",
    spd: 55, acc: 26, hnd: 2.3, wt: 3, drift: 1.3, off: 0.5, air: 0.6, boost: 1, bdur: 1.1, grip: 0.95,
    wheels: { kind: "thin", r: 0.75, pos: [[0.6, 1.6, 1], [0.6, -1.4, 0], [-1.8, -0.2, 0]] }, seat: [0.6, 1.5, -0.4],
    parts: [["b", 0.7, 0.8, 2.6, 0.6, 1.4, 0.1, "K"], ["s", 1.5, 1.0, 2.8, -1.6, 1.0, 0.1, "A"], ["b", 0.8, 0.3, 1.2, 0.6, 1.9, -0.5, "D"], ["s", 0.35, 0.35, 0.2, 0.6, 1.8, 1.5, 0xffff88]] },
  { id: "fass", name: "Barrel Racer", cls: "Oddball", desc: "A rolling oak barrel. Heavy, stubborn, unstoppable.",
    spd: 54, acc: 23, hnd: 2.1, wt: 5, drift: 1, off: 0.5, air: 0.35, boost: 1, bdur: 1.1, grip: 1,
    wheels: { kind: "wood", r: 0.8, pos: [[1.7, 1.6, 1], [-1.7, 1.6, 1], [1.7, -1.6, 0], [-1.7, -1.6, 0]] }, seat: [0, 2.0, -0.4],
    parts: [["c", 1.6, 4.6, 1.6, 0, 1.6, 0, 0x9a6a3a, Math.PI / 2], ["t", 1.62, 0.12, 1.62, 0, 1.6, 1.4, 0x555555], ["t", 1.62, 0.12, 1.62, 0, 1.6, -1.4, 0x555555], ["t", 1.68, 0.12, 1.68, 0, 1.6, 0, 0x555555], ["c", 0.3, 0.6, 0.3, 0, 1.6, 2.5, "C", Math.PI / 2], ["b", 1.6, 0.4, 1.6, 0, 2.9, -0.4, "K"]] },
  { id: "kuckuck", name: "Cuckoo Clock Car", cls: "Oddball", desc: "A Black Forest cuckoo clock on wheels. Cuckoo! Cuckoo!",
    spd: 53, acc: 27, hnd: 2.4, wt: 3, drift: 1.05, off: 0.45, air: 0.5, boost: 1, bdur: 1, grip: 1, cuckoo: true,
    wheels: { kind: "wood", r: 0.65, pos: [[1.5, 1.5, 1], [-1.5, 1.5, 1], [1.5, -1.5, 0], [-1.5, -1.5, 0]] }, seat: [0, 1.3, -0.6],
    parts: [["b", 3, 0.6, 4.4, 0, 0.9, 0, 0x7a4a24], ["b", 2.6, 2.4, 1.4, 0, 2.2, -1.8, 0x9a6a3a], ["k", 2.4, 1.6, 1.8, 0, 4.2, -1.8, 0x5a3a1a, 0, Math.PI / 4], ["c", 0.6, 0.15, 0.6, 0, 2.6, -1.05, 0xf5f0e0, Math.PI / 2], ["b", 0.4, 0.4, 0.4, 0, 3.5, -1.05, 0xffd23f], ["b", 0.2, 1.2, 0.1, 0.6, 1.5, -1.05, 0x6a4a2a], ["k", 0.3, 0.6, 0.3, 0.6, 0.8, -1.05, 0xd4af37, Math.PI]] },
  { id: "dampf", name: "Steam Locomotive", cls: "Rail", desc: "A mini steam engine. Unbeatable on rails, leisurely acceleration.",
    spd: 58, acc: 20, hnd: 2.0, wt: 5, drift: 0.9, off: 0.4, air: 0.3, boost: 1.1, bdur: 1.2, grip: 1, rail: true, smoke: true,
    wheels: { kind: "red", r: 0.8, pos: [[1.4, 1.8, 1], [-1.4, 1.8, 1], [1.4, 0, 0], [-1.4, 0, 0], [1.4, -1.8, 0], [-1.4, -1.8, 0]] }, seat: [0, 1.6, -1.8],
    parts: [["c", 1.2, 3.6, 1.2, 0, 1.9, 0.9, 0x222222, Math.PI / 2], ["c", 0.4, 1.5, 0.4, 0, 3.5, 2.0, 0x222222], ["k", 0.7, 0.5, 0.7, 0, 4.3, 2.0, 0x222222, Math.PI], ["b", 2.6, 0.5, 5.4, 0, 0.9, 0, "K"], ["b", 2.4, 1.8, 1.4, 0, 2.2, -1.9, "A"], ["k", 1.6, 1.2, 0.6, 0, 0.9, 3.0, "K", Math.PI / 2, 0, 0], ["s", 0.45, 0.45, 0.2, 0, 2.2, 2.75, 0xffff88]] },
  { id: "ice", name: "Bullet Train", cls: "Rail", desc: "A 186 mph power car. Handles like a freight train. On time? Never.",
    spd: 63, acc: 21, hnd: 1.85, wt: 5, drift: 0.85, off: 0.15, air: 0.3, boost: 1.1, bdur: 1.1, grip: 0.96, rail: true, terr: { dirt: 1.2, grass: 1.2 },
    wheels: { kind: "hidden", r: 0.6, pos: [[1.3, 1.6, 1], [-1.3, 1.6, 1], [1.3, -1.8, 0], [-1.3, -1.8, 0]] }, seat: [0, 1.5, -0.6],
    parts: [["b", 2.9, 1.8, 4.2, 0, 1.6, -0.8, 0xf4f4f4], ["s", 2.9, 1.8, 3.8, 0, 1.5, 1.3, 0xf4f4f4], ["b", 2.95, 0.4, 4.2, 0, 1.1, -0.8, 0xdd0000], ["s", 2.3, 0.9, 2.0, 0, 2.1, 1.8, 0x223344], ["s", 0.4, 0.3, 0.1, 0.8, 1.3, 3.1, 0xffffcc], ["s", 0.4, 0.3, 0.1, -0.8, 1.3, 3.1, 0xffffcc]], open: [0, 2.5, -0.9, 1.6, 1.4] },
  { id: "bagger", name: "Excavator", cls: "Construction", desc: "A tracked digger with a bucket. Mud? Snow? Obstacles? Gone.",
    spd: 49, acc: 20, hnd: 2.1, wt: 6, drift: 0.8, off: 0.85, air: 0.25, boost: 1, bdur: 1, grip: 1.05, smash: true, tracks: true, terr: { mud: 0.1, snow: 0.15, ice: 0.3, sand: 0.3 },
    wheels: { kind: "tracks", r: 0.8, pos: [[1.6, 0, 1], [-1.6, 0, 1]] }, seat: [0.4, 1.9, -0.4],
    parts: [["b", 3.0, 1.0, 3.4, 0, 2.0, -0.4, 0xffb000], ["b", 1.5, 1.8, 1.6, 0.5, 3.2, -0.2, "G"], ["b", 1.3, 1.3, 1.6, -0.7, 2.9, -1.2, 0xffb000], ["b", 0.5, 0.5, 3.2, -0.7, 2.9, 1.4, 0xffb000, -0.5], ["b", 1.8, 1.2, 1.0, -0.7, 1.6, 3.0, 0x666666]] },
  { id: "walze", name: "Road Roller", cls: "Construction", desc: "Flattens everything. Really everything. Slow but relentless.",
    spd: 50, acc: 18, hnd: 2.0, wt: 6, drift: 0.8, off: 0.5, air: 0.2, boost: 1, bdur: 1.1, grip: 1.05, smash: true, roller: true,
    wheels: { kind: "drum", r: 1.1, pos: [[0, 2.0, 1], [1.5, -1.6, 0], [-1.5, -1.6, 0]] }, seat: [0, 2.3, -0.8],
    parts: [["b", 2.6, 1.2, 3.6, 0, 1.8, -0.6, 0xffcc00], ["b", 3.2, 0.3, 1.4, 0, 3.4, 2.0, 0xffcc00], ["c", 0.08, 2.2, 0.08, 1.2, 4.6, -0.8, "D"], ["c", 0.08, 2.2, 0.08, -1.2, 4.6, -0.8, "D"], ["b", 2.8, 0.15, 2.6, 0, 5.7, -0.8, "K"], ["b", 2.8, 0.6, 0.6, 0, 3.0, 2.0, "K"]] },
  { id: "traktor", name: "Tractor", cls: "Agriculture", desc: "Fendt power. A force on grass and in mud.",
    spd: 51, acc: 23, hnd: 2.15, wt: 4.5, drift: 0.9, off: 0.85, air: 0.35, boost: 1, bdur: 1, grip: 1, terr: { grass: -0.1, mud: 0.05, dirt: 0 },
    wheels: { kind: "tractor", r: 1.5, pos: [[1.5, 1.9, 1], [-1.5, 1.9, 1], [1.7, -1.3, 0], [-1.7, -1.3, 0]], front: 0.6 }, seat: [0, 2.6, -1.0],
    parts: [["b", 1.8, 1.4, 3.6, 0, 1.9, 1.0, 0x2a8a3a], ["b", 2.4, 2.4, 1.8, 0, 3.4, -1.0, "G"], ["b", 2.6, 0.2, 2.2, 0, 4.7, -1.0, 0x2a8a3a], ["c", 0.18, 1.5, 0.18, 0.6, 3.4, 2.2, 0x333333], ["b", 1.9, 0.4, 0.2, 0, 2.1, 2.85, 0x222222]] },
  { id: "bully", name: "Snow Groomer", cls: "Snow", desc: "A tracked glacier vehicle. Snow and ice? No problem!",
    spd: 52, acc: 22, hnd: 2.15, wt: 5, drift: 0.85, off: 0.75, air: 0.3, boost: 1, bdur: 1, grip: 1.05, tracks: true, terr: { snow: -0.12, ice: 0.05, mud: 0.4, sand: 0.4 },
    wheels: { kind: "tracks", r: 0.8, pos: [[1.6, 0, 1], [-1.6, 0, 1]] }, seat: [0, 2.2, 0.2],
    parts: [["b", 2.8, 1.6, 3.2, 0, 2.2, 0.0, 0xdd2222], ["b", 2.6, 1.2, 1.8, 0, 3.4, 0.6, "G"], ["b", 4.2, 1.4, 0.4, 0, 1.4, 3.0, 0xcccccc, -0.3], ["b", 2.2, 0.4, 1.0, 0, 1.2, -2.6, 0x666666], ["s", 0.4, 0.4, 0.2, 0.9, 4.1, 1.5, 0xffaa00]] },
  { id: "zeppelin", name: "Zeppelin Gondola", cls: "Airship", desc: "A mini zeppelin. Glides forever, but is slow on the ground.",
    spd: 52, acc: 24, hnd: 2.3, wt: 2, drift: 1, off: 0.6, air: 1.0, boost: 1, bdur: 1, grip: 0.9, hover: true, glide: true, terr: { water: 0, mud: 0, sand: 0.2 },
    wheels: { kind: "hover", r: 0.55, pos: [[1.0, 1.4, 1], [-1.0, 1.4, 1], [1.0, -1.4, 0], [-1.0, -1.4, 0]] }, seat: [0, 1.1, 0.2],
    parts: [["s", 3.6, 3.6, 8.5, 0, 6.6, -0.3, 0xd8d0c0], ["b", 2.2, 0.6, 4, 0, 1.0, 0, "K"], ["b", 0.15, 2.0, 1.6, 0, 7.2, -4.4, "A"], ["b", 2.2, 0.15, 1.6, 0, 6.6, -4.4, "A"], ["c", 0.08, 4.4, 0.08, 1.0, 3.6, 0, "D"], ["c", 0.08, 4.4, 0.08, -1.0, 3.6, 0, "D"], ["b", 3.65, 0.5, 2, 0, 6.6, 1.5, 0xdd0000]] },
  { id: "rak", name: "Rocket Opel", cls: "Experimental", desc: "RAK2, 1928. Solid-fuel rockets in back. Brutal boosts. Steering is optional.",
    spd: 58, acc: 22, hnd: 1.8, wt: 3, drift: 0.9, off: 0.2, air: 0.4, boost: 1.28, bdur: 1.45, grip: 0.9, rocket: true,
    wheels: { kind: "spoke", r: 0.8, pos: [[1.4, 1.9, 1], [-1.4, 1.9, 1], [1.4, -1.6, 0], [-1.4, -1.6, 0]] }, seat: [0, 1.25, -0.5],
    parts: [["c", 0.9, 5.4, 0.9, 0, 1.3, 0, "K", Math.PI / 2], ["k", 0.9, 1.2, 0.9, 0, 1.3, 3.2, "K", Math.PI / 2], ["b", 4.6, 0.12, 1.2, 0, 1.4, 0.3, "A"], ["c", 0.35, 1.4, 0.35, 0.4, 1.6, -3.0, 0x444444, Math.PI / 2], ["c", 0.35, 1.4, 0.35, -0.4, 1.6, -3.0, 0x444444, Math.PI / 2], ["c", 0.35, 1.4, 0.35, 0, 1.0, -3.0, 0x444444, Math.PI / 2], ["c", 0.35, 1.4, 0.35, 0, 2.1, -3.0, 0x444444, Math.PI / 2]] },
  { id: "flunder", name: "911 Flatfish", cls: "Sports Car", desc: "Low, wide, rear-engine. King of the highway, nightmare in a field.",
    spd: 62, acc: 25, hnd: 2.3, wt: 3, drift: 1.05, off: 0.0, air: 0.4, boost: 1.05, bdur: 1, grip: 1.05, terr: { dirt: 1.4, grass: 1.4, sand: 1.5, mud: 1.3, snow: 1.3 },
    wheels: { kind: "fat", r: 0.65, pos: [[1.5, 1.7, 1], [-1.5, 1.7, 1], [1.6, -1.6, 0], [-1.6, -1.6, 0]] }, seat: [0, 0.95, -0.4],
    parts: [["s", 3.2, 1.2, 5.6, 0, 0.9, 0, "K"], ["s", 2.4, 1.0, 2.6, 0, 1.5, -0.5, "G"], ["s", 0.55, 0.4, 0.2, 0.95, 1.0, 2.6, 0xffffcc], ["s", 0.55, 0.4, 0.2, -0.95, 1.0, 2.6, 0xffffcc], ["b", 3.0, 0.12, 0.7, 0, 1.8, -2.6, "A"], ["b", 3.0, 0.2, 0.3, 0, 0.9, -2.9, 0xdd0000]], open: [0, 1.7, -0.5, 1.6, 1.4] },
  { id: "stapler", name: "Forklift", cls: "Construction", desc: "Rear-wheel steering spins on a dime. Slow, but loves a corner!",
    spd: 48, acc: 30, hnd: 3.1, wt: 4, drift: 1.2, off: 0.5, air: 0.3, boost: 1, bdur: 1, grip: 1.1, smash: true,
    wheels: { kind: "std", r: 0.65, pos: [[1.2, 1.3, 0], [-1.2, 1.3, 0], [1.1, -1.3, 1], [-1.1, -1.3, 1]] }, seat: [0, 1.5, -0.3],
    parts: [["b", 2.4, 1.2, 3.6, 0, 1.2, 0, 0xffb000], ["b", 2.2, 1.6, 1.4, 0, 1.6, -1.8, 0x555555], ["c", 0.08, 3, 0.08, 1.0, 3.0, 0.5, "D"], ["c", 0.08, 3, 0.08, -1.0, 3.0, 0.5, "D"], ["b", 2.2, 0.15, 2.2, 0, 4.5, -0.2, 0xffb000], ["b", 0.25, 4, 0.25, 0.7, 2.4, 2.0, 0x444444], ["b", 0.25, 4, 0.25, -0.7, 2.4, 2.0, 0x444444], ["b", 0.3, 0.15, 2.0, 0.6, 0.6, 2.9, 0x888888], ["b", 0.3, 0.15, 2.0, -0.6, 0.6, 2.9, 0x888888], ["b", 1.6, 0.8, 1.6, 0, 1.2, 3.0, 0xb07a3a]] },
  { id: "camper", name: "Microbus Camper", cls: "Heavyweight", desc: "A classic T1 microbus. Soft as a sofa and built to take hits.",
    spd: 53, acc: 21, hnd: 2.0, wt: 5, drift: 0.95, off: 0.45, air: 0.3, boost: 1, bdur: 1.15, grip: 0.98, sturdy: true,
    wheels: { kind: "std", r: 0.7, pos: [[1.5, 1.9, 1], [-1.5, 1.9, 1], [1.5, -1.9, 0], [-1.5, -1.9, 0]] }, seat: [0, 1.6, 0.9],
    parts: [["b", 3.0, 1.6, 5.4, 0, 1.6, 0, "K"], ["b", 3.0, 1.4, 5.4, 0, 3.1, 0, 0xf5f5f5], ["b", 3.05, 0.9, 1.0, 0, 3.0, 2.3, "G"], ["k", 1.0, 0.6, 0.1, 0, 2.0, 2.72, 0xf5f5f5, Math.PI / 2, 0, Math.PI], ["s", 0.45, 0.45, 0.2, 0.9, 1.6, 2.72, 0xffffcc], ["s", 0.45, 0.45, 0.2, -0.9, 1.6, 2.72, 0xffffcc], ["b", 2.8, 0.3, 3, 0, 3.95, -0.6, 0x9a6a3a]], open: [0, 3.0, 1.0, 1.7, 1.6] },
  { id: "drescher", name: "Combine Harvester", cls: "Agriculture", desc: "A beast with a cutting header. Mows grass, hay bales, and rivals.",
    spd: 50, acc: 19, hnd: 1.95, wt: 6, drift: 0.8, off: 0.8, air: 0.2, boost: 1, bdur: 1, grip: 1, smash: true, terr: { grass: -0.12, hay: -0.12, mud: 0.15 },
    wheels: { kind: "tractor", r: 1.4, pos: [[1.8, 1.3, 1], [-1.8, 1.3, 1], [1.5, -2.0, 0], [-1.5, -2.0, 0]] }, seat: [0, 3.2, 0.6], scale: 1.05,
    parts: [["b", 3.0, 2.6, 5, 0, 2.6, -0.6, 0x2a8a3a], ["b", 2.2, 1.8, 1.8, 0, 4.4, 0.8, "G"], ["b", 5.4, 1.0, 1.4, 0, 1.0, 3.0, 0xdddd22], ["c", 0.6, 5.2, 0.6, 0, 1.2, 3.3, 0x888888, 0, 0, Math.PI / 2], ["c", 0.3, 4, 0.3, -1.8, 4.0, -1, 0x2a8a3a, 0, 0, 1.0]] },
  { id: "spielzeug", name: "Wooden Toy", cls: "Lightweight", desc: "A wooden car from the Ore Mountains. Featherlight and wildly bouncy.",
    spd: 51, acc: 38, hnd: 2.6, wt: 1, drift: 1.2, off: 0.4, air: 0.9, boost: 1.05, bdur: 1, grip: 1, tiny: true, bouncy: true,
    wheels: { kind: "wood", r: 0.7, pos: [[1.2, 1.2, 1], [-1.2, 1.2, 1], [1.2, -1.2, 0], [-1.2, -1.2, 0]] }, seat: [0, 1.4, -0.4], scale: 0.9,
    parts: [["b", 2.2, 1.0, 3.6, 0, 1.0, 0, 0xe8b070], ["b", 1.8, 0.9, 1.6, 0, 1.95, -0.3, "K"], ["s", 0.5, 0.5, 0.5, 0, 1.4, 1.9, 0xff3b3b], ["c", 0.1, 1.2, 0.1, 0, 0.8, -2.2, 0x888888, Math.PI / 2]] },
  { id: "transrapid", name: "Maglev", cls: "Experimental", desc: "A Transrapid pod. Rockets on metal and pavement, lost in the dirt.",
    spd: 62, acc: 26, hnd: 2.2, wt: 3, drift: 1.1, off: 0.1, air: 0.6, boost: 1.1, bdur: 1, grip: 0.92, hover: true, rail: true, maglev: true, terr: { dirt: 1.2, grass: 1.3, sand: 1.4, mud: 0.6, water: 0.2 },
    wheels: { kind: "hover", r: 0.6, pos: [[1.3, 1.8, 1], [-1.3, 1.8, 1], [1.3, -1.8, 0], [-1.3, -1.8, 0]] }, seat: [0, 1.4, -0.3],
    parts: [["s", 3.0, 1.6, 6.4, 0, 1.4, 0, 0xf0f0f0], ["b", 3.05, 0.35, 5, 0, 1.0, -0.3, "K"], ["s", 2.2, 0.8, 2.4, 0, 2.0, 1.4, 0x1a2a4a], ["b", 3.2, 0.3, 6, 0, 0.5, 0, 0x555555], ["s", 0.5, 0.2, 0.1, 0, 1.2, 3.2, 0x00f0ff]], open: [0, 2.2, -0.6, 1.6, 1.4] },
  { id: "einkauf", name: "Shopping Cart", cls: "Oddball", desc: "Borrowed from the grocery store. Drifts wildly. Everyone loves it.",
    spd: 52, acc: 31, hnd: 2.5, wt: 1.5, drift: 1.45, off: 0.3, air: 0.6, boost: 1, bdur: 1, grip: 0.88, tiny: true,
    wheels: { kind: "caster", r: 0.4, pos: [[1.0, 1.4, 1], [-1.0, 1.4, 1], [1.0, -1.4, 1], [-1.0, -1.4, 1]] }, seat: [0, 1.4, -0.2],
    parts: [["b", 2.2, 0.08, 3.4, 0, 1.0, 0, "C"], ["b", 0.08, 1.6, 3.4, 1.1, 1.8, 0, "C"], ["b", 0.08, 1.6, 3.4, -1.1, 1.8, 0, "C"], ["b", 2.2, 1.6, 0.08, 0, 1.8, 1.7, "C"], ["b", 2.2, 0.15, 0.15, 0, 2.9, -2.0, "K"], ["b", 0.6, 0.6, 0.6, 0.5, 1.4, 1.0, 0xffd23f], ["b", 0.6, 0.8, 0.5, -0.5, 1.5, 1.1, 0xff3b3b]] },
  { id: "wanne", name: "Bathtub", cls: "Amphibious", desc: "An enamel tub with an outboard motor. Faster on water than land.",
    spd: 52, acc: 25, hnd: 2.3, wt: 3, drift: 1.1, off: 0.5, air: 0.5, boost: 1, bdur: 1, grip: 0.95, amph: true, terr: { water: -0.15, mud: 0.2 },
    wheels: { kind: "std", r: 0.5, pos: [[1.2, 1.4, 1], [-1.2, 1.4, 1], [1.2, -1.4, 0], [-1.2, -1.4, 0]] }, seat: [0, 1.0, -0.4],
    parts: [["s", 2.6, 1.6, 4.4, 0, 1.4, 0, 0xffffff], ["s", 2.2, 0.3, 4, 0, 2.1, 0, 0x9fe3ff], ["c", 0.15, 1.2, 0.15, 0.6, 2.6, 1.6, "C"], ["b", 0.5, 1.2, 0.5, 0, 1.4, -2.4, "K"], ["s", 0.6, 0.5, 0.6, 0.6, 2.4, 1.0, 0xffd23f]] },
  { id: "kettcar", name: "Pedal Kart Turbo", cls: "Lightweight", desc: "A childhood pedal kart, now with an afterburner. A drifting machine.",
    spd: 54, acc: 33, hnd: 2.55, wt: 1.5, drift: 1.35, off: 0.3, air: 0.6, boost: 1.08, bdur: 1.1, grip: 1, tiny: true,
    wheels: { kind: "std", r: 0.55, pos: [[1.3, 1.5, 1], [-1.3, 1.5, 1], [1.3, -1.3, 0], [-1.3, -1.3, 0]] }, seat: [0, 1.1, -0.5],
    parts: [["b", 0.5, 0.4, 4.2, 0, 0.75, 0.1, "K"], ["b", 2.6, 0.25, 0.3, 0, 0.75, 1.5, "K"], ["b", 2.6, 0.25, 0.3, 0, 0.75, -1.3, "K"], ["b", 1.2, 0.9, 0.2, 0, 1.4, -1.1, "A"], ["c", 0.25, 0.8, 0.25, 0, 0.9, -2.2, 0x444444, Math.PI / 2]] },
  { id: "vmax", name: "Velocity X", cls: "Top Speed", desc: "The highest top speed by far, with a little more launch and steering.",
    spd: 100, acc: 11, hnd: 0.9, wt: 0, drift: 0, off: 0, air: 0, boost: 0, bdur: 0, grip: 0,
    wheels: { kind: "spoke", r: 0.62, pos: [[1.35, 1.7, 1], [-1.35, 1.7, 1], [1.35, -1.7, 0], [-1.35, -1.7, 0]] }, seat: [0, 1.05, -0.55],
    parts: [["b", 2.2, 0.45, 5.2, 0, 0.72, 0, "K"], ["k", 0.85, 0.7, 1.25, 0, 0.8, 3.0, "A", Math.PI / 2], ["c", 0.72, 2.6, 0.72, 0.8, 0.8, -2.4, 0x444444, Math.PI / 2], ["c", 0.72, 2.6, 0.72, -0.8, 0.8, -2.4, 0x444444, Math.PI / 2], ["b", 2.5, 0.12, 0.35, 0, 1.3, -2.95, "A"]] },
  { id: "rasenmaeher", name: "Lawn Mower", cls: "Garden Kart", desc: "Maximum handling, traction, and off-road grip. Slow, but sure-footed everywhere.",
    spd: 42, acc: 0, hnd: 5.4, wt: 0, drift: 0, off: 1, air: 0, boost: 0, bdur: 0, grip: 1.2,
    wheels: { kind: "tractor", r: 0.55, pos: [[1.35, 1.4, 1], [-1.35, 1.4, 1], [1.35, -1.35, 0], [-1.35, -1.35, 0]], front: 0.8 }, seat: [0, 1.55, -0.55],
    parts: [["b", 2.8, 0.5, 3.4, 0, 0.72, 0.45, 0xd52c28], ["b", 2.1, 0.7, 1.45, 0, 1.25, -0.25, 0xffd34e], ["c", 0.5, 0.7, 0.5, 0, 1.65, -0.15, 0x555555], ["c", 0.1, 2.35, 0.1, 0.85, 2.15, -1.65, 0x333333], ["c", 0.1, 2.35, 0.1, -0.85, 2.15, -1.65, 0x333333], ["b", 1.9, 0.14, 0.14, 0, 3.25, -1.65, 0x333333], ["b", 2.0, 0.12, 0.6, 0, 0.48, 1.35, 0x888888]] },
];
export const VEH = Object.fromEntries(VEHICLES.map(v => [v.id, v]));

// terrain penalty multiplier for vehicle on surface class (0 = no loss, 1 = full base loss, negative = faster)
export function terrMul(v, cls) {
  if (cls === "road") return 0;
  if (v.terr && v.terr[cls] !== undefined) return v.terr[cls];
  if (cls === "ice") return 1;
  return 1 - v.off * 0.85;
}
export function gripMul(v, cls) {
  if (cls === "road") return 1;
  if (cls === "ice") return v.tracks ? 0.85 : v.hover ? 0.6 : 0.25 + v.off * 0.2;
  const base = { dirt: 0.82, grass: 0.8, sand: 0.68, mud: 0.6, snow: 0.62, water: 0.72, rock: 0.85 }[cls] || 0.8;
  if (v.hover) return 0.78;
  return base + (1 - base) * v.off * 0.75;
}

// --------------- model ---------------
const Lm = (c, o) => new THREE.MeshLambertMaterial({ color: c, ...o });
const matCache = {};
function mat(c, look) {
  let col = c;
  if (c === "K") col = look.kart; else if (c === "A") col = look.acc2; else if (c === "D") col = 0x222222; else if (c === "C") col = 0xd0d4da;
  const key = c === "G" ? "G" : String(col);
  if (matCache[key]) return matCache[key];
  return (matCache[key] = c === "G" ? Lm(0x9fd8ff, { transparent: true, opacity: 0.55 }) : Lm(col, c === "C" ? { emissive: 0x333333 } : undefined));
}
const geos = { b: new THREE.BoxGeometry(1, 1, 1), c: new THREE.CylinderGeometry(1, 1, 1, 14), s: new THREE.SphereGeometry(0.5, 14, 10), k: new THREE.ConeGeometry(1, 1, 12), t: new THREE.TorusGeometry(1, 1, 6, 18) };
export function buildVehicle(v, look) {
  const body = new THREE.Group();
  for (const p of v.parts) {
    const [ty, sx, sy, sz, x, y, z, c, rx = 0, ry = 0, rz = 0] = p;
    let m;
    if (ty === "t") { m = new THREE.Mesh(new THREE.TorusGeometry(sx, sy, 6, 18), mat(c, look)); }
    else { m = new THREE.Mesh(geos[ty], mat(c, look)); if (ty === "c") m.scale.set(sx, sy, sz); else if (ty === "k") m.scale.set(sx, sy, sz); else m.scale.set(sx, sy, sz); }
    m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
    body.add(m);
  }
  // wheels
  const W = v.wheels, wheels = [];
  const r = W.r;
  for (const [x, z, front] of W.pos) {
    const piv = new THREE.Group(); piv.position.set(x, W.kind === "tracks" ? 0.8 : r, z);
    let w;
    switch (W.kind) {
      case "tracks": { w = new THREE.Group(); const tr = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.5, 5), Lm(0x222222)); w.add(tr); for (let k = -2; k <= 2; k++) { const rw = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.95, 10), Lm(0x555555)); rw.rotation.z = Math.PI / 2; rw.position.z = k * 1.1; w.add(rw); } w.isTrack = true; break; }
      case "hover": { const g = new THREE.CylinderGeometry(r, r * 1.2, 0.3, 16); w = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.85 })); w.isHover = true; piv.position.y = 0.45; break; }
      case "hidden": w = new THREE.Group(); break;
      default: {
        const wd = W.kind === "fat" ? 0.9 : W.kind === "thin" ? 0.3 : W.kind === "monster" ? 1.4 : W.kind === "tractor" ? (front ? 0.6 : 1.0) : W.kind === "drum" ? (front ? 3.0 : 0.8) : W.kind === "caster" ? 0.25 : 0.6;
        const rr = W.kind === "tractor" && front ? r * (W.front || 0.6) : r;
        if (W.kind === "tractor" && front) piv.position.y = rr;
        const g = new THREE.CylinderGeometry(rr, rr, wd, W.kind === "drum" ? 18 : 14); g.rotateZ(Math.PI / 2);
        const col = W.kind === "wood" ? 0x8a5a2a : W.kind === "drum" ? 0x888888 : W.kind === "red" ? 0xcc2222 : 0x1a1a1a;
        w = new THREE.Mesh(g, Lm(col));
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.45, rr * 0.45, wd + 0.04, 8), Lm(W.kind === "red" ? 0x222222 : W.kind === "rally" ? 0xffffff : 0xdddddd)); hub.rotation.z = Math.PI / 2; w.add(hub);
        if (W.kind === "monster" || W.kind === "knobby" || W.kind === "tractor") for (let k = 0; k < 10; k++) { const kn = new THREE.Mesh(new THREE.BoxGeometry(wd + 0.06, 0.25, 0.35), Lm(0x111111)); const a = k / 10 * Math.PI * 2; kn.position.set(0, Math.cos(a) * rr, Math.sin(a) * rr); kn.rotation.x = -a; w.add(kn); }
        if (W.kind === "spoke") for (let k = 0; k < 6; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.1, rr * 1.8, 0.06), Lm(0xdddddd)); sp.rotation.x = k * Math.PI / 6; w.add(sp); }
      }
    }
    piv.add(w); body.add(piv); wheels.push({ piv, w, front: !!front, r });
  }
  return { body, wheels, seat: v.seat, scale: v.scale || 1, open: v.open };
}
