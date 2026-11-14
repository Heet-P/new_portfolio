import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { resetCabin, useCabin } from "./cabinStore";
import { usePaperHint } from "./paperHint";
import { useRide } from "./rideStore";
import { ScrollHint } from "./ScrollHint";

// The intro's open state is the IntroGate's own store; here a plain flag stands in for it.
const intro = vi.hoisted(() => ({ open: false }));
vi.mock("@/intro/IntroGate", () => ({ useIntroOpen: () => intro.open }));

/** Ride mode, parked at Departure, the world drawn: where the hint belongs. */
function parkAtDeparture() {
  useRide.setState({ mode: "ride", progress: 0, target: null, sceneReady: true });
}

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  intro.open = false;
  parkAtDeparture();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  resetCabin();
  usePaperHint.setState({ seen: false });
  useRide.setState({ mode: "express", progress: 0, target: null, sceneReady: false });
});

const status = () => screen.getByRole("status");

describe("ScrollHint", () => {
  it("shows both wordings in one status region at Departure (CSS picks one per pointer)", () => {
    render(<ScrollHint />);
    expect(status().textContent).toContain("Scroll to depart");
    expect(status().textContent).toContain("Swipe up to depart");
  });

  it("stays empty while the intro covers the ride", () => {
    intro.open = true;
    render(<ScrollHint />);
    expect(status().textContent).toBe("");
  });

  it("goes for good after the first wheel: faded, then its text removed, remembered for the session", () => {
    const { rerender } = render(<ScrollHint />);
    act(() => {
      window.dispatchEvent(new WheelEvent("wheel", { deltaY: 40 }));
    });
    expect(status().hasAttribute("data-visible")).toBe(false);
    expect(sessionStorage.getItem("nt-hint-seen")).toBe("1");
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(status().textContent).toBe("");
    // Back at Departure later in the session: still gone.
    rerender(<ScrollHint />);
    expect(status().textContent).toBe("");
  });

  it("goes after a scroll key or a touch drag too", () => {
    render(<ScrollHint />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "PageDown" }));
    });
    expect(sessionStorage.getItem("nt-hint-seen")).toBe("1");
    cleanup();
    sessionStorage.clear();
    render(<ScrollHint />);
    act(() => {
      window.dispatchEvent(new Event("touchmove"));
    });
    expect(sessionStorage.getItem("nt-hint-seen")).toBe("1");
  });

  it("ignores keys that don't scroll (Tab through the page keeps the hint)", () => {
    render(<ScrollHint />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
    });
    expect(status().hasAttribute("data-visible")).toBe(true);
    expect(sessionStorage.getItem("nt-hint-seen")).toBeNull();
  });

  it("is dismissed when the train leaves Departure some other way (a route-map ride)", () => {
    render(<ScrollHint />);
    act(() => useRide.setState({ target: 4 }));
    expect(sessionStorage.getItem("nt-hint-seen")).toBe("1");
  });

  it("never appears for a deep link: landing away from Departure counts as moving on", () => {
    useRide.setState({ progress: 3 / 7 });
    render(<ScrollHint />);
    expect(status().textContent).toBe("");
    expect(sessionStorage.getItem("nt-hint-seen")).toBe("1");
  });

  it("starts hidden when already seen this session", () => {
    sessionStorage.setItem("nt-hint-seen", "1");
    render(<ScrollHint />);
    expect(status().textContent).toBe("");
  });

  // Task 17: one hint at a time. With the paper open and its own cue up, the paper hint wins.
  it("stays away while the open paper shows its own first-time cue, and comes back once that is seen", () => {
    usePaperHint.setState({ seen: false });
    act(() => useCabin.setState({ shown: true, stationIndex: 0 }));
    render(<ScrollHint />);
    expect(status().hasAttribute("data-visible")).toBe(false);
    act(() => usePaperHint.setState({ seen: true }));
    expect(status().hasAttribute("data-visible")).toBe(true);
  });
});
