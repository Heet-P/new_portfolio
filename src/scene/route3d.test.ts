import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { STATIONS } from "@/content/route";
import { nearestOnTrack, ROUTE, trainU, TRACK } from "./route3d";

describe("ROUTE", () => {
  it("has one stationU per station, strictly increasing inside (0, 1)", () => {
    expect(ROUTE.stationU).toHaveLength(STATIONS.length);
    let last = 0;
    for (const u of ROUTE.stationU) {
      expect(u).toBeGreaterThan(last);
      expect(u).toBeLessThan(1);
      last = u;
    }
  });

  it("spaces stations comfortably apart (well over a train length)", () => {
    for (let i = 1; i < ROUTE.stationU.length; i++) {
      expect((ROUTE.stationU[i] - ROUTE.stationU[i - 1]) * ROUTE.length).toBeGreaterThan(150);
    }
  });

  it("leaves track behind the departure train and ahead of the terminus train", () => {
    expect(ROUTE.stationU[0] * ROUTE.length).toBeGreaterThan(40);
    expect((1 - ROUTE.stationU[ROUTE.stationU.length - 1]) * ROUTE.length).toBeGreaterThan(40);
  });
});

describe("trainU", () => {
  it("hits stationU[i] exactly at each integer position", () => {
    ROUTE.stationU.forEach((u, i) => expect(trainU(i)).toBeCloseTo(u, 10));
  });

  it("is monotonic over the whole ride and clamps outside it", () => {
    let last = -1;
    for (let p = 0; p <= STATIONS.length - 1; p += 0.01) {
      const u = trainU(p);
      expect(u).toBeGreaterThanOrEqual(last);
      last = u;
    }
    expect(trainU(-5)).toBe(ROUTE.stationU[0]);
    expect(trainU(99)).toBe(ROUTE.stationU[ROUTE.stationU.length - 1]);
  });
});

describe("nearestOnTrack", () => {
  it("returns ~0 distance and the right arc length for points on the curve", () => {
    const p = new THREE.Vector3();
    const hit = { s: 0, d: 0, y: 0 };
    for (const u of [0.1, 0.33, 0.5, 0.77, 0.9]) {
      ROUTE.curve.getPointAt(u, p);
      nearestOnTrack(p.x, p.z, hit);
      expect(Math.abs(hit.d)).toBeLessThan(0.3);
      expect(hit.s).toBeCloseTo(u * ROUTE.length, -0.5);
      expect(hit.y).toBeCloseTo(p.y, 0);
    }
  });

  it("gives a signed lateral distance: + on the right of travel, - on the left", () => {
    const i = Math.floor(TRACK.count / 2);
    const x = TRACK.px[i];
    const z = TRACK.pz[i];
    // Right of travel = tangent x up = (-tz, 0, tx).
    const nx = -TRACK.tz[i];
    const nz = TRACK.tx[i];
    const hit = { s: 0, d: 0, y: 0 };
    nearestOnTrack(x + nx * 20, z + nz * 20, hit);
    expect(hit.d).toBeCloseTo(20, 0);
    nearestOnTrack(x - nx * 35, z - nz * 35, hit);
    expect(hit.d).toBeCloseTo(-35, 0);
  });
});
