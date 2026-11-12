"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { atmosphere, MATS } from "./materials";
import { ROUTE, tangentAt, trainPose } from "./route3d";
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
  /** Axle positions along the car, relative to its node origin (empty for the coupling). */
  axles: number[];
}

/**
 * Procedural wheels (the model's are fused into the bodies): radius, lateral offset (set
 * out under the body sides, wider than the rails, so the chase camera can see them turn).
 */
const WHEEL = { radius: 0.45, halfGauge: 1.35, axleSpacing: 1.7, bogieInset: 0.18 } as const;
const WHEELS_PER_CAR = 8; // 2 bogies x 2 axles x 2 sides

/**
 * Axle offsets for a car from its rest bounding box: a two-axle bogie near each end,
 * `bogieInset` of the car length in from the ends.
 */
function axlesFor(min: number, max: number): number[] {
  const len = max - min;
  const out: number[] = [];
  for (const c of [min + len * WHEEL.bogieInset, max - len * WHEEL.bogieInset]) {
    out.push(c - WHEEL.axleSpacing / 2, c + WHEEL.axleSpacing / 2);
  }
  return out;
}

/** Give a geometry one vertex colour, non-indexed and without uvs (so parts merge). */
function painted(g: THREE.BufferGeometry, hex: string): THREE.BufferGeometry {
  const g2 = g.index ? g.toNonIndexed() : g;
  g2.deleteAttribute("uv");
  const c = new THREE.Color(hex);
  const n = g2.getAttribute("position").count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(arr, i * 3);
  g2.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return g2;
}

/**
 * Wheel: dark steel disc with light spokes and hub (so rotation reads in motion), axle
 * along local z. Flat-shaded, vertex-coloured, one geometry for every instance.
 */
function wheelGeometry(): THREE.BufferGeometry {
  const R = WHEEL.radius;
  const parts = [
    painted(new THREE.CylinderGeometry(R, R, 0.14, 12).rotateX(Math.PI / 2), "#3a3d44"),
    painted(new THREE.CylinderGeometry(0.13, 0.13, 0.3, 6).rotateX(Math.PI / 2), "#d8cfb8"),
    ...[0, 1, 2].map((k) => painted(new THREE.BoxGeometry(R * 1.8, 0.1, 0.2).rotateZ((k * Math.PI) / 3), "#cfc6ae")),
  ];
  const g = mergeGeometries(parts);
  g.computeVertexNormals();
  return g;
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
  scene.updateMatrixWorld(true);
  const cars = PARTS.flatMap((name, i) => {
    const node = scene.getObjectByName(name);
    if (!node) return [];
    if (!node.userData.rest) {
      // Measured once at rest pose (root zeroed): the car's length gives its bogie spots.
      const box = new THREE.Box3().setFromObject(node);
      node.userData.rest = {
        x: node.position.x + rootX,
        y: node.position.y,
        q: node.quaternion.clone(),
        axles: i < CARS.length ? axlesFor(box.min.x - node.position.x, box.max.x - node.position.x) : [],
      };
    }
    const rest = node.userData.rest as { x: number; y: number; q: THREE.Quaternion; axles: number[] };
    // Phases spread over the cycle; i*2.1 rad avoids any two cars lining up.
    return [
      { node, restX: rest.x, restY: rest.y, restQ: rest.q, phase: i * 2.1, sways: i < CARS.length, axles: rest.axles },
    ];
  });
  return { cars, windowMats };
}

const pt = new THREE.Vector3();
const tg = new THREE.Vector3();
const side = new THREE.Vector3();
const upv = new THREE.Vector3();
const basis = new THREE.Matrix4();
const roll = new THREE.Quaternion();
const carQ = new THREE.Quaternion();
const spin = new THREE.Quaternion();
const wq = new THREE.Quaternion();
const wp = new THREE.Vector3();
const wm = new THREE.Matrix4();
const ONE = new THREE.Vector3(1, 1, 1);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const WORLD_UP = new THREE.Vector3(0, 1, 0);

/**
 * Place every part on the curve: each sits at the train centre's arc length plus its rest
 * offset (cars keep their spacing along the bends), turned to the local tangent. Cars add
 * a subtle roll + bob scaled by `amount` (0 = parked). Reuses module temporaries: no
 * per-frame allocations.
 */
function placeCars(cars: CarRig[], w: number, amount: number, wheels: THREE.InstancedMesh | null, wheelAngle: number) {
  let k = 0;
  spin.setFromAxisAngle(Z_AXIS, wheelAngle);
  const L = ROUTE.length;
  const centre = trainPose.u * L;
  for (const car of cars) {
    const u = Math.max(0, Math.min(1, (centre + car.restX * TRAIN_PARAMS.scale) / L));
    ROUTE.curve.getPointAt(u, pt);
    tangentAt(u, tg);
    // Car frame: x = tangent, z = right of travel, y = their cross product (stays upright).
    side.crossVectors(tg, WORLD_UP).normalize();
    upv.crossVectors(side, tg).normalize();
    basis.makeBasis(tg, upv, side);
    carQ.setFromRotationMatrix(basis);
    car.node.quaternion.copy(carQ);
    if (car.sways) car.node.quaternion.multiply(roll.setFromAxisAngle(X_AXIS, Math.sin(w + car.phase) * TRAIN_PARAMS.swayRoll * amount));
    car.node.quaternion.multiply(car.restQ);
    // Bob at a slightly different rate than the roll so the motion never looks mechanical.
    const bob = car.sways ? Math.sin(w * 1.37 + car.phase) * TRAIN_PARAMS.bobHeight * amount : 0;
    car.node.position.copy(pt).addScaledVector(upv, car.restY * TRAIN_PARAMS.scale + bob);
    // Wheels: on the rails under each bogie, spinning about the axle (no sway: they ride the track).
    if (!wheels) continue;
    wq.copy(carQ).multiply(spin);
    for (const ox of car.axles) {
      for (let s = -1; s <= 1; s += 2) {
        wp.copy(pt)
          .addScaledVector(tg, ox * TRAIN_PARAMS.scale)
          .addScaledVector(upv, WHEEL.radius)
          .addScaledVector(side, s * WHEEL.halfGauge);
        wheels.setMatrixAt(k++, wm.compose(wp, wq, ONE));
      }
    }
  }
  if (wheels) wheels.instanceMatrix.needsUpdate = true;
}

/** Roll the wheels by the distance the train moved since last frame; returns the new angle. */
function advanceWheels(r: { lastS: number; angle: number }, s: number): number {
  if (r.lastS >= 0) r.angle -= (s - r.lastS) / WHEEL.radius;
  r.lastS = s;
  return r.angle;
}

/** Window lamp strength from the palette: faint at golden hour, strong at night. */
function glowWindows(mats: THREE.MeshStandardMaterial[], intensity: number) {
  for (const m of mats) m.emissiveIntensity = intensity;
}

/**
 * The night train: Heet's Blender model (locomotive + 3 wagons, wheels fused into the
 * bodies, so procedural spinning wheel sets are added under each bogie), restyled
 * flat-shaded, running along ROUTE. Each car follows the curve on its
 * own; windows glow per the palette (faint at golden hour, warm and strong at night).
 */
export function Train({ reducedMotion, shadows }: { reducedMotion: boolean; shadows: boolean }) {
  const { scene } = useGLTF(TRAIN_PARAMS.modelUrl);
  const rig = useRef<ReturnType<typeof rigTrain>>({ cars: [], windowMats: [] });
  const wheels = useRef<THREE.InstancedMesh>(null);
  const wheelGeo = useMemo(() => wheelGeometry(), []);
  // Wheel rotation: angle = distance travelled / radius (negative = rolling forward).
  const rolling = useRef({ lastS: -1, angle: 0 });

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
    const angle = advanceWheels(rolling.current, trainPose.u * ROUTE.length);
    placeCars(rig.current.cars, w, amount, wheels.current, angle);
    glowWindows(rig.current.windowMats, atmosphere.palette.windowGlow);
  });

  // Parts are placed in world space each frame; the container itself never moves.
  return (
    <>
      <primitive object={scene} />
      <instancedMesh
        ref={wheels}
        args={[wheelGeo, MATS.wheel, CARS.length * WHEELS_PER_CAR]}
        castShadow={shadows}
        frustumCulled={false}
      />
    </>
  );
}
