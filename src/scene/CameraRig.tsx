"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { smoothstep } from "./noise";
import { ROUTE, tangentAt, trainPose } from "./route3d";
import { travel } from "./travel";
import { getWorld } from "./World";
import { heightAt } from "./worldgen";

/**
 * One camera framing, in the train's frame: `ahead` along the track (+ = in front of the
 * train, - = behind it), `side` to the right of travel (the camera side; platforms are on
 * the left), `up` above the rails. The look target is the train centre shifted by
 * lookAhead / lookUp / lookSide (lookSide - = toward the platform).
 */
interface Framing {
  ahead: number;
  side: number;
  up: number;
  lookAhead: number;
  lookUp: number;
  lookSide: number;
}

const F = (ahead: number, side: number, up: number, lookAhead: number, lookUp: number, lookSide = 0): Framing => ({
  ahead,
  side,
  up,
  lookAhead,
  lookUp,
  lookSide,
});

/**
 * Camera framing knobs: a raised chase camera behind the train, slightly to its right so
 * the body reads, looking forward along the track: the train runs away from the camera,
 * into the world, with the route ahead and a band of sky in view. At a station it rises a
 * little and opens to the left to take in the platform. Phones: the same, closer in.
 */
export const CAMERA = {
  desktop: {
    fov: 38,
    // High enough to look over the steel bridge's arches and the overhead line.
    travel: F(-34, 9, 14, 40, 2),
    station: F(-32, 10, 16, 36, 1, -3),
  },
  phone: {
    fov: 52,
    travel: F(-27, 5, 12, 34, 2),
    station: F(-26, 6, 14, 32, 1, -4),
  },
  /** Aspect (w/h) below which the phone framing applies fully; above wideAspect, desktop. */
  narrowAspect: 0.7,
  wideAspect: 1.2,
  /** Screen px on the left covered by the desktop route-map panel (RouteMap.module.css). */
  leftInsetPx: 260,
  /** Idle drift amplitude (units) and period (s). */
  driftAmount: 0.4,
  driftPeriod: 16,
  /** Keep at least this much clearance above the terrain. */
  minClearance: 4,
};

const KEYS = ["ahead", "side", "up", "lookAhead", "lookUp", "lookSide"] as const;

/** out = a + (b - a) * t per field. */
function blend(out: Framing, a: Framing, b: Framing, t: number): Framing {
  for (const k of KEYS) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
}

const tan = new THREE.Vector3();
const pos = new THREE.Vector3();
const look = new THREE.Vector3();
const lookTan = new THREE.Vector3();
const goalPos = new THREE.Vector3();
const goalLook = new THREE.Vector3();
const phoneF = F(0, 0, 0, 0, 0);
const deskF = F(0, 0, 0, 0, 0);
const frame = F(0, 0, 0, 0, 0);

/**
 * Chase camera. Rigidly tied to the train's (already speed-limited, smoothly eased) place
 * on the track, so it never lags and snaps: all smoothing lives in travel.ts. Its frame is
 * taken from the curve at the camera's own arc length, so it swings naturally through
 * bends. Allocation-free per frame. Reduced motion: no idle drift.
 */
export function CameraRig({ reducedMotion }: { reducedMotion: boolean }) {
  const view = useRef({ w: 0, h: 0, inset: -1 });

  useFrame(({ camera, size, clock }) => {
    const cam = camera as THREE.PerspectiveCamera;
    const trainS = trainPose.u * ROUTE.length;

    // Blend travel <-> the nearest station's framing by distance to it, then phone <->
    // desktop by aspect.
    const aspect = size.width / Math.max(1, size.height);
    const wide = smoothstep(CAMERA.narrowAspect, CAMERA.wideAspect, aspect);
    const near = Math.round(travel.position);
    const atStop = 1 - smoothstep(0, 0.3, Math.abs(travel.position - near));
    blend(deskF, CAMERA.desktop.travel, CAMERA.desktop.station, atStop);
    blend(phoneF, CAMERA.phone.travel, CAMERA.phone.station, atStop);
    blend(frame, phoneF, deskF, wide);

    // Barely-there idle drift (none for reduced motion).
    const t = (clock.elapsedTime / CAMERA.driftPeriod) * Math.PI * 2;
    const drift = reducedMotion ? 0 : CAMERA.driftAmount;
    const up = frame.up + Math.sin(t * 0.7 + 1) * drift * 0.5;
    const side = frame.side + Math.sin(t) * drift;

    // Camera position from the curve at its own arc length (behind the train).
    const u = Math.max(0, Math.min(1, (trainS + frame.ahead) / ROUTE.length));
    ROUTE.curve.getPointAt(u, pos);
    tangentAt(u, tan);
    tan.y = 0;
    tan.normalize();
    // Right of travel = tangent x up.
    const rx = -tan.z;
    const rz = tan.x;

    goalPos.set(pos.x + rx * side, pos.y + up, pos.z + rz * side);
    // Never inside a hill (tunnels, valley sides): ride up over the terrain. The look target
    // rises by the same amount, so the view keeps its pitch and looks out over the hill
    // (e.g. while the train is inside a tunnel) instead of into the slope.
    const lift = Math.max(0, heightAt(getWorld(), goalPos.x, goalPos.z) + CAMERA.minClearance - goalPos.y);
    goalPos.y += lift;
    // Look target: on the track ahead of the train (taken from the curve, so it leads the
    // camera round bends).
    const lu = Math.max(0, Math.min(1, (trainS + frame.lookAhead) / ROUTE.length));
    ROUTE.curve.getPointAt(lu, look);
    tangentAt(lu, lookTan);
    goalLook.set(
      look.x - lookTan.z * frame.lookSide,
      look.y + frame.lookUp + lift,
      look.z + lookTan.x * frame.lookSide,
    );
    camera.position.copy(goalPos);
    camera.lookAt(goalLook);

    // FOV per framing, and shift the projection right on desktop so the train sits in the
    // space beside the route-map panel instead of under it.
    const fov = CAMERA.phone.fov + (CAMERA.desktop.fov - CAMERA.phone.fov) * wide;
    const inset = size.width > 640 && size.height > 600 ? CAMERA.leftInsetPx * wide : 0;
    const v = view.current;
    if (Math.abs(cam.fov - fov) > 0.01 || v.w !== size.width || v.h !== size.height || v.inset !== inset) {
      cam.fov = fov;
      if (inset > 0) cam.setViewOffset(size.width, size.height, -inset / 2, 0, size.width, size.height);
      else cam.clearViewOffset();
      cam.updateProjectionMatrix();
      view.current = { w: size.width, h: size.height, inset };
    }
  });
  return null;
}
