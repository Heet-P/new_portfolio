"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { MATS } from "./materials";
import { hash2 } from "./noise";
import { cloudPuffs } from "./weather";

/** Cloud layout seed: change it to reshuffle the sky. */
const CLOUD_SEED = 7;
/** Drift speed of the whole layer around the camera (radians/s): ~1 unit/s at the ring's middle. */
const DRIFT = 0.0012;

/**
 * One faceted puff: a big jittered icosahedron with two smaller lumps on its shoulders,
 * flat-shaded (non-indexed, per-face normals). Corners are jittered by a hash of their
 * position, so the faces that share a corner move it together and the mesh never cracks.
 */
function puffGeometry(): THREE.BufferGeometry {
  const lumps: [number, number, number, number][] = [
    [1, 0, 0, 0],
    [0.62, 0.62, 0.22, 0.1],
    [0.56, -0.6, 0.12, -0.18],
  ];
  const parts = lumps.map(([r, x, y, z], k) => {
    const g = new THREE.IcosahedronGeometry(r, 0);
    const pos = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const py = pos.getY(i);
      const pz = pos.getZ(i);
      const j = hash2(Math.round(px * 100), Math.round(py * 100 + pz * 7), k + 1);
      const s = 0.8 + j * 0.4;
      pos.setXYZ(i, px * s + x, py * s + y, pz * s + z);
    }
    g.deleteAttribute("uv");
    return g;
  });
  const g = mergeGeometries(parts);
  g.computeVertexNormals();
  return g;
}

/**
 * Built once per page load and kept (like World's chunks): re-entering the ride reuses it.
 * The instance matrices are the cloudPuffs layout, fixed for good.
 */
let cache: { geometry: THREE.BufferGeometry; matrices: THREE.Matrix4[] } | null = null;
function getClouds() {
  if (cache) return cache;
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const matrices = cloudPuffs(CLOUD_SEED).map((p) =>
    new THREE.Matrix4().compose(
      new THREE.Vector3(p.x, p.y, p.z),
      q.setFromAxisAngle(up, p.yaw).clone(),
      new THREE.Vector3(p.sx, p.sy, p.sz),
    ),
  );
  cache = { geometry: puffGeometry(), matrices };
  return cache;
}

/**
 * Low-poly clouds: faceted, flattened puffs strung into clusters on a ring around the
 * camera, low in the sky band the chase camera actually sees. One InstancedMesh (one
 * draw call) on the shared cloud material, which Atmosphere's tintWorld re-tints from the
 * palette: warm white at golden hour, pink at dusk, dim blue-grey at night. The ring
 * rides with the camera (always "far away") and turns slowly; reduced motion: it holds still.
 */
export function Clouds({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const group = useRef<THREE.Group>(null);
  const { geometry, matrices } = getClouds();

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
  }, [matrices]);

  useFrame(({ camera, clock }) => {
    const g = group.current;
    if (!g) return;
    g.position.copy(camera.position);
    g.rotation.y = reducedMotion ? 0 : clock.elapsedTime * DRIFT;
  });

  return (
    <group ref={group}>
      <instancedMesh ref={ref} args={[geometry, MATS.cloud, matrices.length]} frustumCulled={false} />
    </group>
  );
}
