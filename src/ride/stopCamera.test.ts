import { describe, expect, it } from "vitest";
import { STATIONS } from "@/content/route";
import { displayOpacity, passGate, smoothDamp, STOP_PHASE, stopBlend, swapOpacity } from "./stopCamera";

/*
 * stopBlend takes the TRAIN's smoothed position (travel.position, in stations), not the
 * scroll progress: the camera only goes into the cabin once the train itself has pulled in.
 * Station i sits at position i, so "the centre of a stop" is every integer and "mid-travel"
 * is every i + 0.5.
 */
const COUNT = STATIONS.length;

describe("stopBlend", () => {
  it("is 0 at mid-travel between every pair of stations", () => {
    for (let i = 0; i < COUNT - 1; i++) expect(stopBlend(i + 0.5)).toBe(0);
  });

  it("is 1 at the centre of every stop", () => {
    for (let i = 0; i < COUNT; i++) expect(stopBlend(i)).toBe(1);
  });

  it("stays 0 for most of the journey (the cabin is only for the final approach)", () => {
    for (let i = 0; i < COUNT - 1; i++) {
      expect(stopBlend(i + 0.2)).toBe(0);
      expect(stopBlend(i + 0.8)).toBe(0);
    }
  });

  it("rises monotonically toward each stop and falls monotonically after it", () => {
    for (let i = 0; i < COUNT; i++) {
      // Approach half: i - 0.5 -> i (non-decreasing). Departure half: i -> i + 0.5 (non-increasing).
      let prevIn = -1;
      let prevOut = 2;
      for (let k = 0; k <= 2000; k++) {
        const d = 0.5 - (k / 2000) * 0.5; // 0.5 -> 0
        if (i > 0) {
          const v = stopBlend(i - d);
          expect(v).toBeGreaterThanOrEqual(prevIn);
          prevIn = v;
        }
        const w = stopBlend(i + 0.5 - d); // i -> i + 0.5 as k grows
        if (i < COUNT - 1) {
          expect(w).toBeLessThanOrEqual(prevOut);
          prevOut = w;
        }
      }
    }
  });

  it("is continuous (no jumps anywhere along the route)", () => {
    const step = 1e-5;
    let prev = stopBlend(0);
    for (let p = step; p <= COUNT - 1; p += step) {
      const v = stopBlend(p);
      expect(Math.abs(v - prev)).toBeLessThan(0.01);
      prev = v;
    }
  });

  it("always lies in 0..1", () => {
    for (let p = -0.5; p <= COUNT - 0.5; p += 0.001) {
      const v = stopBlend(p);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe("passGate", () => {
  it("lets the cabin open while the train is slowing into a stop", () => {
    expect(passGate(0)).toBe(1);
    expect(passGate(0.4)).toBe(1);
  });

  it("keeps the camera outside while the train runs through a station at speed", () => {
    expect(passGate(0.9)).toBe(0);
    expect(passGate(1)).toBe(0);
  });
});

describe("swap overlay and display timing", () => {
  it("covers the screen fully across the moment the camera cuts inside", () => {
    expect(swapOpacity(0)).toBe(0);
    expect(swapOpacity(STOP_PHASE.swoopEnd)).toBe(0);
    expect(swapOpacity(STOP_PHASE.cut)).toBe(1);
    expect(swapOpacity(STOP_PHASE.swapIn)).toBe(1);
    expect(swapOpacity(STOP_PHASE.swapOut)).toBe(1);
    expect(swapOpacity(STOP_PHASE.fadeEnd)).toBe(0);
    expect(swapOpacity(1)).toBe(0);
  });

  it("only shows the display once the camera is settling inside", () => {
    expect(displayOpacity(STOP_PHASE.fadeEnd)).toBe(0);
    expect(displayOpacity(1)).toBe(1);
  });
});

describe("smoothDamp", () => {
  it("approaches the target without overshooting and settles", () => {
    const s = { value: 0, velocity: 0 };
    let max = 0;
    for (let i = 0; i < 300; i++) {
      smoothDamp(s, 1, 0.3, 1 / 60);
      max = Math.max(max, s.value);
    }
    expect(max).toBeLessThanOrEqual(1);
    expect(s.value).toBeCloseTo(1, 3);
  });
});
