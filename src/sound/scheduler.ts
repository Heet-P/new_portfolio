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

export interface Scheduler {
  /** Add a track; its first event is at the next start() (or right away if running). */
  add(track: Track): void;
  start(): void;
  stop(): void;
}

export function createScheduler(now: () => number): Scheduler {
  const tracks: Array<{ play: Track; next: number }> = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const tick = () => {
    const t = now();
    const horizon = t + SCHEDULER.lookahead;
    for (const track of tracks) {
      // Fell behind (a throttled background tab, a long stall)? Skip what was missed rather
      // than playing a burst of stale events all at once.
      if (track.next < t) track.next = t;
      while (track.next < horizon) track.next += Math.max(0.01, track.play(track.next));
    }
    timer = setTimeout(tick, SCHEDULER.intervalMs);
  };

  return {
    add(play) {
      tracks.push({ play, next: now() });
    },
    start() {
      if (timer !== null) return;
      // Resume from the clock: anything that "should" have played while stopped is dropped.
      const t = now();
      for (const track of tracks) track.next = t;
      tick();
    },
    stop() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}
