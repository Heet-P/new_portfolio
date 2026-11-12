import { describe, expect, it } from "vitest";
import { PROFILE, STATIONS } from "./route";

const byId = (id: string) => STATIONS.find((s) => s.id === id);

describe("route content", () => {
  it("lists every station in ride order", () => {
    expect(STATIONS.map((s) => s.id)).toEqual([
      "departure",
      "mct",
      "vaani",
      "yieldguard",
      "formai",
      "quizzx",
      "solar",
      "next",
      "terminus",
    ]);
  });

  it("uses the resume figure of 383 ms, never 300 ms", () => {
    const json = JSON.stringify(STATIONS);
    expect(json).toContain("383 ms");
    expect(json).not.toMatch(/300\s?ms/);
  });

  it("never leaks the phone number into page content", () => {
    expect(JSON.stringify({ STATIONS, PROFILE })).not.toContain("9227011606");
  });

  it("flags the two flagship projects and the current/upcoming stops", () => {
    expect(byId("vaani")?.flagship).toBe(true);
    expect(byId("yieldguard")?.flagship).toBe(true);
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
