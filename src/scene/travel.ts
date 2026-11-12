import { progressToStation } from "@/ride/mapping";

/**
 * Where the train is along the route and how fast it is going, shared by every scene
 * system that reacts to motion (carriage sway now; scenery speed in T8, rumble sound in T12).
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

/** Velocity (stations/s) that counts as "full speed" for travel.speed. */
export const TRAVEL_REF_SPEED = 1;
/** Smoothing rate (1/s) for velocity: higher = snappier, lower = more inertia. */
const SMOOTHING = 6;
/** Longest frame we trust (s); a backgrounded tab can report seconds-long deltas. */
const MAX_DT = 0.1;

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

/** Advance the shared travel state by one frame. Call once per frame. */
export function stepTravel(progress: number, count: number, dt: number): void {
  const next = trainPosition(progress, count);
  if (dt <= 0) {
    travel.position = next;
    return;
  }
  const step = Math.min(dt, MAX_DT);
  const raw = (next - travel.position) / step;
  // Frame-rate independent exponential smoothing toward the raw frame-to-frame velocity.
  let v = travel.velocity + (raw - travel.velocity) * (1 - Math.exp(-step * SMOOTHING));
  if (raw === 0 && Math.abs(v) < 1e-4) v = 0; // settle to a true stop, no endless tail
  travel.position = next;
  travel.velocity = v;
  travel.speed = Math.min(1, Math.abs(v) / TRAVEL_REF_SPEED);
}

/** Jump to a progress value with the train at rest (mount, tests). */
export function resetTravel(progress: number, count: number): void {
  travel.position = trainPosition(progress, count);
  travel.velocity = 0;
  travel.speed = 0;
}

/**
 * World distance (units) between two stations. Anything that scrolls past the train
 * (sleepers now, scenery in T8) moves by travel.position * UNITS_PER_STATION so it all
 * agrees on speed.
 */
export const UNITS_PER_STATION = 120;
