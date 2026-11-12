import { Kit } from "./kit";
import { LAMP, roofHeightAt } from "./parts";
import { canopyHeights, END_SIGN, END_SIGN_YAW, endSigns, PLATFORM, type Prop, type StationPlan } from "./placement";

/**
 * Platform furniture, name boards, signature signs and solar panels, built into Kits.
 * Same local frame as parts.ts: x along the track, y up, z to the right (platform side z < 0).
 */

const H = PLATFORM.height;
const DARK = "#2d3a4a";
const WOOD = "#8b6a44";
const BOARD = "#1d2a4c";

/** Lamp post: base, tapering pole, an arm reaching over the platform edge and a glowing head. */
function lamp(kit: Kit, u: number) {
  kit.cyl([0, H + 0.2, -u], 0.17, 0.12, 0.4, 8, DARK);
  kit.cyl([0, H + 2.2, -u], 0.07, 0.05, 3.9, 8, "#2a3a36");
  kit.box([0, H + 4.1, -u + 0.3], [0.08, 0.08, 0.7], "#2a3a36");
  kit.box([0, H + 4.14, -u + 0.62], [0.52, 0.1, 0.4], DARK);
  kit.box([0, H + 4.02, -u + 0.62], [0.36, 0.1, 0.28], "#efe3bd", { glow: LAMP });
}

/** Bench: slatted seat and back on iron ends, facing the track. */
function bench(kit: Kit, u: number) {
  for (let k = 0; k < 3; k++) kit.box([0, H + 0.46, -u + (k - 1) * 0.17], [1.7, 0.05, 0.14], WOOD);
  for (let k = 0; k < 3; k++) kit.box([0, H + 0.72 + k * 0.14, -u - 0.24 - k * 0.03], [1.7, 0.1, 0.04], WOOD, { rot: [-0.18, 0, 0] });
  for (const s of [-1, 1]) {
    kit.box([s * 0.78, H + 0.23, -u], [0.07, 0.46, 0.5], DARK);
    kit.box([s * 0.78, H + 0.7, -u - 0.28], [0.07, 0.5, 0.07], DARK, { rot: [-0.18, 0, 0] });
  }
}

/** Litter bin: green drum with a band and a domed lid. */
function bin(kit: Kit, u: number) {
  kit.cyl([0, H + 0.4, -u], 0.3, 0.26, 0.8, 8, "#3d5a4c");
  kit.cyl([0, H + 0.45, -u], 0.31, 0.31, 0.06, 8, "#d8c27a");
  kit.cyl([0, H + 0.86, -u], 0.32, 0.18, 0.14, 8, "#2f4a3d");
}

/** Planter box with a clipped bush and a few flowers. */
function planter(kit: Kit, u: number, seed: number) {
  kit.box([0, H + 0.25, -u], [1.2, 0.5, 0.6], "#7a5a3a");
  kit.box([0, H + 0.52, -u], [1.05, 0.05, 0.45], "#3a2a20");
  const greens = ["#4f7d3a", "#5f8d44", "#456f33"];
  for (let k = 0; k < 3; k++) kit.blob([(k - 1) * 0.36, H + 0.85 + (k === 1 ? 0.12 : 0), -u], [0.42, 0.4, 0.42], greens[(k + seed) % 3], seed + k);
  for (let k = 0; k < 4; k++) kit.box([(k - 1.5) * 0.28, H + 1.15 + (k % 2) * 0.1, -u + 0.18], [0.1, 0.1, 0.1], k % 2 ? "#e0826a" : "#f0c64a");
}

/** Timetable / departure board on two posts: dark panel with glowing amber rows. */
function timetable(kit: Kit, u: number) {
  for (const s of [-1, 1]) kit.box([s * 0.85, H + 1.2, -u - 0.05], [0.08, 2.4, 0.08], DARK);
  kit.box([0, H + 1.85, -u], [2, 1.35, 0.1], BOARD);
  kit.box([0, H + 1.85, -u + 0.06], [1.8, 1.15, 0.03], "#0e141e");
  kit.box([0, H + 2.28, -u + 0.09], [1.5, 0.12, 0.02], "#e8b34a", { glow: [1, 0.7, 0.25] });
  [1.2, 0.9, 1.35, 1.05].forEach((w, k) => {
    kit.box([-0.9 + w / 2 + 0.1, H + 1.98 - k * 0.22, -u + 0.09], [w, 0.06, 0.02], "#e8b34a", { glow: [0.9, 0.62, 0.22] });
    kit.box([0.65, H + 1.98 - k * 0.22, -u + 0.09], [0.28, 0.06, 0.02], "#7ad6c0", { glow: [0.25, 0.8, 0.7] });
  });
  kit.box([0, H + 2.62, -u - 0.04], [2.15, 0.08, 0.3], DARK);
}

/** Stacked wooden crates and a barrel. */
function crates(kit: Kit, u: number) {
  const tones = ["#a07a4a", "#8f6c40", "#b08a55"];
  const crate = (x: number, y: number, sz: number, t: number, rot = 0) => {
    kit.box([x, H + y, -u], [sz, sz, sz], tones[t], { rot: [0, rot, 0] });
    kit.box([x, H + y, -u], [sz + 0.04, 0.08, sz + 0.04], "#6e5030", { rot: [0, rot, 0] });
    kit.box([x, H + y + sz * 0.3, -u], [sz + 0.04, 0.06, sz + 0.04], "#6e5030", { rot: [0, rot, 0] });
  };
  crate(0, 0.4, 0.8, 0);
  crate(0.95, 0.35, 0.7, 1, 0.2);
  crate(0.1, 1.15, 0.65, 2, -0.15);
  kit.cyl([-1, H + 0.45, -u + 0.1], 0.36, 0.34, 0.9, 8, "#5d6d7e");
  kit.cyl([-1, H + 0.5, -u + 0.1], 0.37, 0.37, 0.07, 8, "#3d4a58");
}

/** Luggage cart: flat bed on four wheels with a handle, a suitcase and a trunk. */
function cart(kit: Kit, u: number) {
  kit.box([0, H + 0.55, -u], [1.9, 0.1, 0.9], "#7a5a3a");
  for (const x of [-0.7, 0.7]) for (const z of [-0.4, 0.4]) kit.cyl([x, H + 0.28, -u + z], 0.28, 0.28, 0.07, 10, DARK, { rot: [Math.PI / 2, 0, 0] });
  kit.box([1.05, H + 0.95, -u], [0.06, 0.8, 0.06], DARK);
  kit.box([1.05, H + 1.35, -u], [0.06, 0.06, 0.8], DARK);
  kit.box([-0.3, H + 0.95, -u], [0.8, 0.7, 0.5], "#a8553f");
  kit.box([-0.3, H + 0.95, -u], [0.84, 0.07, 0.54], "#d8c27a");
  kit.box([0.4, H + 0.8, -u + 0.05], [0.55, 0.4, 0.4], "#33425e");
  kit.box([0.4, H + 1.03, -u + 0.05], [0.2, 0.06, 0.06], "#d8c27a");
}

/** Vaani: a small free-standing sign with a glowing teal voice waveform. */
function waveSign(kit: Kit, u: number) {
  for (const s of [-1, 1]) kit.box([s * 0.95, H + 0.9, -u - 0.05], [0.08, 1.8, 0.08], DARK);
  kit.box([0, H + 1.9, -u], [2.2, 1.1, 0.1], BOARD);
  kit.box([0, H + 1.9, -u + 0.06], [2, 0.9, 0.03], "#0b1a22");
  for (let k = 0; k < 15; k++) {
    const hgt = 0.1 + 0.62 * Math.abs(Math.sin(k * 0.62 + 0.5) * Math.cos(k * 0.21));
    kit.box([(k - 7) * 0.125, H + 1.9, -u + 0.09], [0.07, hgt, 0.02], "#3fd1c4", { glow: [0.15, 0.85, 0.78] });
  }
}

/** YieldGuard: a round wafer map, a grid of dies with a few failing ones, on a post. */
function waferSign(kit: Kit, u: number) {
  kit.box([0, H + 0.9, -u - 0.05], [0.1, 1.8, 0.1], DARK);
  kit.group([0, H + 2.15, -u], [0, 0, 0], () => {
    kit.cyl([0, 0, 0], 0.95, 0.95, 0.1, 18, BOARD, { rot: [Math.PI / 2, 0, 0] });
    kit.cyl([0, 0, 0.06], 0.78, 0.78, 0.04, 18, "#8fa6b8", { rot: [Math.PI / 2, 0, 0] });
    for (let ix = -5; ix <= 5; ix++) {
      for (let iy = -5; iy <= 5; iy++) {
        const x = ix * 0.125;
        const y = iy * 0.125;
        if (Math.hypot(x, y) > 0.68) continue;
        const bad = (ix + 3) ** 2 + (iy - 2) ** 2 < 2.5; // a cluster of failures: the "defect map"
        kit.box([x, y, 0.09], [0.1, 0.1, 0.02], bad ? "#b8473a" : "#2a6a8e", { glow: bad ? [0.9, 0.2, 0.12] : [0.1, 0.45, 0.7] });
      }
    }
  });
}

const PROPS: Record<Prop["kind"], (kit: Kit, u: number, seed: number) => void> = {
  lamp,
  bench,
  bin,
  planter,
  timetable,
  crates,
  cart,
  waveSign,
  waferSign,
};

/** All furniture of a station. */
export function furniture(kit: Kit, p: StationPlan) {
  p.props.forEach((q, k) => {
    kit.at(p.s + q.along);
    PROPS[q.kind](kit, q.u, k);
  });
}

/** Picket fence along the back edge of the platform, either side of the building. */
export function fence(kit: Kit, p: StationPlan) {
  const colour = p.building.trim === "#33425e" ? "#d8d2c0" : p.building.trim;
  const u = PLATFORM.outer - 0.12;
  for (const [a0, a1] of p.fence) {
    for (let a = a0; a <= a1; a += 0.75) {
      kit.at(p.s + a);
      kit.box([0, H + 0.45, -u], [0.09, 0.9, 0.05], colour);
      kit.box([0, H + 0.93, -u], [0.09, 0.06, 0.06], colour, { rot: [0, 0, Math.PI / 4] });
    }
    for (let a = a0; a < a1; a += 4) {
      const len = Math.min(4, a1 - a);
      kit.at(p.s + a + len / 2);
      for (const y of [0.3, 0.72]) kit.box([0, H + y, -u - 0.06], [len, 0.07, 0.05], colour);
    }
    for (const a of [a0, a1]) {
      kit.at(p.s + a);
      kit.box([0, H + 0.5, -u], [0.16, 1, 0.16], colour);
    }
  }
}

/**
 * Name boards at both ends of the platform: dark board in a cream frame with an amber rule,
 * a little cap roof, on two posts reaching down to the ground. Turned to face back down the
 * track and a little toward the camera. The lettering is drawn by Station.tsx.
 */
export function endBoards(kit: Kit, p: StationPlan) {
  const { width: w, height: h, bottom, u } = END_SIGN;
  for (const sign of endSigns(p.index)) {
    kit.at(p.s + sign.along);
    kit.group([0, H, -u], [0, END_SIGN_YAW, 0], () => {
      const cy = bottom + h / 2;
      kit.box([0, cy, 0], [w, h, 0.14], BOARD);
      kit.box([0, cy + h / 2 + 0.05, 0.02], [w + 0.2, 0.12, 0.2], "#efe3c0");
      kit.box([0, cy - h / 2 - 0.05, 0.02], [w + 0.2, 0.12, 0.2], "#efe3c0");
      for (const s of [-1, 1]) kit.box([(s * (w + 0.1)) / 2, cy, 0.02], [0.12, h, 0.2], "#efe3c0");
      kit.box([0, bottom + 0.2, 0.09], [w - 0.5, 0.06, 0.02], "#e9a23b");
      kit.box([0, cy + h / 2 + 0.2, 0], [w + 0.5, 0.1, 0.5], "#3a4350", { rot: [0.15, 0, 0] });
      for (const s of [-1, 1]) kit.box([s * (w / 2 - 0.45), (bottom + 0.2 - 1.6) / 2, -0.14], [0.2, bottom + 1.8, 0.2], "#8b9097");
    });
  }
}

/** One solar panel unit centred on the local origin: silver frame and a 3 x 2 grid of blue cells. */
function panelCells(kit: Kit, length: number, depth: number) {
  kit.box([0, 0, 0], [length, 0.07, depth], "#c4c9d2");
  const cw = length / 3 - 0.1;
  const cd = depth / 2 - 0.12;
  for (let a = 0; a < 3; a++) {
    for (let b = 0; b < 2; b++) {
      kit.box([(a - 1) * (cw + 0.1), 0.035, (b - 0.5) * (cd + 0.12)], [cw, 0.05, cd], (a + b) % 2 ? "#1c3d86" : "#18357a");
    }
  }
}

/**
 * Solar stop: rows of tilted panels on frames in the field behind the building (they lean
 * toward the track, like the sun-facing rows of a real farm), and panels lying on the canopy roof.
 */
export function solar(panels: Kit, p: StationPlan) {
  const tilt = (25 * Math.PI) / 180;
  for (const q of p.panels) {
    panels.at(p.s + q.along);
    // Terrain sits 0.35 below the rail tops here.
    const base = -0.35;
    for (const s of [-1, 1]) panels.box([s * 1, base + 0.5, -q.u], [0.12, 1, 0.12], "#8b9097");
    panels.group([0, base + 0.95, -q.u], [tilt, 0, 0], () => panelCells(panels, 3.4, 2.2));
  }
  if (!p.roofPanels) return;
  const { yb } = canopyHeights(p);
  const slope = Math.atan2(0.45, 3.35);
  const { from, to } = p.canopy;
  for (let a = from + 1.2; a + 1.05 < to; a += 2.25) {
    panels.at(p.s + a);
    for (const z of [-5.55, -4.2]) {
      // Roof surface at that z, plus half the panel's thickness.
      const y = roofHeightAt(yb, z) + 0.08;
      panels.group([0, y, z], [slope, 0, 0], () => panelCells(panels, 2.1, 1.25));
    }
  }
}
