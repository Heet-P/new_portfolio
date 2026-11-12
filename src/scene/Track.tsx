"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { travel, UNITS_PER_STATION } from "./travel";

/** Track layout. The train's wheels sit at y = 0, so the rail tops are at y = 0 too. */
const TRACK = {
  /** Length of the track and ground (units); wide enough for ultra-wide screens. */
  length: 320,
  /** Distance between rail centres (matches the model's wheel line, z = +-0.75). */
  gauge: 1.5,
  sleeperSpacing: 1.4,
  /** Ground depth (z): reaches past the camera in front and towards the horizon behind. */
  groundDepth: 220,
  /** Ground centre z: shifted towards the camera, which sits at +z (up to ~70 on phones). */
  groundZ: 30,
} as const;

const SLEEPERS = Math.ceil(TRACK.length / TRACK.sleeperSpacing);

/**
 * Ground strip, two rails and instanced sleepers. The rails are featureless so they never
 * need to move; the sleepers scroll with travel distance (wrapped to one spacing, so the
 * instance matrices are written once and only the group shifts each frame).
 */
export function Track() {
  const sleepers = useRef<THREE.InstancedMesh>(null);
  const scroller = useRef<THREE.Group>(null);

  // Lay the sleepers out once.
  useLayoutEffect(() => {
    const mesh = sleepers.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    for (let i = 0; i < SLEEPERS; i++) {
      m.makeTranslation(-TRACK.length / 2 + i * TRACK.sleeperSpacing, -0.16, 0);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  useFrame(() => {
    // Train moves +X, so the ground slides -X. Modulo keeps the offset inside one spacing.
    const d = (travel.position * UNITS_PER_STATION) % TRACK.sleeperSpacing;
    if (scroller.current) scroller.current.position.x = -d;
  });

  return (
    <group>
      {/* Ground: dark night field, slightly lighter than the sky's bottom so the horizon reads. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.24, TRACK.groundZ]}>
        <planeGeometry args={[TRACK.length, TRACK.groundDepth]} />
        <meshStandardMaterial color="#2a3254" roughness={1} />
      </mesh>
      {/* Two steel rails catching the moonlight. */}
      {[-TRACK.gauge / 2, TRACK.gauge / 2].map((z) => (
        <mesh key={z} position={[0, -0.06, z]}>
          <boxGeometry args={[TRACK.length, 0.12, 0.1]} />
          <meshStandardMaterial color="#8d97b5" metalness={0.8} roughness={0.35} />
        </mesh>
      ))}
      <group ref={scroller}>
        <instancedMesh ref={sleepers} args={[undefined, undefined, SLEEPERS]}>
          <boxGeometry args={[0.28, 0.12, 2.4]} />
          <meshStandardMaterial color="#2a2420" roughness={1} />
        </instancedMesh>
      </group>
    </group>
  );
}
