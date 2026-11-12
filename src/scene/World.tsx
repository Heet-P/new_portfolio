"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { hash2 } from "./noise";
import { pineGeometry, rockGeometry, terrainChunk } from "./geometry";
import { MATS } from "./materials";
import { Structures } from "./Structures";
import { generateWorld, type Placement, type WorldLayout } from "./worldgen";

/** World seed: change it to reshuffle every tree and rock (the route itself is hand-placed). */
const SEED = 1;
/**
 * Terrain chunk size in world units (x, z): each chunk is one culled group (terrain + its
 * pines). Multiples of both grid steps (6 desktop, 9 phone) so chunks hold whole cells.
 */
const CHUNK_W = 360;
const CHUNK_D = 288;
/** Pines are drawn 1.3x their modelled size: the reference's forests tower over the train. */
const PINE_SCALE = 1.3;

/**
 * Build once per page load (about 30 ms) and share across mounts: the layout never
 * changes, so re-entering the ride costs nothing.
 */
let cached: WorldLayout | null = null;
export function getWorld(): WorldLayout {
  return (cached ??= generateWorld(SEED));
}

interface Chunk {
  key: string;
  terrain: THREE.BufferGeometry;
  pines: Placement[];
}

/** Split the terrain grid into chunks and bucket the (density-thinned) pines into them. */
function buildChunks(w: WorldLayout, density: number, step: number): Chunk[] {
  const { x0, x1, z0, z1 } = w.bounds;
  const nx = Math.ceil((x1 - x0) / step);
  const nz = Math.ceil((z1 - z0) / step);
  const cx = CHUNK_W / step;
  const cz = CHUNK_D / step;
  const chunks: Chunk[] = [];
  const buckets = new Map<string, Placement[]>();
  w.pines.forEach((p, i) => {
    // Golden-ratio sequence: an even thinning for any density, the same trees every time.
    if (((i * 0.618034) % 1) >= density) return;
    const key = `${Math.floor((p.x - x0) / CHUNK_W)},${Math.floor((p.z - z0) / CHUNK_D)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(p);
  });
  for (let a = 0; a * cx < nx; a++) {
    for (let b = 0; b * cz < nz; b++) {
      const terrain = terrainChunk(w, a * cx, Math.min(nx, (a + 1) * cx), b * cz, Math.min(nz, (b + 1) * cz), step);
      if (!terrain) continue;
      const key = `${a},${b}`;
      chunks.push({ key, terrain, pines: buckets.get(key) ?? [] });
    }
  }
  return chunks;
}

/**
 * Built chunks per (density, step), kept for the page's lifetime: building them is the
 * single biggest mount cost (~0.1-0.2 s), so leaving and re-entering the ride reuses them.
 */
const chunkCache = new Map<string, Chunk[]>();
function getChunks(density: number, step: number): Chunk[] {
  const key = `${density}:${step}`;
  let c = chunkCache.get(key);
  if (!c) chunkCache.set(key, (c = buildChunks(getWorld(), density, step)));
  return c;
}

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const v = new THREE.Vector3();
const sc = new THREE.Vector3();
const yAxis = new THREE.Vector3(0, 1, 0);
const olive = new THREE.Color("#fff0b0");
const forest = new THREE.Color("#c8e0c0");
const col = new THREE.Color();

/**
 * One InstancedMesh of a prop, laid out from placements. Instance colours vary each copy
 * between two tints so forests read as olive and pine greens like the reference.
 */
function Instances({
  geometry,
  material,
  items,
  scale = 1,
  shadows,
  sink = 0,
}: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  items: Placement[];
  scale?: number;
  shadows: boolean;
  /** Lower each copy by this much: hides gaps where a coarse terrain mesh dips below the true height. */
  sink?: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    items.forEach((p, i) => {
      q.setFromAxisAngle(yAxis, p.rot);
      const s = p.scale * scale;
      // Slight per-instance height variation keeps rows of trees from looking cloned.
      sc.set(s, s * (0.9 + hash2(i, 3, 1) * 0.25), s);
      m4.compose(v.set(p.x, p.y - sink, p.z), q, sc);
      mesh.setMatrixAt(i, m4);
      mesh.setColorAt(i, col.copy(forest).lerp(olive, p.tint));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items, scale, sink]);
  if (items.length === 0) return null;
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, items.length]}
      castShadow={shadows}
      receiveShadow={shadows}
    />
  );
}

/**
 * The low-poly world: chunked flat-shaded terrain with instanced pines per chunk (so whole
 * chunks frustum-cull), one batch of boulders, plus rivers, bridges and tunnels.
 * `density` (0..1) thins vegetation on weaker devices, `step` is the terrain grid spacing,
 * `shadows` toggles shadow casting. Geometry is cached at module level (never disposed).
 */
export function World({ density, step, shadows }: { density: number; step: number; shadows: boolean }) {
  const world = getWorld();
  const chunks = getChunks(density, step);
  const pine = useMemo(() => pineGeometry(), []);
  const rock = useMemo(() => rockGeometry(SEED), []);
  const rocks = useMemo(() => world.rocks.filter((_, i) => ((i * 0.618034) % 1) < Math.max(0.5, density)), [world, density]);

  return (
    <group>
      {chunks.map((c) => (
        <group key={c.key}>
          <mesh geometry={c.terrain} material={MATS.terrain} receiveShadow={shadows} />
          <Instances geometry={pine} material={MATS.foliage} items={c.pines} scale={PINE_SCALE} sink={step / 10} shadows={shadows} />
        </group>
      ))}
      <Instances geometry={rock} material={MATS.rock} items={rocks} shadows={shadows} />
      <Structures world={world} shadows={shadows} />
    </group>
  );
}
