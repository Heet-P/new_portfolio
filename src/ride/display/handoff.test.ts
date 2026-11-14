import { describe, expect, it } from "vitest";
import { ARM, edgesOf, initialHandoff, stepHandoff, type HandoffInput, type HandoffState } from "./handoff";

/** A page parked at a middle stop (both neighbours exist), scrolled somewhere in the middle. */
const BASE: HandoffInput = {
  delta: 0,
  gesture: 1,
  atTop: false,
  atBottom: false,
  canPrev: true,
  canNext: true,
  threshold: ARM.wheel,
};

/** Runs a sequence of inputs from a fresh state; returns every step's result. */
function run(inputs: Partial<HandoffInput>[], from: HandoffState = initialHandoff()) {
  let state = from;
  return inputs.map((i) => {
    const r = stepHandoff(state, { ...BASE, ...i });
    state = r.state;
    return r;
  });
}

describe("edgesOf", () => {
  it("reads the top and the bottom with a pixel of slack (fractional scroll offsets)", () => {
    expect(edgesOf({ scrollTop: 0, scrollHeight: 2000, clientHeight: 600 })).toEqual({ atTop: true, atBottom: false });
    expect(edgesOf({ scrollTop: 700, scrollHeight: 2000, clientHeight: 600 })).toEqual({ atTop: false, atBottom: false });
    expect(edgesOf({ scrollTop: 1399.5, scrollHeight: 2000, clientHeight: 600 })).toEqual({ atTop: false, atBottom: true });
  });

  it("a page that fits is at both edges", () => {
    expect(edgesOf({ scrollTop: 0, scrollHeight: 500, clientHeight: 600 })).toEqual({ atTop: true, atBottom: true });
  });
});

describe("stepHandoff", () => {
  it("while the paper can still scroll that way, the paper takes the input (nothing handed off)", () => {
    const [r] = run([{ delta: 100 }]);
    expect(r.pass).toBe(0);
    expect(r.armedNow).toBe(false);
  });

  it("at the bottom, the first notch only arms; the next gesture hands its scroll to the train", () => {
    const [a, b, c] = run([
      { delta: 100, gesture: 2, atBottom: true },
      { delta: 100, gesture: 3, atBottom: true },
      { delta: 40, gesture: 3, atBottom: true },
    ]);
    expect(a).toMatchObject({ pass: 0, armedNow: true });
    expect(b).toMatchObject({ pass: 100, armedNow: false });
    expect(c.pass).toBe(40);
  });

  it("small inputs add up to the arming threshold", () => {
    const steps = run([
      { delta: 20, atBottom: true, threshold: ARM.touch },
      { delta: 20, atBottom: true, threshold: ARM.touch },
      { delta: 20, atBottom: true, threshold: ARM.touch },
      { delta: 20, atBottom: true, threshold: ARM.touch },
    ]);
    expect(steps.map((s) => s.armedNow)).toEqual([false, false, true, false]);
    expect(steps.map((s) => s.pass)).toEqual([0, 0, 0, 20]);
  });

  it("a flick that scrolls the paper to its bottom never launches the train in that same gesture", () => {
    const steps = run([
      { delta: 300, gesture: 5 }, // reading: the paper scrolls
      { delta: 300, gesture: 5, atBottom: true }, // momentum hits the bottom: arms
      { delta: 300, gesture: 5, atBottom: true }, // more momentum: still the same gesture
      { delta: 300, gesture: 5, atBottom: true },
    ]);
    expect(steps.map((s) => s.pass)).toEqual([0, 0, 0, 0]);
    expect(steps[1].armedNow).toBe(true);
    // A fresh gesture at the bottom rides on.
    const [next] = run([{ delta: 100, gesture: 6, atBottom: true }], steps[3].state);
    expect(next.pass).toBe(100);
  });

  it("is symmetric at the top: scrolling up past it backs the train toward the previous stop", () => {
    const [a, b] = run([
      { delta: -100, gesture: 2, atTop: true },
      { delta: -120, gesture: 3, atTop: true },
    ]);
    expect(a.armedNow).toBe(true);
    expect(b.pass).toBe(-120);
  });

  it("a page that fits on screen arms and hands off within one gesture (no paper scroll to latch to)", () => {
    const [a, b] = run([
      { delta: 100, atTop: true, atBottom: true },
      { delta: 100, atTop: true, atBottom: true },
    ]);
    expect(a.armedNow).toBe(true);
    expect(b.pass).toBe(100);
  });

  it("turning back disarms: the other direction must arm afresh", () => {
    const [, , c, d] = run([
      { delta: 100, gesture: 2, atTop: true, atBottom: true },
      { delta: 100, gesture: 3, atTop: true, atBottom: true },
      { delta: -100, gesture: 4, atTop: true, atBottom: true },
      { delta: -100, gesture: 4, atTop: true, atBottom: true },
    ]);
    expect(c).toMatchObject({ pass: 0, armedNow: true });
    expect(d.pass).toBe(-100);
  });

  it("leaving the edge (scrolling back into the page) disarms", () => {
    const [, , c] = run([
      { delta: 100, gesture: 2, atBottom: true },
      { delta: -50, gesture: 3 }, // back up into the page
      { delta: 100, gesture: 4, atBottom: true },
    ]);
    expect(c).toMatchObject({ pass: 0, armedNow: true });
  });

  it("never arms toward a stop that doesn't exist (Departure's top, the Terminus's bottom)", () => {
    const [a, b] = run([
      { delta: -100, atTop: true, canPrev: false },
      { delta: -100, gesture: 2, atTop: true, canPrev: false },
    ]);
    expect(a).toMatchObject({ pass: 0, armedNow: false });
    expect(b).toMatchObject({ pass: 0, armedNow: false });
    const [c] = run([{ delta: 100, atBottom: true, canNext: false }]);
    expect(c).toMatchObject({ pass: 0, armedNow: false });
  });

  it("a zero delta changes nothing", () => {
    const state = initialHandoff();
    expect(stepHandoff(state, { ...BASE, atBottom: true })).toEqual({ state, pass: 0, armedNow: false });
  });
});
