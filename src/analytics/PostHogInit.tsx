"use client";

import { useEffect } from "react";
import { STATIONS } from "@/content/route";
import { posthogHost, posthogKey } from "./config";
import { analyticsEnabled, attachSender } from "./track";

/** Load after first paint: at the browser's next idle moment, and no later than this (ms). */
const LOAD_TIMEOUT_MS = 1500;

/** Station names are public site copy, the only text a session replay may show unmasked. */
const STATION_NAMES = new Set(STATIONS.map((s) => s.name));

/** Replay text mask: station names pass through, every other character becomes "*". */
const maskText = (text: string) => (STATION_NAMES.has(text.trim()) ? text : text.replace(/\S/g, "*"));

/**
 * Starts PostHog product analytics, cookieless, after the page has had its first paint, and
 * hands the SDK to track.ts. Renders nothing. With an empty project key (or for an
 * automated browser) it does nothing at all: no import, no network.
 */
export function PostHogInit() {
  useEffect(() => {
    if (!analyticsEnabled()) return;
    let cancelled = false;

    const load = async () => {
      try {
        const { default: posthog } = await import("posthog-js");
        // Never init twice (Strict Mode mounts twice in dev): the SDK itself knows if it has started.
        if (cancelled || posthog.__loaded) return;
        posthog.init(posthogKey(), {
          api_host: posthogHost(),
          // Cookieless: nothing is written to cookies or localStorage; a visitor is a page load.
          persistence: "memory",
          respect_dnt: true,
          // We never identify anyone, so no person profiles (cheaper, and anonymous).
          person_profiles: "identified_only",
          // Only the events in track.ts, plus the one page's view and leave.
          autocapture: false,
          capture_pageview: true,
          capture_pageleave: true,
          // Nothing else phones home: no feature-flag fetch, surveys, heatmaps or click heuristics.
          advanced_disable_flags: true,
          disable_surveys: true,
          capture_heatmaps: false,
          capture_dead_clicks: false,
          rageclick: false,
          disable_session_recording: false,
          session_recording: {
            // Replay shows the layout and motion, not the words: inputs and all text are masked
            // except the station names.
            maskAllInputs: true,
            maskTextSelector: "*",
            maskTextFn: maskText,
          },
        });
        attachSender((event, props) => posthog.capture(event, props));
      } catch {
        // Blocked or offline: analytics is optional, the site never notices.
      }
    };

    // requestIdleCallback is missing in Safari: a plain timer does the same job there.
    const idle = typeof window.requestIdleCallback === "function";
    const handle = idle
      ? window.requestIdleCallback(load, { timeout: LOAD_TIMEOUT_MS })
      : window.setTimeout(load, LOAD_TIMEOUT_MS);
    return () => {
      cancelled = true;
      if (idle) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, []);

  return null;
}
