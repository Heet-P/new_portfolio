import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { useRide } from "@/ride/rideStore";
import { SceneBoundary } from "./SceneBoundary";

function Boom(): never {
  throw new Error("WebGL context lost");
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  useRide.setState({ mode: "ride" });
  // React logs caught render errors to console.error; keep the test output clean.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("SceneBoundary", () => {
  it("renders its children when nothing throws", () => {
    render(
      <SceneBoundary>
        <p>scene</p>
      </SceneBoundary>,
    );
    expect(screen.getByText("scene")).toBeTruthy();
    expect(useRide.getState().mode).toBe("ride");
  });

  it("a crashing scene drops the visitor into Express instead of blanking the page", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() =>
      render(
        <div>
          <p>sibling</p>
          <SceneBoundary>
            <Boom />
          </SceneBoundary>
        </div>,
      ),
    ).not.toThrow();
    expect(useRide.getState().mode).toBe("express");
    expect(screen.getByText("sibling")).toBeTruthy();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
