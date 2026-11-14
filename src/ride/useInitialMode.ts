"use client";

import { useEffect } from "react";
import { track } from "@/analytics/track";
import { chooseInitialMode, readSavedMode } from "./mode";
import { webglSupported } from "./webgl";
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
      webgl: webglSupported(),
      saved: readSavedMode(),
    });
    useRide.getState().setMode(mode);
    // The mode the visit starts in (the ride vs Express split is the headline number).
    track("mode_changed", { mode, initial: true });
  }, []);
}
