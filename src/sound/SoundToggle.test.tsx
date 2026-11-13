import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

// A stand-in engine: the toggle only needs on/off, subscribe and tap.
const fake = vi.hoisted(() => {
  let on = false;
  const listeners = new Set<() => void>();
  return {
    enabled: () => on,
    setEnabled: (v: boolean) => {
      on = v;
      listeners.forEach((fn) => fn());
    },
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    tap: () => {},
    reset: () => {
      on = false;
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

  it("follows the engine when it changes elsewhere (e.g. a remembered preference)", () => {
    render(<SoundToggle />);
    act(() => fake.setEnabled(true));
    expect(screen.getByRole("button", { name: "Sound" }).getAttribute("aria-pressed")).toBe("true");
  });
});
