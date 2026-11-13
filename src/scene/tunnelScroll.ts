import { ROUTE } from "./route3d";
import type { LegWarp } from "./travel";
import { TUNNEL_VIEW, tunnelBlend } from "./tunnelCamera";
import type { Span } from "./worldgen";

/**
 * Tunnels take more scroll. The skills reel on a bore's walls has to be readable at any scroll
 * speed, so while the chase camera is in a bore every unit of track costs TUNNEL_SCROLL times
 * the scroll of open track, easing between the two along the camera's ramps in and out (the
 * same blend that lowers the camera into the bore, tunnelCamera.ts). The visitor still drives:
 * the train simply covers less ground per scroll there.
 */
export const TUNNEL_SCROLL = 2.75;

/** Scroll cost of one unit of track with the train's centre at arc length `s` (1 = open track). */
export function scrollWeight(s: number, tunnels: Span[]): number {
  return 1 + (TUNNEL_SCROLL - 1) * tunnelBlend(s - TUNNEL_VIEW.chase, tunnels);
}

/** Samples per leg for the cumulative tables: about one per unit of track. */
const SAMPLES = Math.ceil(ROUTE.spacing);

/** Per leg, the cumulative scroll weight at every sample (SAMPLES + 1 values from 0). */
function legTables(tunnels: Span[]): Float64Array[] {
  const ds = ROUTE.spacing / SAMPLES;
  return ROUTE.stationU.slice(1).map((_, i) => {
    const s0 = ROUTE.stationU[i] * ROUTE.length;
    const cum = new Float64Array(SAMPLES + 1);
    for (let k = 0; k < SAMPLES; k++) cum[k + 1] = cum[k] + scrollWeight(s0 + (k + 0.5) * ds, tunnels);
    return cum;
  });
}

/**
 * Each leg's scroll length relative to a leg of open track: what scrollMap.ts's LEG_SCROLL table
 * must hold (its test checks the two agree).
 */
export function legScroll(tunnels: Span[]): number[] {
  return legTables(tunnels).map((cum) => cum[SAMPLES] / SAMPLES);
}

/**
 * The LegWarp for travel.ts: within each leg, the scroll fraction is spread over the leg's
 * distance by the scroll weight, so a bore advances slowly and open track at the usual rate.
 * Tables are built once here; the returned function only binary-searches (no allocations).
 */
export function tunnelScrollWarp(tunnels: Span[]): LegWarp {
  const tables = legTables(tunnels);
  return (leg, f) => {
    const cum = tables[Math.max(0, Math.min(tables.length - 1, leg))];
    const want = Math.max(0, Math.min(1, f)) * cum[SAMPLES];
    let lo = 0;
    let hi = SAMPLES;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= want) lo = mid;
      else hi = mid;
    }
    return (lo + (want - cum[lo]) / (cum[hi] - cum[lo])) / SAMPLES;
  };
}
