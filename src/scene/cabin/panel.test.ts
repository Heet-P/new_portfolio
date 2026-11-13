import { describe, expect, it } from "vitest";
import { RESIZE_SETTLE, resizeGate } from "./panel";

describe("resizeGate (Task 13: no print/geometry churn while a window is being dragged)", () => {
  it("lets the very first size through at once (nothing built yet)", () => {
    const gate = resizeGate();
    expect(gate(2, 3, 0, false)).toBe(true);
  });

  it("holds a changing size until it has stayed put for the settle time", () => {
    expect(RESIZE_SETTLE).toBeGreaterThanOrEqual(0.15);
    const gate = resizeGate();
    gate(2, 3, 0, false);
    // A window drag: the size changes every frame for half a second.
    let t = 0;
    for (let i = 0; i < 30; i++) {
      t += 1 / 60;
      expect(gate(2 + i * 0.01, 3, t, true)).toBe(false);
    }
    // Then it stops; nothing until RESIZE_SETTLE has passed with the same size.
    const stopped = t;
    t += RESIZE_SETTLE / 2;
    expect(gate(2.29, 3, t, true)).toBe(false);
    t = stopped + RESIZE_SETTLE + 1e-3;
    expect(gate(2.29, 3, t, true)).toBe(true);
  });

  it("an unchanged size is always ready", () => {
    const gate = resizeGate();
    gate(2, 3, 0, false);
    expect(gate(2, 3, 5, true)).toBe(true);
  });
});
