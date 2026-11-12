import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { ScreenRect } from "@/ride/cabinStore";

/**
 * The on-board display's 3D body: a screen face, a rounded bezel and two hangers up to the
 * ceiling. Its size is not fixed: it is fitted so that, seen from the settled camera, the
 * screen face covers exactly the HTML display's box on screen (see OnboardDisplay), so the
 * HTML can sit on it pixel for pixel without ever being scaled.
 */

/** Bezel rim and corner radii in screen px (inner radius = outer - rim, the nested-corner rule). */
export const BEZEL_PX = { rim: 12, outer: 24 } as const;
/** Bezel depth, hanger radius (cabin metres). */
const DEPTH = 0.05;
const HANGER_R = 0.006;

/** Where the screen face sits in the settled camera's frame (cabin metres; -z = ahead). */
export interface PanelFit {
  cx: number;
  cy: number;
  w: number;
  h: number;
  /** Cabin metres per screen px at the panel's distance (for the px-sized bezel). */
  mPerPx: number;
}

const v = new THREE.Vector3();

/**
 * Fit the panel to a screen rect: unproject the rect's corners with the camera's current
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
  out.mPerPx = out.h / rect.h;
  return true;
}

/** Rounded rectangle centred on the origin. */
function roundedRect<T extends THREE.Path>(w: number, h: number, r: number, shape: T): T {
  const x = -w / 2;
  const y = -h / 2;
  const rr = Math.min(r, w / 2, h / 2);
  shape.moveTo(x + rr, y);
  shape.lineTo(x + w - rr, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + rr);
  shape.lineTo(x + w, y + h - rr);
  shape.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  shape.lineTo(x + rr, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - rr);
  shape.lineTo(x, y + rr);
  shape.quadraticCurveTo(x, y, x + rr, y);
  return shape;
}

/**
 * Geometry for a fitted panel, in the panel's own frame (screen face at z = 0 facing +z,
 * centred on the origin): `screen` (the glass face) and `body` (bezel + hangers merged, one
 * draw call). `hangerLength` = distance from the bezel's top edge up to the ceiling (0 = none).
 */
export function panelGeometry(fit: PanelFit, hangerLength: number) {
  const rim = BEZEL_PX.rim * fit.mPerPx;
  const outerR = BEZEL_PX.outer * fit.mPerPx;
  const innerR = outerR - rim;

  const screen = new THREE.ShapeGeometry(roundedRect(fit.w, fit.h, innerR, new THREE.Shape()), 6);
  screen.deleteAttribute("uv");

  const outer = roundedRect(fit.w + rim * 2, fit.h + rim * 2, outerR, new THREE.Shape());
  outer.holes.push(roundedRect(fit.w, fit.h, innerR, new THREE.Path()));
  const bezel = new THREE.ExtrudeGeometry(outer, { depth: DEPTH, bevelEnabled: false, curveSegments: 6 }).translate(0, 0, -DEPTH + 0.004);
  // A back plate so the panel is solid from any angle the camera passes on its way in.
  const back = new THREE.ShapeGeometry(roundedRect(fit.w + rim * 2, fit.h + rim * 2, outerR, new THREE.Shape()), 6)
    .rotateY(Math.PI)
    .translate(0, 0, -DEPTH + 0.004);
  const flat = (g: THREE.BufferGeometry) => (g.index ? g.toNonIndexed() : g);
  const parts = [flat(bezel), flat(back)];
  if (hangerLength > 0.01) {
    const top = fit.h / 2 + rim;
    for (const x of [-fit.w * 0.36, fit.w * 0.36]) {
      parts.push(
        new THREE.CylinderGeometry(HANGER_R, HANGER_R, hangerLength, 6)
          .translate(x, top + hangerLength / 2, -DEPTH / 2)
          .toNonIndexed(), // cylinders are indexed
      );
    }
  }
  for (const p of parts) p.deleteAttribute("uv");
  const body = mergeGeometries(parts);
  return { screen, body };
}
