import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createScheduler, SCHEDULER } from "./scheduler";

/** Audio clock driven by the fake timers' Date. */
const t0 = { v: 0 };
const now = () => (Date.now() - t0.v) / 1000;

beforeEach(() => {
  vi.useFakeTimers();
  t0.v = Date.now();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createScheduler (look-ahead)", () => {
  it("schedules events ahead of the clock, never in the past", () => {
    const times: Array<{ at: number; when: number }> = [];
    const s = createScheduler(now);
    s.add((when) => {
      times.push({ at: now(), when });
      return 0.25;
    });
    s.start();
    vi.advanceTimersByTime(5000);
    expect(times.length).toBeGreaterThan(15);
    for (const { at, when } of times) {
      expect(when).toBeGreaterThanOrEqual(at);
      // Never further ahead than the look-ahead window (+ one event length).
      expect(when - at).toBeLessThanOrEqual(SCHEDULER.lookahead + 0.25 + 1e-9);
    }
    // Evenly spaced on the audio clock: no setInterval-style drift.
    for (let i = 1; i < times.length; i++) expect(times[i].when - times[i - 1].when).toBeCloseTo(0.25, 9);
  });

  it("keeps exactly one pending timer however long it runs", () => {
    const s = createScheduler(now);
    s.add(() => 0.4);
    s.add(() => 0.1);
    s.start();
    s.start(); // a second start is a no-op
    for (let i = 0; i < 30; i++) {
      vi.advanceTimersByTime(1000);
      expect(vi.getTimerCount()).toBe(1);
    }
    s.stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stop() really stops, and start() resumes from the clock (no burst of missed events)", () => {
    let calls = 0;
    const whens: number[] = [];
    const s = createScheduler(now);
    s.add((when) => {
      calls++;
      whens.push(when);
      return 0.25;
    });
    s.start();
    vi.advanceTimersByTime(1000);
    s.stop();
    const stopped = calls;
    vi.advanceTimersByTime(10_000);
    expect(calls).toBe(stopped);
    s.start();
    const resumedAt = now();
    vi.advanceTimersByTime(SCHEDULER.intervalMs);
    // ~lookahead/0.25 events, not the ~40 that "should" have played while stopped.
    expect(calls - stopped).toBeLessThanOrEqual(Math.ceil(SCHEDULER.lookahead / 0.25) + 2);
    expect(whens[stopped]).toBeGreaterThanOrEqual(resumedAt);
  });
});

describe("createScheduler (robustness, Task 13)", () => {
  it("looks far enough ahead to ride out a ~0.4 s main-thread stall", () => {
    expect(SCHEDULER.lookahead).toBeGreaterThanOrEqual(0.5);
  });

  it("keeps ticking when a track throws, and the other tracks keep playing", () => {
    let good = 0;
    const s = createScheduler(now);
    s.add(() => {
      throw new Error("broken voice");
    });
    s.add(() => {
      good++;
      return 0.25;
    });
    s.start();
    const before = good;
    vi.advanceTimersByTime(3000);
    expect(good - before).toBeGreaterThan(8);
    expect(vi.getTimerCount()).toBe(1);
    s.stop();
  });

  it("a late tick resyncs a track through its resync hook (the music snaps to the next bar)", () => {
    const whens: number[] = [];
    const resyncs: number[] = [];
    const s = createScheduler(now);
    s.add(
      (when) => {
        whens.push(when);
        return 0.25;
      },
      (t) => {
        resyncs.push(t);
        // "Next bar boundary" on a 1 s grid.
        return Math.ceil(t);
      },
    );
    s.start();
    vi.advanceTimersByTime(1000);
    expect(resyncs).toHaveLength(0);
    // The main thread stalls for 2.3 s: the timer fires long after the queue ran dry.
    const stalledFrom = whens.length;
    vi.setSystemTime(Date.now() + 2300);
    vi.advanceTimersByTime(SCHEDULER.intervalMs);
    expect(resyncs).toHaveLength(1);
    // Keep ticking normally until the grid boundary has been queued.
    vi.advanceTimersByTime(1000);
    expect(resyncs).toHaveLength(1);
    // Nothing is played in the past, and play resumes exactly on the grid's next boundary.
    expect(whens[stalledFrom]).toBe(Math.ceil(resyncs[0]));
    for (const w of whens.slice(stalledFrom)) expect(w).toBeGreaterThanOrEqual(resyncs[0]);
    s.stop();
  });
});
