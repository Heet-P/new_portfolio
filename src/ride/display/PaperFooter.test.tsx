import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { STATIONS } from "@/content/route";
import { resetCabin, useCabin } from "../cabinStore";
import { usePaperHint } from "../paperHint";
import { useRide } from "../rideStore";
import { DisplayScreen, OnboardDisplay } from "./OnboardDisplay";

const at = (id: string) => STATIONS.findIndex((s) => s.id === id);
const LAST = STATIONS.length - 1;

/** The stop's front page as the cabin shows it. */
function show(id: string) {
  const i = at(id);
  return render(<DisplayScreen station={STATIONS[i]} index={i} />);
}

const footer = () => within(screen.getByTestId("paper-footer"));
const bar = () => within(screen.getByTestId("paper-bar"));

beforeEach(() => {
  sessionStorage.clear();
  usePaperHint.setState({ seen: false });
  useRide.setState({ target: null });
});

afterEach(() => {
  cleanup();
  resetCabin();
  useRide.setState({ target: null });
});

describe("end-of-page footer", () => {
  it("names the next stop and offers Previous / Next stop at a middle stop", () => {
    show("vaani");
    expect(screen.getByTestId("paper-footer").textContent).toContain("Continued at the next stop: YieldGuard AI");
    expect(footer().getByRole("button", { name: "Previous stop" })).toBeTruthy();
    expect(footer().getByRole("button", { name: "Next stop" })).toBeTruthy();
  });

  it("calls the open platform by its section, as the masthead does", () => {
    show("experience");
    expect(screen.getByTestId("paper-footer").textContent).toContain("Continued at the next stop: Situations Wanted");
  });

  it("has no Previous stop at Departure", () => {
    show("departure");
    expect(footer().queryByRole("button", { name: "Previous stop" })).toBeNull();
    expect(footer().getByRole("button", { name: "Next stop" })).toBeTruthy();
    expect(screen.getByTestId("paper-footer").textContent).toContain("Continued at the next stop: Vaani AI");
  });

  it("is the end of the line at the Terminus, with a way back to Departure", () => {
    show("terminus");
    expect(screen.getByTestId("paper-footer").textContent).toContain("End of the line");
    expect(footer().queryByRole("button", { name: "Next stop" })).toBeNull();
    expect(footer().queryByRole("button", { name: "Previous stop" })).toBeNull();
    fireEvent.click(footer().getByRole("button", { name: "Back to Departure" }));
    expect(useRide.getState().target).toBe(0);
  });

  it("Next stop and Previous stop ride to the neighbouring stops", () => {
    show("vaani");
    fireEvent.click(footer().getByRole("button", { name: "Next stop" }));
    expect(useRide.getState().target).toBe(at("vaani") + 1);
    fireEvent.click(footer().getByRole("button", { name: "Previous stop" }));
    expect(useRide.getState().target).toBe(at("vaani") - 1);
  });

  it("every stop except the Terminus has Next stop; every stop except Departure has a way back", () => {
    STATIONS.forEach((station, i) => {
      const { unmount } = render(<DisplayScreen station={station} index={i} />);
      expect(!!footer().queryByRole("button", { name: "Next stop" }), station.id).toBe(i < LAST);
      expect(!!footer().queryByRole("button", { name: "Previous stop" }), station.id).toBe(i > 0 && i < LAST);
      unmount();
    });
  });
});

describe("phone bar (sticky, inside the display)", () => {
  it("shows the station between Prev and Next stop", () => {
    show("yieldguard");
    expect(screen.getByTestId("paper-bar").textContent).toContain("YieldGuard AI");
    fireEvent.click(bar().getByRole("button", { name: "Next stop" }));
    expect(useRide.getState().target).toBe(at("yieldguard") + 1);
    fireEvent.click(bar().getByRole("button", { name: "Previous stop" }));
    expect(useRide.getState().target).toBe(at("yieldguard") - 1);
  });

  it("has no Prev at Departure and heads back to Departure from the Terminus", () => {
    show("departure");
    expect(bar().queryByRole("button", { name: "Previous stop" })).toBeNull();
    cleanup();
    show("terminus");
    expect(bar().queryByRole("button", { name: "Next stop" })).toBeNull();
    fireEvent.click(bar().getByRole("button", { name: "Back to Departure" }));
    expect(useRide.getState().target).toBe(0);
  });
});

describe("first-time paper hint", () => {
  it("shows both wordings (CSS picks one per pointer) the first time the paper is up", () => {
    show("vaani");
    const hint = screen.getByTestId("paper-hint");
    expect(hint.textContent).toContain("Scroll to read · keep scrolling to ride on");
    expect(hint.textContent).toContain("Swipe to read · keep swiping to ride on");
  });

  it("is not shown once seen this session", () => {
    usePaperHint.setState({ seen: true });
    show("vaani");
    expect(screen.queryByTestId("paper-hint")).toBeNull();
  });

  it("goes for the session once the visitor uses Next stop", () => {
    show("vaani");
    expect(screen.getByTestId("paper-hint").hasAttribute("data-visible")).toBe(true);
    fireEvent.click(footer().getByRole("button", { name: "Next stop" }));
    // Fading out (it leaves the DOM when its fade ends).
    expect(screen.getByTestId("paper-hint").hasAttribute("data-visible")).toBe(false);
    expect(sessionStorage.getItem("nt-paper-hint-seen")).toBe("1");
  });

  it("goes for the session once the visitor scrolls to the bottom of a page", () => {
    const { container } = show("vaani");
    const scroller = container.querySelector<HTMLElement>("[data-paper-scroller]")!;
    // jsdom has no layout: give the scroller a size and scroll it to its end.
    Object.defineProperties(scroller, {
      scrollHeight: { value: 2000, configurable: true },
      clientHeight: { value: 600, configurable: true },
    });
    scroller.scrollTop = 700;
    act(() => {
      fireEvent.scroll(scroller);
    });
    expect(screen.getByTestId("paper-hint").hasAttribute("data-visible")).toBe(true);
    scroller.scrollTop = 1400;
    act(() => {
      fireEvent.scroll(scroller);
    });
    expect(screen.getByTestId("paper-hint").hasAttribute("data-visible")).toBe(false);
    expect(sessionStorage.getItem("nt-paper-hint-seen")).toBe("1");
  });

  it("rides along with the display: none while the train travels", () => {
    render(<OnboardDisplay />);
    expect(screen.queryByTestId("paper-hint")).toBeNull();
    act(() => useCabin.setState({ shown: true, stationIndex: at("solar") }));
    expect(screen.getByTestId("paper-hint")).toBeTruthy();
  });
});
