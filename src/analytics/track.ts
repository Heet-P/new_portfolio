import { posthogKey } from "./config";

/*
 * The site's one door to product analytics (PostHog). Components call `track(...)` and never
 * import the SDK: it is loaded lazily after first paint (PostHogInit) and plugs itself in here.
 *
 * Privacy: events carry station ids, modes and booleans only, never personal data.
 */

/** Exactly the events the site reports. */
export type AnalyticsEvent =
  | "intro_shown"
  | "ticket_printed"
  | "intro_skipped"
  | "boarded"
  | "hurry_clicked"
  | "mode_changed"
  | "station_reached"
  | "paper_handoff"
  | "route_map_jump"
  | "link_clicked"
  | "resume_downloaded"
  | "sound_toggled";

export type AnalyticsProps = Record<string, string | number | boolean>;

type Send = (event: AnalyticsEvent, props?: AnalyticsProps) => void;

/** Events fired before the SDK has loaded wait here (the oldest ~20 are kept; the rest dropped). */
const MAX_QUEUED = 20;

let send: Send | null = null;
const queue: [AnalyticsEvent, AnalyticsProps | undefined][] = [];

/**
 * Whether analytics runs at all: needs a project key (config.ts), a browser, and a real visitor.
 * `navigator.webdriver` is true under Playwright/Selenium, so automated runs (the e2e suite)
 * never load PostHog or send anything. Read per call so an empty key is a complete no-op.
 */
export function analyticsEnabled(): boolean {
  if (typeof window === "undefined" || !posthogKey()) return false;
  return !navigator.webdriver;
}

/** Report an event. Does nothing when analytics is off; queues (bounded) until the SDK is ready. */
export function track(event: AnalyticsEvent, props?: AnalyticsProps): void {
  if (!analyticsEnabled()) return;
  if (send) send(event, props);
  else if (queue.length < MAX_QUEUED) queue.push([event, props]);
}

/** Called once by PostHogInit when the SDK is ready: flushes everything queued, then sends live. */
export function attachSender(fn: Send): void {
  send = fn;
  for (const [event, props] of queue.splice(0)) fn(event, props);
}

/** Back to "not loaded, nothing queued" (tests). */
export function resetAnalytics(): void {
  send = null;
  queue.length = 0;
}
