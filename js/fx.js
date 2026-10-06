import * as THREE from "three";
// Pooled particle system with per-particle color/size
export class FX {
  constructor(scene, max = 3000) {
    this.max = max; this.n = 0;
    this.p = new Float32Array(max * 3); this.v = new Float32Array(max * 3); this.c = new Float32Array(max * 3);
    this.s = new Float32Array(max); this.life = new Float32Array(max); this.maxLife = new Float32Array(max); this.g = new Float32Array(max); this.s0 = new Float32Array(max); this.grow = new Float32Array(max);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("color", new THREE.BufferAttribute(this.c, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("size", new THREE.BufferAttribute(this.s, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      vertexShader: "attribute float size; attribute vec3 color; varying vec3 vc; void main(){ vc=color; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = size * 320.0 / -mv.z; gl_Position = projectionMatrix*mv; }",
      fragmentShader: "varying vec3 vc; void main(){ vec2 d = gl_PointCoord-0.5; float r = length(d); if(r>0.5) discard; gl_FragColor = vec4(vc, smoothstep(0.5,0.2,r)); }",
    });
    this.pts = new THREE.Points(geo, mat); this.pts.frustumCulled = false;
    scene.add(this.pts);
    this.geo = geo; this.col = new THREE.Color();
  }
  spawn(x, y, z, vx, vy, vz, color, size, life, grav = 0, grow = 0) {
    let i = this.n < this.max ? this.n++ : Math.floor(Math.random() * this.max);
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
    this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.col.set(color); this.c[i * 3] = this.col.r; this.c[i * 3 + 1] = this.col.g; this.c[i * 3 + 2] = this.col.b;
    this.s[i] = size; this.s0[i] = size; this.life[i] = life; this.maxLife[i] = life; this.g[i] = grav; this.grow[i] = grow;
  }
  burst(pos, color, count = 20, speed = 10, size = 1.2, grav = 20) {
    for (let k = 0; k < count; k++) {
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2;
      const sp = speed * (0.4 + Math.random() * 0.6);
      this.spawn(pos.x, pos.y + 1, pos.z, Math.cos(a) * Math.cos(b) * sp, Math.abs(Math.sin(b)) * sp + 3, Math.sin(a) * Math.cos(b) * sp, color, size * (0.6 + Math.random() * 0.8), 0.6 + Math.random() * 0.6, grav);
    }
  }
  confetti(pos, count = 80) {
    const cols = [0x000000, 0xdd0000, 0xffce00, 0xffffff, 0x2a9df4];
    for (let k = 0; k < count; k++) this.spawn(pos.x + (Math.random() - 0.5) * 20, pos.y + 10 + Math.random() * 10, pos.z + (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 12, Math.random() * 10, (Math.random() - 0.5) * 12, cols[k % cols.length], 0.9, 2.5, 6);
  }
  update(dt) {
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        const j = --this.n;
        if (i !== j) {
          for (let k = 0; k < 3; k++) { this.p[i * 3 + k] = this.p[j * 3 + k]; this.v[i * 3 + k] = this.v[j * 3 + k]; this.c[i * 3 + k] = this.c[j * 3 + k]; }
          this.s[i] = this.s[j]; this.life[i] = this.life[j]; this.maxLife[i] = this.maxLife[j]; this.g[i] = this.g[j]; this.s0[i] = this.s0[j]; this.grow[i] = this.grow[j];
        }
        continue;
      }
      this.v[i * 3 + 1] -= this.g[i] * dt;
      this.p[i * 3] += this.v[i * 3] * dt; this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt; this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
      const k = this.life[i] / this.maxLife[i];
      this.s[i] = this.s0[i] * (this.grow[i] ? 1 + (1 - k) * this.grow[i] : Math.min(1, k * 2));
      i++;
    }
    this.geo.setDrawRange(0, this.n);
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.color.needsUpdate = true; this.geo.attributes.size.needsUpdate = true;
  }
}
