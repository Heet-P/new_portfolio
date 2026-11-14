import { describe, expect, it } from "vitest";
import { contrast } from "@/newspaper/contrast";
import { memoryStorage, throwingStorage } from "@/sound/fakeAudioContext";
import {
  HINT_SEEN_KEY,
  HINT_TEXT,
  isDeparted,
  markHintSeen,
  markPaperHintSeen,
  PAPER_HINT_SEEN_KEY,
  PAPER_HINT_TEXT,
  readHintSeen,
  readPaperHintSeen,
  shouldShowHint,
  shouldShowPaperHint,
} from "./hint";

/** A visitor sitting at Departure in the ride, intro gone, world drawn, never scrolled. */
const AT_DEPARTURE = { mode: "ride", progress: 0, target: null, seen: false, introOpen: false, sceneReady: true } as const;

describe("shouldShowHint", () => {
  it("shows at Departure in the ride, once the intro is gone and the world is drawn", () => {
    expect(shouldShowHint(AT_DEPARTURE)).toBe(true);
  });

  it("never shows once seen this session", () => {
    expect(shouldShowHint({ ...AT_DEPARTURE, seen: true })).toBe(false);
  });

  it("never shows in Express", () => {
    expect(shouldShowHint({ ...AT_DEPARTURE, mode: "express" })).toBe(false);
  });

  it("waits while the ticket-printer intro covers the ride", () => {
    expect(shouldShowHint({ ...AT_DEPARTURE, introOpen: true })).toBe(false);
  });

  it("waits for the 3D world's first frame (no hint over a blank screen)", () => {
    expect(shouldShowHint({ ...AT_DEPARTURE, sceneReady: false })).toBe(false);
  });

  it("only at Departure: any other stop, or on the way, hides it", () => {
    expect(shouldShowHint({ ...AT_DEPARTURE, progress: 1 / 7 })).toBe(false);
    expect(shouldShowHint({ ...AT_DEPARTURE, progress: 0.02 })).toBe(false);
  });

  it("hides as soon as a route-map ride is under way, even before the train moves", () => {
    expect(shouldShowHint({ ...AT_DEPARTURE, target: 3 })).toBe(false);
  });
});

describe("isDeparted", () => {
  it("is false at rest at Departure and true once the train has moved off it", () => {
    expect(isDeparted(0, null)).toBe(false);
    expect(isDeparted(0.0001, null)).toBe(false);
    expect(isDeparted(0.01, null)).toBe(true);
    expect(isDeparted(0, 2)).toBe(true);
    // Riding back to Departure (target 0) is not departing.
    expect(isDeparted(0, 0)).toBe(false);
  });
});

describe("hint memory (sessionStorage nt-hint-seen)", () => {
  it("reads unseen, remembers, then reads seen", () => {
    const s = memoryStorage();
    expect(HINT_SEEN_KEY).toBe("nt-hint-seen");
    expect(readHintSeen(s)).toBe(false);
    markHintSeen(s);
    expect(s.getItem("nt-hint-seen")).toBe("1");
    expect(readHintSeen(s)).toBe(true);
  });

  it("never throws when storage is blocked (reads as unseen)", () => {
    const s = throwingStorage();
    expect(() => markHintSeen(s)).not.toThrow();
    expect(readHintSeen(s)).toBe(false);
  });
});

describe("hint copy", () => {
  it("says scroll with a mouse and swipe on touch", () => {
    expect(HINT_TEXT.fine).toBe("Scroll to depart");
    expect(HINT_TEXT.coarse).toBe("Swipe up to depart");
  });

  it("red ink on the paper tag passes 4.5:1", () => {
    // --red on --paper-light (globals.css): the tag's text and its background.
    expect(contrast("#b0352b", "#f8f2e2")).toBeGreaterThanOrEqual(4.5);
  });
});

/* ---------- Task 17: the paper's own first-time cue ---------- */

describe("shouldShowPaperHint", () => {
  it("shows on the open paper until seen this session", () => {
    expect(shouldShowPaperHint({ shown: true, seen: false })).toBe(true);
    expect(shouldShowPaperHint({ shown: true, seen: true })).toBe(false);
    expect(shouldShowPaperHint({ shown: false, seen: false })).toBe(false);
  });
});

describe("only one hint at a time", () => {
  it("the paper hint wins: the Departure hint stays away while the paper's own cue is up", () => {
    expect(shouldShowHint({ ...AT_DEPARTURE, paperHint: true })).toBe(false);
    expect(shouldShowHint({ ...AT_DEPARTURE, paperHint: false })).toBe(true);
  });
});

describe("paper hint memory (sessionStorage nt-paper-hint-seen)", () => {
  it("reads unseen, remembers, then reads seen, under its own key", () => {
    const s = memoryStorage();
    expect(PAPER_HINT_SEEN_KEY).toBe("nt-paper-hint-seen");
    expect(readPaperHintSeen(s)).toBe(false);
    markPaperHintSeen(s);
    expect(s.getItem("nt-paper-hint-seen")).toBe("1");
    expect(readPaperHintSeen(s)).toBe(true);
    // Separate from the Departure hint.
    expect(readHintSeen(s)).toBe(false);
  });

  it("never throws when storage is blocked (reads as unseen)", () => {
    const s = throwingStorage();
    expect(() => markPaperHintSeen(s)).not.toThrow();
    expect(readPaperHintSeen(s)).toBe(false);
  });
});

describe("paper hint copy", () => {
  it("says scroll on a desktop and swipe on touch, and that going on rides on", () => {
    expect(PAPER_HINT_TEXT.fine).toBe("Scroll to read · keep scrolling to ride on");
    expect(PAPER_HINT_TEXT.coarse).toBe("Swipe to read · keep swiping to ride on");
  });
});
