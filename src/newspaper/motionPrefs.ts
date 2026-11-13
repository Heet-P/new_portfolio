import { useSyncExternalStore } from "react";

/**
 * The two media queries every bit of Express whimsy answers to:
 * - reduced motion: no parallax, no wiggles, no chugging train, no ink-in; states are instant;
 * - a fine pointer that can hover: hover-driven effects (parallax) only for a real mouse/trackpad.
 */
export const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
export const FINE_POINTER = "(hover: hover) and (pointer: fine)";

/** matchMedia, or undefined where it doesn't exist (server, jsdom). */
function mql(query: string): MediaQueryList | undefined {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(query) : undefined;
}

/** One-off read, for event handlers and effects. Missing matchMedia counts as "no". */
export function matches(query: string): boolean {
  return mql(query)?.matches ?? false;
}

/**
 * A media query as React state, kept live (a visitor can flip reduced motion mid-visit).
 * The server snapshot is false: the server-rendered page is always the static one, and the
 * client turns whimsy on after hydration if the query allows it.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = mql(query);
      list?.addEventListener?.("change", onChange);
      return () => list?.removeEventListener?.("change", onChange);
    },
    () => matches(query),
    () => false,
  );
}
