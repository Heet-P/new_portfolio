import { describe, expect, it } from "vitest";
import { STATIONS } from "@/content/route";
import { buildStations } from "./build";
import { stationPlan, toWorld } from "./placement";

describe("buildStations", () => {
  const built = buildStations();

  it("returns the same geometry on every call (the stops never change)", () => {
    expect(buildStations()).toBe(built);
  });

  it("keeps the whole route's stations within a modest triangle budget", () => {
    expect(built.triangles.kit).toBeGreaterThan(STATIONS.length * 1500); // detailed, not boxy
    expect(built.triangles.kit).toBeLessThan(150_000);
    expect(built.triangles.panels).toBeGreaterThan(0);
    expect(built.triangles.panels).toBeLessThan(30_000);
  });

  it("emits finite, consistent attributes with some emissive vertices (windows, lamps, clocks)", () => {
    const g = built.kit;
    const count = g.getAttribute("position").count;
    for (const name of ["position", "normal", "color", "aGlow"]) expect(g.getAttribute(name).count).toBe(count);
    expect(count % 3).toBe(0);
    const pos = g.getAttribute("position").array;
    expect(pos.every((v) => Number.isFinite(v))).toBe(true);
    const glow = g.getAttribute("aGlow").array;
    let lit = 0;
    for (let i = 0; i < glow.length; i += 3) if (glow[i] > 0) lit++;
    expect(lit / count).toBeGreaterThan(0.01);
    expect(lit / count).toBeLessThan(0.3);
  });

  it("adds one small drone mesh hovering over SAHARA's helipad (the only extra draw call)", () => {
    const { drone, triangles } = built;
    expect(drone).not.toBeNull();
    expect(triangles.drone).toBeGreaterThan(100);
    expect(triangles.drone).toBeLessThan(2000);
    // A few units across, standing over the helipad's spot on the route.
    const sphere = drone!.boundingSphere!;
    expect(sphere.radius).toBeLessThan(3);
    const pad = stationPlan(STATIONS.findIndex((s) => s.id === "sahara")).helipad!;
    const [x, z] = toWorld(STATIONS.findIndex((s) => s.id === "sahara"), pad.along, -pad.u);
    expect(Math.hypot(sphere.center.x - x, sphere.center.z - z)).toBeLessThan(1);
  });

  it("carries emissive nav lights on the drone", () => {
    const glow = built.drone!.getAttribute("aGlow").array;
    expect(glow.some((v) => v > 0)).toBe(true);
  });

  it("puts panels only at the Solar stop", () => {
    const sphere = built.panels.boundingSphere!;
    const solar = stationPlan(STATIONS.findIndex((s) => s.id === "solar"));
    expect(solar.panels.length).toBeGreaterThan(0);
    // One station's field: the bounding sphere is tens of units, not the route's ~1800.
    expect(sphere.radius).toBeLessThan(80);
  });
});
