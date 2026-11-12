import { beforeEach, describe, expect, it } from "vitest";
import { resetTravel, stepTravel, travel, trainPosition } from "./travel";

const N = 9;
const seg = 1 / (N - 1);

describe("trainPosition", () => {
  it("sits exactly on a station while in its dwell zone", () => {
    expect(trainPosition(0, N)).toBe(0);
    expect(trainPosition(2 * seg, N)).toBe(2);
    expect(trainPosition(1, N)).toBe(N - 1);
  });

  it("is halfway between stations mid-travel and grows monotonically", () => {
    expect(trainPosition(1.5 * seg, N)).toBeCloseTo(1.5);
    let last = -1;
    for (let p = 0; p <= 1; p += 0.01) {
      const x = trainPosition(p, N);
      expect(x).toBeGreaterThanOrEqual(last);
      last = x;
    }
  });
});

describe("stepTravel", () => {
  beforeEach(() => resetTravel(0, N));

  it("velocity is zero while stopped at a station", () => {
    for (let i = 0; i < 60; i++) stepTravel(0.01 * (i % 2), N, 1 / 60); // jitter inside the dwell zone
    expect(travel.velocity).toBe(0);
    expect(travel.speed).toBe(0);
  });

  it("velocity becomes positive moving forward and negative moving back", () => {
    let p = 1.2 * seg;
    resetTravel(p, N);
    for (let i = 0; i < 30; i++) stepTravel((p += 0.002), N, 1 / 60);
    expect(travel.velocity).toBeGreaterThan(0);
    expect(travel.speed).toBeGreaterThan(0);
    expect(travel.speed).toBeLessThanOrEqual(1);
    for (let i = 0; i < 60; i++) stepTravel((p -= 0.002), N, 1 / 60);
    expect(travel.velocity).toBeLessThan(0);
  });

  it("decays back to zero after the train stops", () => {
    let p = 1.2 * seg;
    resetTravel(p, N);
    for (let i = 0; i < 30; i++) stepTravel((p += 0.002), N, 1 / 60);
    for (let i = 0; i < 300; i++) stepTravel(p, N, 1 / 60);
    expect(Math.abs(travel.velocity)).toBeLessThan(1e-3);
  });

  it("ignores a zero or huge frame delta (tab switch) without exploding", () => {
    stepTravel(0.5, N, 0);
    expect(Number.isFinite(travel.velocity)).toBe(true);
    stepTravel(0.6, N, 5);
    expect(Number.isFinite(travel.velocity)).toBe(true);
  });
});
