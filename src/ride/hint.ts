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
  /** The cabin's paper is open with its own first-time cue up: only one hint at a time, and that one wins. */
  paperHint?: boolean;
}): boolean {
  if (env.mode !== "ride" || env.seen || env.introOpen || !env.sceneReady || env.paperHint) return false;
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

/** True once the hint stored under `key` was dismissed this session. Unreadable storage reads as "not seen". */
function readSeen(key: string, storage?: Storage): boolean {
  try {
    return sessionStore(storage)?.getItem(key) === "1";
  } catch {
    return false;
  }
}

/** Remembers a dismissal for this session; silently does nothing if storage is blocked. */
function markSeen(key: string, storage?: Storage): void {
  try {
    sessionStore(storage)?.setItem(key, "1");
  } catch {
    // Not remembered: a reload would show the hint again, which is harmless.
  }
}

/** True once the Departure hint was dismissed this session. */
export function readHintSeen(storage?: Storage): boolean {
  return readSeen(HINT_SEEN_KEY, storage);
}

/** Remembers the Departure hint's dismissal for this session. */
export function markHintSeen(storage?: Storage): void {
  markSeen(HINT_SEEN_KEY, storage);
}

/* ---------- The paper's own cue (Task 17) ---------- */

/*
 * The cabin's newspaper scrolls by itself, and keeps going into the ride once its page runs out
 * (display/handoff.ts). The first time the paper is open in a session, a small chip on it says
 * so; it goes for the session the first time the visitor reaches the bottom of a page or uses
 * the paper's Next / Previous stop buttons.
 */

/** sessionStorage key: set once the visitor has found the end of a page (or the stop buttons). */
export const PAPER_HINT_SEEN_KEY = "nt-paper-hint-seen";

/** What the paper's chip says: scrolling with a mouse or trackpad, swiping on a touch screen. */
export const PAPER_HINT_TEXT = {
  fine: "Scroll to read · keep scrolling to ride on",
  coarse: "Swipe to read · keep swiping to ride on",
} as const;

/** Whether the paper's chip is on screen: on the open paper, until seen this session. */
export function shouldShowPaperHint(env: { shown: boolean; seen: boolean }): boolean {
  return env.shown && !env.seen;
}

/** True once the paper hint was dismissed this session. */
export function readPaperHintSeen(storage?: Storage): boolean {
  return readSeen(PAPER_HINT_SEEN_KEY, storage);
}

/** Remembers the paper hint's dismissal for this session. */
export function markPaperHintSeen(storage?: Storage): void {
  markSeen(PAPER_HINT_SEEN_KEY, storage);
}
