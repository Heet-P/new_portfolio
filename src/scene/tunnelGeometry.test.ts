import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { terrainChunk } from "./geometry";
import { TRACK } from "./route3d";
import { portal, tunnelShell } from "./tunnelGeometry";
import { BORE_HALF, BORE_SPRING, generateWorld, heightAt } from "./worldgen";

const world = generateWorld(1);
const shell = tunnelShell(world.tunnels);
/** What the renderer draws: terrain, roof, floor and portal rock are single-sided (FrontSide). */
const front = new THREE.MeshBasicMaterial({ side: THREE.FrontSide });
/** How deep into the hill (units past a portal's plane) a line of sight may go before it must be stopped. */
const DEPTH = 9;

/** World point at arc length s, `lat` right of the track and `up` above the rails. */
function at(s: number, lat: number, up: number): THREE.Vector3 {
  const i = Math.round(s / TRACK.step);
  return new THREE.Vector3(TRACK.px[i] - TRACK.tz[i] * lat, TRACK.py[i] + up, TRACK.pz[i] + TRACK.tx[i] * lat);
}

/** The terrain grid cells within `r` units of (x, z), as one chunk (same global grid as World). */
function localTerrain(x: number, z: number, r: number, step: number): THREE.BufferGeometry {
  const { x0, z0 } = world.bounds;
  const g = terrainChunk(
    world,
    Math.floor((x - r - x0) / step),
    Math.ceil((x + r - x0) / step),
    Math.floor((z - r - z0) / step),
    Math.ceil((z + r - z0) / step),
    step,
  );
  if (!g) throw new Error("no terrain");
  return g;
}

/**
 * Every tunnel mouth, both ends, seen from wherever a visitor's camera could be outside it:
 * the portal rock, the terrain (desktop and phone grids) and the floor must close
 * the hillside around the opening. A ray from such a viewpoint through a point of the portal's
 * plane (a ring around the bore opening, below the hill's surface) has to hit a front face
 * before it gets more than DEPTH units into the hill (the rock face slopes back ~6 units);
 * through a seam it would fly on to the far landscape or the open sky. The bore opening itself
 * is left out, of course.
 */
describe("tunnel portals are sealed against the hillside", () => {
  const portals = world.tunnels.flatMap((t, k) => [
    { name: `tunnel ${k + 1} entrance`, s: t.s0, out: -1 },
    { name: `tunnel ${k + 1} exit`, s: t.s1, out: 1 },
  ]);
  const ray = new THREE.Raycaster();
  const hits: THREE.Intersection[] = [];

  for (const step of [6, 9]) {
    for (const p of portals) {
      it(`${p.name}, terrain grid ${step}`, () => {
        const c = at(p.s, 0, 0);
        const k = world.tunnels.findIndex((t) => t.s0 === p.s || t.s1 === p.s);
        const meshes = [
          new THREE.Mesh(localTerrain(c.x, c.z, 70, step), front),
          new THREE.Mesh(portal(p.s, p.out === -1 ? 1 : -1, k * 2 + (p.out === -1 ? 0 : 1)), front),
          new THREE.Mesh(shell.floor, front),
        ];
        // Ring of targets in the portal's plane: across the hillside and up to just under its surface.
        const inward = -p.out;
        const axis = at(p.s + inward, 0, 0).sub(c).normalize();
        const targets: THREE.Vector3[] = [];
        for (let lat = -21; lat <= 21; lat += 3) {
          const surface = heightAt(world, at(p.s + inward * 4, lat, 0).x, at(p.s + inward * 4, lat, 0).z) - TRACK.py[Math.round(p.s)];
          for (let up = 0; up <= 16; up += 2) {
            if (up > surface - 1.5) continue;
            // The bore opening (with a margin): a view into the tunnel is meant to be open.
            const r = BORE_HALF + 1.5;
            if (Math.abs(lat) < r && up < BORE_SPRING + Math.sqrt(r * r - lat * lat)) continue;
            targets.push(at(p.s, lat, up));
          }
        }
        expect(targets.length).toBeGreaterThan(50);
        const leaks: string[] = [];
        let views = 0;
        for (const d of [25, 45, 65]) {
          for (const lat of [-30, -12, 0, 12, 30]) {
            for (const up of [8, 16, 28]) {
              const eye = at(p.s + p.out * d, lat, up);
              // Only places a camera can be: above the ground.
              if (eye.y < heightAt(world, eye.x, eye.z) + 2) continue;
              views++;
              for (const t of targets) {
                ray.set(eye, t.clone().sub(eye).normalize());
                hits.length = 0;
                ray.intersectObjects(meshes, false, hits);
                // How far past the portal's plane, into the hill, the line of sight got before something stopped it.
                const depth = hits.length ? hits[0].point.sub(c).dot(axis) : Infinity;
                if (depth > DEPTH) leaks.push(`eye(d${d},lat${lat},up${up}) -> ${t.toArray().map((v) => v.toFixed(1))}`);
              }
            }
          }
        }
        expect(views).toBeGreaterThan(10);
        expect(leaks.slice(0, 8)).toEqual([]);
      });
    }
  }
});
