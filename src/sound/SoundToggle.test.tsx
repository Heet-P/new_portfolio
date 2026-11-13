import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

// A stand-in engine: the toggle only needs on/off, subscribe and tap.
const fake = vi.hoisted(() => {
  let on = false;
  /** Whether the browser has let audio start yet (false = a remembered "on" before any gesture). */
  let running = true;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((fn) => fn());
  return {
    enabled: () => on,
    state: () => (!on ? "off" : running ? "on" : "pending"),
    setEnabled: (v: boolean) => {
      on = v;
      running = true;
      notify();
    },
    /** Test hook: a remembered "on" that is still waiting for a gesture. */
    remembered: () => {
      on = true;
      running = false;
      notify();
    },
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    tap: () => {},
    reset: () => {
      on = false;
      running = true;
    },
  };
});
vi.mock("./sound", () => ({ getSound: () => fake }));

import { SoundToggle } from "./SoundToggle";

afterEach(() => {
  cleanup();
  fake.reset();
  vi.restoreAllMocks();
});

describe("SoundToggle", () => {
  it("is a true toggle named Sound, off by default", () => {
    render(<SoundToggle />);
    const btn = screen.getByRole("button", { name: "Sound" });
    expect(btn.getAttribute("aria-pressed")).toBe("false");
  });

  it("turns sound on and off, keeping its label and flipping aria-pressed", () => {
    const set = vi.spyOn(fake, "setEnabled");
    render(<SoundToggle />);
    const btn = screen.getByRole("button", { name: "Sound" });
    fireEvent.click(btn);
    expect(set).toHaveBeenLastCalledWith(true);
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    expect(btn.textContent).toBe("Sound");
    fireEvent.click(btn);
    expect(set).toHaveBeenLastCalledWith(false);
    expect(btn.getAttribute("aria-pressed")).toBe("false");
  });

  // Task 13: a remembered "on" that the browser hasn't let start yet must not look like plain "on".
  it("shows a pending state (pressed, dashed, 'tap to start') until audio is running", () => {
    render(<SoundToggle />);
    act(() => fake.remembered());
    const btn = screen.getByRole("button", { name: "Sound" });
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    expect(btn.hasAttribute("data-pending")).toBe(true);
    expect(btn.getAttribute("aria-describedby")).toBeTruthy();
    expect(document.getElementById(btn.getAttribute("aria-describedby")!)?.textContent).toMatch(/tap to start/i);
    // Tapping it starts the sound (asks for "on" again), it does not switch it off.
    const set = vi.spyOn(fake, "setEnabled");
    fireEvent.click(btn);
    expect(set).toHaveBeenLastCalledWith(true);
    expect(btn.hasAttribute("data-pending")).toBe(false);
    expect(btn.getAttribute("aria-pressed")).toBe("true");
  });

  it("follows the engine when it changes elsewhere (e.g. a remembered preference)", () => {
    render(<SoundToggle />);
    act(() => fake.setEnabled(true));
    expect(screen.getByRole("button", { name: "Sound" }).getAttribute("aria-pressed")).toBe("true");
  });
});
