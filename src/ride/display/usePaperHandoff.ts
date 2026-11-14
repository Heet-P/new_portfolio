"use client";

import { type RefObject, useEffect } from "react";
import { STATIONS } from "@/content/route";
import { cabinFrame, useCabin } from "../cabinStore";
import { dismissPaperHint } from "../paperHint";
import { rideScrollBy } from "../rideScroll";
import { displayOpacity } from "../stopCamera";
import { ARM, edgesOf, initialHandoff, stepHandoff } from "./handoff";

const LAST = STATIONS.length - 1;

/** A wheel event further than this (ms) from the previous one starts a new gesture. */
const WHEEL_GESTURE_GAP_MS = 200;
/** px per line for wheels that scroll by lines (deltaMode 1): one notch of 3 lines arms. */
const LINE_PX = 32;
/** px a handed-off arrow key press scrolls the ride (twice the browser's 40: the ride is long). */
const ARROW_PX = 80;
/** A handed-off PageDown / Space scrolls the ride by this much of a viewport, like the browser. */
const PAGE_FRACTION = 0.8;
/** A finger let go while riding on carries on for about this long at its release speed (ms). */
const FLING_MS = 300;
/** Slower than this at release (px/ms), the finger simply stops: no fling. */
const FLING_MIN_SPEED = 0.2;

/** The cue's nudge when the hand-off arms: 4px along the way on and back, ease-out, 280ms. */
const PULSE_MS = 280;
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

/** True when a key press belongs to a text field (typing is not scrolling). */
const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

/** Which way a key scrolls (+1 down, -1 up, 0 = not one we hand off). Home/End stay the page's own. */
function keyDirection(e: KeyboardEvent): -1 | 0 | 1 {
  switch (e.key) {
    case "PageDown":
    case "ArrowDown":
      return 1;
    case "PageUp":
    case "ArrowUp":
      return -1;
    case " ":
    case "Spacebar":
      return e.shiftKey ? -1 : 1;
    default:
      return 0;
  }
}

/**
 * Scroll hand-off from the cabin's newspaper to the train (the decisions: handoff.ts).
 *
 * The paper's scroller keeps `data-lenis-prevent` (Lenis never sees input inside it) and
 * `overscroll-behavior: contain` (its overscroll never chains to the page), so the page always
 * reads first and, on its own, would never move the train. This hook watches wheel, touch and
 * scroll keys on the display and forwards whatever the page has run out of to the ride
 * (rideScroll.ts -> useScrollDriver's Lenis), once armed.
 *
 * Only on a fully shown display: never while the cabin swoops in or out. Once a hand-off has
 * started the display fades as the train pulls away, and input keeps flowing to the train until
 * it is gone (then the window's own scroll has it).
 */
export function usePaperHandoff(layer: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const root = layer.current;
    if (!root) return;

    let state = initialHandoff();
    /** Gesture counter: a wheel burst, a touch, a key press (repeats included) each get one id. */
    let gesture = 0;
    let lastWheel = -Infinity;
    /** This display has started handing on: keep forwarding while it fades out. */
    let handing = false;

    // A new stop (or the display going away) starts from scratch.
    const unsubCabin = useCabin.subscribe((s, prev) => {
      if (s.shown === prev.shown && s.stationIndex === prev.stationIndex) return;
      state = initialHandoff();
      handing = false;
    });

    /** The paper's scroller, if `t` is inside it. */
    const scrollerOf = (t: EventTarget | null) => {
      const el = root.querySelector<HTMLElement>("[data-paper-scroller]");
      return el && t instanceof Node && el.contains(t) ? el : null;
    };

    /** Nudge whatever marks the way on in direction `dir`: "keep going and you'll ride on". */
    const pulse = (dir: number) => {
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
      const d = dir > 0 ? 4 : -4;
      for (const el of root.querySelectorAll<HTMLElement>(`[data-handoff-cue="${dir > 0 ? "next" : "prev"}"]`)) {
        el.animate?.(
          [{ transform: "none" }, { transform: `translateY(${d}px) scale(1.02)` }, { transform: "none" }],
          { duration: PULSE_MS, easing: EASE_OUT },
        );
      }
    };

    /**
     * One input through the hand-off. Returns the px handed to the ride (0 = none).
     * `smooth`: Lenis's wheel smoothing; a finger is followed 1:1.
     */
    const feed = (scroller: HTMLElement, delta: number, id: number, threshold: number, smooth: boolean) => {
      const { shown, stationIndex } = useCabin.getState();
      if (!shown || (!handing && displayOpacity(cabinFrame.blend) < 1)) return 0;
      const r = stepHandoff(state, {
        delta,
        gesture: id,
        ...edgesOf(scroller),
        canPrev: stationIndex > 0,
        canNext: stationIndex < LAST,
        threshold,
      });
      state = r.state;
      if (r.armedNow) {
        pulse(delta);
        // Pushing on past a page's end is "reaching the bottom": the reader has found the way on.
        if (delta > 0) dismissPaperHint();
      }
      if (r.pass) {
        handing = true;
        dismissPaperHint();
        rideScrollBy(r.pass, smooth);
      }
      return r.pass;
    };

    const onWheel = (e: WheelEvent) => {
      const scroller = scrollerOf(e.target);
      if (!scroller || e.ctrlKey || !e.deltaY) return; // ctrl+wheel = zoom
      if (e.timeStamp - lastWheel > WHEEL_GESTURE_GAP_MS) gesture++;
      lastWheel = e.timeStamp;
      const unit = e.deltaMode === 1 ? LINE_PX : e.deltaMode === 2 ? scroller.clientHeight : 1;
      feed(scroller, e.deltaY * unit, gesture, ARM.wheel, true);
    };

    // Touch: one finger, tracked from where it went down. Its moves are followed on the touched
    // element itself, because the display (and that element) leaves the DOM as the train pulls
    // away mid-drag, and a detached node's events no longer bubble up to this layer.
    const onTouchStart = (e: TouchEvent) => {
      const scroller = scrollerOf(e.target);
      const target = e.target;
      if (!scroller || !target || e.touches.length !== 1) return;
      const id = ++gesture;
      let lastY = e.touches[0].clientY;
      let lastT = e.timeStamp;
      /** px/ms, + = scrolling down the page (finger moving up), smoothed over the last moves. */
      let velocity = 0;
      let rode = false;
      const move = (ev: TouchEvent) => {
        if (ev.touches.length !== 1) return end();
        const y = ev.touches[0].clientY;
        const d = lastY - y;
        const dt = Math.max(1, ev.timeStamp - lastT);
        velocity = 0.6 * (d / dt) + 0.4 * velocity;
        lastY = y;
        lastT = ev.timeStamp;
        if (feed(scroller, d, id, ARM.touch, false)) rode = true;
      };
      const end = () => {
        target.removeEventListener("touchmove", move as EventListener);
        target.removeEventListener("touchend", end);
        target.removeEventListener("touchcancel", end);
        // Let go while riding on: the train carries on a little, as a native fling would.
        if (rode && Math.abs(velocity) > FLING_MIN_SPEED) rideScrollBy(velocity * FLING_MS, true);
      };
      target.addEventListener("touchmove", move as EventListener, { passive: true });
      target.addEventListener("touchend", end);
      target.addEventListener("touchcancel", end);
    };

    // Keys: only when the page itself has run out that way (otherwise the browser scrolls the
    // page as usual). At the edge the browser must not scroll anything itself: we decide.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      const scroller = scrollerOf(e.target);
      const dir = keyDirection(e);
      if (!scroller || !dir) return;
      // Space on a button presses it.
      if ((e.key === " " || e.key === "Spacebar") && e.target instanceof HTMLButtonElement) return;
      const { atTop, atBottom } = edgesOf(scroller);
      if (!(dir > 0 ? atBottom : atTop)) return;
      e.preventDefault();
      if (!e.repeat) gesture++;
      const px = e.key.startsWith("Arrow") ? ARROW_PX : window.innerHeight * PAGE_FRACTION;
      feed(scroller, dir * px, gesture, ARM.key, true);
    };

    root.addEventListener("wheel", onWheel, { passive: true });
    root.addEventListener("touchstart", onTouchStart, { passive: true });
    root.addEventListener("keydown", onKeyDown);
    return () => {
      unsubCabin();
      root.removeEventListener("wheel", onWheel);
      root.removeEventListener("touchstart", onTouchStart);
      root.removeEventListener("keydown", onKeyDown);
    };
  }, [layer]);
}
