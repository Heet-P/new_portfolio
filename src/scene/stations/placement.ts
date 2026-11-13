import { STATIONS, type StationId } from "@/content/route";
import { mulberry32 } from "../noise";
import { ROUTE, TRACK } from "../route3d";

/**
 * What stands at every stop and where: a pure, seeded plan per station. No three.js objects,
 * so it is unit-testable; kit.ts / parts.ts turn a plan into geometry.
 *
 * Coordinates: `along` is the distance down the track from the station point (the parked
 * train's centre, ~30 long), `u` the distance to the platform side of the track centreline
 * (the left of travel, where worldgen keeps +-24 along x 24 across flat). Items sit on the
 * platform slab, 0.55 above the rail tops.
 */

/** Platform dimensions (units). */
export const PLATFORM = {
  /** Distance from the track centre to the edge (the train is 3.3 wide). */
  inner: 2.0,
  /** Slab top above the rail tops. */
  height: 0.55,
  /** Back edge of the slab (the building's front wall overlaps it). */
  outer: 6.8,
  /** The slab runs this far each way from the station point. */
  halfLength: 23,
  /** The ends slope down to the ground over this distance. */
  ramp: 4,
} as const;

/** Nothing but the platform itself stands closer to the track centreline than this. */
export const CLEARANCE = 2.9;
/** Distance of the building's front wall from the track centreline. */
export const BUILD_FRONT = 6.6;
/** Terrain sits this far below the rail tops in the cleared patch (worldgen heightAt). */
export const GROUND_DROP = 0.35;

/** Name boards at the platform ends: size and the height of the lower edge above the slab. */
export const END_SIGN = { width: 6.4, height: 2.3, bottom: 1.7, u: 6.2 } as const;
/** An end board turns this far from facing straight back down the track, toward the camera (right). */
const SIGN_TILT = 0.25;
/** Local yaw of an end board relative to the track frame (its front is the board's +Z). */
export const END_SIGN_YAW = Math.atan2(-1, SIGN_TILT);

export type PropKind =
  | "bench"
  | "lamp"
  | "bin"
  | "timetable"
  | "planter"
  | "crates"
  | "cart"
  | "waveSign"
  | "waferSign";

export interface Prop {
  kind: PropKind;
  along: number;
  /** Distance from the track centreline. */
  u: number;
}

export interface StationPlan {
  index: number;
  id: StationId;
  /** "main" = the big two-storey station with a clock tower (Departure, Terminus). */
  kind: "main" | "halt";
  /** Arc length of the station point. */
  s: number;
  building: {
    along: number;
    width: number;
    depth: number;
    floors: 1 | 2 | 3;
    /** Height of the walls above the platform top. */
    wallHeight: number;
    wall: string;
    trim: string;
    roof: string;
    /** Door position (along), windows (along), ticket window (along) or null. */
    door: number;
    windows: number[];
    ticket: number | null;
    chimney: number | null;
    tower: boolean;
    /** Flat parapet roof of the Work Experience office, instead of the station's pitched roof. */
    flatRoof: boolean;
  };
  canopy: { from: number; to: number; spacing: number; clock: number | null; roof: string };
  props: Prop[];
  /** Back-edge fence runs [from, to] (along). */
  fence: [number, number][];
  /** Solar field units behind the building (Solar only). */
  panels: { along: number; u: number }[];
  /** Panels on the canopy roof (Solar only). */
  roofPanels: boolean;
  /** SAHARA's round landing pad on the ground behind the platform (centre and radius), else null. */
  helipad: { along: number; u: number; radius: number } | null;
}

/** Wall colours (sRGB): warm cream, terracotta, teal, sage, butter, brick. */
const WALLS = ["#e6d9bd", "#c4694c", "#5b9a96", "#93a98a", "#dcb867", "#a8553f"];
/** Trim (frames, fascia): cream, navy, brown, deep teal. */
const TRIMS = ["#f3ead3", "#33425e", "#6b4a34", "#2f6f6c"];
/** Roofs: slate, tile, moss, brown. */
const ROOFS = ["#66728a", "#b05a42", "#4f7358", "#6b5443"];

/** Canopy roofs: pale zinc, sage, light terracotta, powder blue (light, so they read at golden hour). */
const CANOPY_ROOFS = ["#c3c9d3", "#a9c4b8", "#d6b79c", "#b7c6d9"];

const stationS = ROUTE.stationU.map((u) => u * ROUTE.length);

/** Interpolated track sample at arc length s: position, ground tangent, right normal, yaw. */
export function trackFrame(s: number) {
  const f = Math.max(0, Math.min(TRACK.count - 1, s / TRACK.step));
  const i = Math.floor(f);
  const j = Math.min(TRACK.count - 1, i + 1);
  const t = f - i;
  const lerp = (a: Float32Array) => a[i] + (a[j] - a[i]) * t;
  const x = lerp(TRACK.px);
  const y = lerp(TRACK.py);
  const z = lerp(TRACK.pz);
  const h = Math.hypot(lerp(TRACK.tx), lerp(TRACK.tz)) || 1;
  const tx = lerp(TRACK.tx) / h;
  const tz = lerp(TRACK.tz) / h;
  return { x, y, z, tx, tz, nx: -tz, nz: tx, yaw: Math.atan2(-tz, tx) };
}

/** World (x, z) of the point `along` down the track and `lateral` to the right (platform side < 0). */
export function toWorld(i: number, along: number, lateral: number): [number, number] {
  const f = trackFrame(stationS[i] + along);
  return [f.x + f.nx * lateral, f.z + f.nz * lateral];
}

const pick = <T,>(rng: () => number, list: T[]): T => list[Math.floor(rng() * list.length)];

/** Station ids with a luggage cart or crates (the industrial feel), and the signature signs. */
const CART: StationId[] = ["solar", "next"];
const CRATES: StationId[] = ["yieldguard", "sahara"];

/**
 * SAHARA's helipad: a round pad on the ground just past the platform's far end and well back
 * from the track (u 18), where nothing hides it from the chase camera: the platform canopy, the
 * end board and the station building (which stands behind the train's centre) all stand between
 * the camera and anything nearer the platform or the track. It is beyond worldgen's guaranteed flat patch
 * (+-24 along), but the railbed's flat ground and the patch's fade keep it level to within a
 * few tenths, which the legs' deep footing hides. The deck stands PAD_HEIGHT above the ground:
 * at ground level it vanished behind the station's roof ridge from the camera's angle.
 */
const HELIPAD = { along: 28, u: 18, radius: 3.4 } as const;
/** Height of the pad's deck above the ground: raised on legs so it clears the roofline from the chase camera. */
export const PAD_HEIGHT = 2.2;
/** How far above the ground the drone hovers over the pad's centre (2.6 over the deck). */
export const DRONE_HOVER = PAD_HEIGHT + 2.6;

const cache = new Map<number, StationPlan>();

/** The plan for stop i (seeded by its index, memoised). */
export function stationPlan(i: number): StationPlan {
  const hit = cache.get(i);
  if (hit) return hit;
  const id = STATIONS[i].id;
  const rng = mulberry32(7000 + i * 131);
  const main = id === "departure" || id === "terminus";
  // Work Experience: an office block (more windows, flat roof) rather than a station house.
  const office = id === "experience";

  // The canopy covers the middle of the platform. The camera looks down from the right, so a
  // roof hides what is under it: the building is offset so a good part of its facade (windows,
  // ticket window) stands past the canopy's end and stays in view.
  const width = main ? 18 + Math.floor(rng() * 3) : office ? 15 : 9.5 + 1.5 * Math.floor(rng() * 3);
  const depth = main ? 6.4 : office ? 5.2 : id === "solar" ? 4.4 : 4.6 + 0.4 * Math.floor(rng() * 2);
  const length = main ? 22 : pick(rng, [12, 14, 16]);
  // Mostly ahead of the canopy: ahead of the train centre is where the camera and screen show it.
  // SAHARA's building always stands behind the train's centre, at the platform's near end: the
  // helipad is ahead of it, and a building there would hide the pad (and the drone over it) from
  // the chase camera.
  const ahead = rng() < 0.7;
  const dir = id === "sahara" || office ? -1 : ahead ? 1 : -1;
  let centre = main ? 2 : Math.floor(rng() * 4);
  // Main: centred in front of the porch tower (the camera looks over the train toward the
  // platform and the route map covers the left of the screen, so it stands a little ahead).
  let along = main ? 4 : centre + dir * (length / 2 + 0.1 * width);
  const excess = Math.abs(along) + width / 2 - 14.2;
  if (excess > 0) {
    along -= Math.sign(along) * excess;
    centre -= Math.sign(along) * excess;
  }
  // SAHARA and the office: as far back as the platform allows (facade ends at -14.2). At SAHARA
  // that keeps the pad clear of the roofline; the tall office would otherwise stand in front of
  // the far end board and hide half of its lettering from the chase camera.
  if (id === "sahara" || office) along = -(14.2 - width / 2);
  const half = width / 2;
  const doorAt = main || office ? along : along + (rng() - 0.5) * width * 0.3;
  const from = Math.max(-19, centre - length / 2);
  const to = Math.min(19, centre + length / 2);

  // Windows every 2.9 units (2.3 on the office), skipping the door; the ticket window is the
  // one nearest to it (the office has no ticket window).
  const windows: number[] = [];
  const pitch = office ? 2.3 : 2.9;
  for (let a = along - half + 1.6; a <= along + half - 1.6; a += pitch) {
    if (Math.abs(a - doorAt) > 1.7) windows.push(a);
  }
  const byDoor = [...windows].sort((p, q) => Math.abs(p - doorAt) - Math.abs(q - doorAt));
  const ticket = main || office || byDoor.length === 0 ? null : byDoor[0];
  const chimney = main || office || rng() < 0.3 ? null : along + (doorAt < along ? 1 : -1) * half * 0.55;

  const trim = main || office ? TRIMS[1] : pick(rng, TRIMS);
  const building: StationPlan["building"] = {
    along,
    width,
    depth,
    floors: main ? 2 : office ? 3 : 1,
    wallHeight: main ? 6.4 : office ? 9.6 : 3.7,
    wall: main ? WALLS[(i % 2) * 5] : office ? "#aab4be" : WALLS[(i + Math.floor(rng() * 2)) % WALLS.length],
    trim,
    roof: main ? ROOFS[0] : office ? "#4a5360" : ROOFS[(i + Math.floor(rng() * 3)) % ROOFS.length],
    door: doorAt,
    windows: windows.filter((w) => w !== ticket),
    ticket,
    chimney,
    tower: main,
    flatRoof: office,
  };

  const props: Prop[] = [];
  // Lamp posts along the platform edge outside the canopy (it carries its own lights).
  for (let a = -18 + rng() * 3; a < 18; a += 8 + rng() * 2) {
    if (a < from - 1 || a > to + 1) props.push({ kind: "lamp", along: a, u: 3.7 });
  }
  // Benches against the wall under the canopy, never in front of the door.
  const benches = main ? 3 : 1 + Math.floor(rng() * 3);
  for (let k = 0; k < benches; k++) {
    const a = along - half + 2 + ((k + rng() * 0.4) * (width - 4)) / Math.max(1, benches);
    if (Math.abs(a - doorAt) > 2.2) props.push({ kind: "bench", along: a, u: 5.9 });
  }
  props.push({ kind: "bin", along: from + 1.2, u: 5.6 });
  if (rng() < 0.6) props.push({ kind: "bin", along: to - 1.2, u: 5.6 });
  if (rng() < 0.65 || main) props.push({ kind: "timetable", along: along + half + 1.4, u: 5.2 });
  if (rng() < 0.75 || main) {
    props.push({ kind: "planter", along: along - half - 1, u: 6 });
    props.push({ kind: "planter", along: along + half + 1, u: 6 });
  }
  if (CRATES.includes(id)) props.push({ kind: "crates", along: from - 2.2, u: 5.4 });
  if (CART.includes(id)) props.push({ kind: "cart", along: to + 3, u: 5 });
  if (id === "vaani") props.push({ kind: "waveSign", along: along - half - 3, u: 4.6 });
  if (id === "yieldguard") props.push({ kind: "waferSign", along: along - half - 3, u: 4.6 });

  // Solar: rows of tilted panels on the field behind the building, plus panels on the canopy.
  const panels: StationPlan["panels"] = [];
  if (id === "solar") {
    const first = BUILD_FRONT + depth + 2.3;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 12; c++) panels.push({ along: (c - 5.5) * 3.7, u: first + r * 3.2 });
    }
  }

  // The fence runs along the back edge, either side of the building.
  const end = PLATFORM.halfLength - PLATFORM.ramp;
  const fence: [number, number][] = [
    [-end, along - half - 0.5],
    [along + half + 0.5, end],
  ];

  const plan: StationPlan = {
    index: i,
    id,
    kind: main ? "main" : "halt",
    s: stationS[i],
    building,
    canopy: { from, to, spacing: 4, clock: !main && rng() < 0.7 ? (from + to) / 2 : null, roof: main ? "#b5bdc9" : pick(rng, CANOPY_ROOFS) },
    props,
    fence,
    panels,
    roofPanels: id === "solar",
    helipad: id === "sahara" ? { ...HELIPAD } : null,
  };
  cache.set(i, plan);
  return plan;
}

/** The two name boards at the platform ends (along, u of the board's centre); both face back down the track. */
export function endSigns(i: number): { along: number; u: number }[] {
  void i; // same spot at every stop: just past each end of the building's platform run
  const a = PLATFORM.halfLength - 4;
  return [
    { along: -a, u: END_SIGN.u },
    { along: a, u: END_SIGN.u },
  ];
}

/** Heights (above the rail tops) of the canopy roof at the wall and at the eave. */
export function canopyHeights(p: StationPlan) {
  const yb = PLATFORM.height + (p.kind === "main" ? 3.8 : 3.3);
  return { yb, ye: yb - 0.45 };
}

/** World pose of a thing at (along, lateral) standing on the platform: base point and yaw of the track there. */
function platformPose(i: number, along: number, lateral: number) {
  const f = trackFrame(stationS[i] + along);
  return { position: [f.x + f.nx * lateral, f.y + PLATFORM.height, f.z + f.nz * lateral] as [number, number, number], yaw: f.yaw };
}

/** World pose of both end boards: base centre on the slab and the yaw that turns the front back down the track. */
export function endSignPlacements(i: number) {
  return endSigns(i).map((sg) => {
    const { position, yaw } = platformPose(i, sg.along, -sg.u);
    return { position, rotationY: yaw + END_SIGN_YAW };
  });
}

/** Where the station name goes on the canopy fascia (centre of the board, facing the track). */
export function fasciaPlacement(i: number) {
  const p = stationPlan(i);
  const { position, yaw } = platformPose(i, (p.canopy.from + p.canopy.to) / 2, -3.12);
  const { ye } = canopyHeights(p);
  // Fascia spans ye - 0.72 .. ye + 0.12 above the rails; position is on the slab (+ PLATFORM.height).
  position[1] += ye - 0.3 - PLATFORM.height;
  return { position, rotationY: yaw, maxWidth: Math.min(14, p.canopy.to - p.canopy.from - 3) };
}
