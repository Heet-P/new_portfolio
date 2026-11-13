import { describe, expect, it } from "vitest";
import { PROFILE } from "@/content/route";
import { ATLAS, atlasRect, layoutPanels, PANEL, panelPlacement, reelFor, skillReel, strobeAmount, STROBE } from "./tunnelReel";
import { BORE_HALF, generateWorld } from "./worldgen";

const world = generateWorld(1);

describe("skillReel", () => {
  const reel = skillReel(PROFILE.skills);
  const all = Object.values(PROFILE.skills).flat();

  it("lists every skill exactly once", () => {
    expect(reel.map((r) => r.skill).sort()).toEqual([...all].sort());
  });

  it("keeps the resume's order (groups in order, skills in order) and tags each with its group", () => {
    expect(reel.map((r) => r.skill)).toEqual(all);
    for (const [group, skills] of Object.entries(PROFILE.skills)) {
      for (const skill of skills) expect(reel.find((r) => r.skill === skill)?.group).toBe(group);
    }
  });

  it("is empty for no skills", () => {
    expect(skillReel({})).toEqual([]);
  });
});

describe("layoutPanels", () => {
  const span = { s0: 100, s1: 184 };

  it("places n panels evenly along the span, half a gap in from each end", () => {
    const slots = layoutPanels(span, 6);
    expect(slots).toHaveLength(6);
    const gap = (span.s1 - span.s0) / 6;
    slots.forEach((slot, i) => expect(slot.s).toBeCloseTo(span.s0 + (i + 0.5) * gap, 6));
  });

  it("alternates walls, one panel per wall in turn", () => {
    const sides = layoutPanels(span, 7).map((p) => p.side);
    expect(sides).toEqual([1, -1, 1, -1, 1, -1, 1]);
  });

  it("returns nothing for zero panels", () => {
    expect(layoutPanels(span, 0)).toEqual([]);
  });
});

describe("reelFor (the reel spread over the world's tunnels)", () => {
  const reel = skillReel(PROFILE.skills);
  const perTunnel = reelFor(reel, world.tunnels);

  it("fills every tunnel and keeps each panel inside its tunnel", () => {
    expect(perTunnel).toHaveLength(world.tunnels.length);
    perTunnel.forEach((panels, k) => {
      expect(panels.length).toBeGreaterThan(0);
      for (const p of panels) {
        expect(p.s).toBeGreaterThan(world.tunnels[k].s0);
        expect(p.s).toBeLessThan(world.tunnels[k].s1);
      }
    });
  });

  it("hangs the title card first in every tunnel, on the right wall, and skills everywhere else", () => {
    for (const panels of perTunnel) {
      expect(panels[0].entry).toBeNull();
      expect(panels[0].side).toBe(1);
      for (const p of panels.slice(1)) expect(p.entry).not.toBeNull();
    }
  });

  it("shows every skill at least once across the tunnels", () => {
    const shown = new Set(perTunnel.flat().map((p) => p.entry?.skill));
    for (const r of reel) expect(shown.has(r.skill)).toBe(true);
  });

  it("leaves no bare stretch: neighbouring panels are never more than ~1.3 spacings apart", () => {
    for (const panels of perTunnel) {
      for (let i = 1; i < panels.length; i++) expect(panels[i].s - panels[i - 1].s).toBeLessThanOrEqual(PANEL.spacing * 1.3);
    }
  });

  it("repeats the reel when the tunnels are longer than it, rather than leaving bare walls", () => {
    const two = reelFor(reel.slice(0, 3), [{ s0: 0, s1: 80 }]);
    expect(two[0].length).toBeGreaterThan(3);
    expect(two[0].slice(1).map((p) => p.entry?.skill).slice(0, 4)).toEqual([reel[0].skill, reel[1].skill, reel[2].skill, reel[0].skill]);
  });
});

describe("panelPlacement", () => {
  // Track running along +x at the origin: right of travel is +z.
  const base = { px: 10, py: 2, pz: 0, tx: 1, tz: 0 };

  it("hangs on the requested wall, between the train's side and the bore wall", () => {
    for (const side of [1, -1] as const) {
      const p = panelPlacement(base.px, base.py, base.pz, base.tx, base.tz, side);
      // Lateral distance (towards `side`) of the panel's two vertical edges: the wall edge and the free edge.
      const half = PANEL.width / 2;
      const edges = [1, -1].map((k) => side * (p.z + k * p.right[2] * half - base.pz));
      expect(Math.max(...edges)).toBeLessThanOrEqual(BORE_HALF + 1e-6);
      expect(Math.min(...edges)).toBeGreaterThanOrEqual(PANEL.trainClearance);
    }
  });

  it("faces back down the track and inward, so the chase camera reads it", () => {
    const p = panelPlacement(base.px, base.py, base.pz, base.tx, base.tz, 1);
    // Normal points against the direction of travel (-x) and toward the centreline (-z for the right wall).
    expect(p.normal[0]).toBeLessThan(0);
    expect(p.normal[2]).toBeLessThan(0);
    expect(Math.hypot(p.normal[0], p.normal[2])).toBeCloseTo(1, 6);
    // Width axis is horizontal and square to the normal.
    expect(p.right[1]).toBe(0);
    expect(p.right[0] * p.normal[0] + p.right[2] * p.normal[2]).toBeCloseTo(0, 6);
  });

  it("sits at a height the chase camera sees", () => {
    const p = panelPlacement(base.px, base.py, base.pz, base.tx, base.tz, -1);
    expect(p.y).toBeCloseTo(base.py + PANEL.y, 6);
  });
});

describe("strobeAmount", () => {
  it("peaks at 1 as a panel sweeps into view ahead of the camera", () => {
    expect(strobeAmount(STROBE.ahead)).toBeCloseTo(1, 6);
  });

  it("is zero well away from the camera and falls off symmetrically", () => {
    expect(strobeAmount(STROBE.ahead + STROBE.width * 4)).toBe(0);
    expect(strobeAmount(STROBE.ahead - STROBE.width * 4)).toBe(0);
    expect(strobeAmount(STROBE.ahead + 2)).toBeCloseTo(strobeAmount(STROBE.ahead - 2), 9);
    expect(strobeAmount(STROBE.ahead + 2)).toBeLessThan(1);
    expect(strobeAmount(STROBE.ahead + 2)).toBeGreaterThan(0);
  });
});

describe("atlasRect", () => {
  // One cell per skill plus the title card's.
  const count = skillReel(PROFILE.skills).length + 1;
  const rects = Array.from({ length: count }, (_, i) => atlasRect(i));

  it("fits every poster and the title card in the atlas", () => {
    expect(count).toBeLessThanOrEqual(ATLAS.capacity);
    expect(atlasRect(ATLAS.capacity - 1).y + ATLAS.cellH).toBeLessThanOrEqual(ATLAS.size);
  });

  it("gives every poster its own cell inside the atlas, none overlapping", () => {
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(ATLAS.size);
      expect(r.y + r.h).toBeLessThanOrEqual(ATLAS.size);
    }
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap).toBe(false);
      }
    }
  });

  it("cells have the panels' aspect, so type never stretches", () => {
    const r = rects[0];
    expect(r.w / r.h).toBeCloseTo(PANEL.width / PANEL.height, 2);
  });
});
