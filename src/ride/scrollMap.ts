import { STOP_HOLD } from "./mapping";

/**
 * How the page's scroll maps onto the station timeline (`progress`, see mapping.ts), as pure
 * math. In progress every leg between two stations is the same length; on the page, a leg's
 * travel takes scroll in proportion to how much there is to see on it: open track costs the
 * same scroll per unit of distance everywhere, while a tunnel's bore costs several times more
 * (scene/tunnelScroll.ts), so the skills reel on its walls stays readable however fast the
 * visitor scrolls. Every station's dwell (the train held at the platform) takes the same scroll.
 *
 * Kept free of three.js on purpose: the scroll driver is in the page's main bundle, the 3D scene
 * is a lazy chunk. LEG_SCROLL is therefore a table, checked against the scene's geometry by
 * scene/tunnelScroll.test.ts.
 */

/**
 * Scroll length of each leg's travel relative to a leg of plain open track (STATIONS order:
 * leg i runs from station i to i + 1). The two legs with a tunnel are longer.
 */
export const LEG_SCROLL: readonly number[] = [1.725, 1, 1, 1, 1.822, 1, 1];

/**
 * Viewport heights of scroll per leg of plain open track (dwell included). About twice the
 * original one viewport per station: the train answers the scroll like a throttle, not a flick.
 */
export const SCROLL_VH_PER_LEG = 180;

/** Total scroll of the ride in "plain legs": dwell and travel of every leg. */
const UNITS = LEG_SCROLL.reduce((sum, w) => sum + STOP_HOLD + (1 - STOP_HOLD) * w, 0);

/** Height of the ride's spacer (vh): the scroll distance plus the one viewport it is seen through. */
export const SPACER_VH = Math.round(UNITS * SCROLL_VH_PER_LEG) + 100;

/**
 * Breakpoints of the piecewise-linear map: at every station anchor and every dwell edge, its
 * progress (P) and scroll fraction (F). Between breakpoints both run linearly, so inside each
 * dwell and each leg's travel, scroll and progress move in lockstep.
 */
const P: number[] = [0];
const F: number[] = [0];
{
  const legs = LEG_SCROLL.length;
  const half = STOP_HOLD / 2;
  let u = 0;
  for (let i = 0; i < legs; i++) {
    const travel = (1 - STOP_HOLD) * LEG_SCROLL[i];
    P.push((i + half) / legs, (i + 1 - half) / legs, (i + 1) / legs);
    F.push((u += half), (u += travel), (u += half));
  }
  for (let k = 0; k < F.length; k++) F[k] /= u;
}

/** Piecewise-linear lookup of `x` in breakpoints `from`, mapped onto `to` (clamped to 0..1). */
function lookup(x: number, from: number[], to: number[]): number {
  if (!(x > 0)) return 0;
  if (x >= 1) return 1;
  let k = 1;
  while (from[k] < x) k++;
  const span = from[k] - from[k - 1];
  return to[k - 1] + ((to[k] - to[k - 1]) * (x - from[k - 1])) / span;
}

/** Station-timeline progress (0..1) for a scroll fraction (scroll / max scroll). */
export function scrollToProgress(f: number): number {
  return lookup(f, F, P);
}

/** Scroll fraction (0..1) that puts the ride at a station-timeline progress. */
export function progressToScroll(p: number): number {
  return lookup(p, P, F);
}
