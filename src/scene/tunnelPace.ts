import { ROUTE, trainU } from "./route3d";
import { MAX_SPEED } from "./travel";
import { TUNNEL_VIEW, tunnelBlend } from "./tunnelCamera";
import type { Span } from "./worldgen";

/**
 * Top speed (stations/s) while the camera is inside a tunnel: slow enough that the skills reel on
 * the walls can be read. At ~250 units per station this is ~30 units/s, so the bore itself takes ~2.5 s to cross
 * (about 4 s with the slowing and the camera dip either side) instead of ~0.6 s at full speed.
 */
export const TUNNEL_SPEED = 0.12;

/**
 * The speed cap at train position `position` (stations): full speed in the open, TUNNEL_SPEED
 * while the chase camera is in a bore, easing between the two along the camera's ramps in and
 * out (the same blend that lowers the camera, so the ride slows as the camera dips).
 */
export function tunnelPaceCap(position: number, tunnels: Span[]): number {
  const cameraS = trainU(position) * ROUTE.length - TUNNEL_VIEW.chase;
  return MAX_SPEED - (MAX_SPEED - TUNNEL_SPEED) * tunnelBlend(cameraS, tunnels);
}
