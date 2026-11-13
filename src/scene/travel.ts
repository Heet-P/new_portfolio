import { progressToStation } from "@/ride/mapping";

/**
 * Where the train is along the route and how fast it is going, shared by every scene
 * system that reacts to motion (carriage sway, the train's place on the track via
 * route3d.trainU, rumble sound in T12).
 *
 * Units: "stations". position 2.5 = halfway between station 2 and station 3.
 * Updated once per frame by <TravelTracker/> (Scene.tsx) before anything else reads it,
 * so readers just do `travel.speed` inside their own useFrame. Plain mutable object on
 * purpose: zero allocations and zero React renders per frame.
 */
export const travel = {
  /** Train position along the route, in stations (eased; exact integer while stopped). */
  position: 0,
  /** Smoothed signed velocity, stations per second (+ = forward). Exactly 0 when parked. */
  velocity: 0,
  /** |velocity| normalised to 0..1 against TRAVEL_REF_SPEED: handy as an effect amount. */
  speed: 0,
};

/**
 * Top speed of the train, stations/s (~117 world units/s at ~212 units per station). However
 * fast the visitor scrolls or jumps, the train never visibly moves faster than this.
 */
export const MAX_SPEED = 0.55;
/** Acceleration / braking limit, stations/s^2: full speed is reached in ~1.2 s. */
export const MAX_ACCEL = 0.45;
/** Final approach rate (1/s): within the last stretch the speed eases off linearly. */
const APPROACH = 2;
/** Velocity (stations/s) that counts as "full speed" for travel.speed. */
export const TRAVEL_REF_SPEED = MAX_SPEED;
/** Longest frame we trust (s); a backgrounded tab can report seconds-long deltas. */
const MAX_DT = 0.1;
/** Integration sub-step (s), so 30 fps and 144 fps produce the same motion. */
const SUB_DT = 1 / 240;

/** Slow-zone lookahead: sample spacing and reach (stations), and how much of MAX_ACCEL the planned braking uses. */
const PACE_STEP = 0.03;
const PACE_REACH = 0.45;
const PACE_BRAKE = MAX_ACCEL * 0.8;

/**
 * The fastest the train may be going at `x` (stations) heading `dir` (+1/-1) so that it can still
 * brake, within PACE_BRAKE, down to `cap`'s limit at any point up to `room` stations ahead.
 * A hard-edged slow zone therefore becomes a smooth easing down before it. Each lookahead sample is
 * treated as one step nearer than it is, so the plan errs on the early side.
 */
function pacedLimit(x: number, dir: number, room: number, cap: (position: number) => number): number {
  let limit = cap(x);
  const reach = Math.min(PACE_REACH, room);
  for (let k = 1; k * PACE_STEP <= reach; k++) {
    const c = cap(x + dir * k * PACE_STEP);
    limit = Math.min(limit, Math.sqrt(c * c + 2 * PACE_BRAKE * (k - 1) * PACE_STEP));
  }
  return limit;
}

/**
 * Train position for a scroll progress value. Inside a station's dwell zone it is exactly
 * the station index; between stations the linear travel fraction is smoothstepped so the
 * train pulls away and pulls in gently instead of starting/stopping at full speed.
 */
export function trainPosition(progress: number, count: number): number {
  const { index, atStop, t } = progressToStation(progress, count);
  if (atStop) return index;
  return index + t * t * (3 - 2 * t);
}

/**
 * Advance the shared travel state by one frame. Call once per frame.
 *
 * The scroll gives a *target* position; the train chases it with a speed- and
 * acceleration-limited profile: it accelerates at MAX_ACCEL up to MAX_SPEED, brakes
 * along a sqrt(2*a*d) curve so it never overshoots, and eases into the stop linearly.
 * A fast flick therefore becomes a calm 1-2 s pull-away and a gentle arrival instead of
 * a jump. Settles exactly on the target (integer at stations) with zero velocity.
 *
 * `cap`, if given, is a position-dependent top speed (stations/s, always > 0), used to slow the
 * train through places worth lingering in (the tunnels' skills reel). It only ever lowers the
 * limits above, and the train brakes ahead of a slow stretch within MAX_ACCEL.
 */
export function stepTravel(progress: number, count: number, dt: number, cap?: (position: number) => number): void {
  const target = trainPosition(progress, count);
  let left = Math.min(Math.max(dt, 0), MAX_DT);
  let x = travel.position;
  let v = travel.velocity;
  while (left > 1e-9) {
    const h = Math.min(SUB_DT, left);
    left -= h;
    const d = target - x;
    // Fastest speed that can still brake in time, capped, and easing off near the end.
    const top = cap ? pacedLimit(x, Math.sign(d), Math.abs(d), cap) : MAX_SPEED;
    const want = Math.sign(d) * Math.min(MAX_SPEED, top, Math.sqrt(2 * MAX_ACCEL * Math.abs(d)), APPROACH * Math.abs(d));
    v += Math.max(-MAX_ACCEL * h, Math.min(MAX_ACCEL * h, want - v));
    x += v * h;
  }
  // Settle to a true stop: no endless tail.
  if (Math.abs(target - x) < 1e-4 && Math.abs(v) < 2e-3) {
    x = target;
    v = 0;
  }
  travel.position = x;
  travel.velocity = v;
  travel.speed = Math.min(1, Math.abs(v) / TRAVEL_REF_SPEED);
}

/** Jump to a progress value with the train at rest (mount, tests). */
export function resetTravel(progress: number, count: number): void {
  travel.position = trainPosition(progress, count);
  travel.velocity = 0;
  travel.speed = 0;
}

