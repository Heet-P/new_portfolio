import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { PROFILE, STATIONS, type Station } from "@/content/route";
import { resetCabin, useCabin } from "../cabinStore";
import { DisplayScreen, OnboardDisplay } from "./OnboardDisplay";

const VAANI = STATIONS.findIndex((s) => s.id === "vaani");
const TERMINUS = STATIONS.findIndex((s) => s.id === "terminus");

/** Train parked at a station: the scene has settled the camera in front of the display. */
function parkAt(index: number) {
  act(() => useCabin.setState({ shown: true, stationIndex: index }));
}

/** A project with every kind of link, to exercise the primary buttons. */
const WITH_LINKS: Station = {
  ...STATIONS[VAANI],
  links: [
    { label: "Live site", href: "https://vaani.example.app" },
    { label: "Watch demo", href: "https://www.youtube.com/watch?v=abc" },
    { label: "Pitch", href: "https://youtu.be/xyz" },
    { label: "Source", href: "https://github.com/Heet-P/vaani" },
    { label: "Write-up", href: "https://demo.example.app/post" },
  ],
};

afterEach(() => {
  cleanup();
  resetCabin();
});

describe("OnboardDisplay", () => {
  it("shows the Vaani display as a labelled region with its heading", () => {
    render(<OnboardDisplay />);
    parkAt(VAANI);
    const region = screen.getByRole("region", { name: "Vaani AI" });
    expect(within(region).getByRole("heading", { name: "Vaani AI" })).toBeTruthy();
    expect(region.getAttribute("aria-hidden")).toBeNull();
  });

  it("renders no See live / GitHub buttons for a station without such links", () => {
    render(<OnboardDisplay />);
    parkAt(VAANI);
    const region = screen.getByRole("region", { name: "Vaani AI" });
    expect(within(region).queryByRole("link", { name: "See live" })).toBeNull();
    expect(within(region).queryByRole("link", { name: "GitHub" })).toBeNull();
  });

  it("renders See live, every Watch demo and GitHub as new-tab links when the station has them", () => {
    render(<DisplayScreen station={WITH_LINKS} index={VAANI} />);
    const live = screen.getByRole("link", { name: "See live" });
    const demo = screen.getByRole("link", { name: "Watch demo" });
    const demo2 = screen.getByRole("link", { name: "Watch demo 2" });
    const repo = screen.getByRole("link", { name: "GitHub" });
    expect(live.getAttribute("href")).toBe("https://vaani.example.app");
    expect(demo.getAttribute("href")).toBe("https://www.youtube.com/watch?v=abc");
    expect(demo2.getAttribute("href")).toBe("https://youtu.be/xyz"); // by host: the label says "Pitch"
    expect(repo.getAttribute("href")).toBe("https://github.com/Heet-P/vaani"); // by host: the label says "Source"
    for (const a of [live, demo, demo2, repo]) {
      expect(a.getAttribute("target")).toBe("_blank");
      expect(a.getAttribute("rel")).toMatch(/noopener/);
    }
    // Labels decide, not URL text: "Write-up" on a demo.*.app host stays a secondary link.
    expect(screen.getByRole("link", { name: "Write-up" }).getAttribute("href")).toBe("https://demo.example.app/post");
    expect(screen.getAllByRole("link")).toHaveLength(5);
  });

  it("treats a 'demo' label as Watch demo, never as See live", () => {
    const station: Station = { ...STATIONS[VAANI], links: [{ label: "Demo video", href: "https://vaani.example.app/demo" }] };
    render(<DisplayScreen station={station} index={VAANI} />);
    expect(screen.getByRole("link", { name: "Watch demo" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "See live" })).toBeNull();
  });

  it("hands keyboard focus to the route map when the display goes away under it", () => {
    render(
      <>
        <nav aria-label="Route map">
          <button aria-label="Departure">Departure</button>
          <button aria-label="Terminus" aria-current="step">
            Terminus
          </button>
        </nav>
        <OnboardDisplay />
      </>,
    );
    parkAt(TERMINUS);
    const email = screen.getByRole("link", { name: /email/i });
    email.focus();
    expect(document.activeElement).toBe(email);
    act(() => useCabin.setState({ shown: false }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Terminus" }));
  });

  it("shows nothing while the train is travelling", () => {
    const { container } = render(<OnboardDisplay />);
    act(() => useCabin.setState({ shown: false, stationIndex: VAANI }));
    expect(screen.queryByRole("region")).toBeNull();
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    // The (empty) display shell is hidden from assistive tech and the keyboard.
    const shell = container.querySelector("[data-display]");
    expect(shell?.getAttribute("aria-hidden")).toBe("true");
    expect(shell?.hasAttribute("inert")).toBe(true);
  });

  it("hands over the resume as a downloadable ticket at the Terminus", () => {
    render(<OnboardDisplay />);
    parkAt(TERMINUS);
    const region = screen.getByRole("region", { name: "Terminus" });
    const ticket = within(region).getByRole("link", { name: /resume/i });
    expect(ticket.getAttribute("href")).toBe(PROFILE.resume);
    expect(ticket.hasAttribute("download")).toBe(true);
    expect(within(region).getByRole("link", { name: /email/i }).getAttribute("href")).toBe(`mailto:${PROFILE.email}`);
    // Credits for the cabin model live on the last display.
    expect(within(region).getByRole("link", { name: /Subway_\[interior\]/ }).getAttribute("href")).toBe(
      "https://sketchfab.com/3d-models/subway-interior-b7f25426ac674a9291ba092fb9fe8406",
    );
  });

  it("offers GitHub, LinkedIn and the resume at Departure", () => {
    render(<OnboardDisplay />);
    parkAt(0);
    const region = screen.getByRole("region", { name: "Departure" });
    expect(within(region).getByRole("heading", { name: PROFILE.name })).toBeTruthy();
    expect(within(region).getByRole("link", { name: "GitHub" }).getAttribute("href")).toBe(PROFILE.github);
    expect(within(region).getByRole("link", { name: "LinkedIn" }).getAttribute("href")).toBe(PROFILE.linkedin);
    expect(within(region).getByRole("link", { name: /resume/i }).hasAttribute("download")).toBe(true);
  });

  it("invites contact at the open Next stop", () => {
    render(<OnboardDisplay />);
    parkAt(STATIONS.findIndex((s) => s.id === "next"));
    const region = screen.getByRole("region", { name: "Next stop" });
    expect(within(region).getByRole("heading", { name: "Next stop: your team?" })).toBeTruthy();
    expect(within(region).getByRole("link", { name: "Email me" }).getAttribute("href")).toBe(`mailto:${PROFILE.email}`);
    expect(within(region).getByRole("link", { name: "LinkedIn" })).toBeTruthy();
  });
});
