import { fbm, mulberry32, smoothstep } from "./noise";
import { nearestOnTrack, ROUTE, TRACK, type TrackHit } from "./route3d";

export { mulberry32 };

/**
 * Procedural world layout along ROUTE: terrain height function, rivers (with a waterfall),
 * bridge and tunnel spans, and placement lists for pines and rocks. Pure data, no three.js
 * objects: World.tsx turns it into meshes. Deterministic for a given seed.
 */

/** Nothing tall (trees, rocks) closer than this to the track centreline (units). */
export const CORRIDOR = 9;
/** On the camera side (d > 0), no trees closer than this to the track. */
const CAMERA_CLEAR = 38;
/** Half-width of the flat railbed (units); terrain blends to wild hills beyond it. */
const FLAT = 9;
/** Height of the snow line above the local track level. */
export const SNOW_LINE = 52;
/** Half-width of the hole cut in the terrain for a tunnel's bore (units). */
export const TUNNEL_HOLE = 8;
/** Height of a tunnel's hill crest above the track. */
export const TUNNEL_HILL = 13;
/** Steel bridge model half length (public/models/bridge.glb bounds, x = +-73.4). */
export const STEEL_HALF = 73.4;

/** One instanced prop: position, uniform scale, yaw and a 0..1 colour variation. */
export interface Placement {
  x: number;
  y: number;
  z: number;
  scale: number;
  rot: number;
  tint: number;
}

/** A stretch of track by arc length. */
export interface Span {
  s0: number;
  s1: number;
}
export interface Bridge extends Span {
  /** "steel" = Heet's girder bridge model; "trestle" = procedural wooden trestle. */
  kind: "steel" | "trestle";
}

/** A river as a polyline on the ground with a bed height per point. */
export interface River {
  /** Interleaved x, z per point. */
  pts: number[];
  /** Bed height per point. */
  bed: number[];
  /** Half-width of the water channel. */
  half: number;
  /** Extra distance over which the banks rise back to the surrounding terrain. */
  bank: number;
  /** Bounding box of the polyline grown by everything a river affects: [x0, z0, x1, z1]. */
  box: [number, number, number, number];
}

/** A waterfall drop: lip centre, height of the drop and the flow direction on the ground. */
export interface Waterfall {
  x: number;
  y: number;
  z: number;
  drop: number;
  dx: number;
  dz: number;
  width: number;
}

export interface WorldLayout {
  seed: number;
  pines: Placement[];
  rocks: Placement[];
  bridges: Bridge[];
  tunnels: Span[];
  rivers: River[];
  waterfalls: Waterfall[];
  /** Arc length of each station platform (clear ground on the left of the track, d < 0). */
  stationS: number[];
  /** Ground extents covered by terrain chunks. */
  bounds: { x0: number; x1: number; z0: number; z1: number };
}

const stationS = ROUTE.stationU.map((u) => u * ROUTE.length);
const mid = (i: number) => (stationS[i] + stationS[i + 1]) / 2;

/** Track sample index for an arc length. */
const idx = (s: number) => Math.max(0, Math.min(TRACK.count - 1, Math.round(s / TRACK.step)));

/**
 * Build a river crossing the track at arc length `s`, running along the track's normal
 * (so it crosses at right angles) and meandering more the further it gets from the track.
 * `bedAt(d)` gives the bed height relative to the track at signed distance d from it.
 */
function makeRiver(s: number, half: number, bank: number, bedAt: (d: number) => number, seed: number): River {
  const i = idx(s);
  const cx = TRACK.px[i];
  const cz = TRACK.pz[i];
  const ty = TRACK.py[i];
  const tx = TRACK.tx[i];
  const tz = TRACK.tz[i];
  const pts: number[] = [];
  const bed: number[] = [];
  for (let d = -320; d <= 320; d += 4) {
    // Meander along the track direction; zero near the crossing so the bridge sits square.
    const w = (fbm(d * 0.012, 3.7, seed, 2) - 0.5) * 2 * smoothstep(40, 160, Math.abs(d)) * 70;
    pts.push(cx - tz * d + tx * w, cz + tx * d + tz * w);
    bed.push(ty + bedAt(d));
  }
  // Grown by the banks plus the 30-unit levee fade: outside it a river changes nothing.
  const grow = half + bank + 30;
  const box: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (let k = 0; k < pts.length; k += 2) {
    box[0] = Math.min(box[0], pts[k] - grow);
    box[1] = Math.min(box[1], pts[k + 1] - grow);
    box[2] = Math.max(box[2], pts[k] + grow);
    box[3] = Math.max(box[3], pts[k + 1] + grow);
  }
  return { pts, bed, half, bank, box };
}

/** Output scratch for river queries. */
interface RiverHit {
  dist: number;
  bed: number;
}

/** Distance from (x, z) to a river's centreline and the bed height at the closest point. */
function riverQuery(r: River, x: number, z: number, out: RiverHit): RiverHit {
  const [bx0, bz0, bx1, bz1] = r.box;
  if (x < bx0 || x > bx1 || z < bz0 || z > bz1) {
    // Far from this river: skip the per-segment search (the common case by far).
    out.dist = Infinity;
    out.bed = 0;
    return out;
  }
  let best = Infinity;
  let bed = 0;
  const p = r.pts;
  for (let k = 0; k + 3 < p.length; k += 2) {
    const ax = p[k];
    const az = p[k + 1];
    const bx = p[k + 2] - ax;
    const bz = p[k + 3] - az;
    const len2 = bx * bx + bz * bz;
    const t = Math.max(0, Math.min(1, ((x - ax) * bx + (z - az) * bz) / len2));
    const dx = x - ax - bx * t;
    const dz = z - az - bz * t;
    const d2 = dx * dx + dz * dz;
    if (d2 < best) {
      best = d2;
      const j = k >> 1;
      bed = r.bed[j] + (r.bed[j + 1] - r.bed[j]) * t;
    }
  }
  out.dist = Math.sqrt(best);
  out.bed = bed;
  return out;
}

const hit: TrackHit = { s: 0, d: 0, y: 0 };
const rhit: RiverHit = { dist: 0, bed: 0 };

/**
 * Terrain height at (x, z). Flat railbed along the track, rolling hills that grow into a
 * snow-capped mountain wall with distance (steeper on the platform/far side), river
 * valleys cut through everything, and a hill raised over each tunnel. Allocation-free.
 * `trackOut`, if given, receives the nearest track point (saves callers a second lookup).
 */
export function heightAt(w: WorldLayout, x: number, z: number, trackOut?: TrackHit): number {
  nearestOnTrack(x, z, hit);
  if (trackOut) {
    trackOut.s = hit.s;
    trackOut.d = hit.d;
    trackOut.y = hit.y;
  }
  const ad = Math.abs(hit.d);
  const far = hit.d < 0;
  const ty = hit.y;
  const n = fbm(x * 0.011, z * 0.011, w.seed);
  const detail = fbm(x * 0.045, z * 0.045, w.seed + 7, 2);

  // Hills: ramp up past the railbed; the far side climbs into mountains sooner.
  const hills = smoothstep(FLAT, FLAT + 45, ad) * (far ? 13 : 10) * (0.35 + n);
  // Mountains use their own, broader noise so they form ridges and massifs, not lone spikes.
  const ridge = fbm(x * 0.0045, z * 0.0045, w.seed + 13, 3);
  // Set well back from the track so the station framings keep a band of sky above them.
  const mountains = smoothstep(far ? 110 : 140, far ? 330 : 360, ad) * 150 * (0.15 + ridge * ridge * 1.9) * (0.75 + n * 0.5);
  const wild = ty - 0.6 + hills + mountains + detail * 4 * smoothstep(FLAT, FLAT + 30, ad);

  const k = smoothstep(FLAT, FLAT + 20, ad);
  let h = ty - 0.35 + (wild - (ty - 0.35)) * k;

  // Tunnels: a hill over the bore, with shoulders flanking the portals.
  for (const t of w.tunnels) {
    if (hit.s < t.s0 - 16 || hit.s > t.s1 + 16) continue;
    const along = smoothstep(t.s0 - 16, t.s0, hit.s) * (1 - smoothstep(t.s1, t.s1 + 16, hit.s));
    const inside = hit.s >= t.s0 && hit.s <= t.s1;
    // In front of a portal the railbed stays flat; beside it the hillside rises.
    const lateral = (1 - smoothstep(30, 75, ad)) * (inside ? 1 : smoothstep(8, 14, ad));
    // Exactly TUNNEL_HILL over the bore (World's roof cover is shaped to meet it), lumpier beyond.
    const target = ty + TUNNEL_HILL + n * 6 * smoothstep(20, 40, ad);
    const m = along * lateral;
    if (m > 0) h = Math.max(h, h + (target - h) * m);
  }

  // Rivers: carve the channel and its banks out of whatever is there.
  for (const r of w.rivers) {
    riverQuery(r, x, z, rhit);
    const reach = r.half + r.bank;
    if (rhit.dist >= reach + 30) continue;
    // Levees: where the land sits below the water (the stream above its waterfall), lift it
    // so the water never floats; fades out over 30 units beyond the banks.
    h += Math.max(0, rhit.bed + 3 - h) * (1 - smoothstep(reach, reach + 30, rhit.dist));
    if (rhit.dist < reach && h > rhit.bed) h = rhit.bed + (h - rhit.bed) * smoothstep(r.half, reach, rhit.dist);
  }

  // Station clearings last, so nothing (tunnel shoulders, hills) can lift them: flat ground
  // on the far side where Task 10's platforms will stand (+-24 along, out to 24 units).
  if (far) {
    for (const s of w.stationS) {
      const along = Math.abs(hit.s - s);
      if (along >= 44) continue;
      const m = (1 - smoothstep(24, 44, along)) * (1 - smoothstep(26, 42, ad));
      h += (ty - 0.35 - h) * m;
    }
  }
  return h;
}

/** True if (x, z) is in (or right at the edge of) any river channel. */
function inWater(w: WorldLayout, x: number, z: number, margin: number): boolean {
  for (const r of w.rivers) if (riverQuery(r, x, z, rhit).dist < r.half + margin) return true;
  return false;
}

/** Bridge, tunnel and river layout: art-directed positions between stations. */
function features(seed: number): Omit<WorldLayout, "pines" | "rocks"> {
  // Main crossing: Heet's steel bridge between MCT and Vaani over a wide river valley.
  // The route's control points make the track straight here (see route3d.ts).
  const steelS = mid(1);
  // Stream with a waterfall, crossed by a short wooden trestle, just ahead of the Departure
  // train: the chase camera sees it (and the tunnel beyond) waiting up the line.
  const trestleS = stationS[0] + 58;
  const rivers = [
    makeRiver(steelS, 26, 46, (d) => -13 - Math.max(0, d) * 0.01 + Math.max(0, -d - 80) * 0.12, seed),
    makeRiver(
      trestleS,
      6,
      12,
      // Far side (d < 0) climbs up two waterfall steps; camera side drains gently away.
      (d) => (d > -42 ? -7 - Math.max(0, d) * 0.015 : d > -50 ? 1 : 9 + (-d - 50) * 0.08),
      seed + 1,
    ),
  ];

  // Waterfalls at the two bed steps of the stream.
  const i = idx(trestleS);
  const tx = TRACK.tx[i];
  const tz = TRACK.tz[i];
  const waterfalls: Waterfall[] = [];
  const steps: [number, number, number][] = [
    // [signed distance of the lip, bed height above, bed height below] relative to the track
    [-50, 9, 1],
    [-42, 1, -7],
  ];
  for (const [d, top, bottom] of steps) {
    waterfalls.push({
      x: TRACK.px[i] - tz * d,
      y: TRACK.py[i] + top + 0.8,
      z: TRACK.pz[i] + tx * d,
      drop: top - bottom,
      dx: -tz,
      dz: tx,
      width: 11,
    });
  }

  const steelSpan = { kind: "steel" as const, s0: steelS - STEEL_HALF, s1: steelS + STEEL_HALF };
  const trestleSpan = { kind: "trestle" as const, s0: trestleS - 22, s1: trestleS + 22 };
  const tunnels: Span[] = [
    // Right after the trestle: the train crosses the stream, then dives into the hillside.
    { s0: trestleS + 40, s1: trestleS + 110 },
    // Between QuizzX and Solar.
    { s0: mid(5) - 42, s1: mid(5) + 42 },
  ];

  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (let k = 0; k < TRACK.count; k++) {
    x0 = Math.min(x0, TRACK.px[k]);
    x1 = Math.max(x1, TRACK.px[k]);
    z0 = Math.min(z0, TRACK.pz[k]);
    z1 = Math.max(z1, TRACK.pz[k]);
  }
  const bounds = { x0: x0 - 220, x1: x1 + 220, z0: z0 - 380, z1: z1 + 380 };

  return { seed, bridges: [trestleSpan, steelSpan], tunnels, rivers, waterfalls, stationS, bounds };
}

/** Is (s, d) where a tunnel portal or station platform needs open ground? */
function keepClear(w: WorldLayout, s: number, d: number): boolean {
  for (const st of w.stationS) if (d < 0 && d > -30 && Math.abs(s - st) < 40) return true;
  for (const t of w.tunnels) {
    if (Math.abs(d) < 22 && (Math.abs(s - t.s0) < 16 || Math.abs(s - t.s1) < 16)) return true;
    if (Math.abs(d) < TUNNEL_HOLE + 6 && s > t.s0 && s < t.s1) return true;
  }
  return false;
}

/**
 * Generate the whole world for a seed: features first (they shape the terrain), then
 * pines on a jittered grid thinned by a forest-density noise, then rocks.
 */
export function generateWorld(seed: number): WorldLayout {
  const w: WorldLayout = { ...features(seed), pines: [], rocks: [] };
  const rand = mulberry32(seed);
  const { x0, x1, z0, z1 } = w.bounds;
  const local: TrackHit = { s: 0, d: 0, y: 0 };

  // Pines: one candidate per 9x9 cell, jittered, kept where the forest noise is dense.
  const cell = 9;
  for (let gx = x0; gx < x1; gx += cell) {
    for (let gz = z0; gz < z1; gz += cell) {
      const x = gx + rand() * cell;
      const z = gz + rand() * cell;
      const keep = rand();
      const scale = 0.75 + rand() * 0.8;
      const rot = rand() * Math.PI * 2;
      const tint = rand();
      nearestOnTrack(x, z, local);
      const ad = Math.abs(local.d);
      if (ad < CORRIDOR + 4) continue;
      // Keep the camera's side open near the track: trees there would stand between the
      // follow camera and the train.
      if (local.d > 0 && local.d < CAMERA_CLEAR) continue;
      // Forest patches: dense groves and open meadows; sparser far away (fog hides them anyway).
      const density = smoothstep(0.32, 0.62, fbm(x * 0.009, z * 0.009, seed + 31, 3)) * (ad > 220 ? 0.5 : 1);
      // Trees crowd the track edges a little more, like the reference's forest walls.
      if (keep > density * (ad < 60 ? 1 : 0.8)) continue;
      if (keepClear(w, local.s, local.d) || inWater(w, x, z, 3)) continue;
      const y = heightAt(w, x, z);
      if (y > local.y + SNOW_LINE - 12) continue; // tree line below the snow
      w.pines.push({ x, y, z, scale, rot, tint });
    }
  }

  // Rocks: scattered boulders, plus extra along river banks.
  for (let k = 0; k < 2600; k++) {
    const x = x0 + rand() * (x1 - x0);
    const z = z0 + rand() * (z1 - z0);
    const scale = 0.5 + rand() * rand() * 3.5;
    const rot = rand() * Math.PI * 2;
    const tint = rand();
    nearestOnTrack(x, z, local);
    const ad = Math.abs(local.d);
    if (ad < CORRIDOR + 1 || ad > 260 || keepClear(w, local.s, local.d)) continue;
    const bankSide = inWater(w, x, z, 10) && !inWater(w, x, z, -2);
    if (!bankSide && rand() > 0.25) continue;
    w.rocks.push({ x, y: heightAt(w, x, z) - scale * 0.3, z, scale, rot, tint });
  }
  return w;
}
