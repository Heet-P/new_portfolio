"use client";

import { useSyncExternalStore } from "react";
import { track } from "@/analytics/track";
import { getSound } from "@/sound/sound";
import { saveMode } from "./mode";
import { webglSupported } from "./webgl";
import { useRide } from "./rideStore";
import styles from "./ModeToggle.module.css";

/** useSyncExternalStore subscribe for a value that never changes. */
const noopSubscribe = () => () => {};

/**
 * Always-visible switch between the ride and the plain Express page.
 * The label names the destination: "In a hurry?" while riding (to the quick-read Express page),
 * "Ride the train" while on Express;
 * It is a plain action button (no aria-pressed: a pressed state that flips along with a destination
 * label would be announced backwards); aria-label starts with the visible text and spells out the action.
 */
export function ModeToggle() {
  const mode = useRide((s) => s.mode);
  const setMode = useRide((s) => s.setMode);
  // WebGL support never changes, so there is nothing to subscribe to. The server snapshot is false, so the
  // static HTML has no toggle that could flash and vanish on devices without WebGL; the client snapshot
  // is read from the shared one-time probe and swapped in after hydration.
  const canRide = useSyncExternalStore(noopSubscribe, webglSupported, () => false);

  if (!canRide) return null;

  const express = mode === "express";
  const next = express ? "ride" : "express";

  return (
    <button
      type="button"
      className={styles.toggle}
      aria-label={express ? "Ride the train: switch to the 3D train ride" : "In a hurry? Switch to the quick-read page"}
      onClick={() => {
        getSound().tap();
        if (!express) track("hurry_clicked", { from: "toggle" });
        track("mode_changed", { mode: next });
        setMode(next);
        saveMode(next);
      }}
    >
      {express ? "Ride the train" : "In a hurry?"}
    </button>
  );
}
