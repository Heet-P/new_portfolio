/**
 * A narrow door into the ride's scroll engine for input that did not come through the window:
 * the cabin's newspaper handing its overflow on to the train (display/usePaperHandoff.ts).
 * useScrollDriver opens it while its Lenis instance is alive and closes it on teardown, so a
 * call outside ride mode simply does nothing.
 */

/** Moves the ride by `px` of page scroll; `smooth` = Lenis's wheel smoothing, else 1:1 (a finger). */
type RideScroller = (px: number, smooth: boolean) => void;

let scroller: RideScroller | null = null;

/** Called by useScrollDriver: its scroller while riding, null when it tears down. */
export function setRideScroller(fn: RideScroller | null): void {
  scroller = fn;
}

/** Scroll the ride on by `px` (+ = toward the next stop), as the window's own wheel would. */
export function rideScrollBy(px: number, smooth = true): void {
  scroller?.(px, smooth);
}
