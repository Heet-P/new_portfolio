import { describe, expect, it } from "vitest";
import { STATION_PALETTES } from "./palette";
import { CLOUD_BAND, cloudPuffs, mistParticles, nightAmount, rainAmount, rainSlant } from "./weather";

const P = STATION_PALETTES;

describe("rainAmount", () => {
  it("is dry from golden hour through dusk", () => {
    for (const id of ["departure", "vaani", "yieldguard", "solar"] as const) {
      expect(rainAmount(P[id].windowGlow)).toBe(0);
    }
  });

  it("fades in over the night stretch and is full at the last stations", () => {
    expect(rainAmount(P.sahara.windowGlow)).toBeGreaterThan(0);
    expect(rainAmount(P.sahara.windowGlow)).toBeLessThan(rainAmount(P.experience.windowGlow));
    expect(rainAmount(P.next.windowGlow)).toBe(1);
    expect(rainAmount(P.terminus.windowGlow)).toBe(1);
  });
});

describe("nightAmount", () => {
  it("is ~0 at golden hour and 1 at night", () => {
    expect(nightAmount(P.departure.windowGlow)).toBe(0);
    expect(nightAmount(P.terminus.windowGlow)).toBe(1);
  });

  it("is noticeable by dusk", () => {
    expect(nightAmount(P.solar.windowGlow)).toBeGreaterThan(0.3);
  });
});

describe("rainSlant", () => {
  it("leans more the faster the train goes", () => {
    expect(rainSlant(0)).toBeGreaterThan(0);
    expect(rainSlant(1)).toBeGreaterThan(rainSlant(0.5));
    expect(rainSlant(0.5)).toBeGreaterThan(rainSlant(0));
  });

  it("clamps outside 0..1", () => {
    expect(rainSlant(5)).toBe(rainSlant(1));
    expect(rainSlant(-1)).toBe(rainSlant(0));
  });
});

describe("cloudPuffs", () => {
  it("is deterministic for a seed and differs between seeds", () => {
    expect(cloudPuffs(3)).toEqual(cloudPuffs(3));
    expect(cloudPuffs(3)).not.toEqual(cloudPuffs(4));
  });

  it("keeps every puff inside the sky band seen by the chase camera", () => {
    for (const p of cloudPuffs(3)) {
      const dist = Math.hypot(p.x, p.z);
      expect(dist).toBeGreaterThanOrEqual(CLOUD_BAND.near);
      expect(dist).toBeLessThanOrEqual(CLOUD_BAND.far);
      const elev = (Math.atan2(p.y, dist) * 180) / Math.PI;
      expect(elev).toBeGreaterThanOrEqual(CLOUD_BAND.minDeg);
      expect(elev).toBeLessThanOrEqual(CLOUD_BAND.maxDeg);
    }
  });

  it("spreads clusters all round the sky, so every heading sees some", () => {
    const quadrants = new Set(cloudPuffs(3).map((p) => Math.floor(((Math.atan2(p.z, p.x) + Math.PI) / (Math.PI * 2)) * 4) % 4));
    expect(quadrants.size).toBe(4);
  });

  it("makes flattened puffs (wider than tall)", () => {
    for (const p of cloudPuffs(3)) expect(p.sy).toBeLessThan(Math.min(p.sx, p.sz));
  });
});

describe("mistParticles", () => {
  const fall = { x: 10, y: 9, z: -20, drop: 8, dx: 0, dz: 1, width: 11 };

  it("builds `perFall` particles per waterfall, based at the foot of the drop", () => {
    const m = mistParticles([fall, { ...fall, x: 40 }], 30);
    expect(m.base.length).toBe(2 * 30 * 3);
    expect(m.seed.length).toBe(2 * 30 * 4);
    for (let i = 0; i < 30; i++) {
      const y = m.base[i * 3 + 1];
      expect(y).toBeCloseTo(fall.y - fall.drop, 0);
      // Spread across the width of the fall.
      expect(Math.abs(m.base[i * 3] - fall.x)).toBeLessThanOrEqual(fall.width / 2 + 1e-6);
    }
  });

  it("is deterministic", () => {
    expect(mistParticles([fall], 10)).toEqual(mistParticles([fall], 10));
  });
});
