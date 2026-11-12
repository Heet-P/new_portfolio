import { describe, expect, it } from "vitest";
import { STATIONS } from "@/content/route";
import { paletteAt, STATION_PALETTES, type Palette } from "./palette";

const ids = STATIONS.map((s) => s.id);

/** Every number in a palette (colour channels flattened), in a stable order. */
function channels(p: Palette): number[] {
  return Object.keys(p)
    .sort()
    .flatMap((k) => {
      const v = p[k as keyof Palette];
      return Array.isArray(v) ? v : [v as number];
    });
}

describe("STATION_PALETTES", () => {
  it("has a palette for every station", () => {
    for (const id of ids) expect(STATION_PALETTES[id]).toBeDefined();
  });

  it("windows glow brighter at the terminus (night) than at departure (golden hour)", () => {
    expect(STATION_PALETTES.departure.windowGlow).toBeLessThan(STATION_PALETTES.terminus.windowGlow);
  });

  it("only ever gets darker down the route: window glow never drops, stars never fade", () => {
    for (let i = 1; i < ids.length; i++) {
      expect(STATION_PALETTES[ids[i]].windowGlow, ids[i]).toBeGreaterThanOrEqual(STATION_PALETTES[ids[i - 1]].windowGlow);
      expect(STATION_PALETTES[ids[i]].stars, ids[i]).toBeGreaterThanOrEqual(STATION_PALETTES[ids[i - 1]].stars);
    }
  });

  it("spreads golden hour to night over the eight stops: night is reached by the last two", () => {
    expect(STATION_PALETTES.departure.windowGlow).toBeLessThan(0.3);
    expect(STATION_PALETTES.next.windowGlow).toBeGreaterThan(2);
    expect(STATION_PALETTES.terminus.stars).toBe(1);
  });

  it("gets darker: terminus sky top is darker than departure's", () => {
    const lum = ([r, g, b]: number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
    expect(lum(STATION_PALETTES.terminus.skyTop)).toBeLessThan(lum(STATION_PALETTES.departure.skyTop) / 4);
  });
});

describe("paletteAt", () => {
  it("t = 0 equals station i's palette, t = 1 equals station i+1's", () => {
    for (let i = 0; i < ids.length - 1; i++) {
      const a = channels(paletteAt(i, 0));
      const b = channels(paletteAt(i, 1));
      channels(STATION_PALETTES[ids[i]]).forEach((v, k) => expect(a[k]).toBeCloseTo(v, 10));
      channels(STATION_PALETTES[ids[i + 1]]).forEach((v, k) => expect(b[k]).toBeCloseTo(v, 10));
    }
  });

  it("t = 0.5 lies strictly between the two stations on every channel that differs", () => {
    for (let i = 0; i < ids.length - 1; i++) {
      const a = channels(STATION_PALETTES[ids[i]]);
      const b = channels(STATION_PALETTES[ids[i + 1]]);
      const m = channels(paletteAt(i, 0.5));
      m.forEach((v, k) => {
        if (a[k] === b[k]) expect(v).toBe(a[k]);
        else {
          expect(v).toBeGreaterThan(Math.min(a[k], b[k]));
          expect(v).toBeLessThan(Math.max(a[k], b[k]));
        }
      });
    }
  });

  it("clamps at the last station", () => {
    const last = ids.length - 1;
    expect(channels(paletteAt(last, 0.7))).toEqual(channels(STATION_PALETTES[ids[last]]));
  });
});
