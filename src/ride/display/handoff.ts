/**
 * Scroll hand-off from the cabin's newspaper to the ride, as pure decisions (no DOM, no React).
 *
 * The paper is its own scroller: wheel, touch and scroll keys read the page first. Once the page
 * has run out in the direction of travel, input goes on to the train instead (down = on to the
 * next stop, up = back to the previous one), with two kinds of edge resistance so a reader is
 * never launched by accident:
 *
 * - Arming: the first `threshold` px pushed against the edge (about one wheel notch, ~60px of
 *   finger travel, one key press) only arm the hand-off; the paper's footer cue pulses to say
 *   "keep going". Only input after that rides on.
 * - Latching: a gesture that was still scrolling the paper when it reached the edge (a flick
 *   and its momentum, a long drag) never rides on, however far it carries; it may arm. The next
 *   gesture does. Browsers latch nested scrolling to one scroller per gesture the same way.
 *
 * usePaperHandoff.ts feeds it real events; useScrollDriver.ts moves the train.
 */

/** Arming thresholds (px of input pushed against the edge). Keys arm with one press. */
export const ARM = {
  /** About one notch of a mouse wheel (Chrome reports 100px), or a short trackpad push. */
  wheel: 64,
  /** Finger travel on a touch screen. */
  touch: 60,
  /** Any single key press. */
  key: 1,
} as const;

export interface HandoffState {
  /** Direction currently pushed against (+1 down, -1 up, 0 none). */
  dir: -1 | 0 | 1;
  /** Input (px) pushed against the edge so far in `dir`, until armed. */
  accum: number;
  /** Armed in `dir`: further input (from a later gesture) rides on. */
  armed: boolean;
  /** The latest gesture that was still scrolling the paper itself: it never rides on. */
  latched: number;
}

export interface HandoffInput {
  /** Scroll input in px, + = down the page (toward the next stop). */
  delta: number;
  /** Id of the gesture this input belongs to (a wheel burst, a touch, a key press). */
  gesture: number;
  /** The paper's scroll position BEFORE this input applies. */
  atTop: boolean;
  atBottom: boolean;
  /** There is a stop before / after this one to ride to. */
  canPrev: boolean;
  canNext: boolean;
  /** px against the edge that arm the hand-off (ARM.*). */
  threshold: number;
}

export interface HandoffResult {
  state: HandoffState;
  /** px to hand to the ride (0 = the paper keeps the input, or it was spent arming). */
  pass: number;
  /** This input armed the hand-off: pulse the cue. */
  armedNow: boolean;
}

export const initialHandoff = (): HandoffState => ({ dir: 0, accum: 0, armed: false, latched: -1 });

/** Which edges a scroller is at (a pixel of slack: zoom and DPR give fractional offsets). */
export function edgesOf(el: { scrollTop: number; scrollHeight: number; clientHeight: number }): {
  atTop: boolean;
  atBottom: boolean;
} {
  return {
    atTop: el.scrollTop <= 1,
    atBottom: el.scrollTop + el.clientHeight >= el.scrollHeight - 1,
  };
}

/** One input event through the hand-off: who gets it, and whether it armed the hand-off. */
export function stepHandoff(state: HandoffState, input: HandoffInput): HandoffResult {
  const dir = Math.sign(input.delta) as -1 | 0 | 1;
  if (dir === 0) return { state, pass: 0, armedNow: false };

  const atEdge = dir > 0 ? input.atBottom : input.atTop;
  if (!atEdge) {
    // The page can still scroll this way: it reads on, and this gesture is latched to the page.
    return { state: { dir: 0, accum: 0, armed: false, latched: input.gesture }, pass: 0, armedNow: false };
  }
  const canRide = dir > 0 ? input.canNext : input.canPrev;
  if (!canRide) return { state: { ...state, dir: 0, accum: 0, armed: false }, pass: 0, armedNow: false };

  // Turning back against the other edge starts arming afresh.
  const s = state.dir === dir ? state : { ...state, dir, accum: 0, armed: false };
  if (!s.armed) {
    const accum = s.accum + Math.abs(input.delta);
    const armed = accum >= input.threshold;
    return { state: { ...s, accum, armed }, pass: 0, armedNow: armed };
  }
  if (input.gesture === s.latched) return { state: s, pass: 0, armedNow: false };
  return { state: s, pass: input.delta, armedNow: false };
}
