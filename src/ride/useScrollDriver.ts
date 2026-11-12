"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { STATIONS } from "@/content/route";
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

/**
 * The ride's scroll engine. In ride mode only:
 * - smooths the window scroll with Lenis and writes `progress = scroll / maxScroll` to the store;
 * - resolves the initial URL hash itself (scroll restoration is manual) and jumps there instantly;
 * - rides to `target` whenever `goTo(i)` sets one (a new goTo mid-flight simply retargets),
 *   clearing `target` on arrival or when the visitor takes over with the wheel/touch;
 * - keeps `#<station>` in the URL with replaceState (never pushState: no history spam);
 * - keeps the visitor at the same progress across resizes and orientation changes.
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
    const jumpTo = (p: number) => {
      lenis.scrollTo(p * lenis.limit, { immediate: true, force: true });
      setProgress(p);
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

    lenis.on("scroll", () => setProgress(progressOf(lenis.scroll)));
    // A real wheel/touch gesture takes over from an in-flight goTo (Lenis drops the animation), so
    // drop the target too; otherwise clicking that same station again would look like "no change".
    lenis.on("virtual-scroll", ({ deltaX, deltaY }) => {
      if ((deltaX || deltaY) && useRide.getState().target !== null) useRide.setState({ target: null });
    });

    // Deep link: start at the hash's station (unknown/empty = Departure) and correct the URL to match.
    // The matching Express <section id> is hidden by now, so the native anchor jump has nothing to land on;
    // the immediate scroll below also cancels any smooth fragment scroll that started on first paint.
    let shownIndex = parseHash(location.hash, IDS);
    jumpTo(stationToProgress(shownIndex, COUNT));
    history.replaceState(null, "", "#" + IDS[shownIndex]);

    // URL follows the ride: rewrite the hash only when the nearest station changes.
    const unsubHash = useRide.subscribe((s) => {
      const index = nearestStation(s.progress, COUNT);
      if (index === shownIndex) return;
      shownIndex = index;
      history.replaceState(null, "", "#" + IDS[index]);
    });

    // goTo(i) -> ride there. Re-setting the same target mid-flight changes nothing.
    const unsubTarget = useRide.subscribe((s, prev) => {
      if (s.target !== null && s.target !== prev.target) rideTo(s.target);
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
      const index = parseHash(location.hash, IDS);
      history.replaceState(null, "", "#" + IDS[index]);
      useRide.getState().goTo(index);
    };
    window.addEventListener("hashchange", onHashChange);

    return () => {
      const index = nearestStation(useRide.getState().progress, COUNT);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("hashchange", onHashChange);
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
