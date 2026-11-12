import { describe, expect, it } from "vitest";
import { ROUTE, TRACK } from "./route3d";
import { CORRIDOR, generateWorld, heightAt, mulberry32 } from "./worldgen";

const world = generateWorld(1);

/** True distance (x/z plane) from a point to the densely sampled track centreline. */
function distToTrack(x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i < TRACK.count; i++) {
    const dx = x - TRACK.px[i];
    const dz = z - TRACK.pz[i];
    const d = dx * dx + dz * dz;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

describe("mulberry32", () => {
  it("is deterministic per seed and stays in [0, 1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("generateWorld", () => {
  it("is deterministic: same seed, same layout", () => {
    expect(generateWorld(1)).toEqual(world);
  });

  it("differs for a different seed", () => {
    expect(generateWorld(2).pines).not.toEqual(world.pines);
  });

  it("places plenty of trees and rocks", () => {
    expect(world.pines.length).toBeGreaterThan(1500);
    expect(world.rocks.length).toBeGreaterThan(150);
  });

  it("keeps every tree and rock out of the track corridor", () => {
    // Checking a strided subset keeps the brute-force distance test fast.
    for (let i = 0; i < world.pines.length; i += 3) {
      const p = world.pines[i];
      expect(distToTrack(p.x, p.z)).toBeGreaterThan(CORRIDOR);
    }
    for (const r of world.rocks) expect(distToTrack(r.x, r.z)).toBeGreaterThan(CORRIDOR - 2);
  });

  it("has at least one bridge and one tunnel, away from every station", () => {
    expect(world.bridges.length).toBeGreaterThanOrEqual(1);
    expect(world.tunnels.length).toBeGreaterThanOrEqual(1);
    const stationS = ROUTE.stationU.map((u) => u * ROUTE.length);
    for (const f of [...world.bridges, ...world.tunnels]) {
      expect(f.s1).toBeGreaterThan(f.s0);
      for (const s of stationS) {
        // The parked train (30 long) must sit fully clear of bridges and tunnels.
        expect(s + 16 < f.s0 || s - 16 > f.s1).toBe(true);
      }
    }
  });

  it("runs the steel bridge on a straight piece of track", () => {
    const steel = world.bridges.find((b) => b.kind === "steel");
    expect(steel).toBeDefined();
    const i0 = Math.round(steel!.s0 / TRACK.step);
    const i1 = Math.round(steel!.s1 / TRACK.step);
    const dot = TRACK.tx[i0] * TRACK.tx[i1] + TRACK.tz[i0] * TRACK.tz[i1];
    expect(dot).toBeGreaterThan(Math.cos((1 * Math.PI) / 180));
  });

  it("keeps every station's platform patch flat (left of the track, ±24 along)", () => {
    for (const st of world.stationS) {
      for (let along = -24; along <= 24; along += 4) {
        const i = Math.round((st + along) / TRACK.step);
        // Left of travel = -(right normal) = (tz, -tx).
        for (let d = 2; d <= 24; d += 2) {
          const x = TRACK.px[i] + TRACK.tz[i] * d;
          const z = TRACK.pz[i] - TRACK.tx[i] * d;
          expect(Math.abs(heightAt(world, x, z) - (TRACK.py[i] - 0.35))).toBeLessThan(0.6);
        }
      }
    }
  });

  it("puts a trestle over a waterfall stream, then a tunnel, just ahead of the Departure train", () => {
    const dep = world.stationS[0];
    const trestle = world.bridges.find((b) => b.kind === "trestle")!;
    expect(trestle.s0).toBeGreaterThan(dep + 15);
    expect(trestle.s1).toBeLessThan(dep + 100);
    expect(world.tunnels.some((t) => t.s0 > trestle.s1 && t.s0 < world.stationS[1])).toBe(true);
    expect(world.waterfalls.length).toBeGreaterThan(0);
  });

  it("carves water under every bridge and raises a hill over every tunnel", () => {
    const at = (s: number) => {
      const i = Math.round(s / TRACK.step);
      return { x: TRACK.px[i], y: TRACK.py[i], z: TRACK.pz[i] };
    };
    for (const b of world.bridges) {
      const p = at((b.s0 + b.s1) / 2);
      expect(heightAt(world, p.x, p.z)).toBeLessThan(p.y - 4);
    }
    for (const t of world.tunnels) {
      const p = at((t.s0 + t.s1) / 2);
      expect(heightAt(world, p.x, p.z)).toBeGreaterThan(p.y + 8);
    }
  });
});
