import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

// Every component reports through track(); here it is a spy, so we see exactly what would be sent.
const spy = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock("./track", () => spy);

// A silent stand-in for the sound engine (these tests are about analytics, not audio).
const sound = vi.hoisted(() => {
  const noop = () => {};
  return {
    state: () => "off",
    enabled: () => false,
    subscribe: () => noop,
    setEnabled: noop,
    tap: noop,
    stopChatter: noop,
    printChatter: noop,
    chime: noop,
    tear: noop,
  };
});
vi.mock("@/sound/sound", () => ({ getSound: () => sound }));

import { PROFILE, STATIONS, type StationId } from "@/content/route";
import { IntroGate } from "@/intro/IntroGate";
import "@/intro/Intro";
import { FrontPage } from "@/newspaper/FrontPage";
import { resetCabin, useCabin } from "@/ride/cabinStore";
import { DisplayScreen, OnboardDisplay } from "@/ride/display/OnboardDisplay";
import { ModeToggle } from "@/ride/ModeToggle";
import { resetWebglMemo } from "@/ride/webgl";
import * as mode from "@/ride/mode";
import { RouteMap } from "@/ride/RouteMap";
import { useRide } from "@/ride/rideStore";
import { SoundToggle } from "@/sound/SoundToggle";

const at = (id: StationId) => {
  const index = STATIONS.findIndex((s) => s.id === id);
  return { station: STATIONS[index], index };
};

/** Everything reported so far, as [name, props] pairs. */
const events = () => spy.track.mock.calls.map(([name, props]) => [name, props]);

const originalMatchMedia = window.matchMedia;

beforeEach(() => {
  spy.track.mockClear();
  window.sessionStorage.clear();
  resetWebglMemo!();
  vi.spyOn(mode, "detectWebGL").mockReturnValue(true);
  useRide.setState({ mode: "ride", sceneReady: false, progress: 0, target: null });
});

afterEach(() => {
  cleanup();
  resetCabin();
  vi.restoreAllMocks();
  window.matchMedia = originalMatchMedia;
  window.localStorage.clear();
  history.replaceState(null, "", "/");
});

describe("mode and sound", () => {
  it("reports 'In a hurry?' on the toggle, with the new mode", () => {
    render(<ModeToggle />);
    fireEvent.click(screen.getByRole("button", { name: /^In a hurry?/ }));
    expect(events()).toEqual([
      ["hurry_clicked", { from: "toggle" }],
      ["mode_changed", { mode: "express" }],
    ]);
  });

  it("reports going back to the ride as a mode change only (not a hurry)", () => {
    useRide.setState({ mode: "express" });
    render(<ModeToggle />);
    fireEvent.click(screen.getByRole("button", { name: /^Ride the train/ }));
    expect(events()).toEqual([["mode_changed", { mode: "ride" }]]);
  });

  it("reports the sound switch with its new state", () => {
    render(<SoundToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Sound" }));
    expect(events()).toEqual([["sound_toggled", { on: true }]]);
  });
});

describe("the ride", () => {
  it("reports a route-map jump with the station id", () => {
    render(<RouteMap />);
    fireEvent.click(screen.getByRole("button", { name: "Vaani AI" }));
    expect(events()).toEqual([["route_map_jump", { to: "vaani" }]]);
  });

  it("reports the paper's buttons as hand-offs by button, with their direction", () => {
    const { station, index } = at("vaani");
    render(<DisplayScreen station={station} index={index} />);
    const footer = within(screen.getByTestId("paper-footer"));
    fireEvent.click(footer.getByRole("button", { name: "Next stop" }));
    fireEvent.click(footer.getByRole("button", { name: "Previous stop" }));
    expect(events()).toEqual([
      ["paper_handoff", { direction: "next", via: "button" }],
      ["paper_handoff", { direction: "prev", via: "button" }],
    ]);
  });

  it("reports each station once, when the display settles at it (not while riding past)", () => {
    render(<OnboardDisplay />);
    const settle = (stationIndex: number) => act(() => useCabin.setState({ shown: true, stationIndex }));
    const leave = () => act(() => useCabin.setState({ shown: false }));

    // On its way to another stop (target set): not "reached".
    act(() => useRide.setState({ target: 3 }));
    settle(1);
    expect(events()).toEqual([]);
    leave();

    act(() => useRide.setState({ target: null }));
    settle(1);
    leave();
    settle(1); // the same stop again: still one event
    expect(events()).toEqual([["station_reached", { station_id: "vaani", station_index: 1 }]]);
  });
});

describe("front-page links", () => {
  const click = (name: string | RegExp) => {
    const link = screen.getByRole("link", { name });
    // jsdom cannot navigate; the click handler is all that matters here.
    link.addEventListener("click", (e) => e.preventDefault());
    fireEvent.click(link);
  };

  it("reports a project's GitHub and demo links with the station id", () => {
    render(<FrontPage {...at("sahara")} />);
    click("GitHub");
    click("Watch demo");
    expect(events()).toEqual([
      ["link_clicked", { kind: "github", station_id: "sahara" }],
      ["link_clicked", { kind: "demo", station_id: "sahara" }],
    ]);
  });

  it("reports Departure's contact links by kind and its resume as downloaded from 'departure'", () => {
    render(<FrontPage {...at("departure")} />);
    click("Email");
    click("LinkedIn");
    click("Download resume");
    expect(events()).toEqual([
      ["link_clicked", { kind: "email", station_id: "departure" }],
      ["link_clicked", { kind: "linkedin", station_id: "departure" }],
      ["resume_downloaded", { from: "departure" }],
    ]);
  });

  it("reports the Express resume as 'express' and the clip-out ticket as 'ticket'", () => {
    const { unmount } = render(<FrontPage {...at("departure")} whimsy />);
    click("Download resume");
    unmount();
    render(<FrontPage {...at("terminus")} />);
    click(/Download resume/);
    expect(events()).toEqual([
      ["resume_downloaded", { from: "express" }],
      ["resume_downloaded", { from: "ticket" }],
    ]);
    // Never any personal data: the address itself is not an event property.
    expect(JSON.stringify(events())).not.toContain(PROFILE.email);
  });
});

describe("the ticket-printer intro", () => {
  /** Mounts the gate and lets its lazy chunk resolve. Reduced motion = the finished ticket at once. */
  async function open(reduced: boolean) {
    window.matchMedia = vi.fn((query: string) => ({
      matches: reduced && query.includes("reduce"),
      media: query,
      addEventListener() {},
      removeEventListener() {},
    })) as never;
    render(
      <>
        <main id="express">
          <h1>Heet Parikh</h1>
        </main>
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

  it("reports shown, printed and boarded", async () => {
    await open(true);
    fireEvent.click(screen.getByRole("button", { name: "Take the journey" }));
    expect(events()).toEqual([["intro_shown", undefined], ["ticket_printed", undefined], ["boarded", undefined]]);
  });

  it("reports 'In a hurry?' from the intro, with the mode change", async () => {
    await open(true);
    spy.track.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /In a hurry/ }));
    expect(events()).toEqual([
      ["hurry_clicked", { from: "intro" }],
      ["mode_changed", { mode: "express" }],
    ]);
  });

  it("reports Skip, then the finished ticket", async () => {
    await open(false);
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(events()).toEqual([["intro_shown", undefined], ["intro_skipped", undefined], ["ticket_printed", undefined]]);
  });
});
