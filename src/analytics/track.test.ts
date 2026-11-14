import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attachSender, resetAnalytics, track } from "./track";

const KEY = "NEXT_PUBLIC_POSTHOG_KEY";

beforeEach(() => {
  resetAnalytics();
});

afterEach(() => {
  vi.unstubAllEnvs();
  Reflect.deleteProperty(navigator, "webdriver");
  vi.restoreAllMocks();
});

describe("track", () => {
  it("is a complete no-op with an empty key: nothing queued, nothing sent later", () => {
    vi.stubEnv(KEY, "");
    const send = vi.fn();
    track("boarded");
    attachSender(send);
    expect(send).not.toHaveBeenCalled();
    // And live events after attach stay silent too: the key is still empty.
    track("boarded");
    expect(send).not.toHaveBeenCalled();
  });

  it("is a no-op for automated browsers (navigator.webdriver), so e2e runs send nothing", () => {
    vi.stubEnv(KEY, "phc_test");
    // jsdom has no webdriver flag; define it as an automation-controlled browser would.
    Object.defineProperty(navigator, "webdriver", { value: true, configurable: true });
    const send = vi.fn();
    attachSender(send);
    track("boarded");
    expect(send).not.toHaveBeenCalled();
  });

  it("queues events fired before the SDK loads, then flushes them in order on attach", () => {
    vi.stubEnv(KEY, "phc_test");
    const send = vi.fn();
    track("intro_shown");
    track("sound_toggled", { on: true });
    expect(send).not.toHaveBeenCalled();
    attachSender(send);
    expect(send.mock.calls).toEqual([["intro_shown", undefined], ["sound_toggled", { on: true }]]);
    // Once attached, events go straight through.
    track("boarded");
    expect(send).toHaveBeenLastCalledWith("boarded", undefined);
    expect(send).toHaveBeenCalledTimes(3);
  });

  it("keeps at most 20 events while waiting", () => {
    vi.stubEnv(KEY, "phc_test");
    for (let i = 0; i < 30; i++) track("station_reached", { station_index: i });
    const send = vi.fn();
    attachSender(send);
    expect(send).toHaveBeenCalledTimes(20);
    expect(send).toHaveBeenLastCalledWith("station_reached", { station_index: 19 });
  });
});
