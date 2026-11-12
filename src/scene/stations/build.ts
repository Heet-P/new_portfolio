import * as THREE from "three";
import { STATIONS } from "@/content/route";
import { Kit } from "./kit";
import { building, canopy, platform } from "./parts";
import { stationPlan } from "./placement";
import { drone, endBoards, fence, furniture, helipad, solar } from "./props";

/**
 * Builds every station into two geometries: `kit` (platforms, buildings, canopies,
 * furniture, signs: vertex-coloured, with an emissive tint per vertex) and `panels` (the
 * solar panels, a glossier material). Each is one draw call for the whole route. SAHARA's
 * helipad is part of `kit`; its quadcopter is a third, tiny `drone` mesh because it bobs on
 * its own (the only extra draw call, null if no station has a helipad).
 * Cached: the stops never change, and re-entering the ride costs nothing.
 */
export interface StationGeometry {
  kit: THREE.BufferGeometry;
  panels: THREE.BufferGeometry;
  /** SAHARA's quadcopter, in world space at its hover height (the mesh bobs on Y). */
  drone: THREE.BufferGeometry | null;
  /** Triangle counts, for the draw-call / budget notes. */
  triangles: { kit: number; panels: number; drone: number };
}

let cached: StationGeometry | null = null;

export function buildStations(): StationGeometry {
  if (cached) return cached;
  const kit = new Kit();
  const panels = new Kit();
  const dr = new Kit();
  STATIONS.forEach((_, i) => {
    const p = stationPlan(i);
    platform(kit, p);
    canopy(kit, p);
    building(kit, p);
    furniture(kit, p);
    fence(kit, p);
    endBoards(kit, p);
    helipad(kit, p);
    solar(panels, p);
    drone(dr, p);
  });
  cached = {
    kit: kit.build(),
    panels: panels.build(),
    drone: dr.triangles > 0 ? dr.build() : null,
    triangles: { kit: kit.triangles, panels: panels.triangles, drone: dr.triangles },
  };
  return cached;
}
