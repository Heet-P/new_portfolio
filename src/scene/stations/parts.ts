import { Kit, type Vec3 } from "./kit";
import { BUILD_FRONT, canopyHeights, PLATFORM, type StationPlan } from "./placement";

/**
 * The big parts of a station, built into a Kit: platform slab, canopy on columns, the
 * station building (door, framed windows, ticket window, pitched roof, chimney) and the
 * clock tower of the main stations. Frames and sizes follow placement.ts; see kit.ts for the
 * local frame (x along the track, y up, z to the right, so the platform side is z < 0).
 */

const H = PLATFORM.height;
/** Warm lamp tint (linear RGB, multiplied by the palette's window glow at runtime). */
export const WARM: Vec3 = [1, 0.72, 0.38];
/** Cooler lamp-post white. */
export const LAMP: Vec3 = [1, 0.84, 0.55];
/** Clock-face cream. */
export const CLOCK: Vec3 = [0.9, 0.82, 0.55];

const GLASS = "#1b2733";
const STONE = "#8f8a7f";
const DARK = "#2d3a4a";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** Platform ends slope down to the ground; this is how far a platform part is lifted at s. */
export function rampLift(s0: number, s1: number) {
  return (s: number) => {
    const t = clamp01(Math.min(s - s0, s1 - s) / PLATFORM.ramp);
    return -(1 - t * t * (3 - 2 * t)) * (H + 0.5);
  };
}

/**
 * Platform: paved slab (2-unit bands), stone coping on the edge, yellow safety line, a
 * tactile strip, and ends that ramp down to the ground. All follow the curve.
 */
export function platform(kit: Kit, p: StationPlan) {
  const s0 = p.s - PLATFORM.halfLength;
  const s1 = p.s + PLATFORM.halfLength;
  const lift = rampLift(s0, s1);
  const U = PLATFORM.outer;
  const e = PLATFORM.inner;
  const paving = (r: number) => ((r >> 1) & 1 ? "#b2ada0" : "#bdb8ab");
  kit.loft([[-U, H], [-(e + 0.4), H]], s0, s1, paving, { lift });
  kit.loft([[-U, H], [-U, -0.6]], s0, s1, STONE, { lift });
  // Coping: the stone lip along the edge, with its face down to the ballast.
  kit.loft([[-e, -0.45], [-e, H + 0.07], [-(e + 0.4), H + 0.07]], s0, s1, "#d6cfbf", { lift });
  kit.loft([[-(e + 0.4), H + 0.012], [-(e + 0.8), H + 0.012]], s0, s1, "#e8b82c", { lift });
  // Tactile strip: alternating dull and bright 0.5-unit studs.
  kit.loft([[-(e + 0.85), H + 0.02], [-(e + 1.3), H + 0.02]], s0, s1, (r) => (r & 1 ? "#8e8a7a" : "#c9b24a"), { lift, step: 0.5 });
}

/** Canopy roof profile (z, y) from the wall to the eave: a shallow curve that dips toward the edge. */
function canopyTop(yb: number): [number, number][] {
  return [
    [-(BUILD_FRONT - 0.05), yb],
    [-5.2, yb - 0.04],
    [-4.2, yb - 0.17],
    [-3.2, yb - 0.45],
  ];
}

/** Height of the canopy's top surface at lateral position z (linear between the profile points). */
export function roofHeightAt(yb: number, z: number): number {
  const pts = canopyTop(yb);
  for (let k = 0; k + 1 < pts.length; k++) {
    const [z0, y0] = pts[k];
    const [z1, y1] = pts[k + 1];
    if (z <= z1) return y0 + ((y1 - y0) * (z - z0)) / (z1 - z0);
  }
  return pts[pts.length - 1][1];
}

/**
 * Canopy: a long curved roof from the building's wall out over the platform, on slim iron
 * columns, with a deep fascia board (carries the station name), a gutter strip, pendant lamps
 * and, at some stops, a hanging clock. Roof ends are closed with a small chevron.
 */
export function canopy(kit: Kit, p: StationPlan) {
  const { from, to, spacing, clock } = p.canopy;
  const { yb, ye } = canopyHeights(p);
  const roof = p.canopy.roof;
  const top = canopyTop(yb);
  const under = top.map(([z, y]) => [z, y - 0.14] as [number, number]);
  const s0 = p.s + from;
  const s1 = p.s + to;
  kit.loft(top, s0, s1, roof, { step: 2 });
  kit.loft([...under].reverse(), s0, s1, "#3a4350", { step: 2 });
  // Fascia board and the gutter strip along its top, a ridge flashing along the wall.
  // Fascia: cream board (the name is lettered on it) with a stripe in the building's trim colour.
  kit.loft([[-3.12, ye - 0.72], [-3.12, ye + 0.12]], s0, s1, "#ece3c8", { step: 2 });
  kit.loft([[-3.125, ye - 0.72], [-3.125, ye - 0.6]], s0, s1, p.building.trim, { step: 2 });
  kit.loft([[-3.09, ye - 0.04], [-3.09, ye + 0.14]], s0, s1, "#3b4452", { step: 2 });
  kit.loft([[-3.2, ye + 0.12], [-3.1, ye + 0.12]], s0, s1, "#3b4452", { step: 2 });
  // Closed ends: the roof's cross-section as a thin slab.
  const section: [number, number][] = [...top, ...[...under].reverse()];
  for (const [s, dir] of [[s0, 1], [s1, -1]] as const) {
    kit.at(s).extrude(section, -0.05 * dir, 0.05 * dir, roof);
  }

  const bays = Math.max(1, Math.round((to - from) / spacing));
  const colX = (k: number) => from + 1 + (k * (to - from - 2)) / bays;
  for (let k = 0; k <= bays; k++) {
    kit.at(p.s + colX(k));
    const shaftH = ye - 0.72 - H - 0.3;
    kit.box([0, H + 0.15, -3.2], [0.44, 0.3, 0.44], STONE);
    kit.cyl([0, H + 0.3 + shaftH / 2, -3.2], 0.1, 0.085, shaftH, 8, DARK);
    kit.box([0, H + 0.3 + shaftH + 0.05, -3.2], [0.3, 0.12, 0.3], DARK);
    // Bracket from the column up under the roof, like cast-iron spandrels.
    kit.box([0, ye - 1.05, -3.45], [0.07, 0.07, 0.62], DARK, { rot: [0.7, 0, 0] });
    // A pendant lamp in every bay (not at the last column).
    if (k < bays) {
      const mid = (colX(k) + colX(k + 1)) / 2;
      kit.at(p.s + mid);
      kit.box([0, ye - 0.55, -4.4], [0.04, 0.5, 0.04], DARK);
      kit.box([0, ye - 0.9, -4.4], [0.4, 0.14, 0.4], "#e9dcb4", { glow: LAMP });
      kit.box([0, ye - 0.8, -4.4], [0.46, 0.06, 0.46], DARK);
    }
  }
  // Back posts where the roof runs past the building.
  const b = p.building;
  for (const a of [from + 0.3, to - 0.3]) {
    if (a < b.along - b.width / 2 - 0.2 || a > b.along + b.width / 2 + 0.2) {
      kit.at(p.s + a);
      kit.cyl([0, H + (yb - H - 0.2) / 2, -(BUILD_FRONT - 0.5)], 0.1, 0.1, yb - H - 0.2, 8, DARK);
    }
  }
  if (clock !== null) hangingClock(kit, p.s + clock, ye);
}

/**
 * A clock face in its own frame: looks along +z, 12 o'clock up. Dark rim, glowing cream dial,
 * hour ticks and two hands (angles clockwise from 12, radians).
 */
function clockFace(kit: Kit, r: number, hour: number, minute: number) {
  kit.cyl([0, 0, 0], r + 0.12, r + 0.12, 0.16, 16, DARK, { rot: [Math.PI / 2, 0, 0] });
  kit.cyl([0, 0, 0.03], r, r, 0.16, 16, "#efe6c6", { glow: CLOCK, rot: [Math.PI / 2, 0, 0] });
  for (let k = 0; k < 12; k++) {
    kit.group([0, 0, 0.12], [0, 0, -(k / 12) * Math.PI * 2], () => kit.box([0, r * 0.82, 0], [0.05, k % 3 ? 0.1 : 0.2, 0.03], DARK));
  }
  kit.group([0, 0, 0.13], [0, 0, -hour], () => kit.box([0, r * 0.26, 0], [0.07, r * 0.52, 0.03], DARK));
  kit.group([0, 0, 0.14], [0, 0, -minute], () => kit.box([0, r * 0.38, 0], [0.05, r * 0.76, 0.03], DARK));
}

/** A double-faced platform clock on a bracket under the canopy, faces along the track. */
function hangingClock(kit: Kit, s: number, ye: number) {
  kit.at(s);
  kit.box([0, ye - 0.72, -3.6], [0.08, 0.6, 0.08], DARK);
  kit.group([0, ye - 1.3, -3.6], [0, 0, 0], () => {
    kit.box([0, 0, 0], [0.12, 1.3, 1.3], DARK);
    for (const dir of [-1, 1]) {
      kit.group([dir * 0.06, 0, 0], [0, (dir * Math.PI) / 2, 0], () => clockFace(kit, 0.5, 2.1, 3.6));
    }
  });
}

/** A framed window on the facade plane z = zFace: dark glass that glows, frame, sill, muntins, lintel. */
function window(kit: Kit, x: number, y: number, w: number, hgt: number, zFace: number, trim: string, glow = true) {
  kit.box([x, y, zFace + 0.03], [w, hgt, 0.06], GLASS, glow ? { glow: WARM } : {});
  const t = 0.11;
  kit.box([x, y + hgt / 2 + t / 2, zFace + 0.06], [w + 0.22, t, 0.12], trim);
  kit.box([x, y - hgt / 2 - t / 2, zFace + 0.06], [w + 0.22, t, 0.12], trim);
  for (const s of [-1, 1]) kit.box([x + (s * (w + t)) / 2, y, zFace + 0.06], [t, hgt, 0.12], trim);
  kit.box([x, y - hgt / 2 - 0.2, zFace + 0.14], [w + 0.5, 0.1, 0.3], STONE);
  kit.box([x, y, zFace + 0.09], [0.05, hgt, 0.06], trim);
  kit.box([x, y + hgt * 0.15, zFace + 0.09], [w, 0.05, 0.06], trim);
  kit.box([x, y + hgt / 2 + t + 0.1, zFace + 0.08], [w + 0.5, 0.16, 0.16], STONE);
}

/** Door on the facade with frame, step, a glowing transom and fanlight, and a lantern either side. */
function door(kit: Kit, x: number, zFace: number, trim: string, colour: string) {
  const dw = 1.4;
  const dh = 2.5;
  kit.box([x, H + dh / 2, zFace + 0.03], [dw, dh, 0.06], colour);
  kit.box([x, H + dh / 2 + 0.2, zFace + 0.07], [0.5, 0.9, 0.04], GLASS, { glow: WARM });
  kit.box([x, H + dh + 0.3, zFace + 0.04], [dw, 0.5, 0.06], GLASS, { glow: WARM });
  kit.box([x, H + dh + 0.03, zFace + 0.07], [dw + 0.1, 0.07, 0.1], trim);
  kit.box([x, H + dh + 0.6, zFace + 0.07], [dw + 0.3, 0.14, 0.14], trim);
  for (const s of [-1, 1]) kit.box([x + (s * (dw + 0.18)) / 2, H + (dh + 0.6) / 2, zFace + 0.07], [0.18, dh + 0.6, 0.12], trim);
  kit.box([x, H + 0.02, zFace + 0.3], [dw + 0.7, 0.14, 0.62], STONE);
  kit.box([x + 0.45, H + 1.2, zFace + 0.09], [0.07, 0.07, 0.07], "#d4b45a");
  for (const s of [-1, 1]) {
    kit.box([x + s * 1.45, H + 2.45, zFace + 0.12], [0.2, 0.34, 0.2], "#e9dcb4", { glow: LAMP });
    kit.box([x + s * 1.45, H + 2.68, zFace + 0.12], [0.26, 0.06, 0.26], DARK);
  }
}

/**
 * The station building: stone plinth, walls with gable ends, corner quoins, a cornice,
 * door, framed windows (one is the ticket window), a pitched roof with eaves and ridge cap,
 * and a chimney. The main station is two storeys with a clock tower.
 */
export function building(kit: Kit, p: StationPlan) {
  const b = p.building;
  kit.at(p.s + b.along);
  const W = b.width;
  const D = b.depth;
  const zF = -BUILD_FRONT;
  const zB = zF - D;
  const zm = (zF + zB) / 2;
  const yT = H + b.wallHeight;
  const rise = p.kind === "main" ? 1.7 : 1.5;

  // Walls with gable ends as one extrusion.
  kit.extrude([[zF, -0.4], [zB, -0.4], [zB, yT], [zm, yT + rise], [zF, yT]], -W / 2, W / 2, b.wall);
  kit.box([0, (H + 0.6 - 0.4) / 2, zm], [W + 0.16, H + 1, D + 0.16], STONE);
  kit.box([0, yT - 0.05, zm], [W + 0.32, 0.26, D + 0.32], b.trim);
  if (p.kind === "main") kit.box([0, H + 3.75, zm], [W + 0.14, 0.2, D + 0.14], b.trim);
  // Quoins at the front corners.
  for (const s of [-1, 1]) kit.box([(s * (W - 0.55)) / 2, (yT - 0.4) / 2 + 0.1, zF + 0.05], [0.55, yT, 0.12], "#d9d1bd");

  // Roof: a thin chevron with eaves, plus ridge cap.
  const oh = 0.75;
  const slope = rise / (D / 2);
  const t = 0.17;
  const roof: [number, number][] = [
    [zF - oh, yT - oh * slope],
    [zm, yT + rise],
    [zB + oh, yT - oh * slope],
    [zB + oh, yT - oh * slope - t],
    [zm, yT + rise - t],
    [zF - oh, yT - oh * slope - t],
  ];
  kit.extrude(roof, -W / 2 - 0.55, W / 2 + 0.55, b.roof);
  kit.box([0, yT + rise + 0.02, zm], [W + 1.2, 0.16, 0.34], "#2f3744");
  // Fascia along the front eave.
  kit.box([0, yT - oh * slope - t / 2 - 0.05, zF - oh], [W + 1.1, 0.2, 0.06], b.trim);

  const doorX = b.door - b.along;
  const doorColour = p.id === "mct" || p.id === "next" ? "#7a3b2e" : p.kind === "main" ? "#2f6f6c" : "#2d3b57";
  door(kit, doorX, zF, b.trim, doorColour);
  const winY = H + (p.kind === "main" ? 1.9 : 1.9);
  for (const a of b.windows) window(kit, a - b.along, winY, 1.2, 1.35, zF, b.trim);
  if (p.kind === "main") {
    for (const a of [...b.windows, b.door - 3, b.door + 3]) window(kit, a - b.along, H + 5.3, 1.2, 1.55, zF, b.trim);
  }
  if (b.ticket !== null) {
    const x = b.ticket - b.along;
    window(kit, x, H + 1.75, 1.7, 1.05, zF, b.trim);
    kit.box([x, H + 1.1, zF + 0.28], [1.9, 0.09, 0.5], "#6b4a34"); // counter shelf
    kit.box([x, H + 2.75, zF + 0.1], [1.1, 0.26, 0.1], "#e9a23b", { glow: WARM }); // ticket sign
  }
  // One window in each gable end wall.
  for (const s of [-1, 1]) {
    kit.group([(s * W) / 2, 0, zm], [0, (s * Math.PI) / 2, 0], () => window(kit, 0, winY, 1.1, 1.3, 0, b.trim));
  }
  // Chimney with cap and pots, standing on the back slope.
  if (b.chimney !== null) {
    const cx = b.chimney - b.along;
    kit.box([cx, yT + rise * 0.55 + 0.7, zm - 0.9], [0.8, 2.2 + rise * 0.3, 0.8], "#8b4a3a");
    kit.box([cx, yT + rise * 0.55 + 1.9, zm - 0.9], [1, 0.16, 1], "#5a5048");
    for (const dx of [-0.2, 0.2]) kit.cyl([cx + dx, yT + rise * 0.55 + 2.2, zm - 0.9], 0.11, 0.09, 0.45, 6, "#b0623f");
  }
  if (p.kind === "main") tower(kit, p, zF, yT);
}

/**
 * Clock tower of the main station: square shaft through the roof with clock faces on three
 * sides, a belfry stage with louvres, a four-sided spire and a finial.
 */
function tower(kit: Kit, p: StationPlan, zF: number, yT: number) {
  const b = p.building;
  const doorX = b.door - b.along;
  const w = 3;
  const cz = zF - 1.8;
  const shaftTop = yT + 3.3;
  kit.box([doorX, (yT - 0.5 + shaftTop) / 2, cz], [w, shaftTop - yT + 0.5, w], b.wall);
  kit.box([doorX, yT + 0.1, cz], [w + 0.3, 0.22, w + 0.3], b.trim);
  kit.box([doorX, shaftTop, cz], [w + 0.5, 0.26, w + 0.5], b.trim);
  // Clock faces on the track side and both ends.
  const clockY = yT + 1.9;
  for (const [dx, dz, ry] of [[0, 1, 0], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]] as const) {
    kit.group([doorX + (dx * (w + 0.1)) / 2, clockY, cz + (dz * (w + 0.1)) / 2], [0, ry, 0], () => clockFace(kit, 0.8, 5.2, 1.4));
  }
  // Belfry stage with louvred openings.
  const bw = 2.3;
  kit.box([doorX, shaftTop + 0.9, cz], [bw, 1.6, bw], b.wall);
  for (const [dx, dz, ry] of [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]] as const) {
    kit.group([doorX + (dx * bw) / 2, shaftTop + 0.9, cz + (dz * bw) / 2], [0, ry, 0], () => {
      kit.box([0, 0, 0.02], [0.95, 1.05, 0.08], GLASS, { glow: WARM });
      for (let k = -2; k <= 2; k++) kit.box([0, k * 0.2, 0.07], [0.95, 0.04, 0.06], b.trim);
    });
  }
  kit.box([doorX, shaftTop + 1.8, cz], [bw + 0.4, 0.2, bw + 0.4], b.trim);
  // Spire and finial.
  kit.cyl([doorX, shaftTop + 1.9 + 1.0, cz], 1.8, 0.04, 2, 4, b.roof, { rot: [0, Math.PI / 4, 0] });
  kit.cyl([doorX, shaftTop + 4.2, cz], 0.04, 0.04, 0.9, 5, "#d4b45a");
  kit.blob([doorX, shaftTop + 4.7, cz], [0.13, 0.13, 0.13], "#d4b45a", 3);
}
