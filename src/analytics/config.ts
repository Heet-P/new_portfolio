/*
 * PostHog connection settings.
 *
 * The project key is PUBLIC BY DESIGN: PostHog's "phc_" project keys are write-only (they can
 * send events, never read data) and ship in every visitor's browser, so committing it is safe.
 * Build-time env vars override both values; setting NEXT_PUBLIC_POSTHOG_KEY to an empty string
 * turns analytics off entirely (tests and local builds that should send nothing do this).
 */
const DEFAULT_KEY = "phc_zi7AP6TYrQD4GJ2is6aUrhvtwgsBXJNbSsoVcQW4REyF";
/** PostHog US Cloud ingestion host. */
const DEFAULT_HOST = "https://us.i.posthog.com";

/** The project key ("" = analytics off). `??`, not `||`: an explicit empty value disables. */
export const posthogKey = (): string => process.env.NEXT_PUBLIC_POSTHOG_KEY ?? DEFAULT_KEY;

/** The ingestion host (an empty override falls back to the default). */
export const posthogHost = (): string => process.env.NEXT_PUBLIC_POSTHOG_HOST || DEFAULT_HOST;
