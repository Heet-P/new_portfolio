"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { atmosphere } from "./materials";
import { ROUTE, trainPose } from "./route3d";
import { travel } from "./travel";

/**
 * Look-and-feel knobs for the train, kept in one place so they can be tuned against
 * Heet's references without hunting through the code.
 */
export const TRAIN_PARAMS = {
  /** Compressed model produced by `npm run model` (scripts/compress-model.mjs). */
  modelUrl: "/models/train.glb",
  /** Uniform scale of the whole train (model is ~29.7 x 4 x 3.3 units at 1). */
  scale: 1,
  /**
   * Warm lamp light in the windows. Deliberately deeper than the UI amber: the red channel
   * is pushed past 1 by the intensity below and clips, so the colour you see is lighter
   * and warmer than this hex (about #ffbf4a on screen).
   */
  windowColor: "#ff9a3c",
  /** Body paint: the model's flat grey re-tinted to a deep night-train blue. */
  bodyColor: "#55608a",
  /** Sideways roll (radians) of each car at full speed. */
  swayRoll: 0.006,
  /** Vertical bob (units) of each car at full speed. */
  bobHeight: 0.035,
  /** Sway frequency in Hz; each car gets its own phase so they never move in lockstep. */
  swayHz: 1.6,
} as const;

/** Model nodes placed along the curve one by one; the four cars also sway. */
const CARS = ["Driving", "wagon_1", "wagon_2", "wagon_3"] as const;
const PARTS = [...CARS, "Connection"] as const;

/**
 * Per-part rest pose, captured once (in node.userData, so a remount never adopts a moved
 * pose as "rest"): offset along the train from its centre, height, and original rotation.
 */
interface CarRig {
  node: THREE.Object3D;
  restX: number;
  restY: number;
  restQ: THREE.Quaternion;
  phase: number;
  sways: boolean;
}

useGLTF.preload(TRAIN_PARAMS.modelUrl);

/**
 * Re-dress the Blender materials (flat-shaded, glowing windows, night-blue body) and collect
 * the parts to place along the track. Safe to run on every mount even though useGLTF
 * caches and shares one scene: materials only receive fixed values, and each part's rest
 * pose is recorded in node.userData the first time, so a remount never adopts a moved pose.
 */
function rigTrain(scene: THREE.Object3D): { cars: CarRig[]; windowMats: THREE.MeshStandardMaterial[] } {
  const seen = new Set<THREE.Material>();
  const windowMats: THREE.MeshStandardMaterial[] = [];
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (seen.has(mat)) continue;
      seen.add(mat);
      const m = mat as THREE.MeshStandardMaterial;
      // Low-poly restyle: every surface reads as flat facets, like the world around it.
      m.flatShading = true;
      m.needsUpdate = true;
      if (m.name === "trainwindow") {
        m.color.set("#1a1208"); // dark glass base so the glow reads as light, not paint
        m.emissive.set(TRAIN_PARAMS.windowColor);
        m.emissiveIntensity = atmosphere.palette.windowGlow; // updated per frame from the palette
        m.toneMapped = false;
        windowMats.push(m);
      } else if (m.name === "trainbase") {
        m.color.set(TRAIN_PARAMS.bodyColor);
        m.roughness = 0.55;
        m.metalness = 0.25;
      } else if (m.name === "yellow" || m.name === "red") {
        // Lamp materials are already emissive in the export; keep them unlit-bright.
        m.toneMapped = false;
      }
    }
  });
  // The model's root carries the recentring offset (see compress-model.mjs); zero it once and
  // fold it into each part's rest x so parts can be positioned in world space directly.
  const root = scene.getObjectByName("TRAIN");
  if (root && root.userData.rootX === undefined) {
    root.userData.rootX = root.position.x;
    root.position.set(0, 0, 0);
  }
  const rootX = (root?.userData.rootX as number | undefined) ?? 0;
  const cars = PARTS.flatMap((name, i) => {
    const node = scene.getObjectByName(name);
    if (!node) return [];
    node.userData.rest ??= { x: node.position.x + rootX, y: node.position.y, q: node.quaternion.clone() };
    const rest = node.userData.rest as { x: number; y: number; q: THREE.Quaternion };
    // Phases spread over the cycle; i*2.1 rad avoids any two cars lining up.
    return [{ node, restX: rest.x, restY: rest.y, restQ: rest.q, phase: i * 2.1, sways: i < CARS.length }];
  });
  return { cars, windowMats };
}

const pt = new THREE.Vector3();
const tg = new THREE.Vector3();
const side = new THREE.Vector3();
const upv = new THREE.Vector3();
const basis = new THREE.Matrix4();
const roll = new THREE.Quaternion();
const X_AXIS = new THREE.Vector3(1, 0, 0);
const WORLD_UP = new THREE.Vector3(0, 1, 0);

/**
 * Place every part on the curve: each sits at the train centre's arc length plus its rest
 * offset (cars keep their spacing along the bends), turned to the local tangent. Cars add
 * a subtle roll + bob scaled by `amount` (0 = parked). Reuses module temporaries: no
 * per-frame allocations.
 */
function placeCars(cars: CarRig[], w: number, amount: number) {
  const L = ROUTE.length;
  const centre = trainPose.u * L;
  for (const car of cars) {
    const u = Math.max(0, Math.min(1, (centre + car.restX * TRAIN_PARAMS.scale) / L));
    ROUTE.curve.getPointAt(u, pt);
    ROUTE.curve.getTangentAt(u, tg);
    // Car frame: x = tangent, z = right of travel, y = their cross product (stays upright).
    side.crossVectors(tg, WORLD_UP).normalize();
    upv.crossVectors(side, tg).normalize();
    basis.makeBasis(tg, upv, side);
    car.node.quaternion.setFromRotationMatrix(basis);
    if (car.sways) car.node.quaternion.multiply(roll.setFromAxisAngle(X_AXIS, Math.sin(w + car.phase) * TRAIN_PARAMS.swayRoll * amount));
    car.node.quaternion.multiply(car.restQ);
    // Bob at a slightly different rate than the roll so the motion never looks mechanical.
    const bob = car.sways ? Math.sin(w * 1.37 + car.phase) * TRAIN_PARAMS.bobHeight * amount : 0;
    car.node.position.copy(pt).addScaledVector(upv, car.restY * TRAIN_PARAMS.scale + bob);
  }
}

/** Window lamp strength from the palette: faint at golden hour, strong at night. */
function glowWindows(mats: THREE.MeshStandardMaterial[], intensity: number) {
  for (const m of mats) m.emissiveIntensity = intensity;
}

/**
 * The night train: Heet's Blender model (locomotive + 3 wagons, wheels fused into the
 * bodies), restyled flat-shaded, running along ROUTE. Each car follows the curve on its
 * own; windows glow per the palette (faint at golden hour, warm and strong at night).
 */
export function Train({ reducedMotion, shadows }: { reducedMotion: boolean; shadows: boolean }) {
  const { scene } = useGLTF(TRAIN_PARAMS.modelUrl);
  const rig = useRef<ReturnType<typeof rigTrain>>({ cars: [], windowMats: [] });

  useLayoutEffect(() => {
    rig.current = rigTrain(scene);
    scene.traverse((o) => {
      o.castShadow = shadows;
      o.receiveShadow = shadows;
    });
  }, [scene, shadows]);

  useFrame(({ clock }) => {
    // Amount follows travel speed, so parked = perfectly still. Reduced motion: always still.
    const amount = reducedMotion ? 0 : travel.speed;
    const w = clock.elapsedTime * Math.PI * 2 * TRAIN_PARAMS.swayHz;
    placeCars(rig.current.cars, w, amount);
    glowWindows(rig.current.windowMats, atmosphere.palette.windowGlow);
  });

  // Parts are placed in world space each frame; the container itself never moves.
  return <primitive object={scene} />;
}
