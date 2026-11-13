import * as THREE from "three";
import { STOP_PHASE } from "@/ride/stopCamera";
import { ROUTE, tangentAt, trainPose } from "../route3d";
import { TRAIN_SHAPE } from "../TrainLights";
import { CABIN, POSES, type CabinPose } from "./layout";

/**
 * The outside half of the path: the side window of the rear car (nearest the chase camera),
 * in the train's frame (along = metres ahead of the train's tail, side = right of travel,
 * up = above the rails). The camera first swoops to `far` (a few metres off the glass,
 * framing the lit window), then dives to `near` (right at the glass) while the swap overlay
 * covers the view.
 */
export const WINDOW = {
  along: 4.2,
  far: { side: 5, up: 2.6 },
  near: { side: 3.1, up: 2.5 },
  /** Look target: the window itself, a touch ahead so the car's length reads in perspective. */
  look: { ahead: 0.6, up: 2.35 },
} as const;

/** How much sooner the swoop loses height than it closes in (1 = together). */
const DESCENT_LEAD = 1.6;

const UP = new THREE.Vector3(0, 1, 0);
const m4 = new THREE.Matrix4();
const P = new THREE.Vector3();
const T = new THREE.Vector3();
const R = new THREE.Vector3();
const eye = new THREE.Vector3();
const eye2 = new THREE.Vector3();
const target = new THREE.Vector3();
const q1 = new THREE.Quaternion();
const q2 = new THREE.Quaternion();
const chasePos = new THREE.Vector3();
const chaseQ = new THREE.Quaternion();

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
/** Quintic smootherstep: zero velocity and acceleration at both ends. */
const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const easeIn = (t: number) => t * t;
const easeOut = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);

/** Orientation that looks from `from` to `to` (camera convention: -Z forward). */
function lookQuat(from: THREE.Vector3, to: THREE.Vector3, out: THREE.Quaternion) {
  return out.setFromRotationMatrix(m4.lookAt(from, to, UP));
}

/** Cabin metres -> world. The cabin is only translated and uniformly scaled. */
export function cabinToWorld(local: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
  return out.copy(local).multiplyScalar(CABIN.scale).add(CABIN.origin);
}

/** A cabin pose in world space. */
function cabinPose(pose: CabinPose, pos: THREE.Vector3, q: THREE.Quaternion) {
  cabinToWorld(pose.pos, pos);
  cabinToWorld(pose.look, target);
  lookQuat(pos, target, q);
}

/** World pose of the camera off the rear car's side window, `k` = WINDOW.far or .near. */
function windowPose(k: { side: number; up: number }, pos: THREE.Vector3, q: THREE.Quaternion) {
  const s = trainPose.u * ROUTE.length + TRAIN_SHAPE.tail + WINDOW.along;
  const u = Math.max(0, Math.min(1, s / ROUTE.length));
  ROUTE.curve.getPointAt(u, P);
  tangentAt(u, T);
  T.y = 0;
  T.normalize();
  R.set(-T.z, 0, T.x); // right of travel = tangent x up
  pos.copy(P).addScaledVector(R, k.side).addScaledVector(UP, k.up);
  target.copy(P).addScaledVector(T, WINDOW.look.ahead).addScaledVector(UP, WINDOW.look.up);
  lookQuat(pos, target, q);
}

/** Settled camera pose (world), e.g. for fitting the newspaper to the HTML page. */
export function settledPose(pos: THREE.Vector3, q: THREE.Quaternion) {
  cabinPose(POSES.settled, pos, q);
}

/**
 * Bend the chase camera (already placed by CameraRig this frame) along the stop path for a
 * cabin blend `b` (cabinFrame.blend, see ride/stopCamera.ts):
 *   0 .. swoopEnd     chase -> off the rear car's window (smootherstep: leaves and arrives gently)
 *   swoopEnd .. cut   dives at the glass (ease-in), hidden by the swap overlay
 *   cut .. lean       inside the cabin: from just inside the window, turns and leans toward the
 *                     newspaper on the seat (ease-out, so the dive carries on and then settles)
 *   lean .. liftTo    straightens up to the reading pose while the paper rises and unfolds
 *                     (smootherstep: leaves and arrives gently); still from there on
 * Every segment is a continuous function of `b`, which is itself a smooth function of the
 * train's eased position plus a critically damped spring, so the camera cannot jitter.
 * Reduced motion: no swoop and no glide; the camera stays on the chase view until the swap
 * overlay is opaque, then is simply inside, settled. Allocation-free.
 */
export function applyStopCamera(camera: THREE.Camera, b: number, reducedMotion: boolean): void {
  if (b <= 0) return;
  const { swoopEnd, cut } = STOP_PHASE;

  if (reducedMotion) {
    if (b >= cut) cabinPose(POSES.settled, camera.position, camera.quaternion);
    return;
  }

  if (b < cut) {
    chasePos.copy(camera.position);
    chaseQ.copy(camera.quaternion);
    windowPose(WINDOW.far, eye, q1);
    if (b <= swoopEnd) {
      const raw = clamp01(b / swoopEnd);
      const t = smoother(raw);
      camera.position.lerpVectors(chasePos, eye, t);
      // Drop height ahead of the sideways move, so the camera is below the overhead line by
      // the time it nears the train (instead of looking down through the wires at the roof).
      camera.position.y = chasePos.y + (eye.y - chasePos.y) * smoother(Math.min(1, raw * DESCENT_LEAD));
      camera.quaternion.slerpQuaternions(chaseQ, q1, t);
    } else {
      windowPose(WINDOW.near, eye2, q2);
      const t = easeIn(clamp01((b - swoopEnd) / (cut - swoopEnd)));
      camera.position.lerpVectors(eye, eye2, t);
      camera.quaternion.slerpQuaternions(q1, q2, t);
    }
    return;
  }

  // Inside: turn from the window toward the newspaper on the seat (the dive carries on, then
  // eases off), then straighten up to reading height while the paper is lifted and unfolded.
  // It arrives together with the paper (liftTo), so nothing moves while the HTML fades in.
  const { lean, liftTo } = STOP_PHASE;
  const inLean = b < lean;
  cabinPose(inLean ? POSES.entry : POSES.lean, eye, q1);
  cabinPose(inLean ? POSES.lean : POSES.settled, eye2, q2);
  const t = inLean ? easeOut(clamp01((b - cut) / (lean - cut))) : smoother(clamp01((b - lean) / (liftTo - lean)));
  camera.position.lerpVectors(eye, eye2, t);
  camera.quaternion.slerpQuaternions(q1, q2, t);
}
