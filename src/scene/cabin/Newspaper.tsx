"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { STATIONS } from "@/content/route";
import { ILLUSTRATIONS } from "@/newspaper/illustrations";
import { cabinFrame, emitCabinFrame } from "@/ride/cabinStore";
import { paperLift, paperUnfold } from "@/ride/stopCamera";
import { atmosphere } from "../materials";
import { travel } from "../travel";
import { NEWSPAPER, PAPER_DISTANCE, POSES } from "./layout";
import { fitPanel, type PanelFit } from "./panel";
import { loadPrintFonts, printFrontPage } from "./print";

/** How the paper is lit: by the cabin lamps on the seat, as if under a reading lamp once lifted. */
const GLOW = {
  /** Self-lit amount on the seat at golden hour, plus this much per windowGlow at night. */
  seat: 0.05,
  seatPerGlow: 0.08,
  /** Held up to read: bright enough that the tone-mapped paper is close to the HTML page's. */
  read: 0.8,
};
/** How far short of flat the folded half rests, so the two halves never z-fight. */
const FOLDED = Math.PI - 0.06;
/** Back of the sheet: plain newsprint (linear RGB, a shade darker than the page). */
const BACK = "vec3(0.62, 0.55, 0.40)";
/** Canvas width of the printed page (its height follows the page's aspect). */
const PRINT_W = 1024;

/** Illustrations for the print, loaded once per stop and shared across prints. */
const artCache = new Map<string, HTMLImageElement>();

const finalPos = new THREE.Vector3();
const corner = new THREE.Vector3();
/** Lying on the seat: flat and face up, then turned a little off square. */
const seatQ = new THREE.Quaternion().multiplyQuaternions(
  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), NEWSPAPER.yaw),
  new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)),
);
/** The settled camera's pose: the unfolded sheet hangs in its frame, PAPER_DISTANCE ahead. */
const settledPos = POSES.settled.pos.clone();
const settledQ = new THREE.Quaternion().setFromRotationMatrix(
  new THREE.Matrix4().lookAt(POSES.settled.pos, POSES.settled.look, THREE.Object3D.DEFAULT_UP),
);

/** One half of the sheet: a w x h/2 plane above (top) or below (bottom) the fold, mapped to its half of the print. */
function half(w: number, h: number, top: boolean): THREE.PlaneGeometry {
  const g = new THREE.PlaneGeometry(w, h / 2).translate(0, top ? h / 4 : -h / 4, 0);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setY(i, (top ? 0.5 : 0) + uv.getY(i) * 0.5);
  return g;
}

/** A canvas (and its texture) to print the front page on, shaped like the page. */
function makePrint(aspect: number) {
  const canvas = document.createElement("canvas");
  canvas.width = PRINT_W;
  canvas.height = Math.round(Math.min(2048, Math.max(256, PRINT_W / aspect)));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { canvas, texture, aspect };
}

/** The sheet's three.js resources and print state: created once per mount, mutated per frame. */
function createSheet() {
  const print = makePrint(3 / 2);
  const material = new THREE.MeshStandardMaterial({
    map: print.texture,
    emissive: "#ffffff",
    emissiveMap: print.texture,
    roughness: 0.95,
    metalness: 0,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  // The back of the sheet shows plain newsprint instead of the mirrored front page.
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <map_fragment>", `#include <map_fragment>\nif (!gl_FrontFacing) diffuseColor.rgb = ${BACK};`)
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>\nif (!gl_FrontFacing) totalEmissiveRadiance = emissive * ${BACK};`,
      );
  };
  return {
    print,
    material,
    fit: { cx: 0, cy: 0, w: 0, h: 0 } as PanelFit,
    /** Size the halves were last built for. */
    w: 0,
    h: 0,
    /** Stop currently printed, and whether it needs printing again (fonts / art arrived). */
    station: -1,
    dirty: true,
  };
}
type Sheet = ReturnType<typeof createSheet>;

interface SheetParts {
  paper: THREE.Group;
  hinge: THREE.Group;
  top: THREE.Mesh;
  bottom: THREE.Mesh;
}

/** Size the halves to the HTML page's box; a new page shape also gets a new print of that shape. */
function sizeSheet(sheet: Sheet, parts: SheetParts) {
  const { fit } = sheet;
  if (Math.abs(sheet.w - fit.w) <= 1e-4 && Math.abs(sheet.h - fit.h) <= 1e-4) return;
  parts.top.geometry.dispose();
  parts.bottom.geometry.dispose();
  parts.top.geometry = half(fit.w, fit.h, true);
  parts.bottom.geometry = half(fit.w, fit.h, false);
  sheet.w = fit.w;
  sheet.h = fit.h;
  const aspect = fit.w / fit.h;
  if (Math.abs(aspect / sheet.print.aspect - 1) > 0.02) {
    sheet.print.texture.dispose();
    sheet.print = makePrint(aspect); // text must never stretch
    sheet.material.map = sheet.print.texture;
    sheet.material.emissiveMap = sheet.print.texture;
    sheet.dirty = true;
  }
}

/**
 * Print the stop the train is at (or pulling into), again whenever it changes. Its illustration
 * loads on first need and triggers one more print when it arrives.
 */
function printSheet(sheet: Sheet) {
  const index = Math.min(STATIONS.length - 1, Math.max(0, Math.round(travel.position)));
  if (index === sheet.station && !sheet.dirty) return;
  const station = STATIONS[index];
  let art = artCache.get(station.id) ?? null;
  if (!art && ILLUSTRATIONS[station.id]) {
    art = new Image();
    art.decoding = "async";
    art.src = `/illustrations/${station.id}-600.webp`;
    art.onload = () => {
      if (sheet.station === index) sheet.dirty = true;
    };
    artCache.set(station.id, art);
  }
  printFrontPage(sheet.print.canvas, station, index, art?.complete && art.naturalWidth > 0 ? art : null);
  sheet.print.texture.needsUpdate = true;
  sheet.station = index;
  sheet.dirty = false;
}

/** Seat -> in front of the settled camera along a small arc, unfolding on the way. */
function poseSheet(sheet: Sheet, parts: SheetParts, reducedMotion: boolean) {
  const b = cabinFrame.blend;
  const lift = reducedMotion ? 1 : paperLift(b);
  const unfold = reducedMotion ? 1 : paperUnfold(b);
  finalPos.set(sheet.fit.cx, sheet.fit.cy, -PAPER_DISTANCE).applyQuaternion(settledQ).add(settledPos);
  parts.paper.position.lerpVectors(NEWSPAPER.pos, finalPos, lift);
  parts.paper.position.y += NEWSPAPER.liftArc * Math.sin(Math.PI * lift);
  parts.paper.quaternion.slerpQuaternions(seatQ, settledQ, lift);
  parts.hinge.rotation.x = FOLDED * (1 - unfold);
  // Lamp-lit on the seat, then lit for reading as it comes up.
  const seatGlow = GLOW.seat + GLOW.seatPerGlow * atmosphere.palette.windowGlow;
  sheet.material.emissiveIntensity = seatGlow + (GLOW.read - seatGlow) * lift;
}

/** Where the sheet lands on screen this frame (cabinFrame.panel), for the HTML page to ride on. */
function projectSheet(sheet: Sheet, parts: SheetParts, camera: THREE.Camera, width: number, height: number) {
  camera.updateMatrixWorld();
  parts.paper.updateWorldMatrix(true, true);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < 4; i++) {
    // Top corners on the upper half, bottom corners on the hinged lower half.
    const top = i < 2;
    corner
      .set(i & 1 ? sheet.w / 2 : -sheet.w / 2, top ? sheet.h / 2 : -sheet.h / 2, 0)
      .applyMatrix4(top ? parts.paper.matrixWorld : parts.hinge.matrixWorld)
      .project(camera);
    const x = ((corner.x + 1) / 2) * width;
    const y = ((1 - corner.y) / 2) * height;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const r = cabinFrame.panel;
  r.x = minX;
  r.y = minY;
  r.w = maxX - minX;
  r.h = maxY - minY;
}

function markDirty(sheet: Sheet) {
  sheet.dirty = true;
}

function disposeSheet(sheet: Sheet) {
  sheet.print.texture.dispose();
  sheet.material.dispose();
}

/**
 * The newspaper on the cabin seat (replaces the old hanging screen). Two thin paper planes
 * hinged at the fold share one material, so it costs 2 draw calls. The front page is printed
 * onto a CanvasTexture (scene/cabin/print.ts); the back of the sheet is plain paper.
 *
 * Driven every frame by the cabin blend (ride/stopCamera.ts): it lies folded on the seat while
 * the camera comes in and leans toward it, then is lifted along a small arc to in front of the
 * settled camera while it unfolds about the fold; flat, it covers exactly the HTML front page's
 * box (fitted with fitPanel), which then fades in over it. Leaving plays it all in reverse.
 * Reduced motion: the paper is simply open in front of the camera (the swap overlay crossfades).
 * Each frame it also reports where the paper lands on screen (cabinFrame.panel) and notifies
 * the DOM page (emitCabinFrame). Lives in the cabin's own space (a child of the Cabin group).
 */
export function Newspaper({ reducedMotion }: { reducedMotion: boolean }) {
  const paper = useRef<THREE.Group>(null);
  const hinge = useRef<THREE.Group>(null);
  const topMesh = useRef<THREE.Mesh>(null);
  const bottomMesh = useRef<THREE.Mesh>(null);
  const [sheet] = useState(createSheet);

  // Reprint once the page's fonts are ready (a canvas never waits for a web font).
  useEffect(() => {
    let live = true;
    void loadPrintFonts().then(() => {
      if (live) markDirty(sheet);
    });
    return () => {
      live = false;
    };
  }, [sheet]);

  // Free GPU resources with the scene (the meshes' geometries go with the meshes).
  useEffect(() => () => disposeSheet(sheet), [sheet]);

  useFrame(({ camera, size }) => {
    if (!paper.current || !hinge.current || !topMesh.current || !bottomMesh.current) return;
    const parts = { paper: paper.current, hinge: hinge.current, top: topMesh.current, bottom: bottomMesh.current };
    const cam = camera as THREE.PerspectiveCamera;
    // The unfolded sheet covers the HTML page's box for the current projection.
    if (fitPanel(cabinFrame.target, size.width, size.height, cam.projectionMatrixInverse, PAPER_DISTANCE, sheet.fit)) {
      sizeSheet(sheet, parts);
    }
    if (sheet.w > 0) {
      printSheet(sheet);
      poseSheet(sheet, parts, reducedMotion);
      if (cabinFrame.blend > 0) projectSheet(sheet, parts, camera, size.width, size.height);
    }
    // Always notify the HTML page: it follows the blend even before there is a sheet to ride on.
    emitCabinFrame();
  });

  return (
    <group ref={paper}>
      <mesh ref={topMesh} material={sheet.material} />
      <group ref={hinge}>
        <mesh ref={bottomMesh} material={sheet.material} />
      </group>
    </group>
  );
}
