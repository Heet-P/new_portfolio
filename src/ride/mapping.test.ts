import { describe, expect, it } from "vitest";
import { STATIONS } from "@/content/route";
import {
  STOP_HOLD,
  nearestStation,
  parseHash,
  progressToStation,
  stationToProgress,
} from "./mapping";

const N = 9;
const ids = STATIONS.map((s) => s.id);

describe("stationToProgress", () => {
  it("anchors the first and last stations at the ends", () => {
    expect(stationToProgress(0, N)).toBe(0);
    expect(stationToProgress(N - 1, N)).toBe(1);
  });

  it("is strictly increasing", () => {
    for (let i = 1; i < N; i++) {
      expect(stationToProgress(i, N)).toBeGreaterThan(stationToProgress(i - 1, N));
    }
  });

  it("returns 0 for a single-station route instead of dividing by zero", () => {
    expect(stationToProgress(0, 1)).toBe(0);
  });
});

describe("progressToStation", () => {
  it("round-trips every station as a stop with t = 0", () => {
    for (let i = 0; i < N; i++) {
      const r = progressToStation(stationToProgress(i, N), N);
      expect(r.index).toBe(i);
      expect(r.atStop).toBe(true);
      expect(r.t).toBe(0);
    }
  });

  it("clamps progress outside 0..1", () => {
    expect(progressToStation(-5, N)).toEqual({ index: 0, atStop: true, t: 0 });
    expect(progressToStation(5, N)).toEqual({ index: N - 1, atStop: true, t: 0 });
  });

  it("travels between stations: t runs 0..1 and leaves/arrives at the dwell edges", () => {
    const seg = 1 / (N - 1);
    // Midway through segment 2 -> 3 the train is moving, halfway there.
    const mid = progressToStation(2 * seg + seg / 2, N);
    expect(mid.index).toBe(2);
    expect(mid.atStop).toBe(false);
    expect(mid.t).toBeCloseTo(0.5, 10);

    // Just after the dwell ends t is ~0; just before the next dwell t is ~1.
    const half = (STOP_HOLD * seg) / 2;
    const leaving = progressToStation(2 * seg + half + 1e-6, N);
    expect(leaving.atStop).toBe(false);
    expect(leaving.t).toBeGreaterThanOrEqual(0);
    expect(leaving.t).toBeLessThan(0.01);
    const arriving = progressToStation(3 * seg - half - 1e-6, N);
    expect(arriving.atStop).toBe(false);
    expect(arriving.t).toBeGreaterThan(0.99);
    expect(arriving.t).toBeLessThanOrEqual(1);
  });

  it("snaps to the next station once inside its dwell zone", () => {
    const seg = 1 / (N - 1);
    const r = progressToStation(3 * seg - (STOP_HOLD * seg) / 4, N);
    expect(r).toEqual({ index: 3, atStop: true, t: 0 });
  });
});

describe("parseHash", () => {
  it("finds a station by exact id", () => {
    expect(parseHash("#vaani", ids)).toBe(2);
    expect(parseHash("#terminus", ids)).toBe(8);
  });

  it("falls back to 0 for unknown, wrong-case or empty hashes", () => {
    expect(parseHash("#foo", ids)).toBe(0);
    expect(parseHash("#Vaani", ids)).toBe(0);
    expect(parseHash("", ids)).toBe(0);
    expect(parseHash("#", ids)).toBe(0);
  });
});

describe("nearestStation", () => {
  it("is the stopped station at a stop and the closer station while travelling", () => {
    expect(nearestStation(0, N)).toBe(0);
    expect(nearestStation(stationToProgress(2, N), N)).toBe(2);
    // Just past the midpoint between stations 2 and 3: station 3 is closer.
    expect(nearestStation((2.51 / 8), N)).toBe(3);
    expect(nearestStation((2.49 / 8), N)).toBe(2);
    expect(nearestStation(1, N)).toBe(8);
  });

  it("clamps out-of-range progress", () => {
    expect(nearestStation(-1, N)).toBe(0);
    expect(nearestStation(2, N)).toBe(8);
  });
});
