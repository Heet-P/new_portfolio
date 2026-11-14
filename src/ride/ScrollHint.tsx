"use client";

import { useCallback, useEffect, useState } from "react";
import { useIntroOpen } from "@/intro/IntroGate";
import { useCabin } from "./cabinStore";
import { usePaperHint } from "./paperHint";
import { useRide } from "./rideStore";
import { HINT_TEXT, isDeparted, markHintSeen, readHintSeen, shouldShowHint, shouldShowPaperHint } from "./hint";
import styles from "./ScrollHint.module.css";

/** Keys that scroll the page (and so move the train): the first one counts as setting off. */
const SCROLL_KEYS = new Set(["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " ", "Spacebar"]);

/** How long the fade-out takes before the words leave the DOM (the CSS fade is 200 ms). */
const FADE_MS = 240;

/** A hand-drawn ink arrow pointing down (CSS turns it up for touch), a little wobbly like a pen. */
function InkArrow() {
  return (
    <span className={styles.arrowTurn} aria-hidden="true">
      <svg className={styles.arrow} viewBox="0 0 24 32" focusable="false">
        <path
          d="M12.5 3c-.8 5 .9 10.5-.3 16.5-.3 1.8-.4 3.6-.2 5.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M5.5 19.5c2.6 2 4.6 4.3 6.6 8.2 1.6-3.6 3.8-6.3 6.6-8.7"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/**
 * "Scroll to depart" (or "Swipe up to depart" on a touch screen): a paper tag under the front
 * page at Departure that tells a first-time rider how the train moves. It shows after boarding
 * (never under the ticket-printer intro), only while the train sits at Departure, and goes for
 * the rest of the session (sessionStorage `nt-hint-seen`) on the first wheel, touch drag or
 * scroll key, or when the train leaves Departure any other way (a route-map ride, a deep link).
 * It stands aside while the cabin paper's own first-time cue is up (one hint at a time).
 *
 * One polite status region that is always there, so the words are announced once as they
 * appear; they fade out, then leave the DOM, and never come back to be announced again.
 */
export function ScrollHint() {
  const introOpen = useIntroOpen();
  const [seen, setSeen] = useState(readHintSeen);
  // One hint at a time: while the open paper shows its own first-time cue, that one wins.
  const paperShown = useCabin((s) => s.shown);
  const paperHint = shouldShowPaperHint({ shown: paperShown, seen: usePaperHint((s) => s.seen) });
  const visible = useRide((s) =>
    shouldShowHint({ mode: s.mode, progress: s.progress, target: s.target, sceneReady: s.sceneReady, seen, introOpen, paperHint }),
  );

  // The words stay in the DOM through the fade-out after the hint has been shown.
  const [wasShown, setWasShown] = useState(false);
  const [faded, setFaded] = useState(false);
  if (visible && !wasShown) setWasShown(true);
  const present = visible || (wasShown && !faded);

  const dismiss = useCallback(() => {
    markHintSeen();
    setSeen(true);
  }, []);

  // Leaving Departure in any way (or landing somewhere else) means the visitor knows the way.
  useEffect(() => {
    if (seen) return;
    const check = (s: { mode: string; progress: number; target: number | null }) => {
      if (s.mode === "ride" && isDeparted(s.progress, s.target)) dismiss();
    };
    check(useRide.getState());
    return useRide.subscribe(check);
  }, [seen, dismiss]);

  // While it shows: the visitor's first scroll gesture dismisses it (even one the front page
  // takes for itself, scrolling its own column rather than the ride).
  useEffect(() => {
    if (!visible) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaX || e.deltaY) dismiss();
    };
    const onKey = (e: KeyboardEvent) => {
      if (SCROLL_KEYS.has(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) dismiss();
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchmove", dismiss, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchmove", dismiss);
      window.removeEventListener("keydown", onKey);
    };
  }, [visible, dismiss]);

  // Hidden after being shown: let the fade play, then take the words out.
  useEffect(() => {
    if (visible || !wasShown) return;
    const t = setTimeout(() => setFaded(true), FADE_MS);
    return () => clearTimeout(t);
  }, [visible, wasShown]);

  return (
    <div role="status" className={styles.hint} data-visible={visible || undefined} data-testid="scroll-hint">
      {present && (
        <span className={styles.tag}>
          <span className={styles.fine}>{HINT_TEXT.fine}</span>
          <span className={styles.coarse}>{HINT_TEXT.coarse}</span>
          <InkArrow />
        </span>
      )}
    </div>
  );
}
