import * as THREE from "three";

/**
 * Where everything is in the cabin, in the cabin model's own metres (public/models/cabin.glb,
 * re-centred by scripts/compress-model.mjs): the car runs along +X (the direction of travel)
 * from x = -8.53 to 8.53, floor at y = 0, ceiling ~2.8, side walls at z = +-1.7. +Z is the
 * right-hand side of travel, the side the chase camera rides on outside.
 */
export const CABIN = {
  /**
   * The cabin is not inside the exterior train: it is staged on its own, far above the route
   * (the world below is lost in fog at this height and hidden anyway while the camera is in
   * here). The sky dome, stars, moon and clouds follow the camera, so they still show through
   * the windows for free.
   */
  origin: new THREE.Vector3(600, 1400, 0),
  /**
   * World units per cabin metre. Larger than 1 so the camera's fixed near plane (0.5 units)
   * clips only what is within 0.2 m of the lens.
   */
  scale: 2.5,
  /** Side window openings (x ranges), on both walls. */
  windowsX: [
    [-8.25, -6.89],
    [-4.11, -1.39],
    [1.39, 4.11],
    [6.89, 8.25],
  ] as const,
  /** Door glazing: two narrow panes per door, centred on the door at these x. */
  doorsX: [-5.5, 0, 5.5] as const,
  doorPaneX: [0.11, 0.56] as const,
  /** Height range of the side glazing, and the wall plane the panes sit in (|z|). */
  windowY: [1.03, 2.12] as const,
  paneZ: 1.62,
} as const;

/** Camera pose inside the cabin: eye position and a point it looks at (cabin metres). */
export interface CabinPose {
  pos: THREE.Vector3;
  look: THREE.Vector3;
}

/**
 * Where the camera arrives (just inside a right-hand window, looking across the car, as if it
 * had flown straight through the glass), where it leans toward the newspaper lying on the
 * opposite bench, and where it settles (standing in the aisle, facing forward, a touch down,
 * reading the unfolded paper held in front of it).
 */
export const POSES: { entry: CabinPose; lean: CabinPose; settled: CabinPose } = {
  entry: { pos: new THREE.Vector3(-6.2, 1.62, 1.05), look: new THREE.Vector3(-6.6, 1.5, -2) },
  lean: { pos: new THREE.Vector3(-4.75, 1.42, -0.15), look: new THREE.Vector3(-3.6, 0.46, -1.2) },
  settled: { pos: new THREE.Vector3(-5.0, 1.58, 0.12), look: new THREE.Vector3(-1.0, 1.36, 0.12) },
};

/**
 * Distance (cabin metres) from the settled eye to the unfolded newspaper. At this distance a
 * desktop front page is about 0.65 x 0.43 m: a real tabloid spread held at reading distance.
 */
export const PAPER_DISTANCE = 1.0;

/**
 * Where the folded newspaper lies: on the left-hand bench (z < 0; cushion top at y = 0.45,
 * from z = -1.05 to -1.4), its fold toward the aisle and its masthead toward the wall so it
 * reads the right way up from the aisle, turned a little off square as if dropped there.
 * `pos` is the middle of the fold.
 */
export const NEWSPAPER = {
  pos: new THREE.Vector3(-3.6, 0.465, -1.08),
  yaw: 0.14,
  /** Height (m) of the arc the paper makes as it is picked up. */
  liftArc: 0.12,
} as const;
