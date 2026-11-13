import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { sweep } from "./geometry";
import { hash2 } from "./noise";
import { TRACK } from "./route3d";
import { BORE_HALF, BORE_SPRING, MOUTH_DEPTH, TUNNEL_HILL, TUNNEL_HOLE, type Span } from "./worldgen";

/**
 * Static geometry around the tunnel bores that has to meet the terrain without gaps: the rocky
 * portal at each mouth, the grassy roof over the terrain's hole and the ground in front of each
 * mouth. Pure (no React), so worldgen tests can build it and check the seams. Structures.tsx
 * draws it; the bore lining itself (with its skills reel lighting) stays there.
 */

/** Track frame (position, tangent, right) at arc length s, as plain numbers. */
export function frameAt(s: number) {
  const i = Math.max(0, Math.min(TRACK.count - 1, Math.round(s / TRACK.step)));
  const tx = TRACK.tx[i];
  const tz = TRACK.tz[i];
  return { x: TRACK.px[i], y: TRACK.py[i], z: TRACK.pz[i], tx, tz, nx: -tz, nz: tx };
}

/** Give a geometry one vertex colour (for vertex-coloured materials). */
export function painted(g: THREE.BufferGeometry, hex: string): THREE.BufferGeometry {
  const c = new THREE.Color(hex);
  const n = g.getAttribute("position").count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(arr, i * 3);
  g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return g;
}

/** Strip to position-only non-indexed geometry so different builders can be merged. */
export function bare(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const n = g.index ? g.toNonIndexed() : g;
  for (const name of Object.keys(n.attributes)) if (name !== "position" && name !== "color") n.deleteAttribute(name);
  return n;
}

/** Rock colours for the portal (sRGB as authored), picked per facet. */
const ROCK_COLS = ["#a39c8d", "#8f8a80", "#b4a68a", "#7d7a74", "#c2b496"].map((h) => new THREE.Color(h));

/**
 * Rocky portal for one tunnel mouth: rings of jittered vertices offset outward from the
 * bore's outline (walls + arch), standing proud of the hillside and then folding back into
 * it, so the mouth reads as an arch cut into a faceted rock face. Plus a few boulders on its
 * shoulders.
 * Vertex-coloured per facet in warm and cool greys.
 */
export function portal(s: number, inward: 1 | -1, seed: number): THREE.BufferGeometry {
  // Bore outline (local x = lateral, y = up) with outward normals: left wall, arch, right wall.
  // On the bore's own wall, so the rock's inner edge meets the lining (which starts a unit
  // in front of the mouth, see Structures) with no slit between them.
  const path: [number, number, number, number][] = [];
  const edge = BORE_HALF + 0.05;
  for (const y of [-1.5, 1.5]) path.push([-edge, y, -1, 0]);
  for (let k = 0; k <= 10; k++) {
    const a = Math.PI - (k / 10) * Math.PI;
    path.push([Math.cos(a) * edge, BORE_SPRING + Math.sin(a) * edge, Math.cos(a), Math.sin(a)]);
  }
  for (const y of [1.5, -1.5]) path.push([edge, y, 1, 0]);
  /**
   * Ring offsets outward and how far back into the hill each ring sits (- = in front of the
   * portal). The terrain is cut away in a slot around the bore (worldgen's inMouthCut) and the
   * hillside rises as a cliff right at the portal, so the inner rings stand just proud of that
   * cliff and reach above the hill's crest (TUNNEL_HILL; the clamp below flattens them into a
   * rocky cap over the slot), and the outer ring is buried in the hillside, deep enough to close
   * the slot from above too. Every line of sight toward the mouth therefore meets rock or
   * hillside: no seam to see through.
   */
  const rings: [number, number][] = [
    [0, -0.9],
    [1.8, -1.5],
    [4.4, -1.4],
    [7.6, -1.1],
    [11, MOUTH_DEPTH + 2.5],
  ];
  const verts: THREE.Vector3[][] = rings.map(([off, back], r) =>
    path.map(([px, py, nx, ny], j) => {
      const jit = r === 0 ? 0 : (hash2(seed * 31 + r, j, 7) - 0.5) * 1.8;
      const y = Math.min(py + ny * (off + jit), TUNNEL_HILL + 1 + hash2(seed, j, r) * 1.5);
      return new THREE.Vector3(px + nx * (off + jit), y, back + (hash2(seed, r, j) - 0.5) * 0.8);
    }),
  );
  const pos: number[] = [];
  const col: number[] = [];
  const face = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, h: number) => {
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    const colour = ROCK_COLS[Math.floor(h * ROCK_COLS.length)];
    for (let v = 0; v < 3; v++) col.push(colour.r, colour.g, colour.b);
  };
  for (let r = 0; r + 1 < rings.length; r++) {
    for (let j = 0; j + 1 < path.length; j++) {
      const a = verts[r][j];
      const b = verts[r][j + 1];
      const c = verts[r + 1][j];
      const d = verts[r + 1][j + 1];
      face(a, c, b, hash2(seed, r * 50 + j, 1));
      face(b, c, d, hash2(seed, r * 50 + j, 2));
    }
  }
  const face3 = new THREE.BufferGeometry();
  face3.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  face3.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));

  // Boulders on the shoulders, never in front of the opening.
  const parts: THREE.BufferGeometry[] = [face3];
  for (let k = 0; k < 6; k++) {
    const side = k % 2 ? 1 : -1;
    const x = side * (edge + 7 + hash2(seed, k, 3) * 5);
    const y = hash2(seed, k, 4) * 8;
    const r = 1.6 + hash2(seed, k, 2) * 2.2;
    const g = new THREE.IcosahedronGeometry(r, 0).scale(1.2, 0.85, 1).translate(x, y, -1 + y * 0.2); // polyhedra are already non-indexed
    g.deleteAttribute("uv");
    g.deleteAttribute("normal");
    const c = ROCK_COLS[k % ROCK_COLS.length];
    const n = g.getAttribute("position").count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) c.toArray(arr, i * 3);
    g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
    parts.push(g);
  }
  const g = mergeGeometries(parts);

  // Local frame: +Z points into the bore, +Y up.
  const f = frameAt(s);
  const z = new THREE.Vector3(f.tx * inward, 0, f.tz * inward);
  const y = new THREE.Vector3(0, 1, 0);
  const x = new THREE.Vector3().crossVectors(y, z);
  const m = new THREE.Matrix4().makeBasis(x, y, z).setPosition(f.x, f.y, f.z);
  return g.applyMatrix4(m);
}

/** The tunnel pieces that meet the terrain around each bore (everything but the bore lining). */
export interface TunnelShell {
  /** Ground in front of each mouth, under the terrain's slot (inside, the bore has its own floor). */
  floor: THREE.BufferGeometry;
  /** Rocky portals at both ends of every tunnel. */
  stone: THREE.BufferGeometry;
}

/**
 * Build the floor and the portal rock for all tunnels (vertex normals computed). No roof: the
 * terrain is only cut at the mouths (worldgen's inMouthCut), so the hill itself covers the bore.
 */
export function tunnelShell(tunnels: Span[]): TunnelShell {
  const W = TUNNEL_HOLE + 7;
  const out: TunnelShell = {
    floor: mergeGeometries(
      tunnels.flatMap((t) => [
        bare(sweep([[-W, -0.45], [W, -0.45]], Math.max(0, t.s0 - 8), t.s0 + 1)),
        bare(sweep([[-W, -0.45], [W, -0.45]], t.s1 - 1, t.s1 + 8)),
      ]),
    ),
    stone: mergeGeometries(tunnels.flatMap((t, k) => [portal(t.s0, 1, k * 2), portal(t.s1, -1, k * 2 + 1)])),
  };
  for (const g of Object.values(out)) g.computeVertexNormals();
  return out;
}
