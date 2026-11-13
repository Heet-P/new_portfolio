/**
 * Timing of the "into the cabin" moment at every stop, as pure math (no three.js, no DOM),
 * so the camera path, the swap overlay and the on-board display all read one number and can
 * never disagree.
 *
 * Everything keys off the TRAIN, not the scroll: the input is travel.position (stations,
 * smoothed and speed-capped in scene/travel.ts, so it trails the scroll a little). The
 * cabin therefore only opens once the train has really pulled in, and closes as it pulls away.
 */

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

/**
 * Distance from a station (in stations) at which the blend starts: the train is easing into
 * the platform by then (the scroll eases it in, travel.ts smooths it). Slowing to a stop, the
 * distance left shrinks faster than the time left, so a ramp on sqrt(distance) is roughly a
 * ramp in time: the blend rises evenly through the last stretch and reaches exactly 1 as the
 * train comes to rest (travel.ts settles on the integer).
 */
export const STOP_BLEND = { far: 0.12 } as const;

/**
 * How far the camera should be into the cabin for a train position (stations): 0 while
 * travelling, 1 at the centre of a stop (the train parked on the platform), smoothstep-eased
 * in between. Continuous everywhere, rising toward each station and falling after it.
 * cabinStore follows it with a critically damped spring, which sets the glide's pace in time.
 */
export function stopBlend(position: number): number {
  const d = Math.abs(position - Math.round(position));
  if (d >= STOP_BLEND.far) return 0;
  const x = 1 - Math.sqrt(d / STOP_BLEND.far);
  return x * x * (3 - 2 * x);
}

/**
 * 1 while the train is slow enough to be stopping, 0 when it runs through a station at speed
 * (a route-map jump across several stops passes the ones in between at full speed, and their
 * cabins must not flash open). `speed` is travel.speed (0..1 of top speed). On a real final
 * approach the speed at the blend's `far` edge is at most ~0.55 (a route-map ride or a fast
 * scroll; slower scrolling less), so the gate is all but open there.
 */
export function passGate(speed: number): number {
  return 1 - smoothstep(0.5, 0.8, speed);
}

/**
 * Phases of the blend (0..1):
 *  0 .. swoopEnd        chase camera swoops down and along to the train's side window
 *  swoopEnd .. swapIn   a full-screen overlay fades in (cabin colour + slight blur)
 *  swapIn .. swapOut    overlay fully opaque; at `cut` the camera jumps into the cabin
 *  swapOut .. fadeEnd   overlay fades out, revealing the cabin
 *  cut .. lean          inside, the camera turns and leans toward the newspaper folded on a seat
 *  liftFrom .. liftTo   the newspaper lifts off the seat to in front of the camera, which settles
 *                       at liftTo too (so nothing moves while the HTML fades in)
 *  unfoldFrom .. unfoldTo  meanwhile it unfolds (a hinge at the fold) into the full front page
 *  displayFrom .. displayTo  the front page's HTML fades in over the flat 3D paper
 * The opaque plateau around `cut` makes the jump invisible even if a frame lands either side.
 */
export const STOP_PHASE = {
  swoopEnd: 0.45,
  swapIn: 0.5,
  cut: 0.525,
  swapOut: 0.55,
  fadeEnd: 0.6,
  lean: 0.72,
  liftFrom: 0.74,
  unfoldFrom: 0.78,
  liftTo: 0.9,
  unfoldTo: 0.9,
  displayFrom: 0.9,
  displayTo: 0.98,
} as const;

/** How far the newspaper has travelled from the seat to in front of the camera (0..1, eased). */
export function paperLift(b: number): number {
  return smoothstep(STOP_PHASE.liftFrom, STOP_PHASE.liftTo, b);
}

/** How far the newspaper has unfolded (0 = folded in half, 1 = flat), eased. */
export function paperUnfold(b: number): number {
  return smoothstep(STOP_PHASE.unfoldFrom, STOP_PHASE.unfoldTo, b);
}

/** True once the camera belongs inside the cabin (the world outside can stop drawing). */
export function insideCabin(b: number): boolean {
  return b >= STOP_PHASE.cut;
}

/** Opacity of the swap overlay for a blend value. */
export function swapOpacity(b: number): number {
  if (b < STOP_PHASE.swapIn) return smoothstep(STOP_PHASE.swoopEnd, STOP_PHASE.swapIn, b);
  return 1 - smoothstep(STOP_PHASE.swapOut, STOP_PHASE.fadeEnd, b);
}

/** Opacity of the front page's HTML for a blend value: only once the 3D paper lies flat. */
export function displayOpacity(b: number): number {
  return smoothstep(STOP_PHASE.displayFrom, STOP_PHASE.displayTo, b);
}

/**
 * Critically damped spring toward `target` (the classic SmoothDamp integration): no
 * overshoot, no oscillation, frame-rate independent. `smoothTime` (s) ~ time to get most of
 * the way. Mutates and returns `s`; allocation-free.
 */
export function smoothDamp(s: { value: number; velocity: number }, target: number, smoothTime: number, dt: number) {
  if (dt <= 0) return s;
  const omega = 2 / Math.max(1e-4, smoothTime);
  const x = omega * dt;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = s.value - target;
  const temp = (s.velocity + omega * change) * dt;
  let next = target + (change + temp) * decay;
  let velocity = (s.velocity - omega * temp) * decay;
  // Never pass the target (the approximation can, by a hair, on long frames).
  if (target - s.value > 0 === next > target) {
    next = target;
    velocity = 0;
  }
  s.value = next;
  s.velocity = velocity;
  return s;
}
