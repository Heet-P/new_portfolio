import { describe, expect, it } from "vitest";
import { ROUTE, trainU } from "./route3d";
import { MAX_SPEED, resetTravel, stepTravel, travel } from "./travel";
import { TUNNEL_VIEW, tunnelBlend } from "./tunnelCamera";
import { TUNNEL_SPEED, tunnelPaceCap } from "./tunnelPace";
import { generateWorld } from "./worldgen";

const world = generateWorld(1);
const N = ROUTE.stationU.length;
const trainS = (position: number) => trainU(position) * ROUTE.length;
const cameraS = (position: number) => trainS(position) - TUNNEL_VIEW.chase;

describe("tunnelPaceCap", () => {
  it("is full speed in the open and at every station", () => {
    expect(tunnelPaceCap(0, world.tunnels)).toBe(MAX_SPEED);
    for (let i = 0; i < N; i++) expect(tunnelPaceCap(i, world.tunnels)).toBe(MAX_SPEED);
  });

  it("is TUNNEL_SPEED while the camera is inside a bore, and between the two in the ramps", () => {
    let inside = 0;
    for (let x = 0; x < N - 1; x += 0.005) {
      const cap = tunnelPaceCap(x, world.tunnels);
      expect(cap).toBeGreaterThanOrEqual(TUNNEL_SPEED - 1e-9);
      expect(cap).toBeLessThanOrEqual(MAX_SPEED + 1e-9);
      if (tunnelBlend(cameraS(x), world.tunnels) === 1) {
        inside++;
        expect(cap).toBeCloseTo(TUNNEL_SPEED, 9);
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

  it("a tunnel takes several seconds to pass at the capped speed, with a smooth ride in and out", () => {
    resetTravel(0, N);
    const dt = 1 / 60;
    let inside = 0;
    let passing = 0;
    let last = 0;
    for (let i = 0; i < 60 * 80 && travel.position < 1; i++) {
      // Target the next station, as a flick of the scroll would.
      stepTravel(1 / (N - 1), N, dt, (x) => tunnelPaceCap(x, world.tunnels));
      const k = tunnelBlend(cameraS(travel.position), world.tunnels);
      if (k === 1) inside += dt;
      if (k > 0) passing += dt;
      expect(Math.abs(travel.velocity - last)).toBeLessThanOrEqual(0.45 * dt + 1e-9);
      last = travel.velocity;
    }
    expect(travel.position).toBeGreaterThan(0.99);
    // Inside the bore itself, and from the first slowing to the last easing back up (a single tunnel here: one leg).
    expect(inside).toBeGreaterThan(2.2);
    expect(passing).toBeGreaterThan(3.5);
    expect(passing).toBeLessThan(8);
  });
});
