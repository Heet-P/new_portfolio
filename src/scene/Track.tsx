"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { sweep } from "./geometry";
import { MATS } from "./materials";
import { ROUTE, TRACK } from "./route3d";
import type { Span, WorldLayout } from "./worldgen";

/** Track layout. The train's wheels sit at y = 0, so the rail tops are at y = 0 too. */
const TRACK_DIM = {
  /** Distance between rail centres (matches the model's wheel line, z = +-0.75). */
  gauge: 1.5,
  railWidth: 0.1,
  railHeight: 0.12,
  sleeperSpacing: 1.2,
  /** Ballast shoulder: top half-width, bottom half-width. */
  ballastTop: 1.6,
  ballastBottom: 2.3,
} as const;

/** The parts of [0, length] not covered by any of `gaps`, as [s0, s1] pieces. */
function pieces(gaps: Span[], length: number): [number, number][] {
  const sorted = [...gaps].sort((a, b) => a.s0 - b.s0);
  const out: [number, number][] = [];
  let s = 0;
  for (const g of sorted) {
    if (g.s0 > s) out.push([s, g.s0]);
    s = Math.max(s, g.s1);
  }
  if (s < length) out.push([s, length]);
  return out;
}

/**
 * Static track along the curve: ballast bed, two rails and instanced sleepers. It does not
 * move; the train runs along it. Skips the steel bridge (the model carries its own rails
 * and sleepers); the wooden trestle keeps rails and sleepers but no ballast.
 */
export function Track({ world, shadows }: { world: WorldLayout; shadows: boolean }) {
  const sleepers = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => {
    const steel = world.bridges.filter((b) => b.kind === "steel");
    const railPieces = pieces(steel, ROUTE.length);
    const bedPieces = pieces(world.bridges, ROUTE.length);
    const { gauge, railWidth: w, railHeight: h, ballastTop: bt, ballastBottom: bb } = TRACK_DIM;
    // Rail cross-section, walked so the faces point outwards (left side, top, right side).
    const rail = (c: number): [number, number][] => [
      [c - w / 2, -h],
      [c - w / 2, 0],
      [c + w / 2, 0],
      [c + w / 2, -h],
    ];
    const rails = mergeGeometries(
      railPieces.flatMap(([a, b]) => [sweep(rail(-gauge / 2), a, b, 2), sweep(rail(gauge / 2), a, b, 2)]),
    );
    const ballast = mergeGeometries(
      bedPieces.map(([a, b]) =>
        sweep([[-bb, -0.55], [-bt, -0.2], [bt, -0.2], [bb, -0.55]], a, b, 3),
      ),
    );
    // Sleeper transforms along every non-steel-bridge piece.
    const mats: THREE.Matrix4[] = [];
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    for (const [a, b] of railPieces) {
      for (let s = a + 0.6; s < b; s += TRACK_DIM.sleeperSpacing) {
        const i = Math.min(TRACK.count - 1, Math.round(s / TRACK.step));
        q.setFromAxisAngle(up, Math.atan2(-TRACK.tz[i], TRACK.tx[i]));
        mats.push(
          new THREE.Matrix4().compose(new THREE.Vector3(TRACK.px[i], TRACK.py[i] - 0.17, TRACK.pz[i]), q, new THREE.Vector3(1, 1, 1)),
        );
      }
    }
    return { rails, ballast, mats };
  }, [world]);

  useLayoutEffect(() => {
    const mesh = sleepers.current;
    if (!mesh) return;
    geo.mats.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [geo]);

  return (
    <group>
      <mesh geometry={geo.ballast} material={MATS.ballast} receiveShadow={shadows} />
      <mesh geometry={geo.rails} material={MATS.rail} receiveShadow={shadows} />
      <instancedMesh
        ref={sleepers}
        args={[undefined, MATS.sleeper, geo.mats.length]}
        receiveShadow={shadows}
        castShadow={shadows}
      >
        <boxGeometry args={[0.28, 0.12, 2.4]} />
      </instancedMesh>
    </group>
  );
}
