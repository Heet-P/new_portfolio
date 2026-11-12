"use client";

import { useState, useSyncExternalStore } from "react";
import { detectWebGL, saveMode } from "./mode";
import { useRide } from "./rideStore";
import styles from "./ModeToggle.module.css";

/** useSyncExternalStore subscribe for a value that never changes. */
const noopSubscribe = () => () => {};

/**
 * Always-visible switch between the ride and the plain Express page.
 * The label names the destination ("Express" while riding, "Ride the train" while on Express);
 * aria-pressed reports whether Express is the active mode.
 */
export function ModeToggle() {
  const mode = useRide((s) => s.mode);
  const setMode = useRide((s) => s.setMode);
  // WebGL support never changes, so there is nothing to subscribe to. The server snapshot is false, so the
  // static HTML has no toggle that could flash and vanish on devices without WebGL; the client snapshot
  // is probed once per mount (creating a GL context is not free) and swapped in after hydration.
  const [probe] = useState(() => {
    let cached: boolean | undefined;
    return () => (cached ??= detectWebGL());
  });
  const canRide = useSyncExternalStore(noopSubscribe, probe, () => false);

  if (!canRide) return null;

  const express = mode === "express";
  const next = express ? "ride" : "express";

  return (
    <button
      type="button"
      className={styles.toggle}
      aria-pressed={express}
      onClick={() => {
        setMode(next);
        saveMode(next);
      }}
    >
      {express ? "Ride the train" : "Express"}
    </button>
  );
}
