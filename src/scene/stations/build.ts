import * as THREE from "three";
import { STATIONS } from "@/content/route";
import { Kit } from "./kit";
import { building, canopy, platform } from "./parts";
import { stationPlan } from "./placement";
import { fence, endBoards, furniture, solar } from "./props";

/**
 * Builds every station into two geometries: `kit` (platforms, buildings, canopies,
 * furniture, signs: vertex-coloured, with an emissive tint per vertex) and `panels` (the
 * solar panels, a glossier material). Each is one draw call for the whole route.
 * Cached: the stops never change, and re-entering the ride costs nothing.
 */
export interface StationGeometry {
  kit: THREE.BufferGeometry;
  panels: THREE.BufferGeometry;
  /** Triangle counts, for the draw-call / budget notes. */
  triangles: { kit: number; panels: number };
}

let cached: StationGeometry | null = null;

export function buildStations(): StationGeometry {
  if (cached) return cached;
  const kit = new Kit();
  const panels = new Kit();
  STATIONS.forEach((_, i) => {
    const p = stationPlan(i);
    platform(kit, p);
    canopy(kit, p);
    building(kit, p);
    furniture(kit, p);
    fence(kit, p);
    endBoards(kit, p);
    solar(panels, p);
  });
  cached = { kit: kit.build(), panels: panels.build(), triangles: { kit: kit.triangles, panels: panels.triangles } };
  return cached;
}
