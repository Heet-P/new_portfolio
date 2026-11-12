"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { sweep } from "./geometry";
import { MATS } from "./materials";
import { ROUTE, TRACK } from "./route3d";
import type { WorldLayout } from "./worldgen";

/**
 * Overhead line dimensions (units, relative to the rail tops). The contact wire sits just
 * on the raised pantograph (the model is 6 tall); the messenger wire above it sags
 * between masts and hangs the contact wire on droppers.
 */
const OHL = {
  /** Mast spacing along the track. */
  span: 28,
  /** Masts stand this far to the right of the track centre (the platforms are on the left). */
  mastSide: 3.6,
  contactY: 6.1,
  messengerY: 7.3,
  /** Messenger sag at mid-span. */
  sag: 0.55,
  /** Distance between droppers. */
  dropper: 7,
} as const;

/** Strip to position + normal, non-indexed, so different builders merge. */
function bare(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const n = g.index ? g.toNonIndexed() : g;
  for (const name of Object.keys(n.attributes)) if (name !== "position" && name !== "normal") n.deleteAttribute(name);
  return n;
}

/**
 * One mast in its local frame (x along the track, y up, z to the right): a pole, a
 * cantilever arm reaching over the track, a diagonal brace and the register arm that
 * holds the contact wire.
 */
function mastGeometry(): THREE.BufferGeometry {
  const { mastSide: z, messengerY: top, contactY } = OHL;
  const braceLen = Math.hypot(2.4, 1.45);
  const parts = [
    new THREE.BoxGeometry(0.3, top + 1, 0.3).translate(0, (top + 1) / 2 - 0.5, z),
    new THREE.BoxGeometry(0.16, 0.16, z + 0.8).translate(0, top + 0.05, (z - 0.8) / 2),
    new THREE.BoxGeometry(0.1, 0.1, braceLen)
      .rotateX(-Math.atan2(1.45, 2.4))
      .translate(0, top - 0.72, z - 1.2),
    new THREE.BoxGeometry(0.08, top - contactY, 0.08).translate(0, (top + contactY) / 2, 0),
  ];
  const g = mergeGeometries(parts.map(bare));
  g.computeVertexNormals();
  return g;
}

/**
 * Overhead catenary along the whole line: instanced masts every `span` units on the right
 * of the track (none inside tunnel bores or along the wooden trestle, where there is
 * nothing to stand on), plus one merged geometry for the contact wire, the sagging
 * messenger wire and the droppers between them. Two draw calls.
 */
export function Catenary({ world, shadows }: { world: WorldLayout; shadows: boolean }) {
  const masts = useRef<THREE.InstancedMesh>(null);
  const built = useMemo(() => {
    const blocked = [
      ...world.tunnels.map((t) => [t.s0 - 2, t.s1 + 2]),
      ...world.bridges.filter((b) => b.kind === "trestle").map((b) => [b.s0 - 2, b.s1 + 2]),
    ];
    const spots: number[] = [];
    for (let s = OHL.span / 2; s < ROUTE.length; s += OHL.span) {
      if (!blocked.some(([a, b]) => s > a && s < b)) spots.push(s);
    }
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const mats = spots.map((s) => {
      const i = Math.min(TRACK.count - 1, Math.round(s / TRACK.step));
      q.setFromAxisAngle(up, Math.atan2(-TRACK.tz[i], TRACK.tx[i]));
      return new THREE.Matrix4().compose(
        new THREE.Vector3(TRACK.px[i], TRACK.py[i], TRACK.pz[i]),
        q,
        new THREE.Vector3(1, 1, 1),
      );
    });

    // Wires: thin square sections swept along the whole route.
    const box = (y: number): [number, number][] => [
      [-0.035, y - 0.035],
      [-0.035, y + 0.035],
      [0.035, y + 0.035],
      [0.035, y - 0.035],
      [-0.035, y - 0.035],
    ];
    const sagAt = (s: number) => {
      const f = (((s - OHL.span / 2) % OHL.span) + OHL.span) % OHL.span / OHL.span;
      return -OHL.sag * Math.sin(Math.PI * f);
    };
    const parts = [sweep(box(OHL.contactY), 0, ROUTE.length, 2), sweep(box(OHL.messengerY), 0, ROUTE.length, 2, sagAt)];
    for (let s = OHL.span / 2 + OHL.dropper; s < ROUTE.length; s += OHL.dropper) {
      const i = Math.min(TRACK.count - 1, Math.round(s / TRACK.step));
      const h = OHL.messengerY + sagAt(s) - OHL.contactY;
      if (h < 0.15) continue;
      parts.push(
        new THREE.BoxGeometry(0.04, h, 0.04).translate(
          TRACK.px[i],
          TRACK.py[i] + OHL.contactY + h / 2,
          TRACK.pz[i],
        ),
      );
    }
    const wires = mergeGeometries(parts.map(bare));
    return { mats, wires, mast: mastGeometry() };
  }, [world]);

  useLayoutEffect(() => {
    const mesh = masts.current;
    if (!mesh) return;
    built.mats.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [built]);

  return (
    <group>
      <instancedMesh ref={masts} args={[built.mast, MATS.mast, built.mats.length]} castShadow={shadows} />
      <mesh geometry={built.wires} material={MATS.wire} />
    </group>
  );
}
