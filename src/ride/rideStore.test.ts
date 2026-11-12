import { beforeEach, describe, expect, it } from "vitest";
import { STATIONS } from "@/content/route";
import { useRide } from "./rideStore";

const LAST = STATIONS.length - 1;

beforeEach(() => {
  useRide.setState({ mode: "express", progress: 0, target: null });
});

describe("useRide", () => {
  it("starts in express mode at progress 0 with no target", () => {
    const s = useRide.getState();
    expect(s.mode).toBe("express");
    expect(s.progress).toBe(0);
    expect(s.target).toBeNull();
  });

  it("clamps setProgress to 0..1", () => {
    useRide.getState().setProgress(0.4);
    expect(useRide.getState().progress).toBe(0.4);
    useRide.getState().setProgress(-1);
    expect(useRide.getState().progress).toBe(0);
    useRide.getState().setProgress(7);
    expect(useRide.getState().progress).toBe(1);
  });

  it("goTo sets a clamped target without touching progress", () => {
    useRide.getState().setProgress(0.3);
    useRide.getState().goTo(4);
    expect(useRide.getState().target).toBe(4);
    expect(useRide.getState().progress).toBe(0.3);
    useRide.getState().goTo(-3);
    expect(useRide.getState().target).toBe(0);
    useRide.getState().goTo(99);
    expect(useRide.getState().target).toBe(LAST);
  });

  it("setMode switches mode", () => {
    useRide.getState().setMode("ride");
    expect(useRide.getState().mode).toBe("ride");
  });
});
