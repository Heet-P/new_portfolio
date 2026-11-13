import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { paintBore } from "./tunnelWalls";

/** A strip of `n` triangles along +x, each its own facet, non-indexed. */
function strip(n: number): THREE.BufferGeometry {
  const pos: number[] = [];
  for (let i = 0; i < n; i++) pos.push(i * 4, 0, 0, i * 4 + 3, 0, 0, i * 4, 2, 0);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  return g;
}
const lum = (g: THREE.BufferGeometry, v: number) => {
  const c = g.getAttribute("color");
  return c.getX(v) + c.getY(v) + c.getZ(v);
};

describe("paintBore", () => {
  it("gives every vertex a finite colour, one colour per facet when nothing lights it", () => {
    const g = paintBore(strip(20), []);
    expect(g.getAttribute("color").count).toBe(g.getAttribute("position").count);
    for (let t = 0; t < 20; t++) {
      expect(Number.isFinite(lum(g, t * 3))).toBe(true);
      expect(lum(g, t * 3 + 1)).toBeCloseTo(lum(g, t * 3), 9);
      expect(lum(g, t * 3 + 2)).toBeCloseTo(lum(g, t * 3), 9);
    }
  });

  it("varies from facet to facet (faceted stone, not a flat fill) but stays dark", () => {
    const g = paintBore(strip(20), []);
    const values = Array.from({ length: 20 }, (_, t) => lum(g, t * 3));
    expect(new Set(values.map((v) => v.toFixed(4))).size).toBeGreaterThan(5);
    for (const v of values) expect(v).toBeLessThan(0.45);
  });

  it("is brighter near a poster's lamp than far from it", () => {
    const base = paintBore(strip(10), []);
    const lit = paintBore(strip(10), [[2, 1, 0]]);
    // First facet is next to the lamp (distance ~1.5), the last is 36 units away.
    expect(lum(lit, 0)).toBeGreaterThan(lum(base, 0) * 1.5);
    expect(lum(lit, 27)).toBeCloseTo(lum(base, 27), 6);
  });

  it("copes with indexed geometry", () => {
    const g = new THREE.PlaneGeometry(2, 2);
    const out = paintBore(g, []);
    expect(out.index).toBeNull();
    expect(out.getAttribute("color").count).toBe(out.getAttribute("position").count);
  });
});
