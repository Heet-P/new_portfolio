"use client";

import { useState } from "react";
import { track } from "@/analytics/track";
import { STATIONS } from "@/content/route";
import { nextStopLabel } from "@/newspaper/edition";
import news from "@/newspaper/newspaper.module.css";
import { getSound } from "@/sound/sound";
import { PAPER_HINT_TEXT } from "../hint";
import { dismissPaperHint, usePaperHint } from "../paperHint";
import { useRide } from "../rideStore";
import styles from "./PaperFooter.module.css";

/*
 * The cabin paper's ways on: what tells a reader the page continues into the ride, and the
 * buttons that take them there. Everything here is the cabin's only (the Express broadsheet is
 * one long page and never rides anywhere).
 *
 * `data-handoff-cue` marks what pulses when a scroll pushed past the page's end arms the
 * hand-off to the train (usePaperHandoff): "next" for down the line, "prev" for back up it.
 */

const LAST = STATIONS.length - 1;

/** Ride from stop `from` to stop `i`: the soft paper tap, and the reader has found their way on (no more hint). */
function rideTo(i: number, from: number) {
  getSound().tap();
  track("paper_handoff", { direction: i > from ? "next" : "prev", via: "button" });
  dismissPaperHint();
  useRide.getState().goTo(i);
}

/** Decorative arrows: the button's words carry its name. */
const Arrow = ({ children }: { children: string }) => (
  <span className={styles.arrow} aria-hidden="true">
    {children}
  </span>
);

/**
 * The end of the front page, like a story "continued on page 4": the next stop by name above a
 * red rule, and ink-stamp buttons to ride there (or back). At the Terminus: the end of the line,
 * and the way back to Departure.
 */
export function PaperFooter({ index }: { index: number }) {
  const next = index < LAST ? STATIONS[index + 1] : undefined;
  return (
    <footer className={styles.footer} data-testid="paper-footer">
      <p className={styles.cue} data-handoff-cue={next ? "next" : undefined}>
        {next ? (
          <>
            Continued at the next stop: {nextStopLabel(next)} <Arrow>↓</Arrow>
          </>
        ) : (
          "End of the line"
        )}
      </p>
      <ul className={styles.stamps}>
        {next && index > 0 && (
          <li>
            <button type="button" className={`${news.action} ${styles.stamp}`} onClick={() => rideTo(index - 1, index)}>
              <Arrow>←</Arrow> Previous stop
            </button>
          </li>
        )}
        <li>
          {next ? (
            <button type="button" className={`${news.action} ${styles.stamp}`} data-primary="" onClick={() => rideTo(index + 1, index)}>
              Next stop <Arrow>→</Arrow>
            </button>
          ) : (
            <button type="button" className={`${news.action} ${styles.stamp}`} data-primary="" onClick={() => rideTo(0, index)}>
              Back to Departure <Arrow>↑</Arrow>
            </button>
          )}
        </li>
      </ul>
    </footer>
  );
}

/**
 * Phones and touch screens: a slim bar pinned to the bottom of the paper, so the way on is
 * always in reach without scrolling to the end: "← Prev" · the station · "Next stop →".
 * Hidden by CSS on desktop (mouse and wide screen), where the footer and the scroll do the job.
 */
export function PaperBar({ index }: { index: number }) {
  const station = STATIONS[index];
  const last = index === LAST;
  return (
    <div className={styles.bar} role="group" aria-label="Stops" data-testid="paper-bar">
      {index > 0 ? (
        <button type="button" className={styles.barButton} aria-label="Previous stop" data-handoff-cue="prev" onClick={() => rideTo(index - 1, index)}>
          <Arrow>←</Arrow> Prev
        </button>
      ) : (
        <span />
      )}
      <span className={styles.barName}>{station?.name}</span>
      {last ? (
        <button type="button" className={styles.barButton} aria-label="Back to Departure" onClick={() => rideTo(0, index)}>
          Departure <Arrow>↑</Arrow>
        </button>
      ) : (
        <button type="button" className={styles.barButton} data-primary="" aria-label="Next stop" data-handoff-cue="next" onClick={() => rideTo(index + 1, index)}>
          Next stop <Arrow>→</Arrow>
        </button>
      )}
    </div>
  );
}

/**
 * The first time the paper is open in a session: a slip on the page saying it scrolls, and
 * that scrolling on rides on. It fades out (then leaves) the first time the visitor reaches a
 * page's end or uses the stop buttons, and stays gone for the session (nt-paper-hint-seen).
 * Decorative for assistive tech: the footer's words and buttons say the same thing.
 */
export function PaperHint() {
  const seen = usePaperHint((s) => s.seen);
  // Only a paper opened before the hint was seen draws it; once gone it never comes back.
  const [present, setPresent] = useState(!seen);
  if (!present) return null;
  return (
    <div className={styles.hintRow} aria-hidden="true">
      <p
        className={styles.hint}
        data-testid="paper-hint"
        data-visible={!seen || undefined}
        onTransitionEnd={() => seen && setPresent(false)}
      >
        <span className={styles.fine}>{PAPER_HINT_TEXT.fine}</span>
        <span className={styles.coarse}>{PAPER_HINT_TEXT.coarse}</span>
      </p>
    </div>
  );
}
