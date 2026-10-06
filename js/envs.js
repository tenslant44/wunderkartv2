import * as THREE from "three";
// ================= SURFACES =================
// cls drives physics; tex drives visuals
export const SURF = {
  asphalt: { cls: "road", c: "#4a4c52" }, cobble: { cls: "road", c: "#7a7068" }, concrete: { cls: "road", c: "#9a9a96" },
  tile: { cls: "road", c: "#d8d2c4" }, wood: { cls: "road", c: "#9a6a3a" }, metal: { cls: "road", c: "#8a9098", metal: true },
  carpet: { cls: "road", c: "#a83040" }, glass: { cls: "road", c: "#9fe6ff" }, glow: { cls: "road", c: "#3a1a6a" },
  rail: { cls: "road", c: "#b8bcc4", metal: true }, coaster: { cls: "road", c: "#c03030", metal: true }, candy: { cls: "road", c: "#ff8ad0" },
  stone: { cls: "road", c: "#8c8678" }, runway: { cls: "road", c: "#3c3e42" },
  dirt: { cls: "dirt", c: "#8a6238" }, gravel: { cls: "dirt", c: "#9c9080" }, construction: { cls: "dirt", c: "#b0884a" },
  mud: { cls: "mud", c: "#5a3e22" }, grass: { cls: "grass", c: "#4f9a3a" }, hay: { cls: "grass", c: "#d8b850" },
  sand: { cls: "sand", c: "#e8d090" }, snow: { cls: "snow", c: "#f2f6fa" }, ice: { cls: "ice", c: "#bfe8ff" },
  water: { cls: "water", c: "#3a9ad8" }, rock: { cls: "rock", c: "#7a7470" }, lava: { cls: "rock", c: "#ff5a1a" },
};
// base physics per class: pen = top speed loss, grip = steering grip, bump = shake
export const CLS = {
  road: { pen: 0, grip: 1, bump: 0 }, dirt: { pen: 0.2, grip: 0.82, bump: 0.15, dust: 0xb08850 }, grass: { pen: 0.28, grip: 0.8, bump: 0.1, dust: 0x5aa040 },
  sand: { pen: 0.38, grip: 0.68, bump: 0.1, dust: 0xf0dca0 }, mud: { pen: 0.5, grip: 0.58, bump: 0.2, dust: 0x5a3e22 }, snow: { pen: 0.32, grip: 0.62, bump: 0.05, dust: 0xffffff },
  ice: { pen: 0.04, grip: 0.22, bump: 0, dust: 0xdff4ff }, water: { pen: 0.38, grip: 0.7, bump: 0.05, dust: 0x9fd8ff }, rock: { pen: 0.32, grip: 0.85, bump: 0.45, dust: 0x9a948c },
};

// ================= TEXTURES =================
const texCache = {};
function canvasTex(key, w, h, draw, rep = true) {
  if (texCache[key]) return texCache[key];
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return (texCache[key] = t);
}
const speck = (g, w, h, n, cols, s0 = 1, s1 = 3) => { for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; const s = s0 + Math.random() * (s1 - s0); g.fillRect(Math.random() * w, Math.random() * h, s, s); } };
const shade = (hex, f) => { const c = new THREE.Color(hex); c.multiplyScalar(f); return "#" + c.getHexString(); };
export function surfTex(name) {
  const S = SURF[name] || SURF.asphalt, base = S.c;
  return canvasTex("s_" + name, 128, 128, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    switch (name) {
      case "asphalt": case "runway": speck(g, w, h, 900, [shade(base, 0.8), shade(base, 1.25)]); g.fillStyle = name === "runway" ? "#fff" : "#f2f2f2"; for (let y = 0; y < h; y += 64) g.fillRect(w / 2 - 2, y, 4, 34); g.fillStyle = "#ddd"; g.fillRect(3, 0, 3, h); g.fillRect(w - 6, 0, 3, h); break;
      case "cobble": case "stone": for (let y = 0; y < h; y += 16) for (let x = (y / 16) % 2 ? 8 : 0; x < w; x += 16) { g.fillStyle = shade(base, 0.75 + Math.random() * 0.5); g.beginPath(); g.roundRect ? g.roundRect(x + 1, y + 1, 14, 14, 4) : g.rect(x + 1, y + 1, 14, 14); g.fill(); } break;
      case "concrete": speck(g, w, h, 500, [shade(base, 0.85), shade(base, 1.1)]); g.strokeStyle = shade(base, 0.7); g.lineWidth = 2; g.strokeRect(0, 0, w, h); g.fillStyle = "#e8c020"; g.fillRect(w / 2 - 3, 0, 6, h); break;
      case "tile": for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 32) { g.fillStyle = ((x + y) / 32) % 2 ? base : shade(base, 0.82); g.fillRect(x, y, 32, 32); } break;
      case "wood": for (let x = 0; x < w; x += 16) { g.fillStyle = shade(base, 0.8 + Math.random() * 0.4); g.fillRect(x, 0, 15, h); g.fillStyle = shade(base, 0.6); g.fillRect(x, (x * 7) % h, 15, 2); } break;
      case "metal": case "rail": for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 8) { g.fillStyle = shade(base, (x + y) % 16 ? 0.9 : 1.15); g.fillRect(x, y, 6, 2); } break;
      case "coaster": g.fillStyle = "#888"; for (let y = 0; y < h; y += 16) g.fillRect(0, y, w, 5); g.fillStyle = "#ffe000"; g.fillRect(0, 0, 8, h); g.fillRect(w - 8, 0, 8, h); break;
      case "carpet": g.fillStyle = "#e8c050"; g.fillRect(8, 0, 6, h); g.fillRect(w - 14, 0, 6, h); for (let y = 0; y < h; y += 32) { g.beginPath(); g.arc(w / 2, y + 16, 10, 0, 7); g.fill(); } break;
      case "glass": g.fillStyle = "rgba(255,255,255,.5)"; for (let y = 0; y < h; y += 32) g.fillRect(0, y, w, 2); g.fillRect(w / 2, 0, 2, h); g.fillStyle = "#00e5ff"; g.fillRect(0, 0, 6, h); g.fillRect(w - 6, 0, 6, h); break;
      case "glow": g.fillStyle = "#ff3bd0"; g.fillRect(0, 0, 8, h); g.fillRect(w - 8, 0, 8, h); g.fillStyle = "#00f0ff"; for (let y = 0; y < h; y += 32) g.fillRect(0, y, w, 4); break;
      case "candy": for (let y = 0; y < h; y += 32) { g.fillStyle = "#ffffff"; g.fillRect(0, y, w, 12); } break;
      case "dirt": case "construction": speck(g, w, h, 700, [shade(base, 0.7), shade(base, 1.2), shade(base, 0.9)], 1, 5); g.fillStyle = shade(base, 0.72); g.fillRect(w * 0.25, 0, 10, h); g.fillRect(w * 0.7, 0, 10, h); break;
      case "gravel": speck(g, w, h, 1500, ["#bbb", "#777", "#a89a88", "#ddd"], 1, 4); break;
      case "mud": speck(g, w, h, 300, [shade(base, 0.6), shade(base, 1.3)], 3, 10); g.fillStyle = "rgba(255,255,255,.12)"; for (let i = 0; i < 12; i++) { g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 10, 5, 0, 0, 7); g.fill(); } break;
      case "grass": case "hay": speck(g, w, h, 1400, [shade(base, 0.75), shade(base, 1.25), shade(base, 0.9)], 1, 4); break;
      case "sand": speck(g, w, h, 900, [shade(base, 0.85), shade(base, 1.08)], 1, 3); g.strokeStyle = shade(base, 0.85); for (let y = 0; y < h; y += 14) { g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(40, y + 6, 80, y - 6, 128, y); g.stroke(); } break;
      case "snow": speck(g, w, h, 500, ["#dfe8f0", "#ffffff"], 2, 6); g.fillStyle = "#d0dce8"; g.fillRect(w * 0.3, 0, 8, h); g.fillRect(w * 0.65, 0, 8, h); break;
      case "ice": g.strokeStyle = "rgba(255,255,255,.8)"; for (let i = 0; i < 14; i++) { g.beginPath(); g.moveTo(Math.random() * w, Math.random() * h); g.lineTo(Math.random() * w, Math.random() * h); g.stroke(); } break;
      case "water": for (let i = 0; i < 40; i++) { g.fillStyle = "rgba(255,255,255," + (0.1 + Math.random() * 0.3) + ")"; g.fillRect(Math.random() * w, Math.random() * h, 20 + Math.random() * 30, 2); } break;
      case "rock": speck(g, w, h, 200, [shade(base, 0.7), shade(base, 1.3)], 4, 14); break;
      case "lava": speck(g, w, h, 200, ["#ffd000", "#c02000"], 4, 14); break;
    }
  });
}
const matCache = {};
export function surfMat(name) {
  if (matCache[name]) return matCache[name];
  const o = { map: surfTex(name) };
  if (name === "glow" || name === "lava") o.emissive = new THREE.Color(name === "lava" ? 0x882200 : 0x220044);
  if (name === "glass") { o.transparent = true; o.opacity = 0.75; }
  if (name === "water") { o.transparent = true; o.opacity = 0.85; }
  if (name === "ice") o.emissive = new THREE.Color(0x203040);
  return (matCache[name] = new THREE.MeshLambertMaterial({ ...o, side: THREE.DoubleSide }));
}
export function wallTex(type) {
  return canvasTex("w_" + type, 64, 64, (g, w, h) => {
    const cols = { low: ["#d62828", "#ffffff"], barrier: ["#c8c8c8", "#a8a8a8"], rail: ["#cfd4da", "#8a9098"], glass: ["#bdefff", "#7ad0ff"], fence: ["#6b4a2a", "#8a6a3a"], stone: ["#9a9080", "#7a7060"], hay: ["#e0c060", "#c0a040"], tire: ["#222", "#ff3030"], neon: ["#ff3bd0", "#00f0ff"], snowbank: ["#ffffff", "#e0ecf4"], container: ["#c0392b", "#2980b9"], candy: ["#ff5ab0", "#ffffff"] }[type] || ["#888", "#666"];
    for (let x = 0; x < w; x += 16) { g.fillStyle = cols[(x / 16) % 2]; g.fillRect(x, 0, 16, h); }
    if (type === "barrier" || type === "rail") { g.fillStyle = "#666"; g.fillRect(0, h / 2 - 4, w, 8); }
  });
}

// ================= ENVIRONMENT KITS =================
// hw = half road width, sh = shoulder surface, shw = shoulder width, wall = wall type or null, wh = wall height
// encl = enclosure kind for indoor/tunnels, sup = supports, decor = scenery kit
export const ENV = {
  city:      { surf: "asphalt", sh: "concrete", shw: 4, wall: "low", wh: 1.2, decor: "city", sup: "pillar" },
  street:    { surf: "asphalt", sh: "grass", shw: 6, wall: null, decor: "rural", sup: "pillar" },
  village:   { surf: "cobble", sh: "grass", shw: 3, wall: "fence", wh: 1, decor: "village" },
  autobahn:  { surf: "asphalt", sh: "asphalt", shw: 3, wall: "barrier", wh: 1.4, hw: 14, decor: "highway", sup: "pillar" },
  highway:   { surf: "asphalt", sh: "concrete", shw: 2, wall: "barrier", wh: 1.4, hw: 12, decor: "highway", sup: "pillar" },
  bridge:    { surf: "asphalt", sh: "concrete", shw: 1.5, wall: "rail", wh: 1.6, decor: "bridge", sup: "cable" },
  mountain:  { surf: "asphalt", sh: "rock", shw: 5, wall: "rail", wh: 1.1, decor: "alpine", sup: "rock" },
  pass:      { surf: "asphalt", sh: "snow", shw: 5, wall: "snowbank", wh: 1.2, decor: "snowy", sup: "rock" },
  snow:      { surf: "snow", sh: "snow", shw: 9, wall: null, decor: "snowy", sup: "rock" },
  glacier:   { surf: "ice", sh: "snow", shw: 8, wall: null, decor: "snowy", sup: "rock" },
  skijump:   { surf: "snow", sh: "snow", shw: 1, wall: "fence", wh: 1, decor: "snowy", sup: "truss" },
  dirt:      { surf: "dirt", sh: "grass", shw: 8, wall: null, decor: "rural", sup: "rock" },
  rally:     { surf: "gravel", sh: "dirt", shw: 7, wall: "hay", wh: 1.1, decor: "rural", sup: "rock" },
  forest:    { surf: "dirt", sh: "grass", shw: 6, wall: null, decor: "forest", sup: "rock" },
  mudtrail:  { surf: "mud", sh: "grass", shw: 7, wall: null, decor: "forest", sup: "rock" },
  field:     { surf: "grass", sh: "hay", shw: 10, wall: null, decor: "farm" },
  farm:      { surf: "dirt", sh: "mud", shw: 7, wall: "fence", wh: 1, decor: "farm" },
  vineyard:  { surf: "dirt", sh: "grass", shw: 5, wall: null, decor: "vineyard", sup: "rock" },
  beach:     { surf: "sand", sh: "sand", shw: 10, wall: null, decor: "beach" },
  shallows:  { surf: "water", sh: "sand", shw: 8, wall: null, decor: "beach" },
  pier:      { surf: "wood", sh: "water", shw: 0, wall: "fence", wh: 1, decor: "beach", sup: "pillar" },
  river:     { surf: "water", sh: "gravel", shw: 6, wall: null, decor: "river", sup: "rock" },
  dam:       { surf: "concrete", sh: "concrete", shw: 1, wall: "barrier", wh: 1.6, decor: "river", sup: "wall" },
  harbor:    { surf: "concrete", sh: "concrete", shw: 3, wall: "container", wh: 2.4, decor: "harbor", sup: "pillar" },
  ship:      { surf: "metal", sh: "metal", shw: 2, wall: "container", wh: 2.6, decor: "harbor", sup: "ship" },
  industrial:{ surf: "concrete", sh: "gravel", shw: 4, wall: "barrier", wh: 1.3, decor: "industrial", sup: "truss" },
  construction:{ surf: "construction", sh: "dirt", shw: 6, wall: "tire", wh: 1, decor: "construction", sup: "truss" },
  scaffold:  { surf: "wood", sh: "wood", shw: 0, wall: "rail", wh: 1.2, decor: "construction", sup: "truss" },
  airport:   { surf: "concrete", sh: "grass", shw: 6, wall: null, decor: "airport" },
  runway:    { surf: "runway", sh: "grass", shw: 10, wall: null, hw: 18, decor: "airport" },
  roof:      { surf: "gravel", sh: "concrete", shw: 2, wall: "barrier", wh: 1.1, decor: "roof", sup: "building" },
  sky:       { surf: "glow", sh: null, shw: 0, wall: "neon", wh: 0.8, decor: "sky", sup: "none" },
  skyglass:  { surf: "glass", sh: null, shw: 0, wall: "glass", wh: 1.6, decor: "sky", sup: "none" },
  fair:      { surf: "asphalt", sh: "concrete", shw: 4, wall: "low", wh: 1, decor: "fair" },
  coaster:   { surf: "coaster", sh: null, shw: 0, wall: "rail", wh: 0.9, decor: "fair", sup: "truss" },
  fairy:     { surf: "candy", sh: "grass", shw: 5, wall: "candy", wh: 1, decor: "fairy", sup: "rock" },
  castleyard:{ surf: "cobble", sh: "grass", shw: 3, wall: "stone", wh: 2, decor: "castle", sup: "rock" },
  rampart:   { surf: "stone", sh: null, shw: 0, wall: "stone", wh: 1.6, decor: "castle", sup: "rock" },
  // ---- enclosed ----
  tunnel:    { surf: "asphalt", sh: "concrete", shw: 1, wall: "barrier", wh: 1, encl: "arch", ec: 0x6b5f55, light: 0xffd27a },
  rocktunnel:{ surf: "dirt", sh: "rock", shw: 2, wall: null, encl: "cave", ec: 0x5a4f45, light: 0xffaa55 },
  subway:    { surf: "concrete", sh: "rail", shw: 4, wall: "low", wh: 0.8, encl: "box", ec: 0xd8d2c0, ec2: 0x3a7ad8, light: 0xfff2b0, props: "subway" },
  sewer:     { surf: "concrete", sh: "water", shw: 5, wall: null, encl: "tube", ec: 0x6a6a52, light: 0x9aff7a, props: "pipes" },
  cave:      { surf: "rock", sh: "rock", shw: 4, wall: null, encl: "cave", ec: 0x2a1f3d, light: 0x66ffcc, props: "mushrooms" },
  mine:      { surf: "dirt", sh: "rail", shw: 3, wall: null, encl: "mine", ec: 0x4a3a2a, light: 0xffb040, props: "minebeams" },
  garage:    { surf: "concrete", sh: "concrete", shw: 3, wall: "low", wh: 0.6, encl: "box", ech: 7, ec: 0x8d9096, ec2: 0xe8c020, light: 0xe8f0ff, props: "garage" },
  lobby:     { surf: "tile", sh: "tile", shw: 4, wall: null, encl: "box", ech: 12, ec: 0xe8dcc8, ec2: 0xb08850, light: 0xfff0d0, props: "lobby" },
  hallway:   { surf: "carpet", sh: "wood", shw: 1, wall: null, encl: "box", ech: 6, ec: 0xf0e0c0, ec2: 0x6a4a2a, light: 0xffe0a0, props: "hallway", hw: 8 },
  apartment: { surf: "wood", sh: "carpet", shw: 3, wall: null, encl: "box", ech: 6, ec: 0xf8e8d0, ec2: 0x5a8ad0, light: 0xfff0d0, props: "apartment" },
  mall:      { surf: "tile", sh: "tile", shw: 5, wall: null, encl: "box", ech: 14, ec: 0xffffff, ec2: 0xff6fb5, light: 0xffffff, props: "mall" },
  foodcourt: { surf: "tile", sh: "tile", shw: 7, wall: null, encl: "box", ech: 16, ec: 0xfff4e0, ec2: 0xff8a00, light: 0xffffff, props: "food" },
  store:     { surf: "tile", sh: "tile", shw: 3, wall: null, encl: "box", ech: 7, ec: 0xf0f0f0, ec2: 0xdd0000, light: 0xffffff, props: "shelves" },
  dock:      { surf: "concrete", sh: "concrete", shw: 3, wall: "barrier", wh: 1, encl: "box", ech: 9, ec: 0x9a9a9a, ec2: 0xffcc00, light: 0xfff0c0, props: "crates" },
  escalator: { surf: "metal", sh: null, shw: 0, wall: "glass", wh: 1.3, encl: null, decor: null, sup: "truss", hw: 7 },
  elevator:  { surf: "metal", sh: null, shw: 0, wall: null, encl: "shaft", ec: 0x8a9aaa, light: 0xffffff, hw: 9 },
  hall:      { surf: "wood", sh: "carpet", shw: 4, wall: null, encl: "box", ech: 18, ec: 0xb8a888, ec2: 0x8a1a2a, light: 0xffd090, props: "castlehall" },
  stairs:    { surf: "stone", sh: null, shw: 0, wall: "stone", wh: 1.4, encl: "box", ech: 9, ec: 0xa89878, light: 0xffc070, props: "torches", hw: 9 },
  tower:     { surf: "stone", sh: null, shw: 0, wall: "stone", wh: 1.6, encl: null, decor: null, sup: "rock", hw: 8 },
  cathedral: { surf: "stone", sh: "stone", shw: 5, wall: null, encl: "box", ech: 34, ec: 0x8a8478, ec2: 0x4466cc, light: 0xffe8c0, props: "cathedral" },
  tent:      { surf: "wood", sh: "wood", shw: 6, wall: null, encl: "tent", ech: 14, ec: 0xffffff, ec2: 0x2a6fdb, light: 0xffe8a0, props: "beertent" },
  barn:      { surf: "hay", sh: "dirt", shw: 4, wall: null, encl: "box", ech: 10, ec: 0x9a3a24, ec2: 0x6a4a2a, light: 0xffd080, props: "barn" },
  terminal:  { surf: "tile", sh: "tile", shw: 6, wall: null, encl: "box", ech: 15, ec: 0xf4f6f8, ec2: 0x1e5aa8, light: 0xffffff, props: "terminal" },
  baggage:   { surf: "metal", sh: "concrete", shw: 3, wall: "rail", wh: 1, encl: "box", ech: 8, ec: 0xa0a8b0, ec2: 0xffaa00, light: 0xfff8e0, props: "crates" },
  station:   { surf: "concrete", sh: "rail", shw: 6, wall: null, encl: "station", ech: 20, ec: 0x8aa0b0, ec2: 0xdd0000, light: 0xffffff },
  warehouse: { surf: "concrete", sh: "wood", shw: 4, wall: null, encl: "box", ech: 12, ec: 0x8a4a3a, ec2: 0x5a3a2a, light: 0xffe0b0, props: "crates" },
  skybridge: { surf: "glass", sh: null, shw: 0, wall: "glass", wh: 1, encl: "glass", ec: 0xbdefff, sup: "none", hw: 8 },
  train:     { surf: "metal", sh: null, shw: 0, wall: "rail", wh: 0.8, decor: "rural", sup: "train", hw: 9 },
};
export function envOf(name) { return ENV[name] || ENV.city; }
