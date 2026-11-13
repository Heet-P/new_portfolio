"use client";

import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { saveMode } from "@/ride/mode";
import { useRide } from "@/ride/rideStore";
import { getSound } from "@/sound/sound";
import { FEED, formatTicketDate, INTRO_TIMING, markIntroSeen, TICKET, ticketStops } from "./ticket";
import { TicketPrinter, type TicketPrinterStage } from "./TicketPrinter";
import gate from "./IntroGate.module.css";
import styles from "./Intro.module.css";

const easeOut = [0.23, 1, 0.32, 1] as const;

/** What Tab cycles through inside the dialog. */
const FOCUSABLE = "button:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])";

/** Keys that would scroll the page (and so move the train) behind the dialog. */
const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);

/** True while the dialog's own content fits: then nothing in it should scroll at all. */
const fits = (el: HTMLElement) => el.scrollHeight <= el.clientHeight;

/**
 * "Take the journey": the first-visit intro to the ride. A full-screen night with a vintage
 * ticket machine that checks the timetable, prints a rail ticket for the whole route, and then
 * offers to board. Meanwhile the 3D world loads behind it (the Scene is already mounted).
 *
 * Timeline (ticket.ts INTRO_TIMING): processing at once; printing when the scene has drawn its
 * first frame, but no sooner than 1.2 s and no later than 4 s; complete when the 1.75 s feed is
 * out. "Skip" jumps to complete. Reduced motion starts complete, with nothing moving.
 *
 * It is a modal dialog: the page behind is inert, Tab stays inside, Escape boards, and wheel /
 * touch / scroll keys never reach the ride's scroll driver (the train must not move behind it).
 */
export default function Intro({ instant, onClose }: { instant: boolean; onClose: () => void }) {
  const [stage, setStage] = useState<TicketPrinterStage>(instant ? "complete" : "processing");
  const [leaving, setLeaving] = useState(false);
  // Today's date for the ticket, read once (this only ever renders in the browser).
  const [date] = useState(() => formatTicketDate(new Date()));
  const overlayRef = useRef<HTMLDivElement>(null);
  const takeRef = useRef<HTMLButtonElement>(null);
  const leavingRef = useRef(false);
  const animate = !instant;

  /** Board the train: remember the visit, tap, and let the ticket slide away. */
  const board = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    markIntroSeen();
    getSound().tap();
    setLeaving(true);
  }, []);

  /** "In a hurry?": straight to the Express page (remembered, like the mode toggle). */
  const hurry = () => {
    leavingRef.current = true;
    markIntroSeen();
    getSound().tap();
    onClose();
    useRide.getState().setMode("express");
    saveMode("express");
  };

  const skip = () => setStage("complete");

  // Processing -> printing: once the world has drawn its first frame and the machine has had
  // its moment, or at the cap whatever the scene is doing.
  useEffect(() => {
    if (instant) return;
    let minDone = false;
    const print = () => setStage((s) => (s === "processing" ? "printing" : s));
    const tryPrint = () => {
      if (minDone && useRide.getState().sceneReady) print();
    };
    const minTimer = setTimeout(() => {
      minDone = true;
      tryPrint();
    }, INTRO_TIMING.minProcessing * 1000);
    const maxTimer = setTimeout(print, INTRO_TIMING.maxProcessing * 1000);
    const unsubscribe = useRide.subscribe(tryPrint);
    return () => {
      clearTimeout(minTimer);
      clearTimeout(maxTimer);
      unsubscribe();
    };
  }, [instant]);

  // Printing: the print head chatters along with the feed (if sound is on), then it's complete.
  useEffect(() => {
    if (stage !== "printing") return;
    getSound().printChatter(FEED.seconds);
    const done = setTimeout(
      () => setStage((s) => (s === "printing" ? "complete" : s)),
      (FEED.seconds + INTRO_TIMING.settle) * 1000,
    );
    return () => clearTimeout(done);
  }, [stage]);

  // Complete: a small bell (only on a running clock: never queued for a later gesture), and
  // keyboard focus lands on the way forward.
  useEffect(() => {
    if (stage !== "complete") return;
    const sound = getSound();
    if (!instant && sound.state() === "on") sound.chime();
    takeRef.current?.focus();
  }, [stage, instant]);

  // On open, focus the dialog itself so it is announced; Tab then reaches Skip.
  useEffect(() => {
    if (!instant) overlayRef.current?.focus();
  }, [instant]);

  // Everything else on the page is inert while the dialog is up (lifted the moment it leaves).
  useEffect(() => {
    const root = overlayRef.current;
    if (!root || leaving) return;
    const made: Element[] = [];
    for (const el of Array.from(root.parentElement?.children ?? [])) {
      if (el === root || el.hasAttribute("inert")) continue;
      el.setAttribute("inert", "");
      made.push(el);
    }
    return () => made.forEach((el) => el.removeAttribute("inert"));
  }, [leaving]);

  // Leaving: focus goes to the ride (its current stop on the route map) at once, and the dialog
  // unmounts once its exit has played. (A timer, not an animation callback: a hidden tab pauses
  // animations, and the ride must not stay covered.)
  useEffect(() => {
    if (!leaving) return;
    document.querySelector<HTMLElement>('nav[aria-label="Route map"] [aria-current="step"]')?.focus({ preventScroll: true });
    const done = setTimeout(onClose, instant ? 0 : INTRO_TIMING.exit * 1000 + 40);
    return () => clearTimeout(done);
  }, [leaving, instant, onClose]);

  // Keyboard while open: Escape boards, Tab is trapped, scroll keys never scroll the page behind.
  // Capture phase, so it runs before the ride's own key handling.
  useEffect(() => {
    const root = overlayRef.current;
    if (!root || leaving) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        board();
        return;
      }
      if (e.key === "Tab") {
        const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
        const active = document.activeElement;
        const outside = !root.contains(active) || active === root;
        if (items.length === 0) {
          e.preventDefault();
        } else if (e.shiftKey && (outside || active === items[0])) {
          e.preventDefault();
          items[items.length - 1].focus();
        } else if (!e.shiftKey && (active === items[items.length - 1] || !root.contains(active))) {
          e.preventDefault();
          items[0].focus();
        }
        return;
      }
      // Space on a button presses it; everything else that scrolls is held while nothing needs to.
      const onButton = e.target instanceof HTMLElement && e.target.closest("button");
      if (SCROLL_KEYS.has(e.key) && !(e.key === " " && onButton) && fits(root)) e.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [leaving, board]);

  // Wheel and touch over the dialog never reach Lenis (it listens on window), and never scroll
  // the page natively; on a short screen the dialog scrolls itself (overscroll contained in CSS).
  useEffect(() => {
    const root = overlayRef.current;
    if (!root) return;
    const hold = (e: Event) => {
      e.stopPropagation();
      if (fits(root)) e.preventDefault();
    };
    root.addEventListener("wheel", hold, { passive: false });
    root.addEventListener("touchmove", hold, { passive: false });
    return () => {
      root.removeEventListener("wheel", hold);
      root.removeEventListener("touchmove", hold);
    };
  }, []);

  const stops = ticketStops();

  return (
    <motion.div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Your ticket"
      tabIndex={-1}
      className={`${gate.backdrop} ${styles.overlay}`}
      data-leaving={leaving || undefined}
      initial={false}
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: animate ? INTRO_TIMING.exit : 0, ease: easeOut }}
    >
      {/* Leaving: the machine and its ticket slide up and away while the night fades out. */}
      <motion.div
        className={styles.stage}
        initial={animate ? { opacity: 0, transform: "translateY(8px)" } : false}
        animate={leaving ? { opacity: 0, transform: "translateY(-40px)" } : { opacity: 1, transform: "translateY(0px)" }}
        transition={{ duration: animate ? (leaving ? 0.3 : 0.24) : 0, ease: easeOut }}
      >
        <TicketPrinter.Root stage={stage} animate={animate} className={styles.printer}>
          <TicketPrinter.Machine>
            <TicketPrinter.Header>
              <span className={styles.plate}>{TICKET.plate}</span>
              <span className={styles.headerEnd}>
                <span className={styles.lamp} data-stage={stage} aria-hidden="true" />
                {stage !== "complete" && (
                  <button type="button" className={styles.skip} onClick={skip}>
                    Skip
                  </button>
                )}
              </span>
            </TicketPrinter.Header>
            <TicketPrinter.Screen>
              <p className={styles.screenLine}>{TICKET.screenRoute}</p>
              <p className={styles.screenLine}>Passenger: {TICKET.passenger}</p>
              <p className={styles.screenLine}>Fare: {TICKET.fare}</p>
              <TicketPrinter.Status className={styles.screenStatus} />
            </TicketPrinter.Screen>
          </TicketPrinter.Machine>

          <TicketPrinter.Output>
            <TicketPrinter.Paper className={styles.ticket}>
              <header className={styles.ticketHead}>
                <p className={styles.ticketTitle}>{TICKET.header}</p>
                <p className={styles.admit}>{TICKET.admit}</p>
              </header>
              <p className={styles.label} aria-hidden="true">
                Route
              </p>
              <ol className={styles.route} aria-label="Route">
                {stops.map((s) => (
                  <li key={s.id} className={styles.stop} data-current={s.current || undefined} data-upcoming={s.upcoming || undefined}>
                    <span className={styles.dot} aria-hidden="true" />
                    {s.name}
                    {s.current && <span className="sr-only"> (current stop)</span>}
                  </li>
                ))}
              </ol>
              {/* Date and seat, with the inspector's stamp beside them (below them on a phone). */}
              <div className={styles.validation}>
                <dl className={styles.meta}>
                  <div>
                    <dt>Date</dt>
                    <dd>{date}</dd>
                  </div>
                  <div>
                    <dt>Seat</dt>
                    <dd>{TICKET.seat}</dd>
                  </div>
                </dl>
                <p className={styles.stamp}>{TICKET.stamp}</p>
              </div>
              <div className={styles.stub}>
                <span>{TICKET.stub}</span>
                <span className={styles.hole} aria-hidden="true" />
              </div>
            </TicketPrinter.Paper>
          </TicketPrinter.Output>
        </TicketPrinter.Root>

        {/* Space is held for the buttons from the start, so nothing shifts when they appear. */}
        <div className={styles.actions} data-ready={stage === "complete" || undefined}>
          {stage === "complete" && (
            <motion.div
              className={styles.actionsInner}
              initial={animate ? { opacity: 0, transform: "translateY(4px)" } : false}
              animate={{ opacity: 1, transform: "translateY(0px)" }}
              transition={{ duration: 0.2, ease: easeOut }}
            >
              <button ref={takeRef} type="button" className={styles.take} onClick={board}>
                Take the journey
              </button>
              <button type="button" className={styles.hurry} onClick={hurry} aria-label="In a hurry? Switch to the quick-read page">
                In a hurry?
              </button>
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
