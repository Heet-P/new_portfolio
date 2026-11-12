"use client";

import { STATIONS } from "@/content/route";
import { nearestStation } from "./mapping";
import { useRide } from "./rideStore";
import { RouteMap } from "./RouteMap";
import styles from "./RideOverlay.module.css";

/**
 * Fixed UI layered over the ride: the route map plus the current station's name.
 * The name is a placeholder until the full station cards arrive (a later task).
 * Re-renders only when the nearest station changes, never per scroll frame.
 */
export function RideOverlay() {
  const index = useRide((s) => nearestStation(s.progress, STATIONS.length));

  return (
    <>
      <RouteMap />
      {/* Polite live region: screen reader users hear each station as the train reaches it. */}
      <div className={styles.station} aria-live="polite">
        {/* Keyed so each new name gets the short entrance animation. */}
        <p key={index} className={styles.name}>
          {STATIONS[index].name}
        </p>
      </div>
    </>
  );
}
