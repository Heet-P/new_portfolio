"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { PROFILE } from "@/content/route";
import { loadPrintFonts } from "./cabin/print";
import { atmosphere } from "./materials";
import {
  ATLAS,
  atlasRect,
  PANEL,
  panelPlacements,
  reelFor,
  skillReel,
  strobeAmount,
  STROBE,
  type Panel,
  type ReelEntry,
  type Rect,
} from "./tunnelReel";
import { paintAtlas } from "./tunnelPosters";
import type { Span } from "./worldgen";

/**
 * The skills reel: backlit vintage paper posters hung on the tunnel walls (one per skill from
 * PROFILE.skills, spread over the tunnels, the reel running on from one into the next), the first
 * in each tunnel being a blackletter "Skills Supplement" title card. They flash past as the train
 * goes through, like metro tunnel ads, and each flares briefly as it sweeps into view beside the
 * camera.
 *
 * Cheap by construction: one texture atlas printed once (and again when the page's fonts arrive),
 * one material, and one InstancedMesh per tunnel (so at most two draw calls, and only the tunnel
 * the camera is near is drawn). Self-lit through the map, like the stations' windows, so no real
 * lights. The posters are decorative; the same skills are plain text in Express and on the
 * Departure page.
 */

/** Look of the glow: base multiplier on the printed paper, plus this much per unit of the palette's windowGlow. */
const GLOW = { base: 1.05, perWindowGlow: 0.1 };

/** A poster's rectangle in atlas pixels -> the (offset, scale) vec4 the shader applies to the plane's UVs. */
function uvRect(r: Rect, out: Float32Array, at: number) {
  const S = ATLAS.size;
  out[at] = r.x / S;
  out[at + 1] = 1 - (r.y + r.h) / S; // canvas y runs down, texture v runs up
  out[at + 2] = r.w / S;
  out[at + 3] = r.h / S;
}

/** One tunnel's mesh and what the per-frame strobe needs to know about its posters. */
interface TunnelMesh {
  mesh: THREE.InstancedMesh;
  /** World x, z of each instance. */
  px: Float32Array;
  pz: Float32Array;
  flash: THREE.InstancedBufferAttribute;
}

const UP = new THREE.Vector3(0, 1, 0);
const m4 = new THREE.Matrix4();
const right = new THREE.Vector3();
const normal = new THREE.Vector3();
const pos = new THREE.Vector3();
const scale = new THREE.Vector3();
const quat = new THREE.Quaternion();

/** Build a tunnel's InstancedMesh: one instance per panel; `titleCell` is the atlas cell of the title card (panels with no entry). */
function buildTunnel(panels: Panel[], atlasIndex: Map<string, number>, titleCell: number, material: THREE.Material): TunnelMesh {
  const count = panels.length;
  const geometry = new THREE.PlaneGeometry(1, 1);
  const uv = new Float32Array(count * 4);
  const flash = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
  flash.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("aUvRect", new THREE.InstancedBufferAttribute(uv, 4));
  geometry.setAttribute("aFlash", flash);
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const px = new Float32Array(count);
  const pz = new Float32Array(count);
  panelPlacements(panels).forEach((p, i) => {
    const panel = panels[i];
    right.set(...p.right);
    normal.set(...p.normal);
    quat.setFromRotationMatrix(m4.makeBasis(right, UP, normal));
    mesh.setMatrixAt(i, m4.compose(pos.set(p.x, p.y, p.z), quat, scale.set(PANEL.width, PANEL.height, 1)));
    uvRect(atlasRect(panel.entry ? (atlasIndex.get(panel.entry.skill) ?? 0) : titleCell), uv, i * 4);
    px[i] = p.x;
    pz[i] = p.z;
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return { mesh, px, pz, flash };
}

/** The posters' material: the atlas as a self-lit map, a per-instance atlas rectangle and a per-instance flare. */
function posterMaterial(map: THREE.Texture): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader =
      "attribute vec4 aUvRect;\nattribute float aFlash;\nvarying float vFlash;\n" +
      sh.vertexShader.replace("#include <uv_vertex>", "#include <uv_vertex>\n  vMapUv = vMapUv * aUvRect.zw + aUvRect.xy;\n  vFlash = aFlash;");
    sh.fragmentShader =
      "varying float vFlash;\n" +
      sh.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\n  diffuseColor.rgb *= 1.0 + vFlash;");
  };
  return m;
}

/** The atlas canvas, its texture and the material: created once per mount, freed on unmount. */
function createResources() {
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS.size;
  canvas.height = ATLAS.size;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // Seen at a slant from behind the train: anisotropic filtering keeps the type readable.
  texture.anisotropy = 8;
  return { canvas, texture, material: posterMaterial(texture) };
}
type Resources = ReturnType<typeof createResources>;

/** Print the atlas and flag the texture for upload. */
function printAtlas(res: Resources, reel: ReelEntry[]) {
  paintAtlas(res.canvas, reel);
  res.texture.needsUpdate = true;
}

const camDir = new THREE.Vector3();

/** Put every poster's flare back to zero (reduced motion on: nothing may stay lit from before). */
function clearFlash(meshes: TunnelMesh[]) {
  for (const t of meshes) {
    (t.flash.array as Float32Array).fill(0);
    t.flash.needsUpdate = true;
  }
}

/** Set each poster's flare for a camera at `cam` looking along (dx, dz); only tunnels the camera is in or beside. */
function strobe(meshes: TunnelMesh[], cam: THREE.Vector3, dx: number, dz: number) {
  for (const t of meshes) {
    const sphere = t.mesh.boundingSphere;
    if (sphere && sphere.center.distanceTo(cam) > sphere.radius + STROBE.ahead * 4) continue;
    const flash = t.flash.array as Float32Array;
    for (let i = 0; i < flash.length; i++) flash[i] = strobeAmount((t.px[i] - cam.x) * dx + (t.pz[i] - cam.z) * dz) * STROBE.gain;
    t.flash.needsUpdate = true;
  }
}

/**
 * Tunnel skills reel (see the file comment). `reducedMotion` turns the strobe off; the posters
 * themselves are static.
 */
export function TunnelPanels({ tunnels, reducedMotion }: { tunnels: Span[]; reducedMotion: boolean }) {
  const [res] = useState(createResources);
  const reel = useMemo(() => skillReel(PROFILE.skills), []);
  const meshes = useMemo(() => {
    const atlasIndex = new Map(reel.map((r, i) => [r.skill, i] as const));
    return reelFor(reel, tunnels).map((panels) => buildTunnel(panels, atlasIndex, reel.length, res.material));
  }, [reel, tunnels, res]);

  // Print now (fallback fonts), and again once the page's fonts are ready.
  useEffect(() => {
    let live = true;
    printAtlas(res, reel);
    void loadPrintFonts().then(() => {
      if (live) printAtlas(res, reel);
    });
    return () => {
      live = false;
    };
  }, [res, reel]);

  // Reduced motion (also when it is switched on mid-ride): no flare, and none left over.
  useEffect(() => {
    if (reducedMotion) clearFlash(meshes);
  }, [reducedMotion, meshes]);

  // Free GPU resources with the scene.
  useEffect(
    () => () => {
      res.texture.dispose();
      res.material.dispose();
    },
    [res],
  );
  useEffect(
    () => () => {
      for (const t of meshes) {
        t.mesh.geometry.dispose();
        t.mesh.dispose();
      }
    },
    [meshes],
  );

  useFrame(({ camera }) => {
    // Glow follows the night: a little brighter as the palette's window light rises.
    res.material.color.setScalar(GLOW.base + GLOW.perWindowGlow * atmosphere.palette.windowGlow);
    if (reducedMotion) return;
    camera.getWorldDirection(camDir);
    const h = Math.hypot(camDir.x, camDir.z) || 1;
    const dx = camDir.x / h;
    const dz = camDir.z / h;
    strobe(meshes, camera.position, dx, dz);
  });

  return (
    <group>
      {meshes.map((t, k) => (
        <primitive key={k} object={t.mesh} />
      ))}
    </group>
  );
}
