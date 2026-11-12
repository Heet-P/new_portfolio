"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { PROFILE, STATIONS, type Station } from "@/content/route";
import { linkProps, StationContent } from "@/express/StationContent";
import { cabinFrame, onCabinFrame, useCabin } from "../cabinStore";
import { displayOpacity } from "../stopCamera";
import { splitLinks } from "./links";
import styles from "./OnboardDisplay.module.css";

const LAST = STATIONS.length - 1;
const CABIN_CREDIT_URL = "https://sketchfab.com/3d-models/subway-interior-b7f25426ac674a9291ba092fb9fe8406";

/** One display button. External links open in a new tab (noopener), the PDF downloads. */
function Action({ href, primary, children }: { href: string; primary?: boolean; children: ReactNode }) {
  return (
    <li>
      <a className={styles.action} data-primary={primary || undefined} href={href} {...linkProps(href)}>
        {children}
      </a>
    </li>
  );
}

/** A row of display buttons. */
function Actions({ children }: { children: ReactNode }) {
  return <ul className={styles.actions}>{children}</ul>;
}

/** Arrow for links that leave the site (decorative: the link text carries the name). */
const Out = () => (
  <span className={styles.out} aria-hidden="true">
    ↗
  </span>
);

/** Projects and internships: the shared station content plus See live / GitHub buttons. */
function ProjectScreen({ station }: { station: Station }) {
  const { live, repo, rest } = splitLinks(station.links);
  const hasLinks = live || repo || rest.length > 0;
  return (
    <>
      <div className={styles.columns}>
        <StationContent station={station} showLinks={false} />
      </div>
      {hasLinks && (
        <Actions>
          {live && (
            <Action href={live.href} primary>
              See live
              <Out />
            </Action>
          )}
          {repo && (
            <Action href={repo.href} primary={!live}>
              GitHub
              <Out />
            </Action>
          )}
          {rest.map((l) => (
            <Action key={l.href} href={l.href}>
              {l.label}
            </Action>
          ))}
        </Actions>
      )}
    </>
  );
}

/** Departure: who is on board, and where to find more. */
function DepartureScreen({ station }: { station: Station }) {
  return (
    <div className={styles.flow}>
      <p className={styles.eyebrow}>Boarding now</p>
      <h2 className={styles.title}>{PROFILE.name}</h2>
      <p className={styles.role}>{PROFILE.role}</p>
      <div className={styles.body}>
        {station.body.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
      <Actions>
        <Action href={PROFILE.github} primary>
          GitHub
          <Out />
        </Action>
        <Action href={PROFILE.linkedin}>
          LinkedIn
          <Out />
        </Action>
        <Action href={PROFILE.resume}>Download resume</Action>
      </Actions>
    </div>
  );
}

/** The open platform: the next stop could be the visitor's team. */
function NextScreen({ station }: { station: Station }) {
  return (
    <div className={styles.flow}>
      <p className={styles.eyebrow}>Platform open</p>
      <h2 className={styles.title}>{station.tagline}</h2>
      <div className={styles.body}>
        {station.body.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
      <Actions>
        <Action href={`mailto:${PROFILE.email}`} primary>
          Email me
        </Action>
        <Action href={PROFILE.linkedin}>
          LinkedIn
          <Out />
        </Action>
      </Actions>
    </div>
  );
}

/**
 * The resume, handed over as a train ticket. The whole ticket is the download link; on
 * hover / press it "prints" a little further out of its slot (transform only).
 */
function Ticket() {
  return (
    <div className={styles.ticketSlot}>
      <a className={styles.ticket} href={PROFILE.resume} download="">
        <span className={styles.ticketMain}>
          <span className={styles.ticketKicker} aria-hidden="true">
            Night Train · Admit one
          </span>
          <span className={styles.ticketTitle}>Download resume</span>
          <span className={styles.ticketMeta} aria-hidden="true">
            {PROFILE.name} · PDF
          </span>
        </span>
        <span className={styles.ticketStub} aria-hidden="true">
          <span>No.</span>
          <span className={styles.ticketNo}>0816</span>
        </span>
      </a>
    </div>
  );
}

/** End of the line: contact, the ticket, and the credits for the models. */
function TerminusScreen({ station }: { station: Station }) {
  return (
    <div className={styles.flow}>
      <p className={styles.eyebrow}>Contact</p>
      <h2 className={styles.title}>{station.tagline}</h2>
      <div className={styles.body}>
        {station.body.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
      <Actions>
        <Action href={`mailto:${PROFILE.email}`} primary>
          Email {PROFILE.email}
        </Action>
        <Action href={PROFILE.linkedin}>
          LinkedIn
          <Out />
        </Action>
        <Action href={PROFILE.github}>
          GitHub
          <Out />
        </Action>
      </Actions>
      <Ticket />
      <p className={styles.credits}>
        Cabin:{" "}
        <a href={CABIN_CREDIT_URL} target="_blank" rel="noopener noreferrer">
          Subway_[interior]
        </a>{" "}
        by Comicaroid (CC BY 4.0) · Train via TurboSquid
      </p>
    </div>
  );
}

/**
 * The display's screen for one station: a metro-style "Now arriving" bar, then the stop's
 * content. A `region` labelled with the station name, so screen reader users can jump to it.
 */
export function DisplayScreen({ station, index }: { station: Station; index: number }) {
  const next = index < LAST ? STATIONS[index + 1] : undefined;
  const status = index === 0 ? "Now departing" : index === LAST ? "Terminus" : "Now arriving";
  let content: ReactNode;
  if (station.kind === "intro") content = <DepartureScreen station={station} />;
  else if (station.kind === "open") content = <NextScreen station={station} />;
  else if (station.kind === "end") content = <TerminusScreen station={station} />;
  else content = <ProjectScreen station={station} />;

  return (
    <section className={styles.screen} aria-label={station.name}>
      <header className={styles.bar}>
        <span className={styles.barStatus}>
          <span className={styles.lamp} aria-hidden="true" />
          {status}
        </span>
        {next && <span className={styles.barNext}>Next stop · {next.name}</span>}
      </header>
      {/* Lenis must not swallow the wheel here: long content scrolls inside the screen. */}
      <div className={styles.scroller} data-lenis-prevent="">
        {content}
      </div>
    </section>
  );
}

/**
 * The big on-board display, as HTML laid over the 3D panel in the cabin.
 *
 * Its CSS box is the source of truth for where the display sits on screen: it is measured
 * here (cabinFrame.target) and the scene sizes the 3D panel to cover exactly that box once
 * the camera has settled, so the text is never resampled (crisp at any DPR). While the camera
 * is still gliding in, every frame the box is translated/scaled onto wherever the 3D panel
 * currently projects (cabinFrame.panel) and faded in with the blend; settled, the transform
 * is removed entirely. All of that is written straight to the DOM from the scene's frame
 * loop; React only renders when the display is shown or hidden (useCabin).
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
      cabinFrame.targetVersion++;
    };
    measure();
    window.addEventListener("resize", measure);
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    ro?.observe(l);
    return () => {
      window.removeEventListener("resize", measure);
      ro?.disconnect();
    };
  }, []);

  // Per frame: fade with the blend and ride on the 3D panel until the camera settles.
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
