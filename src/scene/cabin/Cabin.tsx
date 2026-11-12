"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { cabinFrame, emitCabinFrame } from "@/ride/cabinStore";
import { atmosphere, MATS } from "../materials";
import { ROUTE } from "../route3d";
import { TRAIN_PARAMS } from "../Train";
import { travel } from "../travel";
import { backdropGeometry, TILE } from "./backdrop";
import { CABIN, DISPLAY_DISTANCE, POSES } from "./layout";
import { fitPanel, panelGeometry, type PanelFit } from "./panel";

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
  /** Screen face of the display before the HTML fades in: dark glass. */
  screenColor: "#0b1020",
  bezelColor: "#23262e",
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

const settledQ = new THREE.Quaternion();
const settledM = new THREE.Matrix4();
const corner = new THREE.Vector3();
const fit: PanelFit = { cx: 0, cy: 0, w: 0, h: 0, mPerPx: 0 };

/**
 * The on-board cabin, staged far above the route (CABIN.origin), drawn only while the camera
 * is inside it. Holds the display panel (fitted every frame to the HTML display's box) and
 * the scrolling countryside outside its windows. Each frame it also reports where the panel
 * lands on screen (cabinFrame.panel) and notifies the DOM display (emitCabinFrame).
 * Draw calls while inside: 11 (model) + 1 (window glass) + 2 (panel) + 2 (scenery) = 16.
 */
export function Cabin() {
  const { scene } = useGLTF(CABIN_URL);
  const gl = useThree((s) => s.gl);
  const root = useRef<THREE.Group>(null);
  const scenery = useRef<THREE.Group>(null);
  const panel = useRef<THREE.Group>(null);
  const screenMesh = useRef<THREE.Mesh>(null);
  const bodyMesh = useRef<THREE.Mesh>(null);
  const built = useRef({ w: 0, h: 0, hang: 0 });
  const looks = useMemo(() => restyle(scene), [scene]);
  const panes = useMemo(() => (paneCache ??= paneGeometry()), []);
  const land = useMemo(() => backdropGeometry(), []);
  const panelMats = useMemo(
    () => ({
      screen: new THREE.MeshBasicMaterial({ color: LOOK.screenColor }),
      body: new THREE.MeshStandardMaterial({ color: LOOK.bezelColor, flatShading: true, metalness: 0.3, roughness: 0.5 }),
    }),
    [],
  );
  // The panel hangs in the settled camera's frame (fixed): computed once.
  const settled = useMemo(() => {
    settledM.lookAt(POSES.settled.pos, POSES.settled.look, THREE.Object3D.DEFAULT_UP);
    settledQ.setFromRotationMatrix(settledM);
    return { pos: POSES.settled.pos.clone(), q: settledQ.clone() };
  }, []);

  // Cabin loaded: from now on the camera may go inside.
  useLayoutEffect(() => {
    cabinFrame.ready = true;
    return () => {
      cabinFrame.ready = false;
      cabinFrame.started = false;
    };
  }, []);

  useFrame(({ camera, size }) => {
    const r = root.current;
    if (!r) return;
    const cam = camera as THREE.PerspectiveCamera;

    // Fit the panel to the HTML display's box for the current projection; rebuild its
    // geometry only when the size actually changed (resize, rotation).
    if (fitPanel(cabinFrame.target, size.width, size.height, cam.projectionMatrixInverse, DISPLAY_DISTANCE, fit)) {
      const top = settled.pos.y + fit.cy + fit.h / 2;
      const hang = Math.max(0, CABIN.ceilingY - top);
      const b = built.current;
      if (Math.abs(b.w - fit.w) > 1e-4 || Math.abs(b.h - fit.h) > 1e-4 || Math.abs(b.hang - hang) > 1e-3) {
        const g = panelGeometry(fit, hang);
        screenMesh.current?.geometry.dispose();
        bodyMesh.current?.geometry.dispose();
        if (screenMesh.current) screenMesh.current.geometry = g.screen;
        if (bodyMesh.current) bodyMesh.current.geometry = g.body;
        built.current = { w: fit.w, h: fit.h, hang };
      }
      panel.current?.position.set(fit.cx, fit.cy, -DISPLAY_DISTANCE);
    }

    // Draw the cabin only while the camera is in it.
    r.visible = cabinFrame.inside;
    if (r.visible) {
      lightCabin(looks, atmosphere.palette.windowGlow);
      // Scenery slides back as the train moves forward (+x), wrapping every tile.
      const dist = travel.position * ROUTE.spacing * SCENERY_SCALE;
      if (scenery.current) scenery.current.position.x = -(((dist % TILE) + TILE) % TILE);
    }

    // Where the panel's screen lands on screen this frame (for the HTML to ride on it).
    if (cabinFrame.blend > 0 && fit.w > 0) {
      camera.updateMatrixWorld();
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (let i = 0; i < 4; i++) {
        corner
          .set(fit.cx + (i & 1 ? fit.w / 2 : -fit.w / 2), fit.cy + (i & 2 ? -fit.h / 2 : fit.h / 2), -DISPLAY_DISTANCE)
          .applyQuaternion(settled.q)
          .add(settled.pos)
          .multiplyScalar(CABIN.scale)
          .add(CABIN.origin)
          .project(camera);
        const x = ((corner.x + 1) / 2) * size.width;
        const y = ((1 - corner.y) / 2) * size.height;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      const p = cabinFrame.panel;
      p.x = minX;
      p.y = minY;
      p.w = maxX - minX;
      p.h = maxY - minY;
    }
    emitCabinFrame();
  });

  // Compile the cabin's shaders on the first frame, while it is still hidden (compile() covers
  // invisible objects too), so the first trip through the window never stalls on a compile.
  const compiled = useRef(false);
  useFrame(({ camera, scene: world }) => {
    if (compiled.current || !root.current) return;
    compiled.current = true;
    gl.compile(root.current, camera, world);
  });

  return (
    <group ref={root} position={CABIN.origin} scale={CABIN.scale} visible={false}>
      <primitive object={scene} />
      {looks.glass && <mesh geometry={panes} material={looks.glass} />}
      <group ref={scenery}>
        <mesh geometry={land.land} material={MATS.terrain} />
        <mesh geometry={land.trees} material={MATS.foliage} />
      </group>
      <group position={settled.pos} quaternion={settled.q}>
        <group ref={panel}>
          <mesh ref={screenMesh} material={panelMats.screen} />
          <mesh ref={bodyMesh} material={panelMats.body} />
        </group>
      </group>
    </group>
  );
}
