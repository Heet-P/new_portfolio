"use client";

import { PROFILE } from "@/content/route";
import { OnboardDisplay } from "./display/OnboardDisplay";
import { SwapOverlay } from "./display/SwapOverlay";
import { RouteMap } from "./RouteMap";

/**
 * Fixed UI layered over the ride. While the train travels: only the route map (and the
 * mode toggle, mounted by the page). At a stop, once the camera has gone into the cabin:
 * the on-board display with that stop's work, plus the warm swap overlay that hides the
 * camera's jump through the window. Neither re-renders per scroll frame (see cabinStore).
 *
 * It is the page's <main> while riding (the Express <main> is hidden then), with a visually
 * hidden h1, so assistive tech still finds one main landmark and one top-level heading.
 */
export function RideOverlay() {
  return (
    <main aria-labelledby="ride-title">
      <h1 id="ride-title" className="sr-only">
        {PROFILE.name}: the night train ride
      </h1>
      <RouteMap />
      <SwapOverlay />
      <OnboardDisplay />
    </main>
  );
}
