import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { mulberry32 } from "../noise";

/**
 * What the cabin windows look out on: a cheap low-poly countryside on both sides of the car
 * (ground, a band of pines, faceted hills), in cabin metres. It is built from one TILE of
 * scenery repeated along the car's length, so sliding it by (distance mod TILE) is seamless;
 * Cabin slides it only when the train moves. Real 3D distance gives real parallax (near trees
 * rush past, hills crawl). Colours are vertex colours multiplied by the shared world materials,
 * which Atmosphere re-tints from the palette every frame: golden hour to night for free.
 */
export const TILE = 160;

/** Tiles repeated along x (odd, centred): enough to fill the oblique views down the car. */
const REPEAT = 5;

/**
 * One vertex colour for a whole part, non-indexed and with position + colour only, so every
 * part merges (normals are recomputed once after merging).
 */
function paint(g: THREE.BufferGeometry, color: THREE.Color): THREE.BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g;
  out.deleteAttribute("uv");
  out.deleteAttribute("normal");
  const n = out.getAttribute("position").count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) color.toArray(arr, i * 3);
  out.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return out;
}

/** Copies of `g` shifted by every tile offset. */
function repeated(g: THREE.BufferGeometry): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  for (let k = 0; k < REPEAT; k++) out.push(g.clone().translate((k - (REPEAT - 1) / 2) * TILE, 0, 0));
  return out;
}

/**
 * Faceted hill ridge along x at lateral distance `z` (sign = side): a strip of triangles
 * whose top edge rises and falls, periodic over TILE so neighbouring tiles join.
 */
function ridge(rand: () => number, z: number, base: number, height: number, color: THREE.Color): THREE.BufferGeometry {
  const steps = 16;
  const tops: number[] = [];
  for (let i = 0; i < steps; i++) tops.push(base + height * (0.45 + rand() * 0.55));
  tops.push(tops[0]); // periodic
  const pos: number[] = [];
  const dx = TILE / steps;
  const bottom = -4;
  for (let i = 0; i < steps; i++) {
    const x0 = -TILE / 2 + i * dx;
    const x1 = x0 + dx;
    // Two triangles per step; the mid-peak makes the facets read.
    const mid = (tops[i] + tops[i + 1]) / 2 + (rand() - 0.3) * height * 0.25;
    const xm = (x0 + x1) / 2;
    const zz = z + Math.sign(z) * rand() * 6; // a little depth wobble
    pos.push(x0, bottom, z, x1, bottom, z, xm, mid, zz);
    pos.push(x0, bottom, z, xm, mid, zz, x0, tops[i], z);
    pos.push(xm, mid, zz, x1, bottom, z, x1, tops[i + 1], z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  return paint(g, color);
}

/** A low-poly pine: trunk + two stacked cones. */
function pine(rand: () => number, x: number, z: number, scale: number): THREE.BufferGeometry[] {
  const h = (5 + rand() * 4) * scale;
  const green = new THREE.Color().setHSL(0.3 + rand() * 0.06, 0.38, 0.2 + rand() * 0.08);
  const darker = green.clone().multiplyScalar(0.8);
  return [
    paint(new THREE.CylinderGeometry(0.18 * scale, 0.24 * scale, h * 0.25, 5).translate(x, -1 + h * 0.125, z), new THREE.Color("#4a3624")),
    paint(new THREE.ConeGeometry(h * 0.26, h * 0.62, 6).translate(x, -1 + h * 0.5, z), darker),
    paint(new THREE.ConeGeometry(h * 0.19, h * 0.45, 6).translate(x, -1 + h * 0.8, z), green),
  ];
}

let cache: { land: THREE.BufferGeometry; trees: THREE.BufferGeometry } | null = null;

/**
 * Backdrop geometry (built once per page, shared): `land` (ground + hills, drawn with the
 * terrain material) and `trees` (foliage material). Two draw calls in total.
 */
export function backdropGeometry() {
  if (cache) return cache;
  const rand = mulberry32(42);
  const land: THREE.BufferGeometry[] = [];
  const trees: THREE.BufferGeometry[] = [];
  for (const side of [1, -1]) {
    // Ground: a wide plane a metre below the floor, out to the hills.
    const ground = new THREE.PlaneGeometry(TILE, 150, 1, 1).rotateX(-Math.PI / 2).translate(0, -1, side * 78);
    land.push(paint(ground, new THREE.Color("#6d7f45")));
    // Near hills, then a taller, bluer far range.
    land.push(ridge(rand, side * 70, 2, 14, new THREE.Color("#5f7446")));
    land.push(ridge(rand, side * 140, 8, 34, new THREE.Color("#7a8a9a")));
    // A band of pines: a few close ones (fast parallax), more further out.
    for (let i = 0; i < 26; i++) {
      const x = -TILE / 2 + rand() * TILE;
      const z = side * (i < 6 ? 9 + rand() * 6 : 18 + rand() * 40);
      trees.push(...pine(rand, x, z, i < 6 ? 0.8 : 1 + rand() * 0.4));
    }
  }
  const one = (parts: THREE.BufferGeometry[]) => {
    const g = mergeGeometries(parts.flatMap(repeated));
    g.computeVertexNormals();
    return g;
  };
  cache = { land: one(land), trees: one(trees) };
  return cache;
}
