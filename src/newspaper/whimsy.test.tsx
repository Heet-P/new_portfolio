import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { STATIONS, type StationId } from "@/content/route";
import { createAudioEngine } from "@/sound/audioEngine";
import { FakeAudioContext, memoryStorage } from "@/sound/fakeAudioContext";

/*
 * The Express whimsy pass: every playful bit must switch off under reduced motion, stay out
 * of the cabin's copy of the page, and make no sound unless the visitor turned sound on.
 */

// One real engine on a fake AudioContext, so "no sound" means "no AudioContext was ever made".
const audio = vi.hoisted(() => ({ engine: null as unknown as ReturnType<typeof createAudioEngine>, ctx: null as unknown as ReturnType<typeof vi.fn> }));
vi.mock("@/sound/sound", () => ({ getSound: () => audio.engine }));

import { ExpressView } from "@/express/ExpressView";
import { Clipping, MAX_TILT, tiltFor } from "./Clipping";
import { FrontPage } from "./FrontPage";

const at = (id: StationId) => {
  const index = STATIONS.findIndex((s) => s.id === id);
  return { station: STATIONS[index], index };
};

/** jsdom has no matchMedia: answer the two queries the whimsy reads. */
function stubMedia({ reduced, fine }: { reduced: boolean; fine: boolean }) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: query.includes("reduced-motion") ? reduced : query.includes("pointer") ? fine : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as never;
}

/** A controllable IntersectionObserver: tests decide when an article is on screen. */
const observers: { cb: IntersectionObserverCallback; el?: Element }[] = [];
class FakeIO {
  constructor(private cb: IntersectionObserverCallback) {
    observers.push({ cb });
  }
  observe(el: Element) {
    observers[observers.length - 1].el = el;
  }
  disconnect() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
}
function fireIO(el: Element, isIntersecting: boolean) {
  for (const o of observers.filter((o) => o.el === el)) {
    act(() => o.cb([{ isIntersecting, target: el } as IntersectionObserverEntry], {} as IntersectionObserver));
  }
}

beforeEach(() => {
  audio.ctx = vi.fn(() => new FakeAudioContext() as unknown as AudioContext);
  audio.engine = createAudioEngine({ storage: memoryStorage(), doc: document, ctx: audio.ctx as () => AudioContext });
  observers.length = 0;
});

afterEach(() => {
  cleanup();
  audio.engine.dispose();
  vi.unstubAllGlobals();
  // @ts-expect-error: tests put matchMedia back to jsdom's "missing"
  delete window.matchMedia;
});

describe("clipping parallax", () => {
  it("tilts at most 3 degrees toward the pointer, flat in the middle", () => {
    const rect = { left: 0, top: 0, width: 200, height: 100 } as DOMRect;
    expect(MAX_TILT).toBeLessThanOrEqual(3);
    expect(tiltFor(100, 50, rect)).toEqual({ x: 0, y: 0 });
    for (const [px, py] of [
      [0, 0],
      [200, 100],
      [-500, 900], // pointer outside the box (fast flick) still clamps
    ]) {
      const t = tiltFor(px, py, rect);
      expect(Math.abs(t.x)).toBeLessThanOrEqual(3);
      expect(Math.abs(t.y)).toBeLessThanOrEqual(3);
    }
    expect(Math.abs(tiltFor(200, 50, rect).y)).toBe(3);
  });

  it("is on in the Express for a fine pointer", () => {
    stubMedia({ reduced: false, fine: true });
    const { container } = render(<Clipping id="vaani" whimsy />);
    expect(container.querySelector("figure")?.getAttribute("data-parallax")).toBe("on");
  });

  it("is off, and the clipping stays flat, under reduced motion", () => {
    stubMedia({ reduced: true, fine: true });
    const { container } = render(<Clipping id="vaani" whimsy />);
    const figure = container.querySelector("figure")!;
    expect(figure.getAttribute("data-parallax")).toBe("off");
    fireEvent.pointerEnter(figure, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(figure, { clientX: 10, clientY: 10 });
    const tilt = container.querySelector<HTMLElement>("[data-tilt]")!;
    expect(tilt.style.transform).toBe("");
  });

  it("is off on touch screens and in the cabin's copy of the page", () => {
    stubMedia({ reduced: false, fine: false });
    const { container: touch } = render(<Clipping id="vaani" whimsy />);
    expect(touch.querySelector("figure")?.getAttribute("data-parallax")).toBe("off");
    cleanup();
    stubMedia({ reduced: false, fine: true });
    const { container: cabin } = render(<Clipping id="vaani" />);
    expect(cabin.querySelector("figure")?.hasAttribute("data-parallax")).toBe(false);
  });

  it("asks matchMedia once per query, however many clippings and renders", () => {
    stubMedia({ reduced: false, fine: true });
    const { rerender } = render(
      <>
        <Clipping id="vaani" whimsy />
        <Clipping id="solar" whimsy />
      </>,
    );
    rerender(
      <>
        <Clipping id="vaani" whimsy />
        <Clipping id="solar" whimsy />
      </>,
    );
    expect(window.matchMedia).toHaveBeenCalledTimes(2); // reduced motion + fine pointer
  });
});

describe("articles inking in as they scroll into view", () => {
  beforeEach(() => vi.stubGlobal("IntersectionObserver", FakeIO));

  it("waits below the fold, then draws the underline once it arrives", () => {
    stubMedia({ reduced: false, fine: true });
    const { container } = render(<FrontPage {...at("vaani")} variant="article" whimsy />);
    const article = container.querySelector("article")!;
    fireIO(article, false);
    expect(article.getAttribute("data-ink")).toBe("pending");
    fireIO(article, true);
    expect(article.getAttribute("data-ink")).toBe("in");
  });

  it("leaves an article that is already on screen at load alone (no flash)", () => {
    stubMedia({ reduced: false, fine: true });
    const { container } = render(<FrontPage {...at("vaani")} variant="article" whimsy />);
    const article = container.querySelector("article")!;
    fireIO(article, true);
    expect(article.hasAttribute("data-ink")).toBe(false);
  });

  it("never holds anything back under reduced motion (instant, static page)", () => {
    stubMedia({ reduced: true, fine: true });
    const { container } = render(<FrontPage {...at("solar")} variant="article" whimsy />);
    const article = container.querySelector("article")!;
    expect(observers).toHaveLength(0);
    expect(article.hasAttribute("data-ink")).toBe(false);
  });
});

describe("Stop press stamp", () => {
  it("lands only on the current stop's article in the Express", () => {
    const { container } = render(<ExpressView />);
    const stamps = container.querySelectorAll("[data-stop-press]");
    expect(stamps).toHaveLength(1);
    const current = STATIONS.find((s) => s.status === "current")!;
    expect(stamps[0].closest("section")?.id).toBe(current.id);
    // Decoration: the "Current stop" kicker already says it in words.
    expect(stamps[0].getAttribute("aria-hidden")).toBe("true");
  });

  it("is not printed in the cabin's copy of the page", () => {
    const { container } = render(<FrontPage {...at("solar")} />);
    expect(container.querySelector("[data-stop-press]")).toBeNull();
  });
});

describe("ink train in the margin rule", () => {
  it("is decoration in the Express only, parked at the end of the rule by default", () => {
    const { container } = render(<ExpressView />);
    const train = container.querySelector("[data-ink-train]");
    expect(train).not.toBeNull();
    expect(train?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("masthead ka-chunk", () => {
  function nameplate() {
    return screen.getByText("The Project Post");
  }

  it("jolts the masthead when clicked, unless the visitor prefers reduced motion", () => {
    const animate = vi.fn();
    Element.prototype.animate = animate as never;
    stubMedia({ reduced: false, fine: true });
    render(<ExpressView />);
    fireEvent.click(nameplate());
    expect(animate).toHaveBeenCalledTimes(1);
    cleanup();
    animate.mockClear();
    stubMedia({ reduced: true, fine: true });
    render(<ExpressView />);
    fireEvent.click(nameplate());
    expect(animate).not.toHaveBeenCalled();
  });

  it("is a plain nameplate in the cabin (no surprise there)", () => {
    const animate = vi.fn();
    Element.prototype.animate = animate as never;
    stubMedia({ reduced: false, fine: true });
    render(<FrontPage {...at("vaani")} />);
    fireEvent.click(nameplate());
    expect(animate).not.toHaveBeenCalled();
  });
});

describe("resume ticket", () => {
  it("gets punched when it is handed over (clicked)", () => {
    render(<FrontPage {...at("terminus")} variant="article" whimsy />);
    const ticket = screen.getByRole("link", { name: /download resume/i });
    expect(ticket.hasAttribute("data-punched")).toBe(false);
    fireEvent.click(ticket);
    expect(ticket.hasAttribute("data-punched")).toBe(true);
  });
});

describe("ink speckles on flagship stats", () => {
  it("are printed (hidden) by the flagship projects' lead stat only", () => {
    const { container } = render(<ExpressView />);
    for (const s of STATIONS) {
      const speckles = container.querySelectorAll(`#${s.id} [data-speckles]`);
      expect(speckles.length).toBe(s.flagship && s.stats?.length ? 1 : 0);
      speckles.forEach((el) => expect(el.getAttribute("aria-hidden")).toBe("true"));
    }
  });
});

describe("sound", () => {
  /** Every whimsy interaction that can make a sound, in one go. */
  function poke() {
    stubMedia({ reduced: false, fine: true });
    Element.prototype.animate = vi.fn() as never;
    render(<ExpressView />);
    fireEvent.click(screen.getByText("The Project Post"));
    const figure = document.querySelector("#vaani figure")!;
    fireEvent.click(figure);
    fireEvent.click(document.querySelector("#terminus a[download]")!);
    fireEvent.click(document.querySelector("#vaani a[href^='http']")!);
  }

  it("stays silent while sound is off: no AudioContext is ever created", () => {
    vi.useFakeTimers();
    poke();
    vi.advanceTimersByTime(1000);
    vi.useRealTimers();
    expect(audio.engine.enabled()).toBe(false);
    expect(audio.ctx).not.toHaveBeenCalled();
  });

  it("taps, and the masthead ka-chunks, once the visitor turns sound on", () => {
    vi.useFakeTimers();
    audio.engine.setEnabled(true);
    const ctx = audio.ctx.mock.results[0].value as FakeAudioContext;
    const before = ctx.sourceCount;
    poke();
    vi.advanceTimersByTime(1000);
    vi.useRealTimers();
    expect(ctx.sourceCount).toBeGreaterThan(before);
  });

  it("a touch that lands on a clipping (say, to scroll) makes no sound; a click taps", () => {
    audio.engine.setEnabled(true);
    const ctx = audio.ctx.mock.results[0].value as FakeAudioContext;
    stubMedia({ reduced: false, fine: false });
    render(<Clipping id="vaani" whimsy />);
    const figure = document.querySelector("figure")!;
    const before = ctx.sourceCount;
    fireEvent.pointerDown(figure, { pointerType: "touch" });
    fireEvent.pointerUp(figure, { pointerType: "touch" });
    expect(ctx.sourceCount).toBe(before);
    fireEvent.click(figure);
    expect(ctx.sourceCount).toBeGreaterThan(before);
  });
});
