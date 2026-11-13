import * as THREE from "three";
import { STATIONS } from "@/content/route";
import { Kit } from "./kit";
import { building, canopy, platform } from "./parts";
import { stationPlan } from "./placement";
import { drone, endBoards, fence, furniture, helipad, solar } from "./props";

/**
 * Builds the stations: `kit` (platforms, buildings, canopies, furniture, signs: vertex-coloured,
 * with an emissive tint per vertex) as ONE geometry PER STATION, so each stop is its own draw
 * call that three frustum-culls (main and shadow pass) while it is off screen, which is nearly
 * always: only one or two stops are ever in view. `panels` holds the solar panels (a glossier
 * material; only Solar has any, so it is local too). SAHARA's helipad is part of its kit; its
 * quadcopter is a tiny separate `drone` mesh because it bobs on its own (null if no station
 * has a helipad). Cached: the stops never change, and re-entering the ride costs nothing.
 */
export interface StationGeometry {
  /** One geometry per station, in route order. */
  kit: THREE.BufferGeometry[];
  panels: THREE.BufferGeometry;
  /** SAHARA's quadcopter, in world space at its hover height (the mesh bobs on Y). */
  drone: THREE.BufferGeometry | null;
  /** Triangle counts, for the draw-call / budget notes. */
  triangles: { kit: number; panels: number; drone: number };
}

let cached: StationGeometry | null = null;

export function buildStations(): StationGeometry {
  if (cached) return cached;
  const kits: Kit[] = [];
  const panels = new Kit();
  const dr = new Kit();
  STATIONS.forEach((_, i) => {
    const p = stationPlan(i);
    const kit = new Kit();
    kits.push(kit);
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
    kit: kits.map((k) => k.build()),
    panels: panels.build(),
    drone: dr.triangles > 0 ? dr.build() : null,
    triangles: { kit: kits.reduce((n, k) => n + k.triangles, 0), panels: panels.triangles, drone: dr.triangles },
  };
  return cached;
}
