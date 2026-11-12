import { hash2, mulberry32, smoothstep } from "./noise";
import type { Waterfall } from "./worldgen";

/**
 * Pure helpers for the weather layers (clouds, rain, waterfall mist) and the night lights.
 * No three.js here: the components turn these numbers into instanced geometry and
 * uniforms, and the tests can check the art direction (when it rains, where clouds sit).
 */

/**
 * Rain strength 0..1 from the palette's window glow (our "how dark is it" dial): dry from
 * golden hour through dusk (glow <= 1.05 at Solar), starting in the twilight, full by
 * "Next stop" (2.2) and the Terminus.
 */
export const RAIN_GLOW = { start: 1.25, full: 2.15 } as const;
export function rainAmount(windowGlow: number): number {
  return smoothstep(RAIN_GLOW.start, RAIN_GLOW.full, windowGlow);
}

/**
 * How much "night" the train's own lights should show, 0..1: headlamp beam and the warm
 * window light spilling on the ground. Off at golden hour (glow 0.12), coming up through
 * sunset/dusk, full from the twilight on.
 */
export const NIGHT_GLOW = { start: 0.3, full: 1.6 } as const;
export function nightAmount(windowGlow: number): number {
  return smoothstep(NIGHT_GLOW.start, NIGHT_GLOW.full, windowGlow);
}

/**
 * Rain lean as horizontal run per unit of fall (tan of the angle from vertical): a light
 * breeze when parked, swept back by the head-wind as the train speeds up (speed 0..1).
 */
export const RAIN_SLANT = { still: 0.12, moving: 0.55 } as const;
export function rainSlant(speed: number): number {
  const s = Math.max(0, Math.min(1, speed));
  return RAIN_SLANT.still + (RAIN_SLANT.moving - RAIN_SLANT.still) * s;
}

/**
 * Where the clouds live, relative to the camera (the cloud layer rides with it, like the
 * far mountains): a ring `near`..`far` units out, between `minDeg` and `maxDeg` above the
 * camera's horizon. The chase camera looks down ~9-12 degrees with a 38 degree FOV, so only
 * the first ~7-10 degrees of sky are in frame (more on phones): the clouds sit low, drifting
 * in front of the far ranges (ring at 1300+) like the reference still, scattered rather
 * than a lid over the view.
 */
export const CLOUD_BAND = { near: 650, far: 1050, minDeg: 1.5, maxDeg: 9.5, clusters: 16 } as const;

/** One puff of a cloud cluster: centre (camera-relative) and scale of a unit, faceted blob. */
export interface CloudPuff {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  /** Turn about the vertical axis (radians), so repeated puffs never look alike. */
  yaw: number;
}

/**
 * Deterministic cloud layout: CLOUD_BAND.clusters clusters spaced evenly (with jitter) around
 * the ring, each a row of 4-7 flattened puffs strung along the ring's tangent. Every puff's
 * elevation is chosen directly in degrees, so the whole layer stays inside the band.
 */
export function cloudPuffs(seed: number): CloudPuff[] {
  const rand = mulberry32(seed);
  const { near, far, minDeg, maxDeg, clusters } = CLOUD_BAND;
  const out: CloudPuff[] = [];
  const deg = Math.PI / 180;
  for (let k = 0; k < clusters; k++) {
    const a = ((k + (rand() - 0.5) * 0.7) / clusters) * Math.PI * 2;
    const dist = near + 60 + rand() * (far - near - 160);
    const elev = minDeg + 1.2 + rand() * (maxDeg - minDeg - 2.6);
    const puffs = 4 + Math.floor(rand() * 4);
    // Tangent to the ring at the cluster: puffs are strung along it.
    const tx = -Math.sin(a);
    const tz = Math.cos(a);
    for (let p = 0; p < puffs; p++) {
      const along = (p - (puffs - 1) / 2) * (26 + rand() * 14);
      const depth = (rand() - 0.5) * 40;
      const x = Math.cos(a) * (dist + depth) + tx * along;
      const z = Math.sin(a) * (dist + depth) + tz * along;
      const d = Math.min(far, Math.max(near, Math.hypot(x, z)));
      // Middle puffs sit a little higher: a soft heap rather than a flat bar.
      const hump = 1 - Math.abs(p - (puffs - 1) / 2) / puffs;
      const e = Math.min(maxDeg, Math.max(minDeg, elev + (hump - 0.5) * 1.2 + (rand() - 0.5) * 0.6));
      const r = Math.hypot(x, z);
      out.push({
        x: (x / r) * d,
        y: Math.tan(e * deg) * d,
        z: (z / r) * d,
        sx: 30 + rand() * 26,
        sy: 8 + rand() * 6,
        sz: 20 + rand() * 14,
        yaw: rand() * Math.PI * 2,
      });
    }
  }
  return out;
}

/**
 * Spray particles at the foot of each waterfall, as flat attribute arrays for a Points
 * draw: `base` (xyz, on the plunge pool, spread across the fall's width and a few units
 * downstream), `dir` (xz unit drift direction: downstream, fanned out) and `seed` (4
 * randoms per particle: speed, phase, rise, size). The motion itself lives in the shader.
 */
export function mistParticles(falls: Waterfall[], perFall: number) {
  const n = falls.length * perFall;
  const base = new Float32Array(n * 3);
  const dir = new Float32Array(n * 2);
  const seed = new Float32Array(n * 4);
  falls.forEach((f, k) => {
    for (let j = 0; j < perFall; j++) {
      const i = k * perFall + j;
      const lat = (hash2(k, j, 11) - 0.5) * f.width;
      const ahead = 0.3 + hash2(k, j, 12) * 2.5;
      base[i * 3] = f.x + f.dx * ahead - f.dz * lat;
      base[i * 3 + 1] = f.y - f.drop + 0.2;
      base[i * 3 + 2] = f.z + f.dz * ahead + f.dx * lat;
      // Downstream, fanned out up to ~50 degrees either side.
      const fan = (hash2(k, j, 13) - 0.5) * 1.7;
      const c = Math.cos(fan);
      const s = Math.sin(fan);
      dir[i * 2] = f.dx * c - f.dz * s;
      dir[i * 2 + 1] = f.dz * c + f.dx * s;
      for (let q = 0; q < 4; q++) seed[i * 4 + q] = hash2(k * 997 + j, q, 14);
    }
  });
  return { base, dir, seed, count: n };
}
