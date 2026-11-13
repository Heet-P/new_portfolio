import { afterEach, describe, expect, it } from "vitest";
import { cabinFrame, resetCabin, snapCabin, stepCabin, useCabin } from "./cabinStore";

afterEach(() => resetCabin());

/** Cabin loaded, train parked at `station`, frames run until the display is up. */
function parkAt(station: number) {
  cabinFrame.ready = true;
  for (let i = 0; i < 200; i++) stepCabin(station, 0, 1 / 30);
}

describe("snapCabin (Task 13: deep links and re-entry snap, never glide)", () => {
  it("jumps straight to the new stop's display on the next frame, with the right station", () => {
    parkAt(1);
    expect(useCabin.getState()).toMatchObject({ shown: true, stationIndex: 1 });
    // The driver re-anchors the ride to another station (late deep-link fix-up / Express re-entry).
    snapCabin();
    stepCabin(5, 0, 1 / 30);
    expect(cabinFrame.blend).toBe(1);
    expect(useCabin.getState()).toMatchObject({ shown: true, stationIndex: 5 });
  });

  it("snapping onto open track hides the display at once", () => {
    parkAt(2);
    snapCabin();
    stepCabin(2.5, 0, 1 / 30);
    expect(cabinFrame.blend).toBe(0);
    expect(useCabin.getState().shown).toBe(false);
  });

  it("without a snap, moving to another station glides (blend leaves 1 gradually)", () => {
    parkAt(1);
    stepCabin(1.5, 0, 1 / 30);
    expect(cabinFrame.blend).toBeGreaterThan(0.5);
  });
});
