"use client";

import { useGLTF } from "@react-three/drei";
import { Suspense, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { PROFILE } from "@/content/route";
import { foamGeometry, riverGeometry, splashGeometry, sweep } from "./geometry";
import { MATS } from "./materials";
import { Mist } from "./Mist";
import { bare, frameAt, tunnelShell } from "./tunnelGeometry";
import { panelPlacements, reelFor, skillReel } from "./tunnelReel";
import { paintBore } from "./tunnelWalls";
import { BORE_HALF, BORE_SPRING, heightAt, type Bridge, type Span, type WorldLayout } from "./worldgen";

/** Heet's steel girder bridge (compressed by scripts/compress-model.mjs). */
const BRIDGE_URL = "/models/bridge.glb";
useGLTF.preload(BRIDGE_URL);

/** Bore outline (BORE_HALF / BORE_SPRING live in worldgen): straight walls, round arch on top (train is 6 tall, 3.3 wide). */
const BORE_PROFILE: [number, number][] = [[-BORE_HALF, -0.5]];
for (let k = 0; k <= 8; k++) {
  const a = Math.PI - (k / 8) * Math.PI;
  BORE_PROFILE.push([Math.cos(a) * BORE_HALF, BORE_SPRING + Math.sin(a) * BORE_HALF]);
}
BORE_PROFILE.push([BORE_HALF, -0.5]);
// Close the loop along the bottom: the bore gets a (black) floor, so nothing lit shows inside.
BORE_PROFILE.push([-BORE_HALF, -0.5]);

/** Tunnels: dark bore lining, floor in front of each mouth, rocky portals. */
function Tunnels({ tunnels, shadows }: { tunnels: Span[]; shadows: boolean }) {
  const geo = useMemo(
    () => ({
      // Faceted stone, lit around each skills poster (tunnelWalls.ts).
      bore: paintBore(
        // A unit past each mouth, so the portal rock's inner edge (on the bore wall) closes against it.
        mergeGeometries(tunnels.map((t) => bare(sweep(BORE_PROFILE, t.s0 - 1, t.s1 + 1)))),
        reelFor(skillReel(PROFILE.skills), tunnels).flatMap((panels) => panelPlacements(panels).map((p): [number, number, number] => [p.x, p.y, p.z])),
      ),
      ...tunnelShell(tunnels),
    }),
    [tunnels],
  );
  return (
    <group>
      <mesh geometry={geo.bore} material={MATS.tunnel} />
      <mesh geometry={geo.floor} material={MATS.ballast} receiveShadow={shadows} />
      <mesh geometry={geo.stone} material={MATS.rockFace} receiveShadow={shadows} castShadow={shadows} />
    </group>
  );
}

/**
 * Wooden trestle: a bent (4 posts, cap beam, cross braces) every 3 units under the track,
 * posts reaching down to the terrain. All one InstancedMesh of unit boxes.
 */
function Trestles({ world, spans, shadows }: { world: WorldLayout; spans: Bridge[]; shadows: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const boxes = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    const yaw = new THREE.Quaternion();
    const roll = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const xAxis = new THREE.Vector3(1, 0, 0);
    const box = (s: number, lat: number, y: number, size: [number, number, number], rollAngle = 0) => {
      const f = frameAt(s);
      yaw.setFromAxisAngle(up, Math.atan2(-f.tz, f.tx));
      roll.setFromAxisAngle(xAxis, rollAngle);
      out.push(
        new THREE.Matrix4().compose(
          new THREE.Vector3(f.x + f.nx * lat, y, f.z + f.nz * lat),
          yaw.clone().multiply(roll),
          new THREE.Vector3(...size),
        ),
      );
    };
    for (const b of spans) {
      for (let s = b.s0 + 1.5; s < b.s1; s += 3) {
        const f = frameAt(s);
        const top = f.y - 0.45;
        let low = top;
        for (const lat of [-2.3, -0.9, 0.9, 2.3]) {
          const g = heightAt(world, f.x + f.nx * lat, f.z + f.nz * lat) - 1;
          low = Math.min(low, g);
          if (top - g > 0.2) box(s, lat, (top + g) / 2, [0.38, top - g, 0.38]);
        }
        box(s, 0, top, [0.45, 0.4, 5.6]); // cap beam
        // X-braces every 3.5 units down to the ground, alternating direction.
        const brace = Math.atan2(3.5, 4.6);
        for (let y = top - 1.75, k = 0; y > low + 1; y -= 3.5, k++) {
          box(s, 0, y, [0.2, 0.22, 5.8], k % 2 ? brace : -brace);
          box(s, 0, y - 1.75, [0.25, 0.3, 5.2]); // horizontal tie
        }
      }
      // Two stringers under the rails along the whole span.
      for (const lat of [-0.9, 0.9]) {
        for (let s = b.s0; s < b.s1; s += 3) box(s + 1.5, lat, frameAt(s + 1.5).y - 0.42, [3.05, 0.35, 0.4]);
      }
    }
    return out;
  }, [world, spans]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    boxes.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [boxes]);

  return (
    <instancedMesh ref={ref} args={[undefined, MATS.wood, boxes.length]} castShadow={shadows} receiveShadow={shadows}>
      <boxGeometry />
    </instancedMesh>
  );
}

/**
 * Heet's steel bridge, placed at its span's centre and turned to the (straight) track there.
 * Its two material colours map onto the world's shared girder and wood materials so it is
 * flat-shaded and palette-tinted like everything else.
 */
function SteelBridge({ span, shadows }: { span: Bridge; shadows: boolean }) {
  const { scene } = useGLTF(BRIDGE_URL);
  useLayoutEffect(() => {
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const m = mesh.material as THREE.MeshStandardMaterial;
      // Wood deck is the darker, warmer one; everything else is painted steel.
      mesh.material = m === MATS.wood || m === MATS.girder ? m : m.color.r < 0.6 ? MATS.wood : MATS.girder;
      mesh.castShadow = shadows;
      mesh.receiveShadow = shadows;
    });
  }, [scene, shadows]);
  const f = frameAt((span.s0 + span.s1) / 2);
  return <primitive object={scene} position={[f.x, f.y, f.z]} rotation-y={Math.atan2(-f.tz, f.tx)} />;
}

/** Rivers (water + foam + waterfall mist), bridges and tunnels. */
export function Structures({ world, shadows }: { world: WorldLayout; shadows: boolean }) {
  const water = useMemo(
    () => mergeGeometries(world.rivers.map((r) => riverGeometry(r.pts, r.bed, r.half))),
    [world],
  );
  const foam = useMemo(() => foamGeometry(world.rivers), [world]);
  const splash = useMemo(() => splashGeometry(world.waterfalls), [world]);
  const steel = world.bridges.find((b) => b.kind === "steel");
  const trestles = useMemo(() => world.bridges.filter((b) => b.kind === "trestle"), [world]);
  return (
    <group>
      <mesh geometry={water} material={MATS.water} receiveShadow={shadows} />
      <mesh geometry={foam} material={MATS.foam} />
      <mesh geometry={splash} material={MATS.splash} />
      <Mist falls={world.waterfalls} />
      <Trestles world={world} spans={trestles} shadows={shadows} />
      {/* Own boundary: while the model loads, everything else stays mounted (no remount/rebuild). */}
      {steel && (
        <Suspense fallback={null}>
          <SteelBridge span={steel} shadows={shadows} />
        </Suspense>
      )}
      <Tunnels tunnels={world.tunnels} shadows={shadows} />
    </group>
  );
}
