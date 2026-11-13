"use client";

import { useGLTF } from "@react-three/drei";
import { Suspense, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { foamGeometry, riverGeometry, splashGeometry, sweep } from "./geometry";
import { MATS } from "./materials";
import { Mist } from "./Mist";
import { hash2 } from "./noise";
import { TRACK } from "./route3d";
import { BORE_HALF, BORE_SPRING, heightAt, TUNNEL_HILL, TUNNEL_HOLE, type Bridge, type Span, type WorldLayout } from "./worldgen";

/** Heet's steel girder bridge (compressed by scripts/compress-model.mjs). */
const BRIDGE_URL = "/models/bridge.glb";
useGLTF.preload(BRIDGE_URL);

/** Bore outline (BORE_HALF / BORE_SPRING live in worldgen): straight walls, round arch on top (train is 6 tall, 3.3 wide). */
const BORE_PROFILE: [number, number][] = [[-BORE_HALF, -0.5]];
for (let k = 0; k <= 8; k++) {
  const a = Math.PI - (k / 8) * Math.PI;
  BORE_PROFILE.push([Math.cos(a) * BORE_HALF, BORE_SPRING + Math.sin(a) * BORE_HALF]);
}
BORE_PROFILE.push([BORE_HALF, -0.5]);
// Close the loop along the bottom: the bore gets a (black) floor, so nothing lit shows inside.
BORE_PROFILE.push([-BORE_HALF, -0.5]);

/** Track frame (position, tangent, right) at arc length s, as plain numbers. */
function frameAt(s: number) {
  const i = Math.max(0, Math.min(TRACK.count - 1, Math.round(s / TRACK.step)));
  const tx = TRACK.tx[i];
  const tz = TRACK.tz[i];
  return { x: TRACK.px[i], y: TRACK.py[i], z: TRACK.pz[i], tx, tz, nx: -tz, nz: tx };
}

/** Give a geometry one vertex colour (for vertex-coloured materials). */
function painted(g: THREE.BufferGeometry, hex: string): THREE.BufferGeometry {
  const c = new THREE.Color(hex);
  const n = g.getAttribute("position").count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(arr, i * 3);
  g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return g;
}

/** Strip to position-only non-indexed geometry so different builders can be merged. */
function bare(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const n = g.index ? g.toNonIndexed() : g;
  for (const name of Object.keys(n.attributes)) if (name !== "position" && name !== "color") n.deleteAttribute(name);
  return n;
}

/** Rock colours for the portal (sRGB as authored), picked per facet. */
const ROCK_COLS = ["#a39c8d", "#8f8a80", "#b4a68a", "#7d7a74", "#c2b496"].map((h) => new THREE.Color(h));

/**
 * Rocky portal for one tunnel mouth: rings of jittered vertices offset outward from the
 * bore's outline (walls + arch), each ring set further back into the hill, so the mouth
 * reads as an arch cut into a faceted rock face. Plus a few boulders on its shoulders.
 * Vertex-coloured per facet in warm and cool greys.
 */
function portal(s: number, inward: 1 | -1, seed: number): THREE.BufferGeometry {
  // Bore outline (local x = lateral, y = up) with outward normals: left wall, arch, right wall.
  const path: [number, number, number, number][] = [];
  const edge = BORE_HALF + 0.25;
  for (const y of [-1.5, 1.5]) path.push([-edge, y, -1, 0]);
  for (let k = 0; k <= 10; k++) {
    const a = Math.PI - (k / 10) * Math.PI;
    path.push([Math.cos(a) * edge, BORE_SPRING + Math.sin(a) * edge, Math.cos(a), Math.sin(a)]);
  }
  for (const y of [1.5, -1.5]) path.push([edge, y, 1, 0]);
  // Ring offsets outward and how far back into the hill each ring sits.
  const rings: [number, number][] = [
    [0, -0.7],
    [1.6, 0.2],
    [4, 1.6],
    [7, 3.4],
    [10.5, 5.5],
  ];
  const verts: THREE.Vector3[][] = rings.map(([off, back], r) =>
    path.map(([px, py, nx, ny], j) => {
      const jit = r === 0 ? 0 : (hash2(seed * 31 + r, j, 7) - 0.5) * 1.8;
      const y = Math.min(py + ny * (off + jit), TUNNEL_HILL + 1 + hash2(seed, j, r) * 1.5);
      return new THREE.Vector3(px + nx * (off + jit), y, back + (hash2(seed, r, j) - 0.5) * 1.2);
    }),
  );
  const pos: number[] = [];
  const col: number[] = [];
  const face = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, h: number) => {
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    const colour = ROCK_COLS[Math.floor(h * ROCK_COLS.length)];
    for (let v = 0; v < 3; v++) col.push(colour.r, colour.g, colour.b);
  };
  for (let r = 0; r + 1 < rings.length; r++) {
    for (let j = 0; j + 1 < path.length; j++) {
      const a = verts[r][j];
      const b = verts[r][j + 1];
      const c = verts[r + 1][j];
      const d = verts[r + 1][j + 1];
      face(a, c, b, hash2(seed, r * 50 + j, 1));
      face(b, c, d, hash2(seed, r * 50 + j, 2));
    }
  }
  const face3 = new THREE.BufferGeometry();
  face3.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  face3.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));

  // Boulders on the shoulders, never in front of the opening.
  const parts: THREE.BufferGeometry[] = [face3];
  for (let k = 0; k < 6; k++) {
    const side = k % 2 ? 1 : -1;
    const x = side * (edge + 7 + hash2(seed, k, 3) * 5);
    const y = hash2(seed, k, 4) * 8;
    const r = 1.6 + hash2(seed, k, 2) * 2.2;
    const g = new THREE.IcosahedronGeometry(r, 0).scale(1.2, 0.85, 1).translate(x, y, 1 + y * 0.4); // polyhedra are already non-indexed
    g.deleteAttribute("uv");
    g.deleteAttribute("normal");
    const c = ROCK_COLS[k % ROCK_COLS.length];
    const n = g.getAttribute("position").count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) c.toArray(arr, i * 3);
    g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
    parts.push(g);
  }
  const g = mergeGeometries(parts);

  // Local frame: +Z points into the bore, +Y up.
  const f = frameAt(s);
  const z = new THREE.Vector3(f.tx * inward, 0, f.tz * inward);
  const y = new THREE.Vector3(0, 1, 0);
  const x = new THREE.Vector3().crossVectors(y, z);
  const m = new THREE.Matrix4().makeBasis(x, y, z).setPosition(f.x, f.y, f.z);
  return g.applyMatrix4(m);
}

/** Tunnels: dark bore lining, grassy roof over the terrain's hole, floor, rocky portals. */
function Tunnels({ tunnels, shadows }: { tunnels: Span[]; shadows: boolean }) {
  const geo = useMemo(() => {
    const W = TUNNEL_HOLE + 7;
    const roofProfile: [number, number][] = [
      [-W, TUNNEL_HILL - 1.5],
      [-TUNNEL_HOLE, TUNNEL_HILL + 0.8],
      [0, TUNNEL_HILL + 2.2],
      [TUNNEL_HOLE, TUNNEL_HILL + 0.8],
      [W, TUNNEL_HILL - 1.5],
    ];
    const out = {
      bore: mergeGeometries(tunnels.map((t) => bare(sweep(BORE_PROFILE, t.s0, t.s1)))),
      roof: mergeGeometries(tunnels.map((t) => bare(painted(sweep(roofProfile, t.s0, t.s1, 4), "#8f973e")))),
      // Ground in front of each mouth, under the terrain's hole (inside, the bore has its own floor).
      floor: mergeGeometries(
        tunnels.flatMap((t) => [
          bare(sweep([[-W, -0.45], [W, -0.45]], Math.max(0, t.s0 - 8), t.s0 + 1)),
          bare(sweep([[-W, -0.45], [W, -0.45]], t.s1 - 1, t.s1 + 8)),
        ]),
      ),
      stone: mergeGeometries(tunnels.flatMap((t, k) => [portal(t.s0, 1, k * 2), portal(t.s1, -1, k * 2 + 1)])),
    };
    for (const g of Object.values(out)) g.computeVertexNormals();
    return out;
  }, [tunnels]);
  return (
    <group>
      <mesh geometry={geo.bore} material={MATS.tunnel} />
      <mesh geometry={geo.roof} material={MATS.terrain} receiveShadow={shadows} castShadow={shadows} />
      <mesh geometry={geo.floor} material={MATS.ballast} receiveShadow={shadows} />
      <mesh geometry={geo.stone} material={MATS.rockFace} receiveShadow={shadows} castShadow={shadows} />
    </group>
  );
}

/**
 * Wooden trestle: a bent (4 posts, cap beam, cross braces) every 3 units under the track,
 * posts reaching down to the terrain. All one InstancedMesh of unit boxes.
 */
function Trestles({ world, spans, shadows }: { world: WorldLayout; spans: Bridge[]; shadows: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const boxes = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    const yaw = new THREE.Quaternion();
    const roll = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const xAxis = new THREE.Vector3(1, 0, 0);
    const box = (s: number, lat: number, y: number, size: [number, number, number], rollAngle = 0) => {
      const f = frameAt(s);
      yaw.setFromAxisAngle(up, Math.atan2(-f.tz, f.tx));
      roll.setFromAxisAngle(xAxis, rollAngle);
      out.push(
        new THREE.Matrix4().compose(
          new THREE.Vector3(f.x + f.nx * lat, y, f.z + f.nz * lat),
          yaw.clone().multiply(roll),
          new THREE.Vector3(...size),
        ),
      );
    };
    for (const b of spans) {
      for (let s = b.s0 + 1.5; s < b.s1; s += 3) {
        const f = frameAt(s);
        const top = f.y - 0.45;
        let low = top;
        for (const lat of [-2.3, -0.9, 0.9, 2.3]) {
          const g = heightAt(world, f.x + f.nx * lat, f.z + f.nz * lat) - 1;
          low = Math.min(low, g);
          if (top - g > 0.2) box(s, lat, (top + g) / 2, [0.38, top - g, 0.38]);
        }
        box(s, 0, top, [0.45, 0.4, 5.6]); // cap beam
        // X-braces every 3.5 units down to the ground, alternating direction.
        const brace = Math.atan2(3.5, 4.6);
        for (let y = top - 1.75, k = 0; y > low + 1; y -= 3.5, k++) {
          box(s, 0, y, [0.2, 0.22, 5.8], k % 2 ? brace : -brace);
          box(s, 0, y - 1.75, [0.25, 0.3, 5.2]); // horizontal tie
        }
      }
      // Two stringers under the rails along the whole span.
      for (const lat of [-0.9, 0.9]) {
        for (let s = b.s0; s < b.s1; s += 3) box(s + 1.5, lat, frameAt(s + 1.5).y - 0.42, [3.05, 0.35, 0.4]);
      }
    }
    return out;
  }, [world, spans]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    boxes.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [boxes]);

  return (
    <instancedMesh ref={ref} args={[undefined, MATS.wood, boxes.length]} castShadow={shadows} receiveShadow={shadows}>
      <boxGeometry />
    </instancedMesh>
  );
}

/**
 * Heet's steel bridge, placed at its span's centre and turned to the (straight) track there.
 * Its two material colours map onto the world's shared girder and wood materials so it is
 * flat-shaded and palette-tinted like everything else.
 */
function SteelBridge({ span, shadows }: { span: Bridge; shadows: boolean }) {
  const { scene } = useGLTF(BRIDGE_URL);
  useLayoutEffect(() => {
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const m = mesh.material as THREE.MeshStandardMaterial;
      // Wood deck is the darker, warmer one; everything else is painted steel.
      mesh.material = m === MATS.wood || m === MATS.girder ? m : m.color.r < 0.6 ? MATS.wood : MATS.girder;
      mesh.castShadow = shadows;
      mesh.receiveShadow = shadows;
    });
  }, [scene, shadows]);
  const f = frameAt((span.s0 + span.s1) / 2);
  return <primitive object={scene} position={[f.x, f.y, f.z]} rotation-y={Math.atan2(-f.tz, f.tx)} />;
}

/** Rivers (water + foam + waterfall mist), bridges and tunnels. */
export function Structures({ world, shadows }: { world: WorldLayout; shadows: boolean }) {
  const water = useMemo(
    () => mergeGeometries(world.rivers.map((r) => riverGeometry(r.pts, r.bed, r.half))),
    [world],
  );
  const foam = useMemo(() => foamGeometry(world.rivers), [world]);
  const splash = useMemo(() => splashGeometry(world.waterfalls), [world]);
  const steel = world.bridges.find((b) => b.kind === "steel");
  const trestles = useMemo(() => world.bridges.filter((b) => b.kind === "trestle"), [world]);
  return (
    <group>
      <mesh geometry={water} material={MATS.water} receiveShadow={shadows} />
      <mesh geometry={foam} material={MATS.foam} />
      <mesh geometry={splash} material={MATS.splash} />
      <Mist falls={world.waterfalls} />
      <Trestles world={world} spans={trestles} shadows={shadows} />
      {/* Own boundary: while the model loads, everything else stays mounted (no remount/rebuild). */}
      {steel && (
        <Suspense fallback={null}>
          <SteelBridge span={steel} shadows={shadows} />
        </Suspense>
      )}
      <Tunnels tunnels={world.tunnels} shadows={shadows} />
    </group>
  );
}
