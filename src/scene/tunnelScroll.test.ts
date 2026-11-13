import { describe, expect, it } from "vitest";
import { LEG_SCROLL, scrollToProgress } from "@/ride/scrollMap";
import { ROUTE } from "./route3d";
import { trainPosition } from "./travel";
import { TUNNEL_VIEW, tunnelBlend } from "./tunnelCamera";
import { legScroll, scrollWeight, TUNNEL_SCROLL, tunnelScrollWarp } from "./tunnelScroll";
import { generateWorld } from "./worldgen";

const world = generateWorld(1);
const N = ROUTE.stationU.length;
const warp = tunnelScrollWarp(world.tunnels);
/** Train position (stations) for a train-centre arc length. */
const positionAt = (s: number) => (s - world.stationS[0]) / ROUTE.spacing;

/** Scroll fraction (0..1 of the page) at which the train's target is at `position`: bisection, it is monotonic. */
function scrollAt(position: number): number {
  let lo = 0;
  let hi = 1;
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if (trainPosition(scrollToProgress(mid), N, warp) < position) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

describe("scrollWeight", () => {
  it("is 1 on open track and at every station", () => {
    expect(scrollWeight(world.stationS[0] + 20, world.tunnels)).toBe(1);
    for (const s of world.stationS) expect(scrollWeight(s, world.tunnels)).toBe(1);
  });

  it("is TUNNEL_SCROLL while the camera is in a bore, and between the two on the ramps", () => {
    let inside = 0;
    for (let s = 0; s < ROUTE.length; s += 0.5) {
      const w = scrollWeight(s, world.tunnels);
      expect(w).toBeGreaterThanOrEqual(1);
      expect(w).toBeLessThanOrEqual(TUNNEL_SCROLL);
      if (tunnelBlend(s - TUNNEL_VIEW.chase, world.tunnels) === 1) {
        inside++;
        expect(w).toBe(TUNNEL_SCROLL);
      }
    }
    expect(inside).toBeGreaterThan(0);
  });

  it("no station's stop camera is inside a tunnel ramp (the camera framing at a stop is untouched)", () => {
    for (const s of world.stationS) {
      // From the chase camera's usual place behind the train to well past the platform.
      for (let d = -TUNNEL_VIEW.chase - 20; d <= 20; d += 1) expect(tunnelBlend(s + d, world.tunnels)).toBe(0);
    }
  });
});

describe("tunnelScrollWarp", () => {
  it("runs 0 -> 1 monotonically on every leg, and is the identity on legs without a tunnel", () => {
    for (let leg = 0; leg < N - 1; leg++) {
      expect(warp(leg, 0)).toBe(0);
      expect(warp(leg, 1)).toBeCloseTo(1, 12);
      let last = 0;
      for (let f = 0.01; f <= 1; f += 0.01) {
        const x = warp(leg, f);
        expect(x).toBeGreaterThan(last);
        last = x;
        if (legScroll(world.tunnels)[leg] === 1) expect(x).toBeCloseTo(f, 9);
      }
    }
  });

  it("matches the scroll lengths the page is built with (scrollMap's LEG_SCROLL)", () => {
    const legs = legScroll(world.tunnels);
    expect(legs).toHaveLength(LEG_SCROLL.length);
    legs.forEach((w, i) => expect(Math.abs(w - LEG_SCROLL[i])).toBeLessThan(0.005));
  });
});

describe("tunnels take more scroll", () => {
  it("a stretch inside each bore takes 2.5-3x the scroll of open track of the same length", () => {
    // Open track: 20 units mid-way along a plain leg (YieldGuard to Solar).
    const mid2 = (world.stationS[2] + world.stationS[3]) / 2;
    const open = scrollAt(positionAt(mid2 + 10)) - scrollAt(positionAt(mid2 - 10));
    for (const t of world.tunnels) {
      // 20 units with the chase camera in the middle of the bore.
      const s = (t.s0 + t.s1) / 2 + TUNNEL_VIEW.chase;
      const bore = scrollAt(positionAt(s + 10)) - scrollAt(positionAt(s - 10));
      expect(bore / open).toBeGreaterThan(2.5);
      expect(bore / open).toBeLessThan(3);
    }
  });
});
