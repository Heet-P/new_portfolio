import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { STATIONS } from "@/content/route";
import { useRide } from "@/ride/rideStore";
import { getSound } from "@/sound/sound";
import { IntroGate } from "./IntroGate";
// Loaded up front so the gate's lazy chunk resolves within a couple of microtasks under fake timers.
import "./Intro";
import { FEED, INTRO_SEEN_KEY } from "./ticket";

const originalMatchMedia = window.matchMedia;

/** A matchMedia that answers prefers-reduced-motion as asked (and "no" to everything else). */
function setReducedMotion(on: boolean) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: on && query.includes("reduce"),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as never;
}

/**
 * Mounts the gate the way the page does (after the initial mode is chosen), beside a stand-in
 * for the ride's route map, then lets the lazily loaded printer chunk resolve.
 */
async function mount({ mode = "ride", hash = "", reduced = false }: { mode?: "ride" | "express"; hash?: string; reduced?: boolean } = {}) {
  useRide.setState({ mode, sceneReady: false, progress: 0, target: null });
  history.replaceState(null, "", hash ? `/${hash}` : "/");
  setReducedMotion(reduced);
  render(
    <>
      {/* Stand-ins for the page around the gate: the (hidden) Express page, the 3D scene, the ride. */}
      <main id="express">
        <h1>Heet Parikh</h1>
      </main>
      <div data-testid="ride-scene" />
      <nav aria-label="Route map">
        <button type="button" aria-current="step">
          Departure
        </button>
      </nav>
      <IntroGate />
    </>,
  );
  await act(async () => {});
  await act(async () => {});
}

/** Moves the fake clock on, inside act so React applies the resulting state changes. */
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

const status = () => screen.getByRole("status");
const routeMap = () => screen.getByRole("navigation", { hidden: true });
/** Every page element beside the gate that the dialog would make inert. */
const inertCount = () => document.querySelectorAll("[inert]").length;
const dialog = () => screen.queryByRole("dialog", { name: "Your ticket" });

beforeEach(() => {
  vi.useFakeTimers();
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.matchMedia = originalMatchMedia;
  window.sessionStorage.clear();
  history.replaceState(null, "", "/");
});

describe("IntroGate: when the ticket printer shows", () => {
  it("shows nothing when the visitor starts in Express", async () => {
    await mount({ mode: "express" });
    expect(dialog()).toBeNull();
  });

  it("shows nothing for a deep link", async () => {
    await mount({ hash: "#sahara" });
    expect(dialog()).toBeNull();
  });

  it("shows nothing once seen this session", async () => {
    window.sessionStorage.setItem(INTRO_SEEN_KEY, "1");
    await mount();
    expect(dialog()).toBeNull();
  });

  it("shows for a fresh ride at #departure too", async () => {
    await mount({ hash: "#departure" });
    expect(dialog()).not.toBeNull();
  });
});

describe("IntroGate: the ticket printer", () => {
  it("is a modal dialog with the machine, its screen and a polite status; the page behind is inert", async () => {
    await mount();
    const d = dialog()!;
    expect(d.getAttribute("aria-modal")).toBe("true");
    expect(within(d).getByText("Night Train")).toBeTruthy();
    expect(d.textContent).toContain("DEPARTURE → TERMINUS");
    expect(d.textContent).toContain("Passenger: Visitor");
    expect(d.textContent).toContain("Fare: one curious scroll");
    expect(status().getAttribute("aria-live")).toBe("polite");
    expect(status().textContent).toContain("Checking the timetable…");
    expect(screen.getByRole("navigation", { hidden: true }).closest("[inert]")).not.toBeNull();
    // Before the ticket is ready only Skip is offered.
    expect(within(d).getByRole("button", { name: "Skip" })).toBeTruthy();
    expect(within(d).queryByRole("button", { name: "Take the journey" })).toBeNull();
  });

  it("prints once the scene is ready and 1.2 s have passed, then completes after the feed", async () => {
    await mount();
    act(() => useRide.setState({ sceneReady: true }));
    await advance(1199);
    expect(status().textContent).toContain("Checking the timetable…");
    await advance(1);
    expect(status().textContent).toContain("Printing your ticket…");
    await advance(FEED.seconds * 1000 - 1);
    expect(status().textContent).not.toContain("Ticket ready");
    await advance(200);
    expect(status().textContent).toContain("Ticket ready — all aboard");
    const take = screen.getByRole("button", { name: "Take the journey" });
    expect(document.activeElement).toBe(take);
    expect(screen.queryByRole("button", { name: "Skip" })).toBeNull();
  });

  it("waits for a slow scene, but never longer than 4 s before printing", async () => {
    await mount();
    await advance(3999);
    expect(status().textContent).toContain("Checking the timetable…");
    await advance(1);
    expect(status().textContent).toContain("Printing your ticket…");
  });

  it("starts printing as soon as a slow scene is ready (between 1.2 s and 4 s)", async () => {
    await mount();
    await advance(2500);
    expect(status().textContent).toContain("Checking the timetable…");
    act(() => useRide.setState({ sceneReady: true }));
    expect(status().textContent).toContain("Printing your ticket…");
  });

  it("prints the whole route on the ticket as real text", async () => {
    await mount({ reduced: true });
    const route = within(dialog()!).getByRole("list", { name: "Route" });
    const items = within(route).getAllByRole("listitem").map((li) => li.textContent);
    expect(items).toHaveLength(8);
    STATIONS.forEach((s, i) => expect(items[i]).toContain(s.name));
    expect(items[3]).toContain("current stop");
  });

  it("Skip jumps straight to the finished ticket", async () => {
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(status().textContent).toContain("Ticket ready — all aboard");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Take the journey" }));
  });

  it("'Take the journey' boards: the gate leaves, the visit is remembered and focus goes to the ride", async () => {
    const tap = vi.spyOn(getSound(), "tap");
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    fireEvent.click(screen.getByRole("button", { name: "Take the journey" }));
    expect(tap).toHaveBeenCalled();
    expect(window.sessionStorage.getItem(INTRO_SEEN_KEY)).toBe("1");
    // The ride is usable at once (inert lifted, focus on the current stop) while the ticket slides away.
    const stop = screen.getByRole("button", { name: "Departure" });
    expect(stop.closest("[inert]")).toBeNull();
    expect(document.activeElement).toBe(stop);
    await advance(400);
    expect(dialog()).toBeNull();
    expect(useRide.getState().mode).toBe("ride");
  });

  it("Escape boards too", async () => {
    await mount();
    expect(inertCount()).toBeGreaterThan(0);
    fireEvent.keyDown(dialog()!, { key: "Escape" });
    expect(window.sessionStorage.getItem(INTRO_SEEN_KEY)).toBe("1");
    expect(inertCount()).toBe(0);
    await advance(400);
    expect(dialog()).toBeNull();
    expect(inertCount()).toBe(0);
  });

  it("nothing is left inert or hidden if the page unmounts it mid-print", async () => {
    await mount();
    expect(inertCount()).toBeGreaterThan(0);
    cleanup();
    expect(inertCount()).toBe(0);
  });

  // Fix round: behind the night only the 3D world shows (no lit cabin display or newspaper).
  it("hides the ride's own UI behind the dialog (the 3D scene stays), and shows it again on boarding", async () => {
    await mount();
    expect(routeMap().style.visibility).toBe("hidden");
    expect(screen.getByTestId("ride-scene").style.visibility).toBe("");
    fireEvent.keyDown(dialog()!, { key: "Escape" });
    expect(routeMap().style.visibility).toBe("");
  });

  it("silences the printer at once on Skip, Escape and boarding", async () => {
    const stop = vi.spyOn(getSound(), "stopChatter");
    await mount();
    act(() => useRide.setState({ sceneReady: true }));
    await advance(1300);
    expect(status().textContent).toContain("Printing your ticket…");
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(stop).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(dialog()!, { key: "Escape" });
    expect(stop).toHaveBeenCalledTimes(2);
  });

  it("Skip lets the rest of the paper out quickly instead of the full 1.75 s glide", async () => {
    await mount();
    act(() => useRide.setState({ sceneReady: true }));
    await advance(1300);
    expect(dialog()!.querySelector("[data-feed]")!.getAttribute("data-feed")).toBe("stepped");
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(dialog()!.querySelector("[data-feed]")!.getAttribute("data-feed")).toBe("fast");
  });

  it("'In a hurry?' switches to Express and remembers the visit", async () => {
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    fireEvent.click(screen.getByRole("button", { name: /^In a hurry\?/ }));
    expect(useRide.getState().mode).toBe("express");
    expect(window.localStorage.getItem("nt-mode")).toBe("express");
    expect(window.sessionStorage.getItem(INTRO_SEEN_KEY)).toBe("1");
    expect(dialog()).toBeNull();
    expect(inertCount()).toBe(0);
    // Focus lands on the Express page's headline, not on <body>.
    await advance(0);
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1 }));
  });

  it("closes if the ride falls back to Express on its own (scene crash)", async () => {
    await mount();
    act(() => useRide.setState({ mode: "express" }));
    expect(dialog()).toBeNull();
    // Coming back to the ride later never replays it.
    act(() => useRide.setState({ mode: "ride" }));
    expect(dialog()).toBeNull();
  });

  it("keeps Tab inside the dialog", async () => {
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    const take = screen.getByRole("button", { name: "Take the journey" });
    const hurry = screen.getByRole("button", { name: /^In a hurry\?/ });
    hurry.focus();
    fireEvent.keyDown(hurry, { key: "Tab" });
    expect(document.activeElement).toBe(take);
    fireEvent.keyDown(take, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(hurry);
  });

  it("with reduced motion, shows the finished ticket at once with 'Take the journey' focused", async () => {
    await mount({ reduced: true });
    expect(status().textContent).toContain("Ticket ready — all aboard");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Take the journey" }));
    fireEvent.click(screen.getByRole("button", { name: "Take the journey" }));
    await advance(0);
    expect(dialog()).toBeNull();
  });
});
