/**
 * Shared ink and type for everything the 3D scene prints onto a canvas in the newspaper's
 * identity: the cabin's front page (cabin/print.ts) and the tunnel posters (tunnelPosters.ts).
 * Each keeps its own paper colour (tuned for where it hangs and how it is lit).
 */

/** The newspaper's ink tokens (globals.css --ink, --ink-faded, --red), for the canvas. */
export const INK = "#1d1915";
export const FADED = "#4a4239";
export const RED = "#b0352b";

/** The page's three type roles, as CSS font-family lists usable in a canvas font string. */
export interface Fonts {
  blackletter: string;
  headline: string;
  body: string;
}

/** The page's own fonts (next/font families), read from the CSS variables set on <html>. */
export function readFonts(): Fonts {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim() || "Georgia, serif";
  return { blackletter: v("--font-blackletter"), headline: v("--font-headline"), body: v("--font-body") };
}

/** Small deterministic PRNG (mulberry32): a print's grain is the same every time, never shimmering. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
