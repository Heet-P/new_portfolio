"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
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
  /**
   * Emissive strength of the windows. Not tone-mapped, so values > 1 stay HDR and land
   * above the bloom threshold T9 will use: the windows glow, the body does not.
   */
  windowIntensity: 1.6,
  /** Body paint: the model's flat grey re-tinted to a deep night-train blue. */
  bodyColor: "#55608a",
  /** Sideways roll (radians) of each car at full speed. */
  swayRoll: 0.006,
  /** Vertical bob (units) of each car at full speed. */
  bobHeight: 0.035,
  /** Sway frequency in Hz; each car gets its own phase so they never move in lockstep. */
  swayHz: 1.6,
  camera: {
    /** Vertical field of view (deg). Narrow-ish = flatter, more "diorama" perspective. */
    fov: 30,
    /** Camera looks down at the train by this much (deg). */
    pitchDeg: 12,
    /** World width kept in frame on wide screens: whole train plus margin. */
    wideFrameWidth: 38,
    /** World width kept in frame on narrow screens: locomotive + first wagon or so. */
    narrowFrameWidth: 17,
    /** Aspect ratio (w/h) at or below which the narrow framing is fully applied. */
    narrowAspect: 0.6,
    /** Aspect ratio at or above which the wide framing is fully applied. */
    wideAspect: 1.3,
    /**
     * Screen px on the left covered by the desktop route-map panel (RouteMap.module.css).
     * Wide framing centres the train in the space to its right. Ignored on phones, where
     * the map is a bottom strip.
     */
    wideLeftInsetPx: 260,
    /** Height of the look-at point above the rails (train is ~4 tall). */
    lookHeight: 2.6,
    /** Idle drift amplitude (units) and period (s). */
    driftAmount: 0.35,
    driftPeriod: 14,
  },
} as const;

/** Car nodes in the model that sway independently (the coupling mesh stays put). */
const CARS = ["Driving", "wagon_1", "wagon_2", "wagon_3"] as const;

/** Per-car resting transform, captured once so sway is applied as an offset, never accumulated. */
interface CarRig {
  node: THREE.Object3D;
  baseY: number;
  phase: number;
}

useGLTF.preload(TRAIN_PARAMS.modelUrl);

/**
 * Re-dress the flat Blender materials (glowing windows, night-blue body) and collect the
 * swaying cars. Safe to run on every mount even though useGLTF caches and shares one scene:
 * materials only receive fixed values, and each car's rest height is recorded in
 * node.userData the first time, so a remount mid-sway never adopts a swayed pose as "rest".
 */
function rigTrain(scene: THREE.Object3D): CarRig[] {
  const seen = new Set<THREE.Material>();
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (seen.has(mat)) continue;
      seen.add(mat);
      const m = mat as THREE.MeshStandardMaterial;
      if (m.name === "trainwindow") {
        m.color.set("#1a1208"); // dark glass base so the glow reads as light, not paint
        m.emissive.set(TRAIN_PARAMS.windowColor);
        m.emissiveIntensity = TRAIN_PARAMS.windowIntensity;
        m.toneMapped = false;
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
  return CARS.flatMap((name, i) => {
    const node = scene.getObjectByName(name);
    // Phases spread over the cycle; i*2.1 rad avoids any two cars lining up.
    if (!node) return [];
    node.userData.restY ??= node.position.y;
    return [{ node, baseY: node.userData.restY as number, phase: i * 2.1 }];
  });
}

/** Apply this frame's sway: roll about the travel axis plus a vertical bob, per car. */
function swayCars(cars: CarRig[], w: number, amount: number) {
  for (const car of cars) {
    car.node.rotation.x = Math.sin(w + car.phase) * TRAIN_PARAMS.swayRoll * amount;
    // Bob at a slightly different rate than the roll so the motion never looks mechanical.
    car.node.position.y = car.baseY + Math.sin(w * 1.37 + car.phase) * TRAIN_PARAMS.bobHeight * amount;
  }
}

/**
 * The side-on night train: Heet's Blender model (locomotive + 3 wagons, wheels fused into
 * the bodies) with warm emissive windows. Motion is sold by a subtle per-car sway/bob
 * that scales with travel speed and is zero when parked; scenery (T8) does the rest.
 */
export function Train({ reducedMotion }: { reducedMotion: boolean }) {
  const { scene } = useGLTF(TRAIN_PARAMS.modelUrl);
  const cars = useRef<CarRig[]>([]);

  useLayoutEffect(() => {
    cars.current = rigTrain(scene);
  }, [scene]);

  useFrame(({ clock }) => {
    // Amount follows travel speed, so parked = perfectly still. Reduced motion: always still.
    const amount = reducedMotion ? 0 : travel.speed;
    const w = clock.elapsedTime * Math.PI * 2 * TRAIN_PARAMS.swayHz;
    swayCars(cars.current, w, amount);
  });

  return <primitive object={scene} scale={TRAIN_PARAMS.scale} />;
}
