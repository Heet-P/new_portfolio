import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAudioEngine, SOUND_KEY } from "./audioEngine";
import { FakeAudioContext, fakeDocument, memoryStorage, throwingStorage } from "./fakeAudioContext";
import { STAMP, TAP } from "./soundDesign";

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
