import * as THREE from "three";
import type { ScreenRect } from "@/ride/cabinStore";

/**
 * Fitting the cabin's 3D newspaper to the HTML front page. Its size is not fixed: it is chosen
 * so that, unfolded in front of the settled camera, the paper covers exactly the HTML page's
 * box on screen (see OnboardDisplay), so the HTML can sit on it pixel for pixel without ever
 * being scaled.
 */

/** Where the paper sits in the settled camera's frame (cabin metres; -z = ahead). */
export interface PanelFit {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

const v = new THREE.Vector3();

/**
 * Fit the paper to a screen rect: unproject the rect's corners with the camera's current
 * projection (which includes the desktop view offset) onto the plane `distance` ahead of the
 * settled eye. Rays don't depend on scale, so the result is in the same units as `distance`.
 * Returns false if the rect or viewport is empty.
 */
export function fitPanel(
  rect: ScreenRect,
  viewW: number,
  viewH: number,
  projectionInverse: THREE.Matrix4,
  distance: number,
  out: PanelFit,
): boolean {
  if (rect.w <= 0 || rect.h <= 0 || viewW <= 0 || viewH <= 0) return false;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < 4; i++) {
    const sx = rect.x + (i & 1 ? rect.w : 0);
    const sy = rect.y + (i & 2 ? rect.h : 0);
    v.set((sx / viewW) * 2 - 1, 1 - (sy / viewH) * 2, 0.5).applyMatrix4(projectionInverse);
    v.multiplyScalar(-distance / v.z);
    minX = Math.min(minX, v.x);
    maxX = Math.max(maxX, v.x);
    minY = Math.min(minY, v.y);
    maxY = Math.max(maxY, v.y);
  }
  out.cx = (minX + maxX) / 2;
  out.cy = (minY + maxY) / 2;
  out.w = maxX - minX;
  out.h = maxY - minY;
  return true;
}
