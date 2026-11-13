import { smoothstep } from "./noise";
import type { Span } from "./worldgen";

/**
 * The chase camera normally rides over the hill that covers a tunnel (it never goes inside
 * terrain), so the bore, and the skills reel on its walls, would be out of sight. While the
 * camera is in a tunnel's stretch it drops into the bore instead: low and near the centreline,
 * behind the train, looking down the line, then climbs back out after the exit portal.
 */
export const TUNNEL_VIEW = {
  /** Lateral offset (units, + = right of travel) and height above the rails inside the bore. */
  side: 0.6,
  up: 4.4,
  /** Arc length (units) over which the camera eases down into the mouth, and back up after the exit. */
  rampIn: 36,
  rampOut: 30,
} as const;

/**
 * 0..1: how far the camera at arc length `s` has moved into its in-tunnel framing. 0 in the open;
 * exactly 1 from just in front of a mouth to just past the far one (so the hill-clearance lift is
 * fully off inside the bore); eased in between.
 */
export function tunnelBlend(s: number, tunnels: Span[]): number {
  let k = 0;
  for (const t of tunnels) {
    const k1 = smoothstep(t.s0 - TUNNEL_VIEW.rampIn, t.s0 - 2, s) * (1 - smoothstep(t.s1 + 2, t.s1 + TUNNEL_VIEW.rampOut, s));
    if (k1 > k) k = k1;
  }
  return k;
}
