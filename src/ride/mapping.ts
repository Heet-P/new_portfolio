/**
 * Pure math that maps scroll progress (0..1) onto the station timeline.
 * No React, no DOM: the scroll driver, route map, 3D scene and station cards
 * all derive their state from these functions so they can never disagree.
 *
 * Timeline layout for N stations (N = 5 here). The route is split into N-1
 * equal segments; each station sits on a segment boundary ("anchor"). Around
 * every anchor the train dwells for STOP_HOLD of one segment's length, split
 * evenly on both sides. The first and last stations are anchored at the very
 * ends (p = 0 and p = 1), so only half of their dwell zone exists:
 *
 *   p: 0                                                     1
 *      |==|-----travel-----|==|-----travel-----|==| ... |==|
 *      S0                   S1                   S2        S4
 *      (half dwell)         (full dwell, centred on anchor)  (half dwell)
 *
 *   "==" = dwell: atStop = true, t = 0, index = that station
 *   "--" = travel from station i to i+1: atStop = false, t runs 0 -> 1
 *          (0 = just left i, 1 = about to arrive at i+1), index = i
 */

/** Fraction of each segment's length the train spends stopped at a station. */
export const STOP_HOLD = 0.5;

export interface StationPosition {
  /** Station stopped at, or the station just departed from while travelling. */
  index: number;
  /** True while inside a station's dwell zone. */
  atStop: boolean;
  /** 0..1 progress of the travel from `index` to `index + 1`; always 0 at a stop. */
  t: number;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Progress value at the centre of a station's dwell (its anchor). */
export function stationToProgress(index: number, count: number): number {
  if (count <= 1) return 0;
  return clamp01(index / (count - 1));
}

/** Where on the timeline a progress value falls: stopped, or travelling. */
export function progressToStation(p: number, count: number): StationPosition {
  if (count <= 1) return { index: 0, atStop: true, t: 0 };

  // Position in "segment units": the integer part is the segment, the
  // fraction is how far past that segment's starting anchor we are.
  const u = clamp01(p) * (count - 1);
  const seg = Math.min(Math.floor(u), count - 1);
  const f = u - seg;
  const halfDwell = STOP_HOLD / 2;

  if (f < halfDwell) return { index: seg, atStop: true, t: 0 };
  if (f > 1 - halfDwell) return { index: seg + 1, atStop: true, t: 0 };
  return { index: seg, atStop: false, t: (f - halfDwell) / (1 - STOP_HOLD) };
}

/**
 * The station the visitor is "at" for UI purposes (route map highlight, URL hash):
 * the stopped station while in a dwell, otherwise whichever station is closer.
 * Dwell zones are centred on anchors, so rounding gives both answers at once.
 */
export function nearestStation(p: number, count: number): number {
  if (count <= 1) return 0;
  return Math.round(clamp01(p) * (count - 1));
}

/**
 * Station index for a URL hash like "#vaani". Matching is exact (case
 * sensitive) on purpose; anything unknown or empty lands on the first station.
 */
export function parseHash(hash: string, ids: readonly string[]): number {
  const i = ids.indexOf(hash.replace(/^#/, ""));
  return i === -1 ? 0 : i;
}
