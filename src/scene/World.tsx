"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { hash2 } from "./noise";
import { pineGeometry, rockGeometry, terrainChunk, TERRAIN_STEP } from "./geometry";
import { MATS } from "./materials";
import { Structures } from "./Structures";
import { generateWorld, type Placement, type WorldLayout } from "./worldgen";

/** World seed: change it to reshuffle every tree and rock (the route itself is hand-placed). */
const SEED = 1;
/** Terrain chunk size in grid cells (x, z): each chunk is one culled group (terrain + its pines). */
const CHUNK_X = 30;
const CHUNK_Z = 46;
/** Pines are drawn 1.3x their modelled size: the reference's forests tower over the train. */
const PINE_SCALE = 1.3;

/** Build once per page load; ~0.1 s. Shared by every mount (the layout never changes). */
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
function buildChunks(w: WorldLayout, density: number): Chunk[] {
  const { x0, x1, z0, z1 } = w.bounds;
  const nx = Math.ceil((x1 - x0) / TERRAIN_STEP);
  const nz = Math.ceil((z1 - z0) / TERRAIN_STEP);
  const cw = CHUNK_X * TERRAIN_STEP;
  const cd = CHUNK_Z * TERRAIN_STEP;
  const chunks: Chunk[] = [];
  const buckets = new Map<string, Placement[]>();
  w.pines.forEach((p, i) => {
    // Golden-ratio sequence: an even thinning for any density, the same trees every time.
    if (((i * 0.618034) % 1) >= density) return;
    const key = `${Math.floor((p.x - x0) / cw)},${Math.floor((p.z - z0) / cd)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(p);
  });
  for (let cx = 0; cx * CHUNK_X < nx; cx++) {
    for (let cz = 0; cz * CHUNK_Z < nz; cz++) {
      const terrain = terrainChunk(
        w,
        cx * CHUNK_X,
        Math.min(nx, (cx + 1) * CHUNK_X),
        cz * CHUNK_Z,
        Math.min(nz, (cz + 1) * CHUNK_Z),
      );
      if (!terrain) continue;
      const key = `${cx},${cz}`;
      chunks.push({ key, terrain, pines: buckets.get(key) ?? [] });
    }
  }
  return chunks;
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
  flatten = 1,
}: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  items: Placement[];
  scale?: number;
  shadows: boolean;
  flatten?: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    items.forEach((p, i) => {
      q.setFromAxisAngle(yAxis, p.rot);
      const s = p.scale * scale;
      // Slight per-instance height variation keeps rows of trees from looking cloned.
      sc.set(s, s * flatten * (0.9 + hash2(i, 3, 1) * 0.25), s);
      m4.compose(v.set(p.x, p.y, p.z), q, sc);
      mesh.setMatrixAt(i, m4);
      mesh.setColorAt(i, col.copy(forest).lerp(olive, p.tint));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items, scale, flatten]);
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
 * `density` (0..1) thins vegetation on weaker devices; `shadows` toggles shadow casting.
 */
export function World({ density, shadows }: { density: number; shadows: boolean }) {
  const world = getWorld();
  const chunks = useMemo(() => buildChunks(world, density), [world, density]);
  const pine = useMemo(() => pineGeometry(), []);
  const rock = useMemo(() => rockGeometry(SEED), []);
  const rocks = useMemo(() => world.rocks.filter((_, i) => ((i * 0.618034) % 1) < Math.max(0.5, density)), [world, density]);

  // Free GPU buffers if the scene unmounts (switching to Express).
  useLayoutEffect(
    () => () => {
      for (const c of chunks) c.terrain.dispose();
    },
    [chunks],
  );

  return (
    <group>
      {chunks.map((c) => (
        <group key={c.key}>
          <mesh geometry={c.terrain} material={MATS.terrain} receiveShadow={shadows} />
          <Instances geometry={pine} material={MATS.foliage} items={c.pines} scale={PINE_SCALE} shadows={shadows} />
        </group>
      ))}
      <Instances geometry={rock} material={MATS.rock} items={rocks} shadows={shadows} />
      <Structures world={world} shadows={shadows} />
    </group>
  );
}
