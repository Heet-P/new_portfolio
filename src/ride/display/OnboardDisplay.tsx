"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { STATIONS, type Station } from "@/content/route";
import { FrontPage } from "@/newspaper/FrontPage";
import { cabinFrame, onCabinFrame, useCabin } from "../cabinStore";
import { displayOpacity } from "../stopCamera";
import styles from "./OnboardDisplay.module.css";

/**
 * One stop's front page of "The Project Post", as a `region` labelled with the station name so
 * screen reader users can jump to it. Long pages scroll inside the sheet.
 */
export function DisplayScreen({ station, index }: { station: Station; index: number }) {
  return (
    <section className={styles.screen} aria-label={station.name}>
      {/* Lenis must not swallow the wheel here: long content scrolls inside the page. */}
      <div className={styles.scroller} data-lenis-prevent="">
        <FrontPage station={station} index={index} />
      </div>
    </section>
  );
}

/**
 * The newspaper's front page, as HTML laid over the unfolded 3D newspaper in the cabin.
 *
 * Its CSS box is the source of truth for where the page sits on screen: it is measured here
 * (cabinFrame.target) and the scene sizes the 3D newspaper so that, unfolded in front of the
 * settled camera, it covers exactly that box, so the text is never resampled (crisp at any
 * DPR). While the camera is still settling, every frame the box is translated/scaled onto
 * wherever the 3D paper currently projects (cabinFrame.panel) and faded in with the blend
 * (only once the paper has unfolded); settled, the transform is removed entirely. All of that
 * is written straight to the DOM from the scene's frame loop; React only renders when the
 * page is shown or hidden (useCabin).
 */
export function OnboardDisplay() {
  const shown = useCabin((s) => s.shown);
  const index = useCabin((s) => s.stationIndex);
  const layer = useRef<HTMLDivElement>(null);
  const screen = useRef<HTMLDivElement>(null);

  // Publish the display's laid-out box (transforms excluded: offset* ignore them).
  useLayoutEffect(() => {
    const l = layer.current;
    const s = screen.current;
    if (!l || !s) return;
    const measure = () => {
      const r = l.getBoundingClientRect();
      const t = cabinFrame.target;
      t.x = r.left + s.offsetLeft;
      t.y = r.top + s.offsetTop;
      t.w = s.offsetWidth;
      t.h = s.offsetHeight;
    };
    measure();
    // The layer is viewport-sized (position: fixed), so this also covers window resizes.
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    ro?.observe(l);
    return () => ro?.disconnect();
  }, []);

  // Leaving a stop while a display control has keyboard focus: hand focus to the route map's
  // button for this station before the display empties and goes inert, so it is not dropped
  // on <body>. The store notifies synchronously, before React re-renders the content away.
  useEffect(
    () =>
      useCabin.subscribe((s, prev) => {
        if (!prev.shown || s.shown) return;
        if (!layer.current?.contains(document.activeElement)) return;
        const map = document.querySelector('nav[aria-label="Route map"]');
        const here = map?.querySelector<HTMLElement>('[aria-current="step"]') ?? map?.querySelector<HTMLElement>("button");
        here?.focus({ preventScroll: true });
      }),
    [],
  );

  // Per frame: fade with the blend and ride on the 3D paper until the camera settles.
  useEffect(() => {
    const last = { opacity: -1, transform: "" };
    return onCabinFrame(() => {
      const el = screen.current;
      if (!el) return;
      const o = displayOpacity(cabinFrame.blend);
      if (o !== last.opacity) {
        el.style.opacity = String(o);
        el.style.visibility = o > 0 ? "visible" : "hidden";
        last.opacity = o;
      }
      if (o <= 0) return;
      const { panel: p, target: t } = cabinFrame;
      if (t.w <= 0 || t.h <= 0 || p.w <= 0) return;
      const dx = p.x - t.x;
      const dy = p.y - t.y;
      const sx = p.w / t.w;
      const sy = p.h / t.h;
      const settled = Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sx - 1) < 1e-3 && Math.abs(sy - 1) < 1e-3;
      const transform = settled ? "none" : `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`;
      if (transform !== last.transform) {
        el.style.transform = transform;
        last.transform = transform;
      }
    });
  }, []);

  const station = STATIONS[index];
  return (
    <>
      {/* Screen reader users hear each stop as the display comes up (the old station label's job). */}
      <p className="sr-only" aria-live="polite">
        {shown && station ? `Now at ${station.name}` : ""}
      </p>
      <div ref={layer} className={styles.layer} data-display="" aria-hidden={!shown || undefined} inert={!shown}>
        <div ref={screen} className={styles.frame}>
          {shown && station && <DisplayScreen key={station.id} station={station} index={index} />}
        </div>
      </div>
    </>
  );
}
