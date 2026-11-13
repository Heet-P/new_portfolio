"use client";

import { useId, useSyncExternalStore } from "react";
import ticket from "@/ride/ModeToggle.module.css";
import type { SoundState } from "./audioEngine";
import { getSound } from "./sound";
import styles from "./SoundToggle.module.css";

const subscribe = (fn: () => void) => getSound().subscribe(fn);
const stateOf = () => getSound().state();
/** Server HTML always shows "off": sound is off by default and the preference lives in the browser. */
const serverState = (): SoundState => "off";

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
 *
 * Pending: a remembered "on" can't make a sound until the visitor's first click or key (the
 * browser's autoplay rule). Until then the ticket is pressed but drawn with a dashed edge and
 * faint waves, described as "tap to start", and tapping it starts the sound instead of
 * switching it off.
 */
export function SoundToggle() {
  const state = useSyncExternalStore(subscribe, stateOf, serverState);
  const hintId = useId();
  const on = state !== "off";
  const pending = state === "pending";
  return (
    <>
      <button
        type="button"
        className={`${ticket.toggle} ${styles.sound}`}
        aria-pressed={on}
        aria-describedby={pending ? hintId : undefined}
        data-pending={pending || undefined}
        title={pending ? "Sound is on: tap to start" : undefined}
        // The engine's "first gesture starts the audio" listener ignores presses on this button,
        // so a press on the pending ticket reaches this click still pending (and means "start").
        data-sound-toggle=""
        onClick={() => {
          const sound = getSound();
          // Tap first: turning off, it is the last thing heard; turning on, it is a no-op.
          sound.tap();
          // Pending: this click is the gesture the browser was waiting for, so start, don't stop.
          sound.setEnabled(pending ? true : !on);
        }}
      >
        <SpeakerGlyph on={on} />
        Sound
      </button>
      {pending && (
        <span id={hintId} className="sr-only">
          Tap to start
        </span>
      )}
    </>
  );
}
