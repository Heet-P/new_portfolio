import { describe, expect, it } from "vitest";
import { DRONE_BOB, droneBobY } from "./drone";

describe("droneBobY", () => {
  it("hangs still (0) under reduced motion, whatever the time", () => {
    for (const t of [0, 0.3, 1.7, 42]) expect(droneBobY(t, true)).toBe(0);
  });

  it("bobs gently within +-amplitude and actually moves otherwise", () => {
    let min = Infinity;
    let max = -Infinity;
    for (let t = 0; t < 20; t += 0.01) {
      const y = droneBobY(t, false);
      min = Math.min(min, y);
      max = Math.max(max, y);
    }
    expect(max).toBeLessThanOrEqual(DRONE_BOB.amplitude);
    expect(min).toBeGreaterThanOrEqual(-DRONE_BOB.amplitude);
    expect(max).toBeGreaterThan(DRONE_BOB.amplitude * 0.95);
    expect(min).toBeLessThan(-DRONE_BOB.amplitude * 0.95);
  });
});
