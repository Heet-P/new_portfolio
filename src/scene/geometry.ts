import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { hash2, smoothstep } from "./noise";
import { TRACK, type TrackHit } from "./route3d";
import { heightAt, SNOW_LINE, TUNNEL_HOLE, type River, type Waterfall, type WorldLayout } from "./worldgen";

/**
 * Geometry builders for the low-poly world. Everything is meant to be drawn with
 * `flatShading: true` materials, so each triangle shows as one flat facet; colours are
 * baked per vertex (per face for terrain) and tinted at runtime by palette multipliers.
 */

/** Linear-RGB helper so colours below read as the sRGB hex an artist would pick. */
const srgb = (hex: string) => new THREE.Color(hex);

/** Give every vertex of `g` one colour. */
function paint(g: THREE.BufferGeometry, c: THREE.Color): THREE.BufferGeometry {
  const n = g.getAttribute("position").count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(arr, i * 3);
  g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return g;
}

/**
 * Stylised pine: a trunk plus three stacked cones, merged into one geometry (one draw
 * call per instanced batch). About 9 units tall at scale 1, base at y = 0.
 */
export function pineGeometry(): THREE.BufferGeometry {
  const trunk = paint(new THREE.CylinderGeometry(0.32, 0.45, 2.4, 5).translate(0, 1.2, 0), srgb("#6e4a2c"));
  const tiers: [number, number, number, string][] = [
    // [radius, height, base y, colour]: darker at the bottom, sunlit tips a touch lighter.
    [2.6, 3.8, 1.7, "#4f7a2a"],
    [2.05, 3.3, 3.7, "#557f2c"],
    [1.4, 2.9, 5.7, "#5d8830"],
  ];
  const cones = tiers.map(([r, h, y, c]) => paint(new THREE.ConeGeometry(r, h, 7).translate(0, y + h / 2, 0), srgb(c)));
  const g = mergeGeometries([trunk, ...cones].map((x) => x.toNonIndexed()));
  g.computeVertexNormals();
  return g;
}

/** Low-detail boulder: an icosahedron with jittered vertices (shared corners move together). */
export function rockGeometry(seed: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, 0);
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    // Hash the corner position so duplicated corners get the same jitter (no cracks).
    const j = 0.75 + hash2(Math.round(x * 100), Math.round(y * 100 + z * 37), seed) * 0.5;
    pos.setXYZ(i, x * j, y * j * 0.7, z * j);
  }
  paint(g, srgb("#b9a684"));
  g.computeVertexNormals();
  return g;
}

/**
 * Sweep a 2D cross-section along the track between arc lengths s0..s1. Profile points are
 * [lateral (+ = right of travel), up] relative to the track centreline at each sample;
 * `lift(s)` optionally raises the whole section (e.g. a sagging wire).
 */
export function sweep(
  profile: [number, number][],
  s0: number,
  s1: number,
  step = 2,
  lift?: (s: number) => number,
): THREE.BufferGeometry {
  const rows: number[] = [];
  for (let s = s0; s < s1; s += step) rows.push(s);
  rows.push(s1);
  const np = profile.length;
  const pos = new Float32Array(rows.length * np * 3);
  rows.forEach((s, r) => {
    const i = Math.max(0, Math.min(TRACK.count - 1, Math.round(s / TRACK.step)));
    const nx = -TRACK.tz[i];
    const nz = TRACK.tx[i];
    const dy = lift ? lift(s) : 0;
    profile.forEach(([lat, up], k) => {
      const o = (r * np + k) * 3;
      pos[o] = TRACK.px[i] + nx * lat;
      pos[o + 1] = TRACK.py[i] + up + dy;
      pos[o + 2] = TRACK.pz[i] + nz * lat;
    });
  });
  const index: number[] = [];
  for (let r = 0; r + 1 < rows.length; r++) {
    for (let k = 0; k + 1 < np; k++) {
      const a = r * np + k;
      const b = a + np;
      index.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/** Terrain palette (sRGB as authored; the golden-hour reference look). */
const T_COL = {
  grassOlive: srgb("#a9a243"),
  grassGreen: srgb("#7f8f37"),
  dirt: srgb("#9c8a5c"),
  sand: srgb("#c9b78e"),
  rockWarm: srgb("#bfae8a"),
  rockGrey: srgb("#9d9b90"),
  snow: srgb("#f2f3f1"),
  bed: srgb("#8d8668"),
};

/** Terrain grid spacing (units) on desktop: big facets, like the reference. Phones use a coarser one. */
export const TERRAIN_STEP = 6;

/**
 * One terrain chunk covering global grid cells [ix0, ix1) x [iz0, iz1) of a grid with
 * spacing `step`. Vertices are
 * jittered by a hash of their global grid index, so neighbouring chunks share edges
 * exactly. Non-indexed with one colour per triangle (true low-poly facets), coloured by
 * height above the track, slope and noise. Tunnel bores are cut out as holes.
 */
export function terrainChunk(
  w: WorldLayout,
  ix0: number,
  ix1: number,
  iz0: number,
  iz1: number,
  step = TERRAIN_STEP,
): THREE.BufferGeometry | null {
  const { x0, z0 } = w.bounds;
  const nx = ix1 - ix0 + 1;
  const nz = iz1 - iz0 + 1;
  const vx = new Float32Array(nx * nz);
  const vy = new Float32Array(nx * nz);
  const vz = new Float32Array(nx * nz);
  const rel = new Float32Array(nx * nz);
  const hole = new Uint8Array(nx * nz);
  const hit: TrackHit = { s: 0, d: 0, y: 0 };
  for (let a = 0; a < nx; a++) {
    for (let b = 0; b < nz; b++) {
      const gx = ix0 + a;
      const gz = iz0 + b;
      const x = x0 + gx * step + (hash2(gx, gz, 11) - 0.5) * step * 0.5;
      const z = z0 + gz * step + (hash2(gx, gz, 23) - 0.5) * step * 0.5;
      const k = a * nz + b;
      vx[k] = x;
      vz[k] = z;
      vy[k] = heightAt(w, x, z, hit); // also reports the nearest track point
      rel[k] = vy[k] - hit.y;
      for (const t of w.tunnels) {
        if (hit.s > t.s0 - 0.5 && hit.s < t.s1 + 0.5 && Math.abs(hit.d) < TUNNEL_HOLE) hole[k] = 1;
      }
    }
  }

  // Preallocated output (2 triangles per cell, 9 floats each), trimmed at the end.
  const pos = new Float32Array((nx - 1) * (nz - 1) * 18);
  const col = new Float32Array(pos.length);
  let o = 0;
  const c = new THREE.Color();
  const tri = (i: number, j: number, k: number, seed: number) => {
    if (hole[i] || hole[j] || hole[k]) return;
    // Face normal's y = how flat the facet is (1 = flat, 0 = vertical cliff).
    const ax = vx[j] - vx[i];
    const ay = vy[j] - vy[i];
    const az = vz[j] - vz[i];
    const bx = vx[k] - vx[i];
    const by = vy[k] - vy[i];
    const bz = vz[k] - vz[i];
    const cx = ay * bz - az * by;
    const cy = az * bx - ax * bz;
    const cz = ax * by - ay * bx;
    const ny = Math.abs(cy) / (Math.hypot(cx, cy, cz) || 1);
    const h = (rel[i] + rel[j] + rel[k]) / 3;
    const n = hash2(seed, Math.round(h * 10), 5);
    if (h > SNOW_LINE + n * 14 - 7 && ny > 0.5) c.copy(T_COL.snow);
    else if (h < -3.5) c.copy(T_COL.bed).lerp(T_COL.sand, n);
    else if (ny < 0.72 || h > SNOW_LINE - 10) c.copy(T_COL.rockWarm).lerp(T_COL.rockGrey, smoothstep(10, 60, h) * 0.8 + n * 0.2);
    else if (Math.abs(h) < 0.6) c.copy(T_COL.grassOlive).lerp(T_COL.dirt, 0.35 + n * 0.2);
    else c.copy(T_COL.grassOlive).lerp(T_COL.grassGreen, n);
    // Small per-face brightness jitter sells the hand-made faceted look.
    c.multiplyScalar(0.94 + hash2(seed, 77, 9) * 0.12);
    for (const v of [i, j, k]) {
      pos[o] = vx[v];
      pos[o + 1] = vy[v];
      pos[o + 2] = vz[v];
      col[o] = c.r;
      col[o + 1] = c.g;
      col[o + 2] = c.b;
      o += 3;
    }
  };
  for (let a = 0; a + 1 < nx; a++) {
    for (let b = 0; b + 1 < nz; b++) {
      const i00 = a * nz + b;
      const i10 = i00 + nz;
      const i01 = i00 + 1;
      const i11 = i10 + 1;
      const seed = (ix0 + a) * 7919 + (iz0 + b);
      // Alternate the diagonal so the facets don't line up in obvious stripes.
      if ((a + b) & 1) {
        tri(i00, i01, i10, seed);
        tri(i10, i01, i11, seed + 1);
      } else {
        tri(i00, i11, i10, seed);
        tri(i00, i01, i11, seed + 1);
      }
    }
  }
  if (o === 0) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos.slice(0, o), 3));
  g.setAttribute("color", new THREE.BufferAttribute(col.slice(0, o), 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/**
 * Water surface along a river polyline, slightly above the bed: split into lanes across
 * and one row per polyline point, so the flowing-water shader has vertices to ripple.
 * Steep stretches (the waterfall steps) become a stepped plane; foamGeometry whitens them.
 */
export function riverGeometry(pts: number[], bed: number[], half: number): THREE.BufferGeometry {
  return ribbon(pts, bed, half + 1, 0.8, Math.max(2, Math.round(half / 4)), () => true);
}

/** White water: the river's steep (waterfall) stretches, lifted a touch, as streaked falls. */
export function foamGeometry(rivers: River[]): THREE.BufferGeometry {
  return mergeGeometries(
    rivers.map(({ pts, bed, half }) => ribbon(pts, bed, half + 0.6, 1.0, 4, (i) => Math.abs(bed[i + 1] - bed[i]) > 1.5)),
  );
}

/** Churning foam blobs where each waterfall lands, spread across the stream. */
export function splashGeometry(falls: Waterfall[]): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  falls.forEach((f, k) => {
    for (let j = 0; j < 9; j++) {
      const r = 1.1 + hash2(k, j, 3) * 1.5;
      const lat = (hash2(k, j, 4) - 0.5) * f.width;
      const ahead = 0.5 + hash2(k, j, 5) * 3.5;
      parts.push(
        new THREE.IcosahedronGeometry(r, 0)
          .scale(1, 0.5, 1)
          .translate(f.x + f.dx * ahead - f.dz * lat, f.y - f.drop + 0.5, f.z + f.dz * ahead + f.dx * lat),
      );
    }
  });
  const g = mergeGeometries(parts);
  g.deleteAttribute("uv");
  g.computeVertexNormals();
  return g;
}

/**
 * Ribbon along a polyline at bed + lift, `lanes` strips wide, keeping only segments where
 * `keep(i)`. Non-indexed. Attributes for the water shaders: aFlow = distance travelled
 * downstream (3D, so drops count), aAcross = 0..1 across the ribbon.
 */
function ribbon(
  pts: number[],
  bed: number[],
  half: number,
  lift: number,
  lanes: number,
  keep: (i: number) => boolean,
): THREE.BufferGeometry {
  const n = pts.length / 2;
  const flow = new Float32Array(n);
  for (let i = 1; i < n; i++) {
    flow[i] = flow[i - 1] + Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1], bed[i] - bed[i - 1]);
  }
  // Point on row i at fraction f (0..1) across.
  const at = (i: number, f: number, out: number[]) => {
    const a = Math.max(0, i - 1);
    const b = Math.min(n - 1, i + 1);
    const dx = pts[b * 2] - pts[a * 2];
    const dz = pts[b * 2 + 1] - pts[a * 2 + 1];
    const len = Math.hypot(dx, dz) || 1;
    const side = (f * 2 - 1) * half;
    out.push(pts[i * 2] - (dz / len) * side, bed[i] + lift, pts[i * 2 + 1] + (dx / len) * side);
  };
  const pos: number[] = [];
  const aFlow: number[] = [];
  const aAcross: number[] = [];
  const vert = (i: number, f: number) => {
    at(i, f, pos);
    aFlow.push(flow[i]);
    aAcross.push(f);
  };
  for (let i = 0; i + 1 < n; i++) {
    if (!keep(i)) continue;
    for (let l = 0; l < lanes; l++) {
      const f0 = l / lanes;
      const f1 = (l + 1) / lanes;
      // Two triangles per cell, wound to face up.
      vert(i, f0);
      vert(i, f1);
      vert(i + 1, f0);
      vert(i, f1);
      vert(i + 1, f1);
      vert(i + 1, f0);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aFlow", new THREE.Float32BufferAttribute(aFlow, 1));
  g.setAttribute("aAcross", new THREE.Float32BufferAttribute(aAcross, 1));
  g.computeVertexNormals();
  return g;
}
