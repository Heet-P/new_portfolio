import { describe, expect, it } from "vitest";
import { TUNNEL_VIEW, tunnelBlend } from "./tunnelCamera";

const spans = [
  { s0: 300, s1: 370 },
  { s0: 1000, s1: 1084 },
];

describe("tunnelBlend", () => {
  it("is 0 in the open, far from any tunnel", () => {
    expect(tunnelBlend(0, spans)).toBe(0);
    expect(tunnelBlend(600, spans)).toBe(0);
    expect(tunnelBlend(300 - TUNNEL_VIEW.rampIn - 1, spans)).toBe(0);
    expect(tunnelBlend(1084 + TUNNEL_VIEW.rampOut + 1, spans)).toBe(0);
  });

  it("is exactly 1 from just before the mouth to just past the far mouth, in every tunnel", () => {
    for (const s of [300 - 2, 301, 335, 369, 370 + 2]) expect(tunnelBlend(s, spans)).toBe(1);
    for (const s of [1000, 1042, 1084]) expect(tunnelBlend(s, spans)).toBe(1);
  });

  it("ramps smoothly and monotonically in on the approach and out after the exit", () => {
    let prev = 0;
    for (let s = 300 - TUNNEL_VIEW.rampIn; s <= 298; s += 1) {
      const k = tunnelBlend(s, spans);
      expect(k).toBeGreaterThanOrEqual(prev);
      prev = k;
    }
    expect(prev).toBeGreaterThan(0.95);
    prev = 1;
    for (let s = 372; s <= 370 + TUNNEL_VIEW.rampOut; s += 1) {
      const k = tunnelBlend(s, spans);
      expect(k).toBeLessThanOrEqual(prev);
      prev = k;
    }
    expect(prev).toBeLessThan(0.05);
  });

  it("stays inside the bore: the in-tunnel view is narrower and lower than the open chase view", () => {
    expect(TUNNEL_VIEW.side).toBeLessThan(2);
    expect(TUNNEL_VIEW.up).toBeLessThan(5);
  });
});
