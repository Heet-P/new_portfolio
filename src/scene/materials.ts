import * as THREE from "three";
import { createPalette, type Palette, type RGB } from "./palette";

/**
 * Shared materials for the world, created once and re-tinted every frame from the
 * current palette (see Atmosphere). All flat-shaded: every triangle reads as one facet.
 * Client-only module (the scene is loaded with ssr:false).
 */

/** The palette in effect this frame. Written by <Atmosphere/>, read by the train's windows. */
export const atmosphere = { palette: createPalette() };

const flat = (opts: THREE.MeshStandardMaterialParameters) =>
  new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1, metalness: 0, ...opts });

/** Base colours (linear RGB, glTF factors) for props tinted by the palette's ground multiplier. */
const BASE: Record<string, RGB> = {
  // From Heet's Rail_Track_Lowpoly.glb: sleeper, rail and ballast colours.
  sleeper: [0.145, 0.085, 0.047],
  rail: [0.155, 0.155, 0.155],
  ballast: [0.348, 0.278, 0.186],
  // From the steel bridge model: wood deck; also used for the procedural trestle.
  wood: [0.427, 0.353, 0.224],
  girder: [0.62, 0.64, 0.68],
  stone: [0.42, 0.38, 0.32],
  tunnel: [0.012, 0.011, 0.01],
};

export const MATS = {
  terrain: flat({ vertexColors: true }),
  foliage: flat({ vertexColors: true }),
  rock: flat({ vertexColors: true }),
  water: flat({ roughness: 0.25, metalness: 0.1 }),
  // Pulled toward the camera so it wins over the water it lies on (waterfall faces are near-vertical).
  foam: flat({ color: "#ffffff", polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  sleeper: flat({}),
  rail: flat({ metalness: 0.6, roughness: 0.4 }),
  ballast: flat({}),
  wood: flat({}),
  girder: flat({ metalness: 0.3, roughness: 0.6 }),
  stone: flat({}),
  // Inside of tunnel bores: near-black, visible from both sides.
  tunnel: flat({ side: THREE.DoubleSide }),
  cloud: flat({ color: "#ffffff", fog: false }),
  mountain: flat({ vertexColors: true, fog: false }),
};

const tmp = new THREE.Color();

/** Multiply a base colour by a palette tint into a material. */
function tinted(m: THREE.MeshStandardMaterial, base: RGB, tint: RGB) {
  m.color.setRGB(base[0] * tint[0], base[1] * tint[1], base[2] * tint[2]);
}

/** Re-tint every shared material for the palette `p`. Allocation-free; call once per frame. */
export function tintWorld(p: Palette) {
  MATS.terrain.color.setRGB(...p.ground);
  MATS.foliage.color.setRGB(...p.foliage);
  MATS.rock.color.setRGB(...p.rock);
  MATS.water.color.setRGB(...p.water);
  MATS.foam.color.setRGB(...p.ground);
  for (const k of ["sleeper", "rail", "ballast", "wood", "girder", "stone", "tunnel"] as const) {
    tinted(MATS[k], BASE[k], k === "stone" || k === "girder" ? p.rock : p.ground);
  }
  // Far mountains and clouds take on the sky: aerial perspective by day, silhouettes by night.
  MATS.mountain.color.setRGB(...p.rock).lerp(tmp.setRGB(...p.skyHorizon), 0.35);
  MATS.cloud.color.setRGB(...p.skyHorizon).lerp(tmp.setRGB(...p.sun), 0.3);
  MATS.cloud.emissive.setRGB(...p.skyHorizon).multiplyScalar(0.35);
}
