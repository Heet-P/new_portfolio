import * as THREE from "three";
import { trackFrame } from "./placement";

/**
 * Geometry kit for the stations: a builder that accumulates flat-shaded, vertex-coloured
 * triangles (plus an optional per-vertex emissive tint) into one BufferGeometry, so a whole
 * station, or every station, is a single draw call.
 *
 * Local frame of every primitive: x along the track, y up (rail top = 0), z to the RIGHT of
 * travel, so the platform side is z < 0. `at(s)` puts the frame on the curve; items near each
 * other share a frame, long continuous parts (platform, canopy) are lofted along the curve.
 */

export type Vec3 = [number, number, number];

/** Options common to all primitives. */
export interface PrimOpts {
  /** Emissive tint (linear RGB, scaled at runtime by the palette's windowGlow). */
  glow?: Vec3;
  /** Euler rotation (x, y, z radians) about the primitive's own centre. */
  rot?: Vec3;
}

const UP = new THREE.Vector3(0, 1, 0);
const colourCache = new Map<string, THREE.Color>();
const colourOf = (c: string | THREE.Color) => {
  if (typeof c !== "string") return c;
  let v = colourCache.get(c);
  if (!v) colourCache.set(c, (v = new THREE.Color(c)));
  return v;
};

/** Deterministic pseudo-random 0..1 from an integer (per-face shade variation). */
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Unit icosahedron faces (20 triangles) for bushes and stones. */
const ICO = (() => {
  const g = new THREE.IcosahedronGeometry(1, 0);
  const p = g.getAttribute("position");
  return Array.from({ length: p.count }, (_, i) => [p.getX(i), p.getY(i), p.getZ(i)] as Vec3);
})();

export class Kit {
  private pos: number[] = [];
  private nrm: number[] = [];
  private col: number[] = [];
  private glw: number[] = [];
  private faces = 0;
  /** local -> world for the current frame. */
  private frame = new THREE.Matrix4();
  private m = new THREE.Matrix4();
  private lm = new THREE.Matrix4();
  private e = new THREE.Euler();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private one = new THREE.Vector3(1, 1, 1);
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();
  private c = new THREE.Vector3();
  private n = new THREE.Vector3();
  /**
   * Scratch vertices, reused across primitives: a primitive takes what it needs with `vec`
   * after `begin()` and its triangles are copied into the arrays as they are emitted, so no
   * Vector3 is allocated per vertex (the whole route is ~140k vertices, built at mount).
   */
  private pool: THREE.Vector3[] = [];
  private used = 0;

  /** Start a primitive: every scratch vertex is free again. */
  private begin(): void {
    this.used = 0;
  }

  /** A scratch vertex (x, y, z) transformed by `M`, valid until the next begin(). */
  private vec(x: number, y: number, z: number, M: THREE.Matrix4): THREE.Vector3 {
    let v = this.pool[this.used];
    if (!v) this.pool.push((v = new THREE.Vector3()));
    this.used++;
    return v.set(x, y, z).applyMatrix4(M);
  }

  /** Put the local frame on the track at arc length s. */
  at(s: number): this {
    const f = trackFrame(s);
    this.frame.makeBasis(this.v.set(f.tx, 0, f.tz), UP, this.n.set(f.nx, 0, f.nz)).setPosition(f.x, f.y, f.z);
    return this;
  }

  /**
   * Run `fn` with the frame moved to `c` and turned by `rot`: lets a compound object (a tilted
   * panel with its cells, a sign turned toward the camera) be built in its own coordinates.
   */
  group(c: Vec3, rot: Vec3, fn: () => void): this {
    const saved = this.frame.clone();
    const local = new THREE.Matrix4().compose(
      new THREE.Vector3(c[0], c[1], c[2]),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2])),
      this.one,
    );
    this.frame.multiply(local);
    fn();
    this.frame.copy(saved);
    return this;
  }

  /** Emit one triangle in world space, with a flat normal. */
  private tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, col: THREE.Color, shade: number, glow?: Vec3) {
    this.n.subVectors(b, a).cross(this.c.subVectors(c, a)).normalize();
    this.vertex(a, col, shade, glow);
    this.vertex(b, col, shade, glow);
    this.vertex(c, col, shade, glow);
  }

  private vertex(p: THREE.Vector3, col: THREE.Color, shade: number, glow?: Vec3) {
    this.pos.push(p.x, p.y, p.z);
    this.nrm.push(this.n.x, this.n.y, this.n.z);
    this.col.push(col.r * shade, col.g * shade, col.b * shade);
    this.glw.push(glow ? glow[0] : 0, glow ? glow[1] : 0, glow ? glow[2] : 0);
  }

  /** A quad (a, b, c, d in order) as two triangles, one shade per face. */
  private quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, col: THREE.Color, glow?: Vec3) {
    // +-2.5 % brightness per face: enough to read as facets, not as noise.
    const shade = 1 + (hash(this.faces++) - 0.5) * 0.05;
    this.tri(a, b, c, col, shade, glow);
    this.tri(a, c, d, col, shade, glow);
  }

  /** local -> world matrix for a primitive centred at `c` with rotation `rot`, into this.m. */
  private place(c: Vec3, rot?: Vec3): THREE.Matrix4 {
    this.q.setFromEuler(this.e.set(rot?.[0] ?? 0, rot?.[1] ?? 0, rot?.[2] ?? 0));
    this.lm.compose(this.v.set(c[0], c[1], c[2]), this.q, this.one);
    return this.m.multiplyMatrices(this.frame, this.lm);
  }

  /** Axis-aligned (in the local frame) box: centre, size, colour. */
  box(c: Vec3, size: Vec3, colour: string | THREE.Color, o: PrimOpts = {}): this {
    const M = this.place(c, o.rot);
    const col = colourOf(colour);
    const [hx, hy, hz] = [size[0] / 2, size[1] / 2, size[2] / 2];
    this.begin();
    const P = (sx: number, sy: number, sz: number) => this.vec(sx * hx, sy * hy, sz * hz, M);
    const p = [P(-1, -1, -1), P(1, -1, -1), P(1, 1, -1), P(-1, 1, -1), P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1)];
    const g = o.glow;
    this.quad(p[0], p[3], p[2], p[1], col, g); // -z
    this.quad(p[4], p[5], p[6], p[7], col, g); // +z
    this.quad(p[0], p[4], p[7], p[3], col, g); // -x
    this.quad(p[1], p[2], p[6], p[5], col, g); // +x
    this.quad(p[3], p[7], p[6], p[2], col, g); // +y
    this.quad(p[0], p[1], p[5], p[4], col, g); // -y
    return this;
  }

  /** Cylinder (or cone: r0 != r1) along the local y axis. */
  cyl(c: Vec3, r0: number, r1: number, h: number, sides: number, colour: string | THREE.Color, o: PrimOpts = {}): this {
    const M = this.place(c, o.rot);
    const col = colourOf(colour);
    this.begin();
    const ring = (r: number, y: number) =>
      Array.from({ length: sides }, (_, k) => {
        const a = (k / sides) * Math.PI * 2;
        return this.vec(Math.cos(a) * r, y, Math.sin(a) * r, M);
      });
    const lo = ring(r0, -h / 2);
    const hi = ring(r1, h / 2);
    const top = this.vec(0, h / 2, 0, M);
    const bottom = this.vec(0, -h / 2, 0, M);
    for (let k = 0; k < sides; k++) {
      const j = (k + 1) % sides;
      this.quad(lo[k], hi[k], hi[j], lo[j], col, o.glow);
      if (r1 > 0) this.tri(hi[k], top, hi[j], col, 1.04, o.glow);
      if (r0 > 0) this.tri(lo[j], bottom, lo[k], col, 0.9, o.glow);
    }
    return this;
  }

  /** A lumpy low-poly blob (bush, stone): an icosahedron with radii `r` and a little jitter. */
  blob(c: Vec3, r: Vec3, colour: string | THREE.Color, seed = 0, o: PrimOpts = {}): this {
    const M = this.place(c, o.rot);
    const col = colourOf(colour);
    const jit = (p: Vec3, k: number) => 0.88 + hash(seed * 97 + Math.round((p[0] + 2) * 31 + (p[1] + 2) * 17 + (p[2] + 2) * 13) + k) * 0.24;
    for (let f = 0; f < ICO.length; f += 3) {
      this.begin();
      const corner = (k: number) => {
        const p = ICO[f + k];
        const j = jit(p, 0);
        return this.vec(p[0] * r[0] * j, p[1] * r[1] * j, p[2] * r[2] * j, M);
      };
      this.tri(corner(0), corner(1), corner(2), col, 0.95 + hash(seed * 13 + f) * 0.1, o.glow);
    }
    return this;
  }

  /**
   * Extrude a polygon given in the (z, y) plane along local x from x0 to x1, with end caps:
   * the building body with its gable ends, the thin chevron of a roof, a column's section.
   */
  extrude(poly: [number, number][], x0: number, x1: number, colour: string | THREE.Color, o: PrimOpts = {}): this {
    const M = this.place([0, 0, 0], o.rot);
    const col = colourOf(colour);
    const at = (x: number, k: number) => this.vec(x, poly[k][1], poly[k][0], M);
    const n = poly.length;
    for (let k = 0; k < n; k++) {
      const j = (k + 1) % n;
      this.begin();
      this.quad(at(x0, k), at(x1, k), at(x1, j), at(x0, j), col, o.glow);
    }
    const tris = THREE.ShapeUtils.triangulateShape(
      poly.map(([z, y]) => new THREE.Vector2(z, y)),
      [],
    );
    for (const [a, b, c] of tris) {
      this.begin();
      this.tri(at(x0, a), at(x0, b), at(x0, c), col, 0.97, o.glow);
      this.tri(at(x1, a), at(x1, b), at(x1, c), col, 1.02, o.glow);
    }
    return this;
  }

  /**
   * Sweep a (z, y) profile along the track from s0 to s1: gap-free, follows the curve and the
   * track's height. `lift(s)` raises the section (the platform's sloping ends); `colour` may
   * depend on the row (paving bands). Open profile: faces between consecutive points.
   */
  loft(
    profile: [number, number][],
    s0: number,
    s1: number,
    colour: string | THREE.Color | ((row: number) => string | THREE.Color),
    o: { step?: number; lift?: (s: number) => number; glow?: Vec3 } = {},
  ): this {
    const step = o.step ?? 1;
    const rows: number[] = [];
    for (let s = s0; s < s1 - 1e-6; s += step) rows.push(s);
    rows.push(s1);
    // Two rings of vertices, swapped row to row (no allocation per row).
    let prev = profile.map(() => new THREE.Vector3());
    let cur = profile.map(() => new THREE.Vector3());
    const ring = (s: number, out: THREE.Vector3[]) => {
      const f = trackFrame(s);
      const dy = o.lift ? o.lift(s) : 0;
      profile.forEach(([z, y], k) => out[k].set(f.x + f.nx * z, f.y + y + dy, f.z + f.nz * z));
    };
    ring(rows[0], prev);
    for (let r = 1; r < rows.length; r++) {
      ring(rows[r], cur);
      const col = colourOf(typeof colour === "function" ? colour(r - 1) : colour);
      for (let k = 0; k + 1 < profile.length; k++) this.quad(prev[k], prev[k + 1], cur[k + 1], cur[k], col, o.glow);
      [prev, cur] = [cur, prev];
    }
    return this;
  }

  /** Finished geometry: position, normal, colour and `aGlow` (emissive tint) attributes. */
  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute("aGlow", new THREE.Float32BufferAttribute(this.glw, 3));
    g.computeBoundingSphere();
    return g;
  }

  /** Triangles emitted so far. */
  get triangles() {
    return this.pos.length / 9;
  }
}
