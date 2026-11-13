"use client";

import { type ComponentProps, useEffect, useRef, useState } from "react";
import { getSound } from "@/sound/sound";
import { matches, REDUCED_MOTION } from "./motionPrefs";

/**
 * When the Stop press stamp hits the paper, after the article starts inking in (ms): its CSS
 * delay (200 ms) plus the moment the landing spring first reaches the page (~60% of its
 * 0.4 s visual duration). Keeps the thunk sound on the visual impact.
 */
const STAMP_HIT_MS = 440;

/**
 * An Express article that "inks in" the first time it scrolls into view: the headline's red
 * brush underline draws itself and (on the current stop) the Stop press stamp thunks down.
 * The CSS keys off `data-ink`:
 * - absent: the finished, static page (server HTML, no JS, reduced motion, or already on
 *   screen at load, where resetting would flash);
 * - "pending": hydrated while below the fold, held back ready to ink in;
 * - "in": arrived; the decorations play their one-off entrance.
 * `thunk`: play the stamp sound as the Stop press lands (silent unless sound is on).
 */
export function WhimsyArticle({ thunk = false, children, ...props }: ComponentProps<"article"> & { thunk?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const [ink, setInk] = useState<"pending" | "in">();

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined" || matches(REDUCED_MOTION)) return;

    let first = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const wasFirst = first;
        first = false;
        if (!entry.isIntersecting) {
          if (wasFirst) setInk("pending");
          return;
        }
        observer.disconnect();
        if (wasFirst) return; // on screen at load: keep the static page
        setInk("in");
        if (thunk) timer = setTimeout(() => getSound().stamp(), STAMP_HIT_MS);
      },
      // "Arrived" once the article's top is a quarter of the way up the viewport, so even an
      // article taller than the screen triggers, and the reader sees the entrance happen.
      { rootMargin: "0px 0px -25% 0px" },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [thunk]);

  return (
    <article ref={ref} {...props} data-ink={ink}>
      {children}
    </article>
  );
}
