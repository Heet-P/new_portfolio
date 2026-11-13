"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { cabinFrame } from "@/ride/cabinStore";
import { atmosphere, MATS } from "../materials";
import { ROUTE } from "../route3d";
import { TRAIN_PARAMS } from "../Train";
import { travel } from "../travel";
import { backdropGeometry, TILE } from "./backdrop";
import { CABIN } from "./layout";
import { Newspaper } from "./Newspaper";

/**
 * Cabin: "Subway_[interior]" by Comicaroid (CC BY 4.0), compressed by scripts/compress-model.mjs
 * (11 materials -> 11 draw calls). Credited on the Terminus display and in CREDITS.md.
 */
export const CABIN_URL = "/models/cabin.glb";

/** Look of the cabin: glass, the warm interior light that follows the palette's windowGlow. */
const LOOK = {
  glassColor: "#d6ebe6",
  glassOpacity: 0.16,
  /** Warm lamp light the interior surfaces give off (multiplies each material's own colour). */
  lampTint: new THREE.Color("#ffd9a8"),
  /** Self-lit amount at golden hour .. at night (windowGlow 0.12 .. 2.5). */
  fillDay: 0.05,
  fillPerGlow: 0.11,
  /** Ceiling light strips: base glow + extra per windowGlow (above the bloom threshold at night). */
  stripBase: 1.1,
  stripPerGlow: 0.55,
};

useGLTF.preload(CABIN_URL);

/** Scenery metres per world unit the train travels (the backdrop's scroll speed). */
const SCENERY_SCALE = 1;

/**
 * Restyle the Blender materials for the low-poly world: flat facets, no mirror-black metals
 * (there is no environment map to reflect), translucent tinted glass, glowing ceiling strips,
 * and a warm self-lit term on everything else so the car reads as lamp-lit at night.
 * Idempotent (useGLTF shares one scene): only fixed values are written.
 */
function restyle(scene: THREE.Object3D) {
  const lit: THREE.MeshStandardMaterial[] = [];
  let strip: THREE.MeshStandardMaterial | null = null;
  let glass: THREE.MeshStandardMaterial | null = null;
  const seen = new Set<THREE.Material>();
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const m = mesh.material as THREE.MeshStandardMaterial;
    if (seen.has(m)) return;
    seen.add(m);
    m.flatShading = true;
    m.metalness = Math.min(m.metalness, 0.3);
    m.needsUpdate = true;
    if (m.name === "/glass") {
      m.color.set(LOOK.glassColor);
      m.transparent = true;
      m.opacity = LOOK.glassOpacity;
      m.depthWrite = false;
      m.roughness = 0.1;
      glass = m;
    } else if (m.name === "/Emissive") {
      m.emissive.set("#fff1d6");
      m.toneMapped = false;
      strip = m;
    } else {
      m.emissive.copy(m.color).multiply(LOOK.lampTint);
      lit.push(m);
    }
  });
  return { lit, strip: strip as THREE.MeshStandardMaterial | null, glass: glass as THREE.MeshStandardMaterial | null };
}

/**
 * Interior light for the palette's windowGlow: a faint warm fill by day, lamp-lit at night;
 * the ceiling strips brighten past the bloom threshold after dark.
 */
function lightCabin(looks: ReturnType<typeof restyle>, glow: number) {
  for (const m of looks.lit) m.emissiveIntensity = LOOK.fillDay + LOOK.fillPerGlow * glow;
  if (looks.strip) looks.strip.emissiveIntensity = LOOK.stripBase + LOOK.stripPerGlow * glow * TRAIN_PARAMS.noBloomGlowBoost;
}

/** Glass for the side windows and door lights (the model leaves those openings empty). */
function paneGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const [y0, y1] = CABIN.windowY;
  const add = (x0: number, x1: number) => {
    for (const side of [1, -1]) {
      parts.push(new THREE.PlaneGeometry(x1 - x0, y1 - y0).translate((x0 + x1) / 2, (y0 + y1) / 2, side * CABIN.paneZ));
    }
  };
  for (const [x0, x1] of CABIN.windowsX) add(x0, x1);
  for (const d of CABIN.doorsX) {
    add(d - CABIN.doorPaneX[1], d - CABIN.doorPaneX[0]);
    add(d + CABIN.doorPaneX[0], d + CABIN.doorPaneX[1]);
  }
  const g = mergeGeometries(parts);
  g.deleteAttribute("uv");
  return g;
}

let paneCache: THREE.BufferGeometry | null = null;

/**
 * The on-board cabin, staged far above the route (CABIN.origin), drawn only while the camera
 * is inside it. Holds the newspaper on the seat (see Newspaper: it unfolds into the HTML front
 * page and reports where it lands on screen) and the scrolling countryside outside its windows.
 * Draw calls while inside: 11 (model) + 1 (window glass) + 2 (newspaper) + 2 (scenery) = 16.
 */
export function Cabin({ post, reducedMotion }: { post: boolean; reducedMotion: boolean }) {
  const { scene } = useGLTF(CABIN_URL);
  const gl = useThree((s) => s.gl);
  const root = useRef<THREE.Group>(null);
  const scenery = useRef<THREE.Group>(null);
  const looks = useMemo(() => restyle(scene), [scene]);
  const panes = useMemo(() => (paneCache ??= paneGeometry()), []);
  const land = useMemo(() => backdropGeometry(), []);

  // Cabin loaded: from now on the camera may go inside.
  useLayoutEffect(() => {
    cabinFrame.ready = true;
    return () => {
      cabinFrame.ready = false;
      cabinFrame.started = false;
    };
  }, []);

  useFrame(() => {
    const r = root.current;
    if (!r) return;
    // Draw the cabin only while the camera is in it (or during the load-time warm-up).
    r.visible = cabinFrame.inside || cabinFrame.warm > 0;
    if (r.visible) {
      lightCabin(looks, atmosphere.palette.windowGlow);
      // Scenery slides back as the train moves forward (+x), wrapping every tile.
      const dist = travel.position * ROUTE.spacing * SCENERY_SCALE;
      if (scenery.current) scenery.current.position.x = -(((dist % TILE) + TILE) % TILE);
    }
  });

  // Shader warm-up, once, on the first frame after load (the scene is still fading in).
  // Every page load starts parked at a station, i.e. inside the cabin, so without it the whole
  // outside world would compile on the first departure (and the cabin on a later arrival).
  // 1. compile() every material in the scene, hidden ones included. A program's key includes
  //    the tone mapping and output colour space, which differ when drawing into a render
  //    target: with post-processing (desktop tier) the scene is drawn into the composer's
  //    target, so compile with a render target bound to get those exact programs.
  // 2. Then draw both the cabin and the outside world for two frames (cabinFrame.warm), which
  //    also builds what compile() cannot: the shadow-map depth programs of the casters.
  const warmed = useRef(false);
  useFrame(({ camera, scene: world }) => {
    if (cabinFrame.warm > 0) cabinFrame.warm--;
    if (warmed.current) return;
    warmed.current = true;
    const prev = gl.getRenderTarget();
    const target = post ? new THREE.WebGLRenderTarget(1, 1) : null;
    gl.setRenderTarget(target);
    gl.compile(world, camera);
    gl.setRenderTarget(prev);
    target?.dispose();
    cabinFrame.warm = 2;
  });

  return (
    <group ref={root} position={CABIN.origin} scale={CABIN.scale} visible={false}>
      <primitive object={scene} />
      {looks.glass && <mesh geometry={panes} material={looks.glass} />}
      <group ref={scenery}>
        <mesh geometry={land.land} material={MATS.terrain} />
        <mesh geometry={land.trees} material={MATS.foliage} />
      </group>
      <Newspaper reducedMotion={reducedMotion} />
    </group>
  );
}
