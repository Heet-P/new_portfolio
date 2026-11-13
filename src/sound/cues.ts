import { STOP_BLEND } from "@/ride/stopCamera";

/**
 * Edge detectors that turn per-frame scene values into one-off sound cues. Each frame the
 * scene asks "did it just happen?"; the answer is true on exactly one frame per event.
 * Closures over a couple of numbers: no allocation per call.
 */

/**
 * Station chime: true on the frame the train comes to rest at a station after having left
 * the previous one. `position` is travel.position (stations; settles on an exact integer),
 * `speed` is travel.speed (0..1; exactly 0 when parked).
 *
 * - Opening the ride already parked (a deep link) is not an arrival.
 * - Running through a station at speed is not an arrival (it never rests there).
 * - It re-arms only once the train is clearly away from the platform (further than the
 *   cabin glide's reach, STOP_BLEND.far), so a nudge of the scroll within a stop never re-chimes.
 */
export function createArrivalDetector(): (position: number, speed: number) => boolean {
  let armed = false;
  return (position, speed) => {
    const off = Math.abs(position - Math.round(position));
    if (off > STOP_BLEND.far) armed = true;
    if (armed && speed === 0 && off < 1e-6) {
      armed = false;
      return true;
    }
    return false;
  };
}

/**
 * True on the frame `value` rises through `threshold`; re-arms once it has dropped below
 * `rearm` (< threshold), so jitter around the threshold fires once. Starting above the
 * threshold does not count as a crossing.
 */
export function createRisingEdge(threshold: number, rearm: number): (value: number) => boolean {
  let armed = false;
  return (value) => {
    if (value < rearm) armed = true;
    if (armed && value >= threshold) {
      armed = false;
      return true;
    }
    return false;
  };
}
