import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

// A stand-in SDK: the real one would open network connections.
const posthog = vi.hoisted(() => ({ init: vi.fn(), capture: vi.fn() }));
vi.mock("posthog-js", () => ({ default: posthog }));

import { PostHogInit } from "./PostHogInit";
import { resetAnalytics, track } from "./track";

/** Runs the idle callback straight away, as a browser would once the page is idle. */
const original = window.requestIdleCallback;
beforeEach(() => {
  resetAnalytics();
  window.requestIdleCallback = ((cb: () => void) => {
    cb();
    return 1;
  }) as never;
  window.cancelIdleCallback = () => {};
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  window.requestIdleCallback = original;
});

describe("PostHogInit", () => {
  it("loads nothing without a key", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    render(<PostHogInit />);
    await new Promise((r) => setTimeout(r, 20));
    expect(posthog.init).not.toHaveBeenCalled();
  });

  it("inits cookieless and privacy-first, then flushes events fired before it loaded", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://eu.i.posthog.com");
    track("intro_shown");
    render(<PostHogInit />);
    await vi.waitFor(() => expect(posthog.init).toHaveBeenCalledTimes(1));

    const [key, config] = posthog.init.mock.calls[0];
    expect(key).toBe("phc_test");
    expect(config).toMatchObject({
      api_host: "https://eu.i.posthog.com",
      persistence: "memory",
      autocapture: false,
      capture_pageview: true,
      capture_pageleave: true,
      respect_dnt: true,
      person_profiles: "identified_only",
      disable_session_recording: false,
      session_recording: { maskAllInputs: true, maskTextSelector: "*" },
    });
    // Replay text: station names stay readable, everything else is starred out.
    const { maskTextFn } = config.session_recording;
    expect(maskTextFn("Vaani AI")).toBe("Vaani AI");
    expect(maskTextFn("Call me on 555")).toBe("**** ** ** ***");

    await vi.waitFor(() => expect(posthog.capture).toHaveBeenCalledWith("intro_shown", undefined));
    track("boarded");
    expect(posthog.capture).toHaveBeenLastCalledWith("boarded", undefined);
  });

  it("falls back to the built-in US host when none is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "");
    render(<PostHogInit />);
    await vi.waitFor(() => expect(posthog.init).toHaveBeenCalled());
    expect(posthog.init.mock.calls[0][1].api_host).toBe("https://us.i.posthog.com");
  });
});
