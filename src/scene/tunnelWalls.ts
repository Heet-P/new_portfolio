import * as THREE from "three";
import { hash2 } from "./noise";

/**
 * Faceted stone for the tunnel bores. The lining is unlit (MeshBasicMaterial, see MATS.tunnel),
 * so its look is baked into vertex colours: every facet gets its own dark warm grey, and the
 * stone near each poster is lifted in the posters' warm paper light, so the posters read as lit
 * bills on a wall rather than floating in black. No real lights.
 */
const STONE_DARK = new THREE.Color("#1d1a17");
const STONE_LIGHT = new THREE.Color("#342e29");
/** The warm tint the posters throw on the stone beside them (linear RGB). */
const GLOW = new THREE.Color("#ffb868");
/** Radius (units) of a poster's pool of light on the wall, how much it multiplies the stone, and how much light it adds. */
const POOL = { radius: 2.4, lift: 2.2, add: 0.02 };

const c = new THREE.Color();

/**
 * Paint `g` (any geometry with positions; made non-indexed so each triangle is a flat facet) with
 * stone colours, lit by `lamps` (world-space poster centres). Returns the non-indexed geometry
 * with a `color` attribute.
 */
export function paintBore(g: THREE.BufferGeometry, lamps: [number, number, number][]): THREE.BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g;
  const pos = out.getAttribute("position");
  const col = new Float32Array(pos.count * 3);
  for (let t = 0; t + 2 < pos.count; t += 3) {
    // One stone tone per facet, a touch warmer or cooler by a second hash.
    c.copy(STONE_DARK).lerp(STONE_LIGHT, hash2(t, 5, 17));
    c.r *= 0.92 + hash2(t, 9, 3) * 0.16;
    for (let v = t; v < t + 3; v++) {
      // Pool of poster light at this vertex: the strongest lamp's Gaussian falloff.
      let pool = 0;
      for (const [lx, ly, lz] of lamps) {
        const d2 = (pos.getX(v) - lx) ** 2 + (pos.getY(v) - ly) ** 2 + (pos.getZ(v) - lz) ** 2;
        pool = Math.max(pool, Math.exp(-d2 / (POOL.radius * POOL.radius)));
      }
      col[v * 3] = c.r * (1 + POOL.lift * pool) + GLOW.r * POOL.add * pool;
      col[v * 3 + 1] = c.g * (1 + POOL.lift * pool) + GLOW.g * POOL.add * pool;
      col[v * 3 + 2] = c.b * (1 + POOL.lift * pool) + GLOW.b * POOL.add * pool;
    }
  }
  out.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return out;
}
