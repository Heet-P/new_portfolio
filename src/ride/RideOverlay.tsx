"use client";

import { OnboardDisplay } from "./display/OnboardDisplay";
import { SwapOverlay } from "./display/SwapOverlay";
import { RouteMap } from "./RouteMap";

/**
 * Fixed UI layered over the ride. While the train travels: only the route map (and the
 * mode toggle, mounted by the page). At a stop, once the camera has gone into the cabin:
 * the on-board display with that stop's work, plus the warm swap overlay that hides the
 * camera's jump through the window. Neither re-renders per scroll frame (see cabinStore).
 */
export function RideOverlay() {
  return (
    <>
      <RouteMap />
      <SwapOverlay />
      <OnboardDisplay />
    </>
  );
}
