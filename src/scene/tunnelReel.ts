import { BORE_HALF, type Span } from "./worldgen";

/**
 * Pure layout for the tunnels' skills reel: which skill hangs where, how a poster sits against
 * the bore wall, the strobe curve and where each poster lives in the texture atlas. No three.js
 * and no DOM, so all of it is unit-tested; TunnelPanels.tsx turns it into one instanced mesh per
 * tunnel and tunnelPosters.ts prints the atlas.
 */

/** One poster's worth of content: a skill and the resume group it belongs to. */
export interface ReelEntry {
  group: string;
  skill: string;
}

/** PROFILE.skills as one flat list, in the resume's order (groups in order, skills in order). */
export function skillReel(skills: Record<string, string[]>): ReelEntry[] {
  return Object.entries(skills).flatMap(([group, list]) => list.map((skill) => ({ group, skill })));
}

/** How a poster is built and hung. Units are world units (the train is 3.3 wide, 4 tall). */
export const PANEL = {
  width: 2,
  height: 2.5,
  /** Height of the poster's centre above the rails: low enough to sit at the chase camera's eye line. */
  y: 2.65,
  /**
   * Angle (radians) between the poster's normal and the track axis. Flat on the wall would be 90deg,
   * which the camera behind the train sees edge-on; swung out like a hanging sign it reads, and its
   * free edge still clears the train.
   */
  tilt: (47 * Math.PI) / 180,
  /** The wall edge stands this far in from the lining (no z-fighting with the bore). */
  wallGap: 0.02,
  /** The free edge must stay at least this far from the centreline (train half-width 1.65 + a margin). */
  trainClearance: 2,
  /** Target arc length (units) between neighbouring posters; the span is divided evenly near this. */
  spacing: 5.5,
} as const;

/** One poster position: arc length along the track and which wall (+1 right of travel, -1 left). */
export interface Slot {
  s: number;
  side: 1 | -1;
}

/** `n` panels spread evenly over a tunnel's span (half a gap in from each end), alternating walls. */
export function layoutPanels(span: Span, n: number): Slot[] {
  const gap = (span.s1 - span.s0) / n;
  return Array.from({ length: Math.max(0, n) }, (_, i) => ({ s: span.s0 + (i + 0.5) * gap, side: i % 2 ? -1 : 1 }));
}

/** A slot with what hangs on it: a skill, or (entry null) the blackletter "Skills Supplement" title card. */
export interface Panel extends Slot {
  entry: ReelEntry | null;
}

/**
 * The reel spread over the tunnels. Each tunnel gets as many skill panels as fit at PANEL.spacing,
 * plus the title card as its first panel (on the right wall, the first thing seen on entering); the
 * reel runs on from one tunnel into the next, wrapping round if the tunnels hold more panels than
 * there are skills (a repeat rather than a bare wall).
 */
export function reelFor(reel: ReelEntry[], spans: Span[]): Panel[][] {
  let next = 0;
  return spans.map((span) => {
    const skills = Math.max(1, Math.round((span.s1 - span.s0) / PANEL.spacing));
    return layoutPanels(span, skills + 1).map((slot, i) => ({ ...slot, entry: i === 0 ? null : reel[next++ % reel.length] }));
  });
}

/** Where (and how it faces) a poster hangs, in world coordinates. */
export interface Placement {
  x: number;
  y: number;
  z: number;
  /** Unit horizontal normal: back down the track and in towards the centreline. */
  normal: [number, number, number];
  /** Unit horizontal width axis (the poster's local +x), square to the normal. */
  right: [number, number, number];
}

/**
 * Hang a poster on a bore wall at a track sample: position (px, py, pz), unit tangent (tx, tz) on
 * the ground plane. The wall edge touches the lining, the poster swings out toward the camera
 * behind the train by PANEL.tilt, and faces back down the track and inward.
 */
export function panelPlacement(px: number, py: number, pz: number, tx: number, tz: number, side: 1 | -1): Placement {
  // Right of travel = tangent x up = (-tz, tx), as in route3d.
  const nx = -tz;
  const nz = tx;
  const c = Math.cos(PANEL.tilt);
  const s = Math.sin(PANEL.tilt);
  // Normal: mostly back along the track, tilted toward the centreline (away from the wall).
  const zx = -c * tx - side * s * nx;
  const zz = -c * tz - side * s * nz;
  // Width axis = up x normal = (z_z, 0, -z_x).
  const rx = zz;
  const rz = -zx;
  const half = PANEL.width / 2;
  const wall = BORE_HALF - PANEL.wallGap;
  // The wall edge is the +right edge on the right wall and the -right edge on the left one.
  return {
    x: px + nx * side * wall - side * rx * half,
    y: py + PANEL.y,
    z: pz + nz * side * wall - side * rz * half,
    normal: [zx, 0, zz],
    right: [rx, 0, rz],
  };
}

/** Strobe: a panel flares as it sweeps into view beside the camera. `ahead` is how far in front of it (along the track) the peak is. */
export const STROBE = { ahead: 8, width: 3.5, gain: 0.8 } as const;

/** Flare amount 0..1 for a panel `along` units in front of the camera: a smooth bump, exactly 0 beyond 2.5 widths. */
export function strobeAmount(along: number): number {
  const d = (along - STROBE.ahead) / (STROBE.width * 2.5);
  return d * d >= 1 ? 0 : (1 - d * d) ** 2;
}

/** The texture atlas: one cell per poster in a grid. The cell after the last skill holds the title card. */
export const ATLAS = {
  size: 2048,
  cellW: 256,
  cellH: 320,
  cols: 8,
  /** Cells the atlas can hold (rows that fit in `size`). */
  capacity: 8 * 6,
} as const;

/** A rectangle in atlas pixels (origin top-left, as on the canvas). */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Cell `i` of the poster grid. */
export function atlasRect(i: number): Rect {
  return { x: (i % ATLAS.cols) * ATLAS.cellW, y: Math.floor(i / ATLAS.cols) * ATLAS.cellH, w: ATLAS.cellW, h: ATLAS.cellH };
}
