import { describe, expect, it } from "vitest";
import { STATIONS } from "@/content/route";
import { STOP_HOLD, stationToProgress } from "./mapping";
import { LEG_SCROLL, progressToScroll, SCROLL_VH_PER_LEG, scrollToProgress, SPACER_VH } from "./scrollMap";

const N = STATIONS.length;
const half = STOP_HOLD / 2 / (N - 1);

describe("scrollMap", () => {
  it("has one scroll length per leg", () => {
    expect(LEG_SCROLL).toHaveLength(N - 1);
    for (const w of LEG_SCROLL) expect(w).toBeGreaterThanOrEqual(1);
  });

  it("maps the ends onto the ends and clamps outside 0..1", () => {
    expect(scrollToProgress(0)).toBe(0);
    expect(scrollToProgress(1)).toBe(1);
    expect(progressToScroll(0)).toBe(0);
    expect(progressToScroll(1)).toBe(1);
    expect(scrollToProgress(-2)).toBe(0);
    expect(scrollToProgress(3)).toBe(1);
    expect(progressToScroll(-2)).toBe(0);
    expect(progressToScroll(3)).toBe(1);
  });

  it("is strictly increasing and round-trips", () => {
    let last = -1;
    for (let f = 0; f <= 1; f += 0.005) {
      const p = scrollToProgress(f);
      expect(p).toBeGreaterThan(last);
      last = p;
      expect(progressToScroll(p)).toBeCloseTo(f, 9);
    }
  });

  it("holds every station for the same scroll", () => {
    const dwell = (i: number) =>
      progressToScroll(Math.min(1, stationToProgress(i, N) + half)) - progressToScroll(Math.max(0, stationToProgress(i, N) - half));
    const inner = dwell(1);
    for (let i = 1; i < N - 1; i++) expect(dwell(i)).toBeCloseTo(inner, 9);
    // Departure and the Terminus sit at the ends: only half their dwell exists.
    expect(dwell(0)).toBeCloseTo(inner / 2, 9);
    expect(dwell(N - 1)).toBeCloseTo(inner / 2, 9);
  });

  it("gives each leg's travel scroll in proportion to LEG_SCROLL (tunnel legs are longer)", () => {
    const travel = (i: number) => progressToScroll(stationToProgress(i + 1, N) - half) - progressToScroll(stationToProgress(i, N) + half);
    for (let i = 0; i < N - 1; i++) expect(travel(i) / travel(2)).toBeCloseTo(LEG_SCROLL[i] / LEG_SCROLL[2], 9);
    expect(travel(0)).toBeGreaterThan(travel(1) * 1.3);
  });

  it("makes the ride about twice the original scroll (one viewport per station)", () => {
    const original = (N - 1) * 100;
    expect(SPACER_VH - 100).toBeGreaterThan(1.8 * original);
    expect(SPACER_VH - 100).toBeLessThan(2.4 * original);
    expect(SCROLL_VH_PER_LEG).toBeGreaterThan(100);
  });
});
