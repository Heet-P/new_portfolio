import { describe, expect, it } from "vitest";
import { getQuality } from "./quality";

const phone = { width: 390, dpr: 3, coarsePointer: true, cores: 6 };
const desktop = { width: 1440, dpr: 2, coarsePointer: false, cores: 8 };

describe("getQuality", () => {
  it("phones get no postprocessing and a capped pixel ratio", () => {
    const q = getQuality(phone);
    expect(q.post).toBe(false);
    expect(q.dpr).toBeLessThanOrEqual(1.5);
  });

  it("phones get fewer rain drops and scenery layers than desktop", () => {
    const p = getQuality(phone);
    const d = getQuality(desktop);
    expect(p.rainDrops).toBeLessThan(d.rainDrops);
    expect(p.sceneryLayers).toBeLessThan(d.sceneryLayers);
  });

  it("desktop gets postprocessing", () => {
    expect(getQuality(desktop).post).toBe(true);
  });

  it("never asks for more pixels than the screen has", () => {
    expect(getQuality({ ...desktop, dpr: 1 }).dpr).toBe(1);
  });

  it("weak desktops (few cores) drop postprocessing", () => {
    expect(getQuality({ ...desktop, cores: 2 }).post).toBe(false);
  });
});
