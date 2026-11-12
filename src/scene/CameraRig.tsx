"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { smoothstep } from "./noise";
import { ROUTE, trainPose } from "./route3d";
import { travel } from "./travel";
import { getWorld } from "./World";
import { heightAt } from "./worldgen";

/**
 * Camera framing knobs. Offsets are in the train's frame: `ahead` along the track,
 * `side` to the right of travel (+ = camera side; platforms are on the left), `up`.
 * Tuned against the reference frames: a raised three-quarter view from in front and to
 * the side, so the train's lit nose comes toward the camera with the valley behind it.
 */
export const CAMERA = {
  desktop: {
    fov: 34,
    travel: { ahead: 38, side: 20, up: 11, lookAhead: -4, lookUp: 8 },
    // At a station: more side-on and a touch higher, looking across the train to the platform.
    station: { ahead: 26, side: 30, up: 12, lookAhead: -2, lookUp: 7, lookSide: -6 },
  },
  phone: {
    fov: 50,
    // Looks more along the track, so the long train fits a portrait screen with sky above it.
    travel: { ahead: 36, side: 15, up: 15, lookAhead: -8, lookUp: 6 },
    station: { ahead: 30, side: 20, up: 15, lookAhead: -6, lookUp: 6, lookSide: -4 },
  },
  /** Aspect (w/h) below which the phone framing applies fully; above wideAspect, desktop. */
  narrowAspect: 0.7,
  wideAspect: 1.2,
  /** How far (units) the camera may trail the train along the track while it moves. */
  maxLag: 9,
  /** Follow rate (1/s): higher = tighter. Reduced motion follows almost rigidly. */
  rate: 3.2,
  reducedRate: 30,
  /** Screen px on the left covered by the desktop route-map panel (RouteMap.module.css). */
  leftInsetPx: 260,
  /** Idle drift amplitude (units) and period (s). */
  driftAmount: 0.6,
  driftPeriod: 16,
  /** Keep at least this much clearance above the terrain. */
  minClearance: 4,
} as const;

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const tan = new THREE.Vector3();
const pos = new THREE.Vector3();
const goalPos = new THREE.Vector3();
const goalLook = new THREE.Vector3();

/**
 * Raised 3/4 follow camera. It tracks a point that trails the train by at most maxLag
 * along the curve, eased with a frame-rate independent exponential follow (so on departure
 * the train sweeps a little toward the camera, and settles back as it slows). Near a station it blends into a wider
 * framing that shows the train and the clear platform ground on its far side.
 */
export function CameraRig({ reducedMotion }: { reducedMotion: boolean }) {
  const s = useRef<number | null>(null);
  const view = useRef({ w: 0, h: 0, inset: -1 });

  useFrame(({ camera, size, clock }, dt) => {
    const cam = camera as THREE.PerspectiveCamera;
    const step = Math.min(dt, 0.1);
    const trainS = trainPose.u * ROUTE.length;
    // Arc length the camera frames: trails the train, never by more than maxLag.
    if (s.current === null) s.current = trainS;
    const k = 1 - Math.exp(-step * (reducedMotion ? CAMERA.reducedRate : CAMERA.rate));
    let cs = (s.current as number) + (trainS - (s.current as number)) * k;
    cs = Math.max(trainS - CAMERA.maxLag, Math.min(trainS + CAMERA.maxLag, cs));
    s.current = cs;

    const u = Math.max(0, Math.min(1, cs / ROUTE.length));
    ROUTE.curve.getPointAt(u, pos);
    ROUTE.curve.getTangentAt(u, tan);
    tan.y = 0;
    tan.normalize();
    // Right of travel = tangent x up.
    const rx = -tan.z;
    const rz = tan.x;

    // Blend phone <-> desktop framing by aspect, and travel <-> station by distance to a stop.
    const aspect = size.width / Math.max(1, size.height);
    const wide = smoothstep(CAMERA.narrowAspect, CAMERA.wideAspect, aspect);
    const atStop = 1 - smoothstep(0, 0.3, Math.abs(travel.position - Math.round(travel.position)));
    const P = CAMERA.phone;
    const D = CAMERA.desktop;
    const pick = (key: "ahead" | "side" | "up" | "lookAhead" | "lookUp") =>
      mix(mix(P.travel[key], P.station[key], atStop), mix(D.travel[key], D.station[key], atStop), wide);
    const lookSide = mix(P.station.lookSide, D.station.lookSide, wide) * atStop;

    // Barely-there idle drift (none for reduced motion).
    const t = (clock.elapsedTime / CAMERA.driftPeriod) * Math.PI * 2;
    const drift = reducedMotion ? 0 : CAMERA.driftAmount;
    const ahead = pick("ahead") + Math.sin(t) * drift;
    const side = pick("side");
    const up = pick("up") + Math.sin(t * 0.7 + 1) * drift * 0.5;

    goalPos.set(pos.x + tan.x * ahead + rx * side, pos.y + up, pos.z + tan.z * ahead + rz * side);
    // Never inside a hill (tunnels, valley sides): ride up over the terrain.
    // The look target rises by the same amount, so the view keeps its pitch and looks out
    // over the hill (e.g. while the train is inside a tunnel) instead of into the slope.
    const lift = Math.max(0, heightAt(getWorld(), goalPos.x, goalPos.z) + CAMERA.minClearance - goalPos.y);
    goalPos.y += lift;
    const la = pick("lookAhead");
    goalLook.set(
      trainPose.pos.x + tan.x * la + rx * lookSide,
      trainPose.pos.y + pick("lookUp") + lift,
      trainPose.pos.z + tan.z * la + rz * lookSide,
    );

    // The lag lives in `cs` (the framed arc length), so the pose itself is applied directly:
    // the camera never drifts off the curve's frame on bends, and the look target stays on
    // the real train, so a pulling-away train slides toward the camera, then re-centres.
    camera.position.copy(goalPos);
    camera.lookAt(goalLook);

    // FOV per framing, and shift the projection right on desktop so the train sits in the
    // space beside the route-map panel instead of under it.
    const fov = mix(P.fov, D.fov, wide);
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
