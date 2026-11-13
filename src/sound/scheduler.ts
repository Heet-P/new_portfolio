import { SCHEDULING } from "./soundDesign";

/**
 * A look-ahead scheduler ("A Tale of Two Clocks"): a coarse JS timer wakes up every
 * `intervalMs` and queues, on the precise audio clock, every event due within the next
 * `lookahead` seconds. Timing therefore comes from the audio clock, never from timer
 * drift, and a late timer just means the queue was topped up a little later.
 *
 * Each track is a function that plays whatever happens at time `when` and returns how
 * long until its next event. There is only ever ONE pending timer (a chained setTimeout,
 * not setInterval), and stop() clears it.
 */
export const SCHEDULER = SCHEDULING;

/** Plays the event at `when` (audio-clock seconds); returns seconds until the next one (> 0). */
export type Track = (when: number) => number;

/**
 * Called instead of playing when a tick finds the track's next event already in the past (the
 * timer was starved for longer than the look-ahead: a throttled tab, a long main-thread stall).
 * Gets the audio clock's now; returns when the track should pick up again (>= now). Without
 * one, the track simply carries on from now.
 */
export type Resync = (now: number) => number;

export interface Scheduler {
  /** Add a track; its first event is at the next start() (or right away if running). */
  add(track: Track, resync?: Resync): void;
  start(): void;
  stop(): void;
}

export function createScheduler(now: () => number): Scheduler {
  const tracks: Array<{ play: Track; resync?: Resync; next: number }> = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;

  const tick = () => {
    try {
      const t = now();
      const horizon = t + SCHEDULER.lookahead;
      for (const track of tracks) {
        try {
          // Fell behind? Never play a burst of stale events: the track picks its re-entry point
          // (the music waits for the next bar line, so it comes back on a downbeat, chord and all).
          if (track.next < t) track.next = track.resync ? Math.max(t, track.resync(t)) : t;
          while (track.next < horizon) track.next += Math.max(0.01, track.play(track.next));
        } catch {
          // A broken voice must not silence the others: skip this track's window, retry next tick.
          track.next = horizon;
        }
      }
    } finally {
      // Always re-arm (unless stopped meanwhile): one bad tick can never wedge the loop.
      timer = running ? setTimeout(tick, SCHEDULER.intervalMs) : null;
    }
  };

  return {
    add(play, resync) {
      tracks.push({ play, resync, next: now() });
    },
    start() {
      if (running) return;
      running = true;
      // Resume from the clock: anything that "should" have played while stopped is dropped.
      const t = now();
      for (const track of tracks) track.next = t;
      tick();
    },
    stop() {
      running = false;
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}
