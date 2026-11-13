import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { PROFILE, STATIONS, type StationId } from "@/content/route";
import { Clipping } from "./Clipping";
import { formatDateline, FrontPage, nextStopLabel } from "./FrontPage";

// Vitest globals are off, so Testing Library cannot auto-clean between tests.
afterEach(cleanup);

const at = (id: StationId) => {
  const index = STATIONS.findIndex((s) => s.id === id);
  return { station: STATIONS[index], index };
};

describe("FrontPage (cabin page)", () => {
  it("prints the masthead, headline, deck and At a Glance box for a project", () => {
    const { container } = render(<FrontPage {...at("vaani")} />);
    expect(screen.getByText("The Project Post")).toBeTruthy();
    expect(screen.getByText("Vol. III, No. 2")).toBeTruthy();
    expect(screen.getByText("Sep 2026")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Vaani AI" })).toBeTruthy();
    expect(screen.getByText("An AI sales agent that picks up the phone.")).toBeTruthy();
    const glance = screen.getByRole("list", { name: "At a Glance" });
    const items = within(glance).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toContain("383 ms");
    expect(items[0].textContent).toContain("voice response");
    // The brush underline is decoration only.
    expect(container.querySelector("h2 svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("prints the project's stack as stamped chips and its GitHub link as an action", () => {
    render(<FrontPage {...at("vaani")} />);
    expect(within(screen.getByRole("list", { name: "Stack" })).getByText("Twilio")).toBeTruthy();
    const github = screen.getByRole("link", { name: "GitHub" });
    expect(github.getAttribute("href")).toBe("https://github.com/Heet-P/Vaani-AI");
    expect(github.getAttribute("target")).toBe("_blank");
    expect(github.getAttribute("rel")).toMatch(/noopener/);
  });

  it("names the next stop sensibly, even when the next station is called 'Next stop'", () => {
    render(<FrontPage {...at("experience")} />);
    expect(screen.getByText("Next stop: Situations Wanted")).toBeTruthy();
    expect(screen.queryByText(/next stop:? next stop/i)).toBeNull();
  });

  it("files Work Experience under Business", () => {
    render(<FrontPage {...at("experience")} />);
    expect(screen.getByText("Business")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Work Experience" })).toBeTruthy();
  });

  it("runs Departure as a Special Edition about Heet", () => {
    render(<FrontPage {...at("departure")} />);
    expect(screen.getByText("Special Edition")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: PROFILE.name })).toBeTruthy();
    expect(screen.getByText(PROFILE.role)).toBeTruthy();
    expect(screen.getByRole("link", { name: "GitHub" }).getAttribute("href")).toBe(PROFILE.github);
    expect(screen.getByRole("link", { name: "LinkedIn" }).getAttribute("href")).toBe(PROFILE.linkedin);
    expect(screen.getByRole("link", { name: /resume/i }).hasAttribute("download")).toBe(true);
  });

  it("runs the open Next stop as a Situations Wanted ad", () => {
    render(<FrontPage {...at("next")} />);
    expect(screen.getByText("Situations Wanted")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Next stop: your team?" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Email me" }).getAttribute("href")).toBe(`mailto:${PROFILE.email}`);
    expect(screen.getByRole("link", { name: "LinkedIn" })).toBeTruthy();
  });

  it("runs the Terminus as classifieds: contact, the resume ticket and the credits", () => {
    render(<FrontPage {...at("terminus")} />);
    expect(screen.getByText("Classifieds")).toBeTruthy();
    expect(screen.getByRole("link", { name: /email/i }).getAttribute("href")).toBe(`mailto:${PROFILE.email}`);
    const ticket = screen.getByRole("link", { name: /resume/i });
    expect(ticket.getAttribute("href")).toBe(PROFILE.resume);
    expect(ticket.hasAttribute("download")).toBe(true);
    expect(screen.getByRole("link", { name: /Subway_\[interior\]/ }).getAttribute("href")).toBe(
      "https://sketchfab.com/3d-models/subway-interior-b7f25426ac674a9291ba092fb9fe8406",
    );
    expect(screen.getByText(/TurboSquid/)).toBeTruthy();
  });
});

describe("FrontPage (Express article and lead)", () => {
  it("drops the nameplate for an article and keeps a dateline kicker instead", () => {
    render(<FrontPage {...at("vaani")} variant="article" />);
    expect(screen.queryByText("The Project Post")).toBeNull();
    expect(screen.getByText(/No\. 2/)).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Vaani AI" })).toBeTruthy();
  });

  it("puts Heet's name in the lead's h1", () => {
    render(<FrontPage {...at("departure")} variant="lead" />);
    expect(screen.getByRole("heading", { level: 1, name: PROFILE.name })).toBeTruthy();
  });

  it("stamps the current and the upcoming stop", () => {
    const { container: solar } = render(<FrontPage {...at("solar")} variant="article" />);
    expect(solar.querySelector("[data-status='current']")?.textContent).toMatch(/current stop/i);
    cleanup();
    const { container: next } = render(<FrontPage {...at("next")} variant="article" />);
    expect(next.querySelector("[data-status='upcoming']")).not.toBeNull();
  });
});

describe("Clipping", () => {
  it("serves the station's illustration responsively and lazily, with a real description", () => {
    render(<Clipping id="sahara" />);
    const img = screen.getByRole("img");
    expect(img.getAttribute("src")).toBe("/illustrations/sahara.webp");
    expect(img.getAttribute("srcset")).toContain("/illustrations/sahara-600.webp 600w");
    expect(img.getAttribute("srcset")).toContain("/illustrations/sahara.webp 1200w");
    expect(img.getAttribute("sizes")).toBeTruthy();
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(img.getAttribute("decoding")).toBe("async");
    expect(img.getAttribute("width")).toBe("1200");
    expect(img.getAttribute("height")).toBe("800");
    expect((img.getAttribute("alt") ?? "").length).toBeGreaterThan(20);
  });

  // Task 13: above-the-fold art must not wait for lazy-loading (LCP on the Express, the cabin page).
  it("loads eagerly at high priority for the Express lead, eagerly in the cabin, lazily elsewhere", () => {
    const { container: lead } = render(<FrontPage {...at("departure")} variant="lead" />);
    const leadImg = lead.querySelector("img")!;
    expect(leadImg.getAttribute("loading")).toBe("eager");
    expect(leadImg.getAttribute("fetchpriority")).toBe("high");
    cleanup();
    const { container: cabin } = render(<FrontPage {...at("vaani")} variant="page" />);
    expect(cabin.querySelector("img")!.getAttribute("loading")).toBe("eager");
    expect(cabin.querySelector("img")!.getAttribute("fetchpriority")).toBeNull();
    cleanup();
    const { container: article } = render(<FrontPage {...at("vaani")} variant="article" />);
    expect(article.querySelector("img")!.getAttribute("loading")).toBe("lazy");
  });

  it("falls back to an ink ornament when a station has no illustration", () => {
    render(<Clipping id={"nowhere" as StationId} />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByTestId("ornament")).toBeTruthy();
  });

  it("falls back to the ornament when the image fails to load", () => {
    render(<Clipping id="vaani" />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByTestId("ornament")).toBeTruthy();
  });
});

describe("datelines", () => {
  it("prints station dates like a newspaper", () => {
    expect(formatDateline("09/2026")).toBe("Sep 2026");
    expect(formatDateline("09/2026 - Present")).toBe("Sep 2026 – Present");
    expect(formatDateline("05/2026 - 06/2026")).toBe("May – Jun 2026");
    expect(formatDateline("2026")).toBe("2026");
    expect(formatDateline(undefined)).toBe("Nov 2026");
  });

  it("calls the open platform 'Situations Wanted' when it is the next stop", () => {
    expect(nextStopLabel(at("next").station)).toBe("Situations Wanted");
    expect(nextStopLabel(at("terminus").station)).toBe("Terminus");
  });
});
