"use client";

import { useEffect } from "react";
import { chooseInitialMode, detectWebGL, readSavedMode } from "./mode";
import { useRide } from "./rideStore";

/**
 * Chooses the starting mode once on mount. This must run in an effect, not during render:
 * the server-rendered HTML is always Express, and reading matchMedia/WebGL/localStorage
 * on the server (or during hydration) would either throw or cause a mismatch.
 */
export function useInitialMode(): void {
  useEffect(() => {
    const mode = chooseInitialMode({
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      webgl: detectWebGL(),
      saved: readSavedMode(),
    });
    useRide.getState().setMode(mode);
  }, []);
}
