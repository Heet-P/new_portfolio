import { useCallback, useSyncExternalStore } from "react";

/**
 * The two media queries every bit of Express whimsy answers to:
 * - reduced motion: no parallax, no wiggles, no chugging train, no ink-in; states are instant;
 * - a fine pointer that can hover: hover-driven effects (parallax) only for a real mouse/trackpad.
 */
export const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
export const FINE_POINTER = "(hover: hover) and (pointer: fine)";

/**
 * One MediaQueryList per query, shared by every clipping and article (reads are then just a
 * property lookup). The cache is dropped if window.matchMedia itself is replaced (tests,
 * polyfills), so a list never outlives the function that made it.
 */
const lists = new Map<string, MediaQueryList>();
let listsFrom: typeof window.matchMedia | undefined;

/** The cached MediaQueryList, or undefined where matchMedia doesn't exist (server, jsdom). */
function mql(query: string): MediaQueryList | undefined {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
  if (listsFrom !== window.matchMedia) {
    listsFrom = window.matchMedia;
    lists.clear();
  }
  let list = lists.get(query);
  if (!list) {
    list = window.matchMedia(query);
    lists.set(query, list);
  }
  return list;
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
  // Stable per query, so React doesn't unsubscribe and resubscribe on every render.
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = mql(query);
      list?.addEventListener?.("change", onChange);
      return () => list?.removeEventListener?.("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => matches(query),
    () => false,
  );
}
