import { describe, expect, it } from "vitest";
import { createArrivalDetector, createRisingEdge } from "./cues";

describe("createArrivalDetector (station chime)", () => {
  it("is quiet when the ride opens already parked at a station", () => {
    const arrived = createArrivalDetector();
    for (let i = 0; i < 120; i++) expect(arrived(2, 0)).toBe(false);
  });

  it("fires once when the train pulls in and comes to rest, not on every frame after", () => {
    const arrived = createArrivalDetector();
    arrived(2, 0);
    let fired = 0;
    // Pull away from 2 and run to 3.
    for (let p = 2; p < 3; p += 0.01) if (arrived(p, 0.6)) fired++;
    // Braking into the platform: still moving, no chime yet.
    if (arrived(2.995, 0.02)) fired++;
    expect(fired).toBe(0);
    // At rest: one chime, then silence while it waits there.
    for (let i = 0; i < 200; i++) if (arrived(3, 0)) fired++;
    expect(fired).toBe(1);
  });

  it("does not chime for stations passed through at speed", () => {
    const arrived = createArrivalDetector();
    arrived(0, 0);
    let fired = 0;
    for (let p = 0; p <= 4; p += 0.05) if (arrived(p, 1)) fired++;
    // Including a frame landing exactly on a station's mark at full speed.
    if (arrived(3, 1)) fired++;
    expect(fired).toBe(0);
  });

  it("a nudge within the platform does not re-chime; leaving and coming back does", () => {
    const arrived = createArrivalDetector();
    arrived(1, 0);
    arrived(1.5, 0.8);
    expect(arrived(2, 0)).toBe(true);
    // Creeps a little and settles back: still the same arrival.
    arrived(2.03, 0.05);
    expect(arrived(2, 0)).toBe(false);
    // Really leaves (backwards this time) and returns.
    arrived(1.7, 0.5);
    expect(arrived(2, 0)).toBe(true);
  });
});

describe("createRisingEdge (newspaper rustle)", () => {
  it("fires once per upward crossing and re-arms only after dropping back below", () => {
    const unfold = createRisingEdge(0.78, 0.5);
    const seq = [0, 0.3, 0.7, 0.79, 0.9, 1, 1, 0.7, 0.85, 0.4, 0.6, 0.8];
    const fires = seq.map((v) => unfold(v));
    // Crosses at 0.79; the dip to 0.7 does not re-arm; after 0.4 it crosses again at 0.8.
    expect(fires.filter(Boolean)).toHaveLength(2);
    expect(fires[3]).toBe(true);
    expect(fires[11]).toBe(true);
  });

  it("does not fire when it starts above the threshold (deep link into the cabin)", () => {
    const unfold = createRisingEdge(0.78, 0.5);
    expect(unfold(1)).toBe(false);
    expect(unfold(1)).toBe(false);
  });
});
