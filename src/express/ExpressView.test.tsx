import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { STATIONS } from "@/content/route";
import { ExpressView } from "./ExpressView";
import { StationMedia } from "./StationMedia";

// Vitest globals are off, so Testing Library cannot auto-clean between tests.
afterEach(cleanup);

describe("ExpressView", () => {
  it("renders a section for every station id, in ride order", () => {
    const { container } = render(<ExpressView />);
    const ids = Array.from(container.querySelectorAll("section[id]")).map((s) => s.id);
    expect(ids).toEqual(STATIONS.map((s) => s.id));
  });

  it("is wrapped in #express and keeps the owner's name as the h1", () => {
    const { container } = render(<ExpressView />);
    const root = container.querySelector("#express");
    expect(root).not.toBeNull();
    expect(root?.querySelector("h1")?.textContent).toContain("Heet Parikh");
  });

  it("offers the resume as a real download", () => {
    const { container } = render(<ExpressView />);
    const resume = container.querySelectorAll('a[href="/HeetParikh_Resume.pdf"]');
    expect(resume.length).toBeGreaterThan(0);
    resume.forEach((a) => expect(a.hasAttribute("download")).toBe(true));
  });

  it("opens every external link in a new tab with noopener", () => {
    const { container } = render(<ExpressView />);
    const external = container.querySelectorAll('a[href^="http"]');
    expect(external.length).toBeGreaterThan(0);
    external.forEach((a) => {
      expect(a.getAttribute("target")).toBe("_blank");
      expect(a.getAttribute("rel") ?? "").toContain("noopener");
    });
  });

  it("lists skills in a strip, including Next.js and Python", () => {
    const { getByTestId } = render(<ExpressView />);
    const strip = getByTestId("skills");
    expect(strip.textContent).toContain("Next.js");
    expect(strip.textContent).toContain("Python");
  });

  it("never shows the wrong 300 ms figure anywhere", () => {
    const { container } = render(<ExpressView />);
    expect(container.textContent).not.toMatch(/300\s?ms/);
  });

  it("ships final stat values in static HTML (count-up only enhances after hydration)", () => {
    const html = renderToStaticMarkup(<ExpressView />);
    for (const value of ["383 ms", "0.923", "0.84", "~25%", "200+"]) {
      expect(html).toContain(value);
    }
  });

  it("lists the projects first and Work Experience after them, without naming the company", () => {
    const { container } = render(<ExpressView />);
    const ids = Array.from(container.querySelectorAll("section[id]")).map((s) => s.id);
    expect(ids.indexOf("experience")).toBeGreaterThan(ids.indexOf("sahara"));
    expect(container.querySelector("#experience h2")?.textContent).toBe("Work Experience");
    expect(container.innerHTML).not.toMatch(/MCT/i);
  });

  it("gives SAHARA its GitHub and both demo videos", () => {
    const { container } = render(<ExpressView />);
    const hrefs = Array.from(container.querySelectorAll("#sahara a")).map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("https://github.com/Heet-P/SAHARA_MetaAI");
    expect(hrefs).toContain("https://www.youtube.com/watch?v=foh6WNTnbp0");
    expect(hrefs).toContain("https://youtu.be/sk_WdN6rbXo");
  });

  it("marks the current and upcoming stops distinctly", () => {
    const { container } = render(<ExpressView />);
    expect(container.querySelector("#solar [data-status='current']")).not.toBeNull();
    expect(container.querySelector("#next [data-status='upcoming']")).not.toBeNull();
  });
});

describe("StationMedia", () => {
  it("renders nothing when a station has no media", () => {
    const { container } = render(<StationMedia media={undefined} />);
    expect(container.innerHTML).toBe("");
  });
});
