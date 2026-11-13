"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { STATIONS } from "@/content/route";
import { resetTravel } from "@/scene/travel";
import { snapCabin } from "./cabinStore";
import { nearestStation, parseHash, stationToProgress } from "./mapping";
import { useRide } from "./rideStore";

const IDS = STATIONS.map((s) => s.id);
const COUNT = IDS.length;

/** Ease-in-out cubic: the train pulls away gently and eases into the platform. */
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Seconds to ride between two progress values: proportional to the number of stations
 * crossed, so a hop to the neighbouring stop is quick and a cross-route trip is not a
 * teleport, but capped so a long trip never feels like waiting.
 */
function rideDuration(from: number, to: number): number {
  const stations = Math.abs(to - from) * (COUNT - 1);
  return Math.min(2.4, 0.6 + 0.3 * stations);
}

/** Mobile toolbars change innerHeight by ~50-100px while scrolling; ignore those resizes. */
const TOOLBAR_JITTER_PX = 120;

/** Keys that scroll the page natively; pressing one takes over from a route-map ride. */
const SCROLL_KEYS = new Set(["PageDown", "PageUp", "ArrowDown", "ArrowUp", "Home", "End", " ", "Spacebar"]);

/** True when a key press belongs to a text field (typing a space there is not scrolling). */
const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

/**
 * After the initial jump, the start station is re-asserted at these moments unless the visitor
 * has moved on: late native scroll events (the Express page's own #anchor jump on first paint),
 * Lenis re-measuring, or the load event can otherwise nudge a cold deep link onto a neighbour.
 */
const SETTLE_CHECKS_MS = [300, 900];

/**
 * The ride's scroll engine. In ride mode only:
 * - smooths the window scroll with Lenis and writes `progress = scroll / maxScroll` to the store;
 * - resolves the initial URL hash itself (scroll restoration is manual) and jumps there instantly;
 * - rides to `target` whenever `goTo(i)` sets one (a new goTo mid-flight simply retargets),
 *   clearing `target` on arrival or when the visitor takes over with the wheel/touch;
 * - keeps `#<station>` in the URL with replaceState (never pushState: no history spam);
 * - keeps the visitor at the same progress across resizes and orientation changes;
 * - lets native keyboard scrolling (PageDown, Space, arrows, Home/End) interrupt a goTo ride.
 * Whenever it places the ride (deep link, re-entry from Express) the train and the cabin snap
 * there instead of gliding through the stops in between.
 * On leaving ride mode, Lenis is destroyed and the Express page is scrolled to the section
 * of the station the visitor was at (Departure = the top of the page).
 */
export function useScrollDriver(): void {
  const mode = useRide((s) => s.mode);

  useEffect(() => {
    if (mode !== "ride") return;

    const html = document.documentElement;
    const { setProgress } = useRide.getState();
    // globals.css asks for smooth anchor scrolling on Express; in the ride every jump must be instant.
    html.style.scrollBehavior = "auto";
    // The browser must not restore an old offset (or chase a hash) on reload; we place the train ourselves.
    history.scrollRestoration = "manual";

    const lenis = new Lenis({ autoRaf: true });
    const progressOf = (scroll: number) => (lenis.limit > 0 ? scroll / lenis.limit : 0);
    /** Drop any Lenis animation and re-read the real scroll position (stop() + start() reset it). */
    const resyncLenis = () => {
      lenis.stop();
      lenis.start();
    };
    const jumpTo = (p: number) => {
      // Sync Lenis to the real scroll first: if its idea of the target already equals `p` (it
      // missed a native scroll), an immediate scrollTo would otherwise silently do nothing.
      resyncLenis();
      lenis.scrollTo(p * lenis.limit, { immediate: true, force: true });
      setProgress(p);
    };
    /** Put the train (and the cabin view) exactly at the current progress: a cut, not a ride. */
    const snapTrain = () => {
      resetTravel(useRide.getState().progress, COUNT);
      snapCabin();
    };
    const rideTo = (index: number) => {
      const to = stationToProgress(index, COUNT);
      lenis.scrollTo(to * lenis.limit, {
        duration: rideDuration(progressOf(lenis.scroll), to),
        easing: easeInOut,
        force: true,
        // Only the latest scrollTo's onComplete ever fires, so a retarget never clears the new target early.
        onComplete: () => useRide.setState({ target: null }),
      });
    };

    /** The visitor has scrolled, pressed a key or picked a stop: never re-place them after that. */
    let takenOver = false;

    lenis.on("scroll", () => setProgress(progressOf(lenis.scroll)));
    // A real wheel/touch gesture takes over from an in-flight goTo (Lenis drops the animation), so
    // drop the target too; otherwise clicking that same station again would look like "no change".
    lenis.on("virtual-scroll", ({ deltaX, deltaY }) => {
      if (!deltaX && !deltaY) return;
      takenOver = true;
      if (useRide.getState().target !== null) useRide.setState({ target: null });
    });

    // Keyboard scrolling is native (Lenis doesn't smooth it), but while a goTo ride is animating
    // Lenis would overwrite it every frame for up to 2.4 s. Stop the ride and let the key win.
    const onKeyDown = (e: KeyboardEvent) => {
      if (!SCROLL_KEYS.has(e.key) || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      takenOver = true;
      if (useRide.getState().target === null) return;
      useRide.setState({ target: null });
      resyncLenis(); // stops the animation; the native scroll that follows is tracked as usual
    };
    window.addEventListener("keydown", onKeyDown);

    // Deep link: start at the hash's station (unknown/empty = Departure) and correct the URL to match.
    // The matching Express <section id> is hidden by now, so the native anchor jump has nothing to land on;
    // the immediate scroll below also cancels any smooth fragment scroll that started on first paint.
    const startIndex = parseHash(location.hash, IDS);
    let shownIndex = startIndex;
    jumpTo(stationToProgress(startIndex, COUNT));
    snapTrain();
    history.replaceState(null, "", "#" + IDS[startIndex]);

    // Settle: re-assert the start station a few times while the page finishes loading, unless
    // the visitor has taken over. A drift is corrected as a cut (train and cabin snap).
    const settle = () => {
      if (takenOver || useRide.getState().target !== null) return;
      const want = stationToProgress(startIndex, COUNT);
      const drifted = Math.abs(lenis.actualScroll - want * lenis.limit) > 1 || useRide.getState().progress !== want;
      if (!drifted) return;
      jumpTo(want);
      snapTrain();
    };
    let settleFrame = requestAnimationFrame(() => {
      settleFrame = requestAnimationFrame(settle);
    });
    const settleTimers = SETTLE_CHECKS_MS.map((ms) => setTimeout(settle, ms));
    const onLoad = () => requestAnimationFrame(settle);
    if (document.readyState !== "complete") window.addEventListener("load", onLoad, { once: true });

    // URL follows the ride: rewrite the hash only when the nearest station changes.
    const unsubHash = useRide.subscribe((s) => {
      const index = nearestStation(s.progress, COUNT);
      if (index === shownIndex) return;
      shownIndex = index;
      history.replaceState(null, "", "#" + IDS[index]);
    });

    // goTo(i) -> ride there. Re-setting the same target mid-flight changes nothing.
    const unsubTarget = useRide.subscribe((s, prev) => {
      if (s.target === null || s.target === prev.target) return;
      takenOver = true;
      rideTo(s.target);
    });

    // Resize/rotation changes maxScroll, which would silently move the visitor to another station.
    // Read progress BEFORE Lenis re-measures (its resize emits a scroll with the new ratio), then re-anchor.
    let lastW = window.innerWidth;
    let lastH = window.innerHeight;
    const onResize = () => {
      const { progress, target } = useRide.getState();
      const real = window.innerWidth !== lastW || Math.abs(window.innerHeight - lastH) > TOOLBAR_JITTER_PX;
      lastW = window.innerWidth;
      lastH = window.innerHeight;
      lenis.resize();
      if (!real) return;
      if (target !== null) rideTo(target);
      else jumpTo(progress);
    };
    window.addEventListener("resize", onResize);

    // Someone edits the hash by hand (or follows an in-page #link) while riding: ride there.
    const onHashChange = () => {
      takenOver = true;
      const index = parseHash(location.hash, IDS);
      history.replaceState(null, "", "#" + IDS[index]);
      useRide.getState().goTo(index);
    };
    window.addEventListener("hashchange", onHashChange);

    return () => {
      const index = nearestStation(useRide.getState().progress, COUNT);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("hashchange", onHashChange);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("load", onLoad);
      cancelAnimationFrame(settleFrame);
      settleTimers.forEach(clearTimeout);
      unsubHash();
      unsubTarget();
      lenis.destroy();
      useRide.setState({ target: null });
      html.style.scrollBehavior = "";
      history.scrollRestoration = "auto";

      // Switched to Express (not just a dev StrictMode re-run): by the time this cleanup runs, React has
      // already committed the Express page and removed the spacer, so we can land on the same station.
      if (useRide.getState().mode !== "express") return;
      const section = index === 0 ? null : document.getElementById(IDS[index]);
      if (section) section.scrollIntoView({ block: "start", behavior: "instant" });
      else window.scrollTo({ top: 0, behavior: "instant" });
    };
  }, [mode]);
}
