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
  /** Train position along the route, in stations (smoothed; exact integer while stopped). */
  position: 0,
  /** Signed velocity, stations per second (+ = forward). Exactly 0 when parked. */
  velocity: 0,
  /** |velocity| normalised to 0..1 against TRAVEL_REF_SPEED: handy as an effect amount. */
  speed: 0,
};

/**
 * The scroll is the throttle: the visitor's scroll position says where the train should be,
 * and the train follows it closely, like a critically damped spring (no bounce) whose lag
 * behind a steadily moving scroll is SMOOTH_TIME. When the scroll stops, the train coasts to
 * a halt in about half a second; scrolling back runs it backwards. There is no driving of its
 * own beyond the scroll position.
 */
export const SMOOTH_TIME = 0.25;
/** The spring's angular frequency (1/s), as in the usual "smooth damp" formulation. */
const OMEGA = 2 / SMOOTH_TIME;
/**
 * Top speed, stations/s (~300 world units/s at ~253 units per station). Only a guard: a huge
 * flick or a route-map jump across the line rides there instead of teleporting.
 */
export const MAX_SPEED = 1.2;
/** Velocity (stations/s) that counts as "full speed" for travel.speed. */
export const TRAVEL_REF_SPEED = MAX_SPEED;
/** Longest frame we trust (s); a backgrounded tab can report seconds-long deltas. */
const MAX_DT = 0.1;
/** Integration sub-step (s), so 30 fps and 144 fps produce the same motion. */
const SUB_DT = 1 / 240;
/**
 * Close enough to call it stopped: within this many stations of the target (~0.25 units) and
 * slower than this (stations/s), the train lands exactly on the target with zero velocity.
 * Stations rely on it: the cabin view and the arrival chime wait for an exact stop.
 */
const SETTLE_POS = 1e-3;
const SETTLE_VEL = 1e-2;

/**
 * Within a leg, maps the eased travel fraction (0..1) to the fraction of the leg's distance
 * covered (0..1), monotonic, 0 -> 0 and 1 -> 1. The scene passes one that gives tunnels more of
 * the leg's scroll (tunnelScroll.ts); without one the two are equal.
 */
export type LegWarp = (leg: number, f: number) => number;

/**
 * Train position for a progress value. Inside a station's dwell zone it is exactly the station
 * index; between stations the linear travel fraction is smoothstepped so the train pulls away
 * and pulls in gently instead of starting/stopping at full speed, then `warp` spreads it over
 * the leg's distance.
 */
export function trainPosition(progress: number, count: number, warp?: LegWarp): number {
  const { index, atStop, t } = progressToStation(progress, count);
  if (atStop) return index;
  const e = t * t * (3 - 2 * t);
  return index + (warp ? warp(index, e) : e);
}

/**
 * Advance the shared travel state by one frame. Call once per frame.
 *
 * The progress gives a *target* position; the train follows it with a critically damped
 * spring (SMOOTH_TIME), its velocity capped at MAX_SPEED. It never overshoots the target, so
 * it never runs past a stop, past the Terminus or back before Departure. Settles exactly on
 * the target (an integer at stations) with zero velocity.
 */
export function stepTravel(progress: number, count: number, dt: number, warp?: LegWarp): void {
  const target = trainPosition(progress, count, warp);
  let left = Math.min(Math.max(dt, 0), MAX_DT);
  let x = travel.position;
  let v = travel.velocity;
  while (left > 1e-9) {
    const h = Math.min(SUB_DT, left);
    left -= h;
    const before = target - x;
    v += (OMEGA * OMEGA * before - 2 * OMEGA * v) * h;
    v = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, v));
    x += v * h;
    // Crossed the target (it reversed under a moving train): stop on it rather than swing past.
    if ((target - x) * before < 0) {
      x = target;
      v = 0;
    }
  }
  // Settle to a true stop: no endless tail.
  if (Math.abs(target - x) < SETTLE_POS && Math.abs(v) < SETTLE_VEL) {
    x = target;
    v = 0;
  }
  travel.position = x;
  travel.velocity = v;
  travel.speed = Math.min(1, Math.abs(v) / TRAVEL_REF_SPEED);
}

/** Jump to a progress value with the train at rest (mount, deep links, tests). */
export function resetTravel(progress: number, count: number, warp?: LegWarp): void {
  travel.position = trainPosition(progress, count, warp);
  travel.velocity = 0;
  travel.speed = 0;
}
