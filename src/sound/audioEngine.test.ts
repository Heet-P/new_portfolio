import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAudioEngine, SOUND_KEY } from "./audioEngine";
import { FakeAudioContext, fakeDocument, memoryStorage, throwingStorage } from "./fakeAudioContext";
import { SCHEDULER } from "./scheduler";
import { MASTER, MIX, PRINT, STAMP, TAP, TEMPO } from "./soundDesign";
import { chatterTicks } from "./synth";

/** An engine wired to fakes, plus the fakes so a test can poke them. */
function setup(storage: Storage = memoryStorage()) {
  const doc = fakeDocument();
  const contexts: FakeAudioContext[] = [];
  const ctx = vi.fn(() => {
    const c = new FakeAudioContext();
    contexts.push(c);
    return c as unknown as AudioContext;
  });
  const engine = createAudioEngine({ storage, doc, ctx });
  return { engine, doc, ctx, contexts, storage };
}

/** Flip the fake document's visibility and tell the engine, as the browser would. */
function setHidden(doc: ReturnType<typeof fakeDocument>, hidden: boolean) {
  doc.hidden = hidden;
  doc.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createAudioEngine", () => {
  it("is off by default", () => {
    const { engine, ctx } = setup();
    expect(engine.enabled()).toBe(false);
    // Nothing audio-related exists until the visitor asks for sound (autoplay policy).
    expect(ctx).not.toHaveBeenCalled();
  });

  // Review Focus 3: private mode / blocked storage still gives a working toggle for the session.
  it("works for the session when storage throws", () => {
    let engine!: ReturnType<typeof createAudioEngine>;
    expect(() => {
      engine = createAudioEngine({ storage: throwingStorage(), doc: fakeDocument(), ctx: () => new FakeAudioContext() as unknown as AudioContext });
    }).not.toThrow();
    expect(engine.enabled()).toBe(false);
    expect(() => engine.setEnabled(true)).not.toThrow();
    expect(engine.enabled()).toBe(true);
    expect(() => engine.setEnabled(false)).not.toThrow();
    expect(engine.enabled()).toBe(false);
  });

  it("persists the choice under nt-sound and a new engine picks it up", () => {
    const { engine, storage } = setup();
    engine.setEnabled(true);
    expect(SOUND_KEY).toBe("nt-sound");
    expect(storage.getItem("nt-sound")).toBe("1");
    expect(setup(storage).engine.enabled()).toBe(true);
    engine.setEnabled(false);
    expect(storage.getItem("nt-sound")).toBe("0");
    expect(setup(storage).engine.enabled()).toBe(false);
  });

  it("creates the AudioContext lazily, exactly once, on the first enable", () => {
    const { engine, ctx } = setup();
    engine.setEnabled(true);
    engine.setEnabled(true);
    engine.setEnabled(false);
    engine.setEnabled(true);
    expect(ctx).toHaveBeenCalledTimes(1);
  });

  it("fades the master in on enable and out on disable", () => {
    const { engine, contexts } = setup();
    engine.setEnabled(true);
    const master = contexts[0].master();
    expect(master.gain.value).toBeGreaterThan(0);
    engine.setEnabled(false);
    expect(master.gain.value).toBe(0);
    // Once the 600 ms fade is over the context sleeps (no CPU while off).
    vi.advanceTimersByTime(700);
    expect(contexts[0].state).toBe("suspended");
  });

  it("a remembered 'on' waits for the visitor's first gesture before making any sound", () => {
    const storage = memoryStorage();
    storage.setItem("nt-sound", "1");
    const { engine, doc, ctx, contexts } = setup(storage);
    expect(engine.enabled()).toBe(true);
    expect(ctx).not.toHaveBeenCalled();
    doc.dispatchEvent(new Event("pointerdown"));
    expect(ctx).toHaveBeenCalledTimes(1);
    expect(contexts[0].master().gain.value).toBeGreaterThan(0);
    // Only once.
    doc.dispatchEvent(new Event("pointerdown"));
    expect(ctx).toHaveBeenCalledTimes(1);
  });

  // Task 13: pressed-but-silent was confusing; the toggle shows "pending" until audio really runs.
  it("reports a remembered 'on' as pending until the audio clock is running", async () => {
    const storage = memoryStorage();
    storage.setItem("nt-sound", "1");
    const { engine, doc, contexts } = setup(storage);
    const seen = vi.fn();
    engine.subscribe(seen);
    expect(engine.state()).toBe("pending");
    // The browser makes the context suspended until a real activation.
    const blocked = vi.fn(() => {
      const c = new FakeAudioContext();
      c.state = "suspended";
      c.resume = () => Promise.resolve();
      contexts.push(c);
      return c as unknown as AudioContext;
    });
    const engine2 = createAudioEngine({ storage, doc, ctx: blocked });
    doc.dispatchEvent(new Event("pointerdown"));
    expect(engine2.state()).toBe("pending");
    // A later gesture that the browser accepts: the clock runs and subscribers hear about it.
    const seen2 = vi.fn();
    engine2.subscribe(seen2);
    contexts[contexts.length - 1].resume = FakeAudioContext.prototype.resume;
    engine2.setEnabled(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(engine2.state()).toBe("on");
    expect(seen2).toHaveBeenCalled();
    // The first engine gets going on its gesture too.
    doc.dispatchEvent(new Event("keydown"));
    expect(engine.state()).toBe("on");
  });

  it("leaves a press on the sound toggle itself to the toggle (it would otherwise read as 'off')", () => {
    const storage = memoryStorage();
    storage.setItem("nt-sound", "1");
    const { engine, doc, ctx } = setup(storage);
    const button = document.createElement("button");
    button.setAttribute("data-sound-toggle", "");
    const glyph = button.appendChild(document.createElement("span"));
    const press = new Event("pointerdown");
    Object.defineProperty(press, "target", { value: glyph });
    doc.dispatchEvent(press);
    expect(ctx).not.toHaveBeenCalled();
    expect(engine.state()).toBe("pending");
    // Anywhere else on the page still starts it.
    doc.dispatchEvent(new Event("pointerdown"));
    expect(engine.state()).toBe("on");
  });

  it("is plainly off by default and on once enabled from a click", () => {
    const { engine } = setup();
    expect(engine.state()).toBe("off");
    engine.setEnabled(true);
    expect(engine.state()).toBe("on");
  });

  // Task 13: where an AudioContext can't be made, the toggle must not stay pressed and silent.
  it("stays off (and usable) when the AudioContext cannot be created", () => {
    const storage = memoryStorage();
    let fail = true;
    const ctx = vi.fn(() => {
      if (fail) throw new Error("no audio hardware");
      return new FakeAudioContext() as unknown as AudioContext;
    });
    const engine = createAudioEngine({ storage, doc: fakeDocument(), ctx });
    const seen = vi.fn();
    engine.subscribe(seen);
    expect(() => engine.setEnabled(true)).not.toThrow();
    expect(engine.enabled()).toBe(false);
    expect(engine.state()).toBe("off");
    expect(storage.getItem("nt-sound")).toBeNull();
    // Usable: a later click tries again and works.
    fail = false;
    engine.setEnabled(true);
    expect(engine.enabled()).toBe(true);
    expect(seen).toHaveBeenCalled();
  });

  it("drops a remembered 'on' back to off when the first gesture can't create audio", () => {
    const storage = memoryStorage();
    storage.setItem("nt-sound", "1");
    const doc = fakeDocument();
    const engine = createAudioEngine({
      storage,
      doc,
      ctx: () => {
        throw new Error("no audio hardware");
      },
    });
    expect(engine.enabled()).toBe(true);
    doc.dispatchEvent(new Event("pointerdown"));
    expect(engine.enabled()).toBe(false);
    expect(engine.state()).toBe("off");
  });

  // Review Focus 5: a hidden tab goes quiet; it comes back only if sound is still on.
  it("fades out while the tab is hidden and back in on return", () => {
    const { engine, doc, contexts } = setup();
    engine.setEnabled(true);
    const master = contexts[0].master();
    const on = master.gain.value;
    setHidden(doc, true);
    expect(master.gain.value).toBe(0);
    vi.advanceTimersByTime(700);
    expect(contexts[0].state).toBe("suspended");
    setHidden(doc, false);
    expect(contexts[0].state).toBe("running");
    expect(master.gain.value).toBe(on);
  });

  it("stays silent on return if sound was switched off while hidden", () => {
    const { engine, doc, contexts } = setup();
    engine.setEnabled(true);
    const master = contexts[0].master();
    setHidden(doc, true);
    engine.setEnabled(false);
    setHidden(doc, false);
    expect(master.gain.value).toBe(0);
    vi.advanceTimersByTime(700);
    expect(contexts[0].state).toBe("suspended");
  });

  it("enabling while the tab is hidden waits for the tab to show", () => {
    const { engine, doc, contexts } = setup();
    engine.setEnabled(true);
    setHidden(doc, true);
    engine.setEnabled(false);
    engine.setEnabled(true);
    expect(contexts[0].master().gain.value).toBe(0);
    setHidden(doc, false);
    expect(contexts[0].master().gain.value).toBeGreaterThan(0);
  });

  it("chime, tap, rustle and stamp make no sound sources while disabled", () => {
    const { engine, contexts } = setup();
    // Never enabled: no context at all, and nothing throws.
    engine.chime();
    engine.tap();
    engine.rustle();
    engine.stamp();
    expect(contexts).toHaveLength(0);
    // Enabled then disabled: the context exists but no new sources are made.
    engine.setEnabled(true);
    engine.setEnabled(false);
    const before = contexts[0].sourceCount;
    engine.chime();
    engine.tap();
    engine.rustle();
    engine.stamp();
    expect(contexts[0].sourceCount).toBe(before);
  });

  it("chime, tap, rustle and stamp make sound sources while enabled", () => {
    const { engine, contexts } = setup();
    engine.setEnabled(true);
    let before = contexts[0].sourceCount;
    engine.chime();
    expect(contexts[0].sourceCount).toBeGreaterThan(before);
    before = contexts[0].sourceCount;
    engine.tap();
    expect(contexts[0].sourceCount).toBeGreaterThan(before);
    before = contexts[0].sourceCount;
    engine.rustle();
    expect(contexts[0].sourceCount).toBeGreaterThan(before);
    before = contexts[0].sourceCount;
    engine.stamp();
    expect(contexts[0].sourceCount).toBeGreaterThan(before);
  });

  it("never schedules before time 0 when sound starts on a fresh audio clock (drum timing slop)", () => {
    // Math.random() = 0: every drum hits, each nudged the full slop EARLY, at audio time 0.
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { engine } = setup();
    expect(() => engine.setEnabled(true)).not.toThrow();
    vi.restoreAllMocks();
  });

  // Task 13: a stalled main thread must not cost the music its downbeat: it comes back in on the next bar line.
  it("after a long stall the music re-enters on the next bar line of its own grid", () => {
    const { engine, contexts } = setup();
    engine.setEnabled(true);
    vi.advanceTimersByTime(2000);
    const ctx = contexts[0];
    const bar = (60 / TEMPO.bpm) * 4;
    // The first downbeat was at the clock's start (~0); now the timer starves for 5.5 s.
    vi.setSystemTime(Date.now() + 5500);
    const before = ctx.starts.length;
    const stalledAt = ctx.currentTime;
    vi.advanceTimersByTime(SCHEDULER.intervalMs + bar * 1000);
    const after = ctx.starts.slice(before);
    const nextBar = Math.ceil(stalledAt / bar) * bar;
    expect(after.length).toBeGreaterThan(0);
    // Nothing lands mid-bar before the bar line (drum slop aside), and the downbeat is on it.
    for (const t of after) expect(t).toBeGreaterThanOrEqual(nextBar - TEMPO.humanize - 1e-9);
    expect(after.some((t) => Math.abs(t - nextBar) < 1e-6)).toBe(true);
  });

  it("never queues a stamp on a suspended clock (it can fire from a scroll, with no gesture)", () => {
    const { engine, contexts } = setup();
    engine.setEnabled(true);
    contexts[0].state = "suspended";
    const before = contexts[0].sourceCount;
    engine.stamp();
    expect(contexts[0].sourceCount).toBe(before);
    contexts[0].state = "running";
    engine.stamp();
    expect(contexts[0].sourceCount).toBeGreaterThan(before);
  });

  // Task 14: the ticket printer's dot-matrix chatter (the intro). Fires from a timer, not a gesture.
  it("printChatter is silent while off, and never queued on a suspended clock", () => {
    const { engine, contexts } = setup();
    engine.printChatter(1.75);
    expect(contexts).toHaveLength(0);
    engine.setEnabled(true);
    contexts[0].state = "suspended";
    const before = contexts[0].sourceCount;
    engine.printChatter(1.75);
    expect(contexts[0].sourceCount).toBe(before);
    engine.setEnabled(false);
    contexts[0].state = "running";
    engine.printChatter(1.75);
    expect(contexts[0].sourceCount).toBe(before);
  });

  it("printChatter plays bursts of ticks spread over the given duration, from now", () => {
    const { engine, contexts } = setup();
    engine.setEnabled(true);
    const ctx = contexts[0];
    const now = ctx.currentTime;
    const before = ctx.starts.length;
    engine.printChatter(1.75);
    const ticks = ctx.starts.slice(before);
    expect(ticks.length).toBe(chatterTicks(1.75).length);
    for (const t of ticks) {
      expect(t).toBeGreaterThanOrEqual(now);
      expect(t).toBeLessThanOrEqual(now + 1.75 + 0.05);
    }
    // One burst per line of paper: PRINT.lines groups separated by quiet gaps.
    const gaps = ticks.slice(1).filter((t, i) => t - ticks[i] > PRINT.tick * 1.5);
    expect(gaps).toHaveLength(PRINT.lines - 1);
  });

  // Task 14 fix round: Skip / boarding mid-print must silence the printer at once.
  it("stopChatter fades the chatter out within ~60 ms and stops every queued tick", () => {
    const { engine, contexts } = setup();
    expect(() => engine.stopChatter()).not.toThrow(); // no graph yet: a no-op
    engine.setEnabled(true);
    const ctx = contexts[0];
    engine.printChatter(1.75);
    const now = ctx.currentTime;
    const before = ctx.stops.length;
    engine.stopChatter();
    const stops = ctx.stops.slice(before);
    expect(stops).toHaveLength(chatterTicks(1.75).length);
    for (const t of stops) expect(t).toBeLessThanOrEqual(now + PRINT.cutFade + 0.02);
    // A second stop (nothing in flight) does nothing.
    const after = ctx.stops.length;
    engine.stopChatter();
    expect(ctx.stops.length).toBe(after);
  });

  it("keeps the chatter quiet: softer than the paper tap, and under -14 dBFS at the speakers", () => {
    expect(PRINT.level).toBeLessThanOrEqual(TAP.level);
    // Worst case: two ticks' tails overlapping at full level, through the UI bus and the master.
    const peak = 2 * PRINT.level * MIX.ui * MASTER.level;
    expect(20 * Math.log10(peak)).toBeLessThanOrEqual(-14);
  });

  it("keeps the stamp cue a soft, low thunk (never louder or brighter than the paper tap)", () => {
    expect(STAMP.level + STAMP.bodyLevel).toBeLessThanOrEqual(TAP.level + TAP.bodyLevel);
    expect(STAMP.lowpass).toBeLessThanOrEqual(TAP.lowpass);
    expect(STAMP.bodyFreq).toBeLessThan(TAP.bodyFreq);
  });

  it("accepts scene values before and after the context exists", () => {
    const { engine } = setup();
    expect(() => {
      engine.setTravelSpeed(0.7);
      engine.setRain(0.4);
      engine.setTunnel(1);
      engine.setEnabled(true);
      engine.setTravelSpeed(2); // out of range: clamped, not thrown
      engine.setRain(-1);
      engine.setTunnel(0.5);
    }).not.toThrow();
  });

  it("tells subscribers when the on/off state changes", () => {
    const { engine } = setup();
    const fn = vi.fn();
    const off = engine.subscribe(fn);
    engine.setEnabled(true);
    engine.setEnabled(true); // no change, no call
    engine.setEnabled(false);
    expect(fn).toHaveBeenCalledTimes(2);
    off();
    engine.setEnabled(true);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("dispose closes the context and stops listening to the document", () => {
    const { engine, doc, contexts } = setup();
    engine.setEnabled(true);
    engine.dispose();
    expect(contexts[0].state).toBe("closed");
    expect(() => setHidden(doc, true)).not.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });
});
