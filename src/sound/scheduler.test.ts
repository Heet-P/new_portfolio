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
