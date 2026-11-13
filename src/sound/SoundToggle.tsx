"use client";

import { useSyncExternalStore } from "react";
import ticket from "@/ride/ModeToggle.module.css";
import { getSound } from "./sound";
import styles from "./SoundToggle.module.css";

const subscribe = (fn: () => void) => getSound().subscribe(fn);
const isOn = () => getSound().enabled();
/** Server HTML always shows "off": sound is off by default and the preference lives in the browser. */
const serverOn = () => false;

/** An ink speaker: sound waves when on, struck through when off. */
function SpeakerGlyph({ on }: { on: boolean }) {
  return (
    <svg className={styles.glyph} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M3 9h4l5-4v14l-5-4H3z" />
      {on ? (
        <g className={styles.waves} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M15.5 9.5a3.5 3.5 0 0 1 0 5" />
          <path d="M18 7a7 7 0 0 1 0 10" />
        </g>
      ) : (
        <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M15 9l6 6M21 9l-6 6" />
      )}
    </svg>
  );
}

/**
 * The sound switch: a paper ticket like the mode toggle, sitting beside it (top-right) in
 * both views. A true toggle: the label stays "Sound" and aria-pressed carries on/off.
 * Off by default; the engine remembers the choice (nt-sound) and does the fading.
 */
export function SoundToggle() {
  const on = useSyncExternalStore(subscribe, isOn, serverOn);
  return (
    <button
      type="button"
      className={`${ticket.toggle} ${styles.sound}`}
      aria-pressed={on}
      onClick={() => {
        const sound = getSound();
        // Tap first: turning off, it is the last thing heard; turning on, it is a no-op.
        sound.tap();
        sound.setEnabled(!on);
      }}
    >
      <SpeakerGlyph on={on} />
      Sound
    </button>
  );
}
