import * as THREE from "three";
import { STATIONS } from "@/content/route";

/**
 * The one track through the world: a gently winding CatmullRom curve that runs mostly
 * along +X (the train model's forward axis) with S-bends in Z and a few metres of
 * elevation change. Everything else (stations, terrain corridor, bridges, tunnels,
 * the camera) is placed by arc length `s` along this curve.
 *
 * Hand-placed control points rather than random: the route is art-directed. Points at
 * x = 170..470 are collinear on purpose so the curve is dead straight where the steel
 * bridge sits (a CatmullRom segment is straight when its 4 neighbouring points are).
 */
const CONTROL: [number, number, number][] = [
  [-90, 2, 0],
  [-40, 2, 0],
  [20, 1.5, -6],
  [90, 0.5, -2],
  [170, 1, 22],
  [240, 1, 22],
  [320, 1, 22],
  [400, 1, 22],
  [470, 1, 22],
  [550, 2, 8],
  [620, 2.5, -5],
  [690, 3, -15],
  [770, 4, -30],
  [850, 3, -35],
  [930, 2, -20],
  [1010, 1, 5],
  [1090, 0.5, 25],
  [1170, 1, 30],
  [1250, 3, 15],
  [1330, 4, -10],
  [1410, 4, -25],
  [1490, 3, -20],
  [1570, 2, 0],
  [1650, 2, 15],
  [1730, 2, 15],
  [1800, 2, 10],
];

/** Arc length (units) before Departure: room for the train's tail and the first tunnel. */
const START_S = 75;
/** Arc length (units) kept after the Terminus so the parked train never runs off the end. */
const END_S = 70;

const curve = new THREE.CatmullRomCurve3(
  CONTROL.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
  false,
  "centripetal",
);
// getPointAt/getTangentAt use an arc-length table; dense = accurate spacing between cars.
curve.arcLengthDivisions = 4000;
const length = curve.getLength();
/** Equal distance between consecutive stations, so every leg of the ride feels the same. */
const spacing = (length - START_S - END_S) / (STATIONS.length - 1);

export const ROUTE: {
  curve: THREE.CatmullRomCurve3;
  /** Curve parameter (0..1, arc-length based) of each station's platform, in STATIONS order. */
  stationU: number[];
  /** Total arc length of the curve (units). */
  length: number;
  /** Arc length between consecutive stations (units). */
  spacing: number;
} = {
  curve,
  stationU: STATIONS.map((_, i) => (START_S + i * spacing) / length),
  length,
  spacing,
};

/**
 * Curve parameter u (arc-length based) of the train's centre for a travel position in
 * stations (travel.position). Piecewise linear between stationU, clamped to the first
 * and last station, so integer positions land exactly on the platforms.
 */
export function trainU(position: number): number {
  const su = ROUTE.stationU;
  if (!(position > 0)) return su[0];
  if (position >= su.length - 1) return su[su.length - 1];
  const i = Math.floor(position);
  const f = position - i;
  return su[i] + (su[i + 1] - su[i]) * f;
}

/**
 * The curve sampled every TRACK.step units of arc length, as flat typed arrays: fast,
 * allocation-free lookups for world generation and static geometry (rails, sleepers,
 * ballast). tx/tz is the unit tangent projected on the ground plane.
 */
export const TRACK = (() => {
  const step = 1;
  const count = Math.floor(length / step) + 1;
  const px = new Float32Array(count);
  const py = new Float32Array(count);
  const pz = new Float32Array(count);
  const tx = new Float32Array(count);
  const tz = new Float32Array(count);
  const p = new THREE.Vector3();
  const t = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const u = Math.min(1, (i * step) / length);
    curve.getPointAt(u, p);
    curve.getTangentAt(u, t);
    const h = Math.hypot(t.x, t.z) || 1;
    px[i] = p.x;
    py[i] = p.y;
    pz[i] = p.z;
    tx[i] = t.x / h;
    tz[i] = t.z / h;
  }
  return { step, count, px, py, pz, tx, tz };
})();

/** Output of nearestOnTrack (caller-owned, reused to avoid allocations). */
export interface TrackHit {
  /** Arc length of the closest track point. */
  s: number;
  /** Signed lateral distance: + = right of travel (camera side), - = left (platform side). */
  d: number;
  /** Track height at that point. */
  y: number;
}

/** Index of the last sample with px <= x (the curve is monotonic in x). */
function indexAtX(x: number): number {
  const { px, count } = TRACK;
  let lo = 0;
  let hi = count - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (px[mid] <= x) lo = mid;
    else hi = mid;
  }
  return lo;
}

/**
 * Closest track point to (x, z) on the ground plane. Starts from the sample at the same x
 * (valid because the route only moves forward in x) and refines by projecting the offset
 * on the local tangent a few times, which converges quickly for these gentle bends.
 */
export function nearestOnTrack(x: number, z: number, out: TrackHit): TrackHit {
  const { px, py, pz, tx, tz, count, step } = TRACK;
  let i = indexAtX(x);
  for (let k = 0; k < 4; k++) {
    const along = (x - px[i]) * tx[i] + (z - pz[i]) * tz[i];
    const next = Math.min(count - 1, Math.max(0, i + Math.round(along / step)));
    if (next === i) break;
    i = next;
  }
  // Sub-sample precision: slide along the tangent by the remaining along-track offset.
  const along = (x - px[i]) * tx[i] + (z - pz[i]) * tz[i];
  const clamped = Math.max(-step, Math.min(step, along));
  out.s = Math.max(0, Math.min(length, i * step + clamped));
  // Right-of-travel normal = tangent x up = (-tz, 0, tx).
  out.d = (x - px[i]) * -tz[i] + (z - pz[i]) * tx[i];
  out.y = py[i];
  return out;
}

/**
 * Where the train's centre is this frame (curve u, position, unit tangent). Written once
 * per frame by updateTrainPose (Scene's TravelTracker) and read by the train, camera and
 * sun shadow. Mutable on purpose: no allocations per frame.
 */
export const trainPose = { u: 0, pos: new THREE.Vector3(), tan: new THREE.Vector3(1, 0, 0) };

/** Move trainPose to a travel position (in stations). */
export function updateTrainPose(position: number): void {
  trainPose.u = trainU(position);
  curve.getPointAt(trainPose.u, trainPose.pos);
  curve.getTangentAt(trainPose.u, trainPose.tan);
}
