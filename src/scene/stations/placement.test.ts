import { describe, expect, it } from "vitest";
import { STATIONS } from "@/content/route";
import { nearestOnTrack, ROUTE, TRACK, type TrackHit } from "../route3d";
import { generateWorld, heightAt } from "../worldgen";
import {
  BUILD_FRONT,
  CLEARANCE,
  END_SIGN,
  endSignPlacements,
  endSigns,
  fasciaPlacement,
  PLATFORM,
  stationPlacement,
  stationPlan,
  toWorld,
  trackFrame,
  type StationPlan,
} from "./placement";

const world = generateWorld(1);
const stationS = ROUTE.stationU.map((u) => u * ROUTE.length);
const idOf = (i: number) => STATIONS[i].id;
const hit: TrackHit = { s: 0, d: 0, y: 0 };
const plans = STATIONS.map((_, i) => stationPlan(i));

/** Every (along, u) point an object of the plan occupies, as its extreme corners. */
function extents(p: StationPlan): { what: string; along: number; u: number }[] {
  const b = p.building;
  const out: { what: string; along: number; u: number }[] = [];
  for (const a of [b.along - b.width / 2, b.along + b.width / 2]) {
    for (const u of [BUILD_FRONT, BUILD_FRONT + b.depth]) out.push({ what: "building", along: a, u });
  }
  out.push({ what: "canopy start", along: p.canopy.from, u: CLEARANCE });
  out.push({ what: "canopy end", along: p.canopy.to, u: CLEARANCE });
  for (const q of p.props) out.push({ what: q.kind, along: q.along, u: q.u });
  for (const q of p.panels) out.push({ what: "panel", along: q.along, u: q.u });
  for (const q of endSigns(p.index)) out.push({ what: "sign", along: q.along, u: q.u });
  return out;
}

describe("stationPlan", () => {
  it("is deterministic per station", () => {
    STATIONS.forEach((_, i) => expect(stationPlan(i)).toEqual(plans[i]));
  });

  it("gives the big main station to Departure and Terminus only", () => {
    plans.forEach((p, i) => {
      const main = idOf(i) === "departure" || idOf(i) === "terminus";
      expect(p.kind, idOf(i)).toBe(main ? "main" : "halt");
      expect(p.building.tower, idOf(i)).toBe(main);
      // The office at Work Experience is the one halt with upper floors (three in all).
      expect(p.building.floors, idOf(i)).toBe(main ? 2 : idOf(i) === "experience" ? 3 : 1);
    });
  });

  it("builds Work Experience as a flat-roofed office with more windows than any station building", () => {
    const office = plans[STATIONS.findIndex((s) => s.id === "experience")];
    expect(office.building.flatRoof).toBe(true);
    expect(office.building.tower).toBe(false);
    expect(office.building.chimney).toBeNull();
    const count = (p: StationPlan) => p.building.windows.length * p.building.floors;
    for (const p of plans) {
      if (p !== office) expect(p.building.flatRoof, idOf(p.index)).toBe(false);
      if (p !== office) expect(count(office), idOf(p.index)).toBeGreaterThan(count(p));
    }
  });

  it("gives SAHARA a helipad past the platform's far end, beside the track, and nobody else", () => {
    plans.forEach((p, i) => {
      if (idOf(i) !== "sahara") return expect(p.helipad, idOf(i)).toBeNull();
      const h = p.helipad!;
      expect(h.radius).toBeGreaterThan(2.5);
      // Beyond the platform slab and its end boards (so nothing hides it), on the platform side
      // and clear of the train's side of the track.
      expect(h.along - h.radius).toBeGreaterThan(PLATFORM.halfLength);
      expect(h.u - h.radius).toBeGreaterThan(CLEARANCE);
      // The station building stands behind the train's centre, so the pad is never behind it.
      expect(p.building.along).toBeLessThan(0);
    });
  });

  it("keeps the helipad's ground level (it lies beyond the guaranteed flat patch)", () => {
    const i = STATIONS.findIndex((s) => s.id === "sahara");
    const h = plans[i].helipad!;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      for (const r of [0, h.radius]) {
        const f = trackFrame(stationS[i] + h.along + Math.cos(a) * r);
        const [x, z] = toWorld(i, h.along + Math.cos(a) * r, -(h.u + Math.sin(a) * r));
        expect(Math.abs(heightAt(world, x, z) - (f.y - 0.35)), `angle ${k}`).toBeLessThan(0.6);
      }
    }
  });

  it("keeps the door clear of benches and planters", () => {
    for (const p of plans) {
      for (const q of p.props) {
        if (q.kind === "bench" || q.kind === "planter") {
          expect(Math.abs(q.along - p.building.door), `${idOf(p.index)} ${q.kind}`).toBeGreaterThan(1.2);
        }
      }
    }
  });
});

describe("placement on the platform side", () => {
  it("keeps everything left of travel, clear of the train, inside the flat patch", () => {
    for (const p of plans) {
      for (const e of extents(p)) {
        const [x, z] = toWorld(p.index, e.along, -e.u);
        nearestOnTrack(x, z, hit);
        const tag = `${idOf(p.index)} ${e.what}`;
        expect(hit.d, tag).toBeLessThan(0); // platform side
        expect(-hit.d, tag).toBeGreaterThanOrEqual(CLEARANCE - 0.3); // the train is 1.65 off the centreline; a bend adds slack
        expect(-hit.d, tag).toBeLessThanOrEqual(24); // worldgen flattens d -2..-24
        expect(Math.abs(hit.s - stationS[p.index]), tag).toBeLessThanOrEqual(24);
      }
    }
  });

  it("keeps the end boards' inner edge off the train's side", () => {
    expect(END_SIGN.u - END_SIGN.width / 2).toBeGreaterThanOrEqual(CLEARANCE);
  });

  it("builds the platform wide enough to reach the building and long enough for the train", () => {
    expect(PLATFORM.outer).toBeGreaterThanOrEqual(BUILD_FRONT);
    expect(PLATFORM.halfLength * 2).toBeGreaterThan(30);
    expect(PLATFORM.halfLength).toBeLessThanOrEqual(24);
  });

  it("turns the building to face the track, sitting on the platform slab", () => {
    STATIONS.forEach((_, i) => {
      const b = stationPlacement(i);
      nearestOnTrack(b.position[0], b.position[2], hit);
      const k = Math.round(hit.s / TRACK.step);
      const yaw = Math.atan2(-TRACK.tz[k], TRACK.tx[k]);
      const diff = Math.atan2(Math.sin(b.rotationY - yaw), Math.cos(b.rotationY - yaw));
      expect(Math.abs(diff), idOf(i)).toBeLessThan(0.1);
      // Floor = platform top, 0.35 + height above the cleared terrain.
      expect(b.position[1] - heightAt(world, b.position[0], b.position[2]), idOf(i)).toBeCloseTo(0.35 + PLATFORM.height, 0);
    });
  });
});

describe("endSigns", () => {
  it("stands one at each end of the platform, the front one past the parked train's nose", () => {
    STATIONS.forEach((_, i) => {
      const signs = endSigns(i);
      expect(signs).toHaveLength(2);
      const alongs = signs.map((s) => s.along).sort((a, b) => a - b);
      expect(alongs[0]).toBeLessThan(-15);
      expect(alongs[1]).toBeGreaterThan(15); // the train is ~30 long, centred on the station
      expect(alongs[1]).toBeLessThan(PLATFORM.halfLength);
    });
  });
});

describe("name board poses", () => {
  it("turns the end boards back down the track, toward the approaching camera", () => {
    STATIONS.forEach((_, i) => {
      for (const b of endSignPlacements(i)) {
        nearestOnTrack(b.position[0], b.position[2], hit);
        const k = Math.round(hit.s / TRACK.step);
        // Board front = local +Z -> world (sin, cos) of the yaw.
        const dot = Math.sin(b.rotationY) * -TRACK.tx[k] + Math.cos(b.rotationY) * -TRACK.tz[k];
        expect(dot, idOf(i)).toBeGreaterThan(0.85);
      }
    });
  });

  it("puts the fascia name on the canopy, facing the track", () => {
    STATIONS.forEach((_, i) => {
      const f = fasciaPlacement(i);
      nearestOnTrack(f.position[0], f.position[2], hit);
      expect(hit.d, idOf(i)).toBeLessThan(0);
      const k = Math.round(hit.s / TRACK.step);
      // Facing right of travel (toward the track): front direction . right normal > 0.95.
      const dot = Math.sin(f.rotationY) * -TRACK.tz[k] + Math.cos(f.rotationY) * TRACK.tx[k];
      expect(dot, idOf(i)).toBeGreaterThan(0.95);
      expect(f.maxWidth, idOf(i)).toBeGreaterThan(8);
    });
  });
});
