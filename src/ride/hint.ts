import type { RideMode } from "./rideStore";

/*
 * The "Scroll to depart" hint at Departure, as plain data and decisions (no React): when it
 * shows, when the visitor has moved on, and the session memory. ScrollHint.tsx only draws it.
 */

/** sessionStorage key: set once the visitor has scrolled (or otherwise left Departure) this session. */
export const HINT_SEEN_KEY = "nt-hint-seen";

/** What the hint says: scrolling with a mouse or trackpad, swiping on a touch screen. */
export const HINT_TEXT = {
  fine: "Scroll to depart",
  coarse: "Swipe up to depart",
} as const;

/**
 * Progress (0..1) below which the train still sits at Departure. The scroll driver parks it at
 * exactly 0; anything past a hair of that means the visitor has started rolling.
 */
const AT_DEPARTURE = 0.002;

/**
 * True once the visitor has set off from Departure: the train has rolled off the platform, or a
 * route-map ride to another stop has been asked for (it hides the hint before the train moves).
 */
export function isDeparted(progress: number, target: number | null): boolean {
  return progress > AT_DEPARTURE || (target !== null && target !== 0);
}

/**
 * Whether the hint is on screen. Only in the ride, only while the train sits at Departure and
 * the visitor hasn't moved yet this session, never under the ticket-printer intro (it shows
 * after boarding), and not before the 3D world has drawn its first frame.
 */
export function shouldShowHint(env: {
  mode: RideMode;
  progress: number;
  target: number | null;
  seen: boolean;
  introOpen: boolean;
  sceneReady: boolean;
}): boolean {
  if (env.mode !== "ride" || env.seen || env.introOpen || !env.sceneReady) return false;
  return !isDeparted(env.progress, env.target);
}

/** Session storage, or undefined where even touching it throws (some private modes). */
function sessionStore(storage?: Storage): Storage | undefined {
  try {
    return storage ?? window.sessionStorage;
  } catch {
    return undefined;
  }
}

/** True once the hint was dismissed this session. Unreadable storage reads as "not seen". */
export function readHintSeen(storage?: Storage): boolean {
  try {
    return sessionStore(storage)?.getItem(HINT_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

/** Remembers the dismissal for this session; silently does nothing if storage is blocked. */
export function markHintSeen(storage?: Storage): void {
  try {
    sessionStore(storage)?.setItem(HINT_SEEN_KEY, "1");
  } catch {
    // Not remembered: a reload at Departure would show the hint again, which is harmless.
  }
}
