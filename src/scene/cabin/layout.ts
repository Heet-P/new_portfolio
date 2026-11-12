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
  /** Underside of the ceiling panels, where the display's hangers attach. */
  ceilingY: 2.62,
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
 * had flown straight through the glass) and where it settles (standing in the aisle, facing
 * forward, the display hanging from the ceiling in front of it).
 */
export const POSES: { entry: CabinPose; settled: CabinPose } = {
  entry: { pos: new THREE.Vector3(-6.2, 1.62, 1.05), look: new THREE.Vector3(-6.6, 1.5, -2) },
  settled: { pos: new THREE.Vector3(-5.0, 1.62, 0), look: new THREE.Vector3(10, 1.62, 0) },
};

/** Distance (cabin metres) from the settled eye to the display's screen. */
export const DISPLAY_DISTANCE = 2.5;
