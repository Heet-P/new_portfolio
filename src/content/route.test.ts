import { describe, expect, it } from "vitest";
import { PROFILE, STATIONS } from "./route";

const byId = (id: string) => STATIONS.find((s) => s.id === id);

describe("route content", () => {
  it("lists every station in ride order", () => {
    expect(STATIONS.map((s) => s.id)).toEqual([
      "departure",
      "vaani",
      "yieldguard",
      "solar",
      "sahara",
      "experience",
      "next",
      "terminus",
    ]);
  });

  it("never names the internship company anywhere in the content", () => {
    expect(JSON.stringify({ STATIONS, PROFILE })).not.toMatch(/MCT/i);
  });

  it("calls the internship station Work Experience, after the projects", () => {
    const exp = byId("experience");
    expect(exp?.name).toBe("Work Experience");
    expect(exp?.kind).toBe("internship");
    expect(exp?.dates).toBe("05/2026 - 06/2026");
    expect(STATIONS.findIndex((s) => s.id === "experience")).toBeGreaterThan(
      STATIONS.findIndex((s) => s.id === "sahara"),
    );
  });

  it("links every project to its GitHub repo", () => {
    const repo = (id: string) => byId(id)?.links?.find((l) => l.label === "GitHub")?.href;
    expect(repo("vaani")).toBe("https://github.com/Heet-P/Vaani-AI");
    expect(repo("yieldguard")).toBe("https://github.com/Heet-P/bob-ai-hackathon-DuckDuckGo");
    expect(repo("solar")).toBe("https://github.com/Heet-P/SGP-II");
    expect(repo("sahara")).toBe("https://github.com/Heet-P/SAHARA_MetaAI");
  });

  it("gives SAHARA two YouTube demo links", () => {
    const demos = byId("sahara")?.links?.filter((l) => /youtu/.test(l.href));
    expect(demos?.map((l) => l.href)).toEqual([
      "https://www.youtube.com/watch?v=foh6WNTnbp0",
      "https://youtu.be/sk_WdN6rbXo",
    ]);
    expect(demos?.map((l) => l.label)).toEqual(["Demo video", "Demo video 2"]);
  });

  it("keeps the Techathon award at Departure although FormAI is no longer a station", () => {
    expect(JSON.stringify(byId("departure"))).toMatch(/Techathon/);
    expect(JSON.stringify(byId("departure"))).toMatch(/FormAI/);
  });

  it("uses the resume figure of 383 ms, never 300 ms", () => {
    const json = JSON.stringify(STATIONS);
    expect(json).toContain("383 ms");
    expect(json).not.toMatch(/300\s?ms/);
  });

  it("never leaks the phone number into page content", () => {
    expect(JSON.stringify({ STATIONS, PROFILE })).not.toContain("9227011606");
  });

  it("flags the flagship projects and the current/upcoming stops", () => {
    expect(byId("vaani")?.flagship).toBe(true);
    expect(byId("yieldguard")?.flagship).toBe(true);
    expect(byId("sahara")?.flagship).toBe(true);
    expect(byId("solar")?.status).toBe("current");
    expect(byId("next")?.status).toBe("upcoming");
  });

  it("exposes the public profile links", () => {
    expect(PROFILE.github).toBe("https://github.com/Heet-P");
    expect(PROFILE.linkedin).toBe("https://www.linkedin.com/in/heetparikh/");
    expect(PROFILE.resume).toBe("/HeetParikh_Resume.pdf");
    expect(PROFILE.email).toBe("heet16@gmail.com");
  });
});
