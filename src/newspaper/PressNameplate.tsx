"use client";

import { getSound } from "@/sound/sound";
import { matches, REDUCED_MOTION } from "./motionPrefs";
import styles from "./newspaper.module.css";

/** "ka" (the press arm lands: a paper tap), then "chunk" (the platen bites: the stamp thud). */
const CHUNK_AFTER_MS = 90;

/**
 * The jolt: the masthead takes two hits from the press and settles (transform only, 280 ms,
 * strong ease-out). Like a sheet of newsprint knocked on the platen, not a shake.
 */
const JOLT: Keyframe[] = [
  { transform: "none" },
  { transform: "translateY(3px)", offset: 0.2 },
  { transform: "translateY(-1px)", offset: 0.42 },
  { transform: "translateY(2px) rotate(-0.25deg)", offset: 0.6 },
  { transform: "none" },
];
const JOLT_TIMING: KeyframeAnimationOptions = { duration: 280, easing: "cubic-bezier(0.23, 1, 0.32, 1)" };

/**
 * The Express nameplate with a small surprise: click "The Project Post" and the printing press
 * goes ka-chunk (sound only when it is on) while the masthead takes a little jolt (skipped
 * under reduced motion). Pure decoration: not focusable, nothing is lost without it.
 * Runs on WAAPI, so no React render; a quick second click restarts the jolt.
 */
export function PressNameplate() {
  return (
    <p
      className={styles.nameplate}
      data-press=""
      onClick={(e) => {
        const sound = getSound();
        sound.tap();
        setTimeout(() => sound.stamp(), CHUNK_AFTER_MS);
        const masthead = e.currentTarget.closest("header");
        if (!masthead || matches(REDUCED_MOTION) || typeof masthead.animate !== "function") return;
        masthead.getAnimations?.().forEach((a) => a.cancel());
        masthead.animate(JOLT, JOLT_TIMING);
      }}
    >
      The Project Post
    </p>
  );
}
