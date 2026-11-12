import type { RideMode } from "./rideStore";

/** Everything the initial-mode decision depends on, gathered once on the client. */
export interface ModeEnv {
  reducedMotion: boolean;
  webgl: boolean;
  /** The visitor's last explicit choice, or null if none (or storage unreadable). */
  saved: RideMode | null;
}

/** localStorage key holding the visitor's last explicit choice. */
const STORAGE_KEY = "nt-mode";

/**
 * Pick the mode a visitor starts in. Priority:
 * 1. No WebGL: the ride cannot run, so Express always wins.
 * 2. An explicit saved choice wins over preferences (a reduced-motion visitor who opted in stays in).
 * 3. Reduced motion with no saved choice: Express.
 * 4. Otherwise: the ride.
 */
export function chooseInitialMode(env: ModeEnv): RideMode {
  if (!env.webgl) return "express";
  if (env.saved) return env.saved;
  if (env.reducedMotion) return "express";
  return "ride";
}

/** True when the browser can create a WebGL context (the ride's hard requirement). */
export function detectWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Reads the saved mode. Storage access can throw (private mode, blocked cookies), so it is guarded. */
export function readSavedMode(storage?: Storage): RideMode | null {
  try {
    const value = (storage ?? window.localStorage).getItem(STORAGE_KEY);
    return value === "ride" || value === "express" ? value : null;
  } catch {
    return null;
  }
}

/** Remembers the visitor's choice; silently does nothing if storage is unavailable. */
export function saveMode(mode: RideMode, storage?: Storage): void {
  try {
    (storage ?? window.localStorage).setItem(STORAGE_KEY, mode);
  } catch {
    // Not being able to persist the choice is harmless: it just won't survive a reload.
  }
}
