"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import { STATIONS } from "@/content/route";
import { getSound } from "@/sound/sound";
import { nearestStation } from "./mapping";
import { useRide } from "./rideStore";
import styles from "./RouteMap.module.css";

const COUNT = STATIONS.length;

/**
 * The map draws itself in only the first time the ride starts in this page session;
 * toggling Express and back should not replay a decorative entrance.
 */
let hasDrawnIn = false;

/** The train marker: a tiny side-view locomotive in ink, like a timetable's printed glyph. */
function TrainGlyph() {
  return (
    <svg className={styles.glyph} viewBox="0 0 24 16" aria-hidden="true" focusable="false">
      {/* Cab, boiler and chimney in ink; windows and wheels punched out in paper. */}
      <path fill="currentColor" d="M2 3h7v3h8V4h2v2h1.5a1.5 1.5 0 0 1 1.5 1.5V12H2z" />
      <rect x="4" y="5" width="3" height="3" fill="var(--paper-light)" />
      <circle cx="6" cy="13" r="2.4" fill="currentColor" stroke="var(--paper-light)" strokeWidth="1" />
      <circle cx="12" cy="13" r="2.4" fill="currentColor" stroke="var(--paper-light)" strokeWidth="1" />
      <circle cx="18" cy="13" r="2.4" fill="currentColor" stroke="var(--paper-light)" strokeWidth="1" />
    </svg>
  );
}

/**
 * The route map: a printed timetable card of every station that doubles as navigation.
 * Desktop: an ink route line fixed bottom-left, with station names in serif. Phones (<= 640px):
 * a compact horizontal strip of stops along the bottom edge (names stay available as aria-labels).
 * The current stop is circled in red ink; the stretch to an upcoming stop is dashed.
 *
 * Performance: the train marker moves on every scroll frame, so it never goes through React.
 * A zustand `subscribe` writes its transform straight to the DOM; React only re-renders when
 * the nearest station index changes (the selector returns a number, so equal values bail out).
 */
export function RouteMap() {
  const current = useRide((s) => nearestStation(s.progress, COUNT));
  const goTo = useRide((s) => s.goTo);
  const trackRef = useRef<HTMLDivElement>(null);
  const carriageRef = useRef<HTMLSpanElement>(null);
  const trainRef = useRef<HTMLSpanElement>(null);
  // Read once per mount: true only for the very first map in this page session.
  const [drawIn] = useState(() => !hasDrawnIn);

  useEffect(() => {
    hasDrawnIn = true;
  }, []);

  // Drive the train marker from progress without re-rendering.
  useEffect(() => {
    const carriage = carriageRef.current;
    const train = trainRef.current;
    if (!carriage || !train) return;
    // The carriage spans first-dot-centre -> last-dot-centre along ONE axis and is 0px on the other,
    // so moving the train by p * (width, height) follows whichever orientation the breakpoint uses.
    // Its size is cached (ResizeObserver) so the per-frame write never forces a layout read.
    // Only the 16px train moves: translating the long carriage itself would add scrollable overflow.
    let w = carriage.offsetWidth;
    let h = carriage.offsetHeight;
    const place = (p: number) => {
      train.style.transform = `translate(${p * w}px, ${p * h}px)`;
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => {
      w = carriage.offsetWidth;
      h = carriage.offsetHeight;
      place(useRide.getState().progress);
    });
    observer?.observe(carriage);
    place(useRide.getState().progress);
    const unsubscribe = useRide.subscribe((s) => place(s.progress));
    return () => {
      unsubscribe();
      observer?.disconnect();
    };
  }, []);

  // Phones: the strip is wider than the screen, so keep the current stop scrolled into view.
  // scrollLeft is set directly (not scrollIntoView) so the page itself never scrolls.
  useEffect(() => {
    const track = trackRef.current;
    const button = track?.querySelectorAll("button")[current];
    if (!track || !button || track.scrollWidth <= track.clientWidth) return;
    const b = button.getBoundingClientRect();
    const t = track.getBoundingClientRect();
    // Shift so the button sits in the middle of the strip (the browser clamps at both ends).
    track.scrollLeft += b.left - t.left - (track.clientWidth - b.width) / 2;
  }, [current]);

  return (
    <nav className={styles.map} aria-label="Route map">
      {/* track = the panel (and, on phones, the horizontal scroller); rail = positioning context
          shared by the station list and the train marker, so the marker lines up and scrolls with the dots. */}
      <div ref={trackRef} className={styles.track} data-draw={drawIn || undefined}>
        {/* Printed card title (decorative: the nav is already named "Route map"). */}
        <p className={styles.title} aria-hidden="true">
          Timetable
        </p>
        <div className={styles.rail} style={{ "--count": COUNT } as CSSProperties}>
          <ol className={styles.list}>
            {STATIONS.map((station, i) => {
              const upcoming = station.status === "upcoming";
              // A segment touching an upcoming station is dashed: that part of the line isn't built yet.
              const nextUpcoming = STATIONS[i + 1]?.status === "upcoming";
              return (
                <li key={station.id} className={styles.stop}>
                  {i < COUNT - 1 && (
                    <span
                      className={styles.segment}
                      data-dashed={upcoming || nextUpcoming || undefined}
                      aria-hidden="true"
                    />
                  )}
                  <button
                    type="button"
                    className={styles.button}
                    aria-label={station.name}
                    aria-current={i === current ? "step" : undefined}
                    data-upcoming={upcoming || undefined}
                    onClick={() => {
                      getSound().tap();
                      goTo(i);
                    }}
                  >
                    <span className={styles.dot} aria-hidden="true" />
                    <span className={styles.label} aria-hidden="true">
                      {station.name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <span ref={carriageRef} className={styles.carriage} aria-hidden="true">
            <span ref={trainRef} className={styles.train}>
              <TrainGlyph />
            </span>
          </span>
        </div>
      </div>
    </nav>
  );
}
