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
  // Overhead line: galvanised masts, dark wires.
  mast: [0.32, 0.33, 0.35],
  wire: [0.06, 0.06, 0.065],
};

/** Seconds, shared by the animated water shaders. Advanced by <Atmosphere/>. */
export const waterTime = { value: 0 };

const FLOW_VERTEX = /* glsl */ `#include <begin_vertex>
  float wv = sin(aFlow * 0.42 - uTime * 2.6 + position.x * 0.09) * 0.22
           + sin(aFlow * 1.07 - uTime * 3.9 + position.z * 0.21) * 0.1;
  transformed.y += wv;
  vCrest = wv;`;

const STREAK_FRAGMENT = /* glsl */ `#include <color_fragment>
  float lane = floor(vAcross * 9.0);
  float r = fract(sin(lane * 12.9898) * 43758.5453);
  float st = fract(vFlow * 0.2 - uTime * (1.3 + r * 0.9) + r);
  diffuseColor.rgb *= mix(vec3(0.55, 0.82, 0.86), vec3(1.0), smoothstep(0.3, 0.65, st));`;

const CHURN_VERTEX = /* glsl */ `#include <begin_vertex>
  transformed += normal * sin(uTime * 5.0 + position.x * 1.7 + position.z * 1.3) * 0.3;`;

/**
 * Flowing water: two travelling sine waves displace the (finely triangulated) surface,
 * moving downstream along `aFlow` (distance along the river), so the flat-shaded facets
 * ripple and drift with the current. Crests are brightened a little.
 */
function flowingWater(m: THREE.MeshStandardMaterial) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = waterTime;
    sh.vertexShader =
      "attribute float aFlow;\nuniform float uTime;\nvarying float vCrest;\n" +
      sh.vertexShader.replace("#include <begin_vertex>", FLOW_VERTEX);
    sh.fragmentShader =
      "varying float vCrest;\n" +
      sh.fragmentShader.replace(
        "#include <color_fragment>",
        "#include <color_fragment>\n  diffuseColor.rgb *= 1.0 + vCrest * 1.8;",
      );
  };
}

/**
 * Falling water: streaks of white water racing down the waterfall face. Each of 9 lanes
 * across the fall (`aAcross`) gets its own speed and phase; `aFlow` increases downhill, so
 * the pattern moves down the drop. Between streaks the sheet shows pale teal.
 */
function fallingWater(m: THREE.MeshStandardMaterial) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = waterTime;
    sh.vertexShader =
      "attribute float aFlow;\nattribute float aAcross;\nvarying float vFlow;\nvarying float vAcross;\n" +
      sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n  vFlow = aFlow;\n  vAcross = aAcross;");
    sh.fragmentShader =
      "uniform float uTime;\nvarying float vFlow;\nvarying float vAcross;\n" +
      sh.fragmentShader.replace("#include <color_fragment>", STREAK_FRAGMENT);
  };
}

/** Splash at the foot of a fall: foam blobs that churn (swell and shrink) in place. */
function churning(m: THREE.MeshStandardMaterial) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = waterTime;
    sh.vertexShader = "uniform float uTime;\n" + sh.vertexShader.replace("#include <begin_vertex>", CHURN_VERTEX);
  };
}

export const MATS = {
  terrain: flat({ vertexColors: true }),
  foliage: flat({ vertexColors: true }),
  rock: flat({ vertexColors: true }),
  water: flat({ roughness: 0.25, metalness: 0.1 }),
  // Pulled toward the camera so it wins over the water it lies on (waterfall faces are near-vertical).
  foam: flat({ color: "#ffffff", polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  splash: flat({ color: "#ffffff" }),
  wheel: flat({ vertexColors: true, metalness: 0.5, roughness: 0.5 }),
  mast: flat({ metalness: 0.4, roughness: 0.6 }),
  wire: flat({ metalness: 0.5, roughness: 0.5 }),
  sleeper: flat({}),
  rail: flat({ metalness: 0.6, roughness: 0.4 }),
  ballast: flat({}),
  wood: flat({}),
  girder: flat({ metalness: 0.3, roughness: 0.6 }),
  // Tunnel portals: per-facet rock colours, tinted like the rocks.
  rockFace: flat({ vertexColors: true }),
  // Solar panels at the Solar stop: blue cells in silver frames, a little glossy.
  panel: flat({ vertexColors: true, metalness: 0.45, roughness: 0.4 }),
  // Inside of tunnel bores: unlit faceted stone baked into vertex colours (tunnelWalls.ts), fading to black
  // with distance from the camera (see boreDepthFade), so the mouth still reads as a deep dark hole.
  tunnel: new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }),
  cloud: flat({ color: "#ffffff", fog: false }),
  mountain: flat({ vertexColors: true, fog: false }),
};

/** Wall brightness falls off with view depth: lit near the camera, swallowed by the dark toward the far portal. */
function boreDepthFade(m: THREE.MeshBasicMaterial) {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader =
      "varying float vBoreDepth;\n" +
      sh.vertexShader.replace("#include <project_vertex>", "#include <project_vertex>\n  vBoreDepth = -mvPosition.z;");
    sh.fragmentShader =
      "varying float vBoreDepth;\n" +
      sh.fragmentShader.replace(
        "#include <color_fragment>",
        "#include <color_fragment>\n  diffuseColor.rgb *= 1.0 - 0.92 * smoothstep(10.0, 75.0, vBoreDepth);",
      );
  };
}

flowingWater(MATS.water);
boreDepthFade(MATS.tunnel);
fallingWater(MATS.foam);
churning(MATS.splash);

const tmp = new THREE.Color();
/** Props whose base colour is multiplied by the palette's ground (or rock) tint. */
const PROPS = ["sleeper", "rail", "ballast", "wood", "girder", "mast", "wire"] as const;

/** Multiply a base colour by a palette tint into a material. */
function tinted(m: THREE.MeshStandardMaterial, base: RGB, tint: RGB) {
  m.color.setRGB(base[0] * tint[0], base[1] * tint[1], base[2] * tint[2]);
}

/** Re-tint every shared material for the palette `p`. Allocation-free; call once per frame. */
export function tintWorld(p: Palette) {
  MATS.terrain.color.setRGB(...p.ground);
  MATS.foliage.color.setRGB(...p.foliage);
  MATS.rock.color.setRGB(...p.rock);
  MATS.rockFace.color.setRGB(...p.rock);
  MATS.water.color.setRGB(...p.water);
  MATS.foam.color.setRGB(...p.ground);
  MATS.splash.color.setRGB(...p.ground);
  MATS.wheel.color.setRGB(...p.ground);
  MATS.panel.color.setRGB(...p.ground);
  for (const k of PROPS) {
    tinted(MATS[k], BASE[k], k === "girder" ? p.rock : p.ground);
  }
  // Far mountains and clouds take on the sky: aerial perspective by day, silhouettes by night.
  MATS.mountain.color.setRGB(...p.rock).lerp(tmp.setRGB(...p.skyHorizon), 0.55);
  // Clouds: near-white by day, catching the sun's colour; sky-toned at night.
  MATS.cloud.color
    .setRGB(...p.skyHorizon)
    .lerp(tmp.setRGB(...p.sun), 0.3)
    .lerp(tmp.setRGB(1, 1, 1), 0.65 * (1 - p.stars))
    .multiplyScalar(1 - 0.5 * p.stars); // dim blue-grey at night, not moonlit periwinkle
  // Self-lit for most of their brightness: the golden-hour sun sits ahead of the chase camera,
  // so the faces we see are backlit and would go muddy brown on light alone. Dimmer at night.
  MATS.cloud.emissive.copy(MATS.cloud.color).multiplyScalar(0.85 - 0.5 * p.stars);
}
