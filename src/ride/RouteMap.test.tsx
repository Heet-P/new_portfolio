import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { STATIONS } from "@/content/route";
import { stationToProgress } from "./mapping";
import { useRide } from "./rideStore";
import { RouteMap } from "./RouteMap";

// Vitest globals are off, so Testing Library cannot auto-clean between tests.
afterEach(cleanup);

beforeEach(() => {
  useRide.setState({ mode: "ride", progress: 0, target: null });
});

describe("RouteMap", () => {
  it("renders one button per station, named after the station", () => {
    render(<RouteMap />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(8);
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual(STATIONS.map((s) => s.name));
  });

  it("asks the driver to ride to a station when its button is clicked", () => {
    render(<RouteMap />);
    fireEvent.click(screen.getByRole("button", { name: "Vaani AI" }));
    expect(useRide.getState().target).toBe(1);
  });

  // Review Focus 2: rapid clicks mid-ride retarget; the last click wins.
  it("retargets to the last clicked station on rapid clicks", () => {
    render(<RouteMap />);
    fireEvent.click(screen.getByRole("button", { name: "Vaani AI" }));
    fireEvent.click(screen.getByRole("button", { name: "YieldGuard AI" }));
    expect(useRide.getState().target).toBe(2);
  });

  it("marks only the current station with aria-current=step, following progress", () => {
    render(<RouteMap />);
    expect(screen.getByRole("button", { name: "Departure" }).getAttribute("aria-current")).toBe("step");

    act(() => useRide.getState().setProgress(stationToProgress(2, STATIONS.length)));
    const current = screen.getAllByRole("button").filter((b) => b.hasAttribute("aria-current"));
    expect(current.map((b) => b.getAttribute("aria-label"))).toEqual(["YieldGuard AI"]);
  });

  it("draws the upcoming station dashed", () => {
    render(<RouteMap />);
    const upcoming = STATIONS.filter((s) => s.status === "upcoming").map((s) => s.name);
    expect(upcoming).toEqual(["Next stop"]);
    expect(screen.getByRole("button", { name: "Next stop" }).dataset.upcoming).toBe("true");
    expect(screen.getByRole("button", { name: "Vaani AI" }).dataset.upcoming).toBeUndefined();
  });
});
