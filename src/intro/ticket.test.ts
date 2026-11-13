import { describe, expect, it } from "vitest";
import { STATIONS } from "@/content/route";
import { memoryStorage, throwingStorage } from "@/sound/fakeAudioContext";
import { chatterTicks } from "@/sound/synth";
import {
  FEED,
  INTRO_SEEN_KEY,
  formatTicketDate,
  markIntroSeen,
  readIntroSeen,
  shouldShowIntro,
  ticketLines,
  ticketStops,
} from "./ticket";

describe("shouldShowIntro", () => {
  const fresh = { mode: "ride", hash: "", seen: false } as const;

  it("shows for a fresh ride that starts at the top (no hash, a bare #, or #departure)", () => {
    expect(shouldShowIntro(fresh)).toBe(true);
    expect(shouldShowIntro({ ...fresh, hash: "#" })).toBe(true);
    expect(shouldShowIntro({ ...fresh, hash: "#departure" })).toBe(true);
  });

  // Express covers no-WebGL and reduced motion without a saved choice (chooseInitialMode).
  it("never shows on Express", () => {
    expect(shouldShowIntro({ ...fresh, mode: "express" })).toBe(false);
  });

  it("never shows for a deep link (a station, or any other hash)", () => {
    for (const hash of ["#vaani", "#sahara", "#terminus", "#nope", "#Departure"]) {
      expect(shouldShowIntro({ ...fresh, hash })).toBe(false);
    }
  });

  it("never shows twice in a session", () => {
    expect(shouldShowIntro({ ...fresh, seen: true })).toBe(false);
  });
});

describe("intro seen flag", () => {
  it("is stored in sessionStorage under nt-intro-seen", () => {
    const storage = memoryStorage();
    expect(INTRO_SEEN_KEY).toBe("nt-intro-seen");
    expect(readIntroSeen(storage)).toBe(false);
    markIntroSeen(storage);
    expect(storage.getItem("nt-intro-seen")).toBe("1");
    expect(readIntroSeen(storage)).toBe(true);
  });

  it("defaults to the real sessionStorage", () => {
    window.sessionStorage.clear();
    expect(readIntroSeen()).toBe(false);
    markIntroSeen();
    expect(window.sessionStorage.getItem(INTRO_SEEN_KEY)).toBe("1");
    expect(readIntroSeen()).toBe(true);
    window.sessionStorage.clear();
  });

  it("never throws when storage is blocked (reads as not seen)", () => {
    expect(() => markIntroSeen(throwingStorage())).not.toThrow();
    expect(readIntroSeen(throwingStorage())).toBe(false);
  });
});

describe("the printed ticket", () => {
  it("lists all 8 stations in ride order", () => {
    expect(ticketStops().map((s) => s.name)).toEqual(STATIONS.map((s) => s.name));
    expect(ticketStops()).toHaveLength(8);
    expect(ticketStops()[0].name).toBe("Departure");
    expect(ticketStops()[7].name).toBe("Terminus");
  });

  it("marks Solar as the current stop and the Next stop as not yet built", () => {
    const stops = ticketStops();
    expect(stops.filter((s) => s.current).map((s) => s.id)).toEqual(["solar"]);
    expect(stops.filter((s) => s.upcoming).map((s) => s.id)).toEqual(["next"]);
  });

  it("formats the date like a ticket punch (day, short month, year)", () => {
    expect(formatTicketDate(new Date(2026, 10, 13))).toBe("13 Nov 2026");
    expect(formatTicketDate(new Date(2027, 0, 2))).toBe("02 Jan 2027");
  });

  it("prints the route, passenger, seat, date, fare and the stamp", () => {
    const text = ticketLines(new Date(2026, 10, 13)).join("\n");
    for (const s of STATIONS) expect(text).toContain(s.name);
    for (const line of ["THE NIGHT TRAIN", "ADMIT ONE", "Visitor", "Window", "13 Nov 2026", "one curious scroll", "VALID FOR ONE JOURNEY"]) {
      expect(text).toContain(line);
    }
  });

  it("never prints the internship company or a phone number", () => {
    const text = ticketLines(new Date(2026, 10, 13)).join("\n");
    expect(text).not.toMatch(/MCT/i);
    // Any run of 8+ digits (spaces, dashes or a leading + allowed) would be a phone number.
    expect(text).not.toMatch(/\+?\d[\d\s-]{6,}\d/);
  });
});

describe("the paper feed", () => {
  it("keeps the reference's stepped keyframes: 20 stops over 1.75 s, ending fully out", () => {
    expect(FEED.seconds).toBe(1.75);
    expect(FEED.transforms).toHaveLength(20);
    expect(FEED.times).toHaveLength(20);
    expect(FEED.times[0]).toBe(0);
    expect(FEED.times[19]).toBe(1);
    expect(FEED.transforms[0]).toBe("translateY(calc(-100% + 2px))");
    expect(FEED.transforms[19]).toBe("translateY(0%)");
  });

  // The printer's chatter must sound only while the paper visibly moves (the odd keyframe spans).
  it("syncs the printer chatter to the moves of the stepped feed", () => {
    const ticks = chatterTicks(FEED.seconds);
    expect(ticks.length).toBeGreaterThan(0);
    const moves = Array.from({ length: 10 }, (_, i) => [FEED.times[2 * i] * FEED.seconds, FEED.times[2 * i + 1] * FEED.seconds]);
    for (const t of ticks) {
      expect(moves.some(([a, b]) => t >= a - 1e-9 && t <= b + 1e-9), `tick at ${t}s`).toBe(true);
    }
    // Every move gets its own burst of chatter.
    for (const [a, b] of moves) expect(ticks.some((t) => t >= a && t <= b)).toBe(true);
  });
});
