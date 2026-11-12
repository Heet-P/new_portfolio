import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRide } from "./rideStore";
import { ModeToggle } from "./ModeToggle";
import * as mode from "./mode";
import { resetWebglMemo } from "./webgl";
import { useInitialMode } from "./useInitialMode";

// Vitest globals are off, so Testing Library cannot auto-clean between tests.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

beforeEach(() => {
  resetWebglMemo();
  useRide.setState({ mode: "express" });
  vi.spyOn(mode, "detectWebGL").mockReturnValue(true);
});

describe("ModeToggle", () => {
  it("offers the ride from express mode with an explicit name and no aria-pressed", () => {
    render(<ModeToggle />);
    const btn = screen.getByRole("button", { name: "Ride the train: switch to the 3D train ride" });
    expect(btn.textContent).toBe("Ride the train");
    expect(btn.hasAttribute("aria-pressed")).toBe(false);
  });

  it("offers Express from ride mode with an explicit name and no aria-pressed", () => {
    useRide.setState({ mode: "ride" });
    render(<ModeToggle />);
    const btn = screen.getByRole("button", { name: "Express: switch to the plain Express page" });
    expect(btn.textContent).toBe("Express");
    expect(btn.hasAttribute("aria-pressed")).toBe(false);
  });

  it("switches mode and persists the choice on click", () => {
    render(<ModeToggle />);
    fireEvent.click(screen.getByRole("button", { name: /^Ride the train/ }));
    expect(useRide.getState().mode).toBe("ride");
    expect(window.localStorage.getItem("nt-mode")).toBe("ride");
    fireEvent.click(screen.getByRole("button", { name: /^Express/ }));
    expect(useRide.getState().mode).toBe("express");
    expect(window.localStorage.getItem("nt-mode")).toBe("express");
  });

  it("probes WebGL only once across toggle and hook", () => {
    const spy = vi.spyOn(mode, "detectWebGL").mockReturnValue(true);
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never;
    function Both() {
      useInitialMode();
      return <ModeToggle />;
    }
    render(<Both />);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("is hidden when WebGL is unavailable", () => {
    vi.spyOn(mode, "detectWebGL").mockReturnValue(false);
    const { container } = render(<ModeToggle />);
    expect(container.querySelector("button")).toBeNull();
  });
});

describe("useInitialMode", () => {
  function Probe() {
    useInitialMode();
    return null;
  }

  function stubReducedMotion(matches: boolean) {
    window.matchMedia = vi.fn().mockReturnValue({ matches }) as never;
  }

  it("sets ride on a capable device with no preferences", () => {
    stubReducedMotion(false);
    act(() => void render(<Probe />));
    expect(useRide.getState().mode).toBe("ride");
  });

  it("sets express for reduced motion", () => {
    stubReducedMotion(true);
    act(() => void render(<Probe />));
    expect(useRide.getState().mode).toBe("express");
  });

  it("restores a saved choice over reduced motion", () => {
    stubReducedMotion(true);
    window.localStorage.setItem("nt-mode", "ride");
    act(() => void render(<Probe />));
    expect(useRide.getState().mode).toBe("ride");
  });
});
