/**
 * Compress Heet's Blender/3ds Max exports for the web.
 *
 *   npm run model
 *
 * Two targets, both from media-inbox/train/ (git-ignored sources) to public/models/ (committed):
 *
 * train.glb  -> public/models/train.glb
 *  1. Drop the scene props (ground plane, rail, station square): the site builds its own
 *     world, only the TRAIN subtree is used.
 *  2. Recentre TRAIN so the train's bounding box is centred on x/z = 0 with its wheels on y = 0.
 *     The scene can then place the train without magic offsets.
 *  3. Dedup + weld + prune (lossless clean-up). No simplification: it is a hard-surface model
 *     and at ~46k triangles it is cheap enough; simplifying chipped the window frames.
 *  4. Meshopt compression (quantized attributes + EXT_meshopt_compression), decoded at runtime
 *     by drei's useGLTF.
 *
 * Rail_bridge_steel_final.glb -> public/models/bridge.glb
 *  1. Drop the export's ground plane, sky dome, background torus and empty helper nodes.
 *  2. Merge its ~48 duplicate materials by base colour into 3 (steel, light girder, wood).
 *  3. Bake one transform into the vertices so the bridge matches the world's conventions:
 *     runs along +X (like the train), rails centred on z = 0 with rail tops at y = 0,
 *     span centred on x = 0, and scaled so its rail gauge equals the train's (1.5 units).
 *  4. Flatten + join meshes per material (a handful of draw calls instead of ~48), weld, meshopt.
 *
 * subway-interior/source/subway.glb -> public/models/cabin.glb
 *   ("Subway_[interior]" by Comicaroid, CC BY 4.0: the on-board cabin seen at each stop)
 *  1. Re-centre so the car runs along +X centred on x/z = 0 with the cabin floor at y = 0.
 *  2. Flatten + join by material: 573 meshes in 11 flat-colour materials become 11 draw calls.
 *  3. Weld, drop the unused UVs (no textures), meshopt.
 *
 * Usage: `npm run model` builds every target; `npm run model -- cabin` builds only the named ones.
 */
import { mkdirSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { NodeIO, getBounds } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, flatten, join, meshopt, prune, weld } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });

const kb = (p) => `${(statSync(p).size / 1024).toFixed(0)} KB`;
const round = (v) => +v.toFixed(2);

/** Count primitives (= draw calls) and materials, for the before/after log line. */
function stats(doc) {
  const prims = doc.getRoot().listMeshes().reduce((n, m) => n + m.listPrimitives().length, 0);
  return `${prims} draw calls, ${doc.getRoot().listMaterials().length} materials`;
}

async function write(doc, src, out) {
  mkdirSync(dirname(out), { recursive: true });
  await io.write(out, doc);
  console.log(`${src} ${kb(src)} -> ${out} ${kb(out)}`);
}

async function train() {
  const SRC = "media-inbox/train/train.glb";
  const OUT = "public/models/train.glb";
  /** The only top-level node we keep. */
  const KEEP = "TRAIN";

  const doc = await io.read(SRC);
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];

  // 1. Keep only the train. Disposing the props lets prune() drop their meshes/materials.
  let trainNode;
  for (const node of scene.listChildren()) {
    if (node.getName() === KEEP) trainNode = node;
    else node.dispose();
  }
  if (!trainNode) throw new Error(`No "${KEEP}" node in ${SRC}`);

  // 2. Recentre: shift the TRAIN root so its world bounds are centred on the origin, floor at y = 0.
  const { min, max } = getBounds(trainNode);
  const [tx, ty, tz] = trainNode.getTranslation();
  trainNode.setTranslation([tx - (min[0] + max[0]) / 2, ty - min[1], tz - (min[2] + max[2]) / 2]);

  // 3-4. Lossless clean-up, then meshopt (medium level = good quantization, no visible loss).
  await doc.transform(dedup(), weld(), prune(), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
  await write(doc, SRC, OUT);
  const b = getBounds(trainNode);
  console.log("train bounds min", b.min.map(round), "max", b.max.map(round));
}

async function bridge() {
  const SRC = "media-inbox/train/Rail_bridge_steel_final.glb";
  const OUT = "public/models/bridge.glb";
  /** Scene dressing from the source file that the site replaces with its own world. */
  const DROP = new Set(["Plane002", "Sky001", "Torus001"]);
  /** Measured in the source: rail centrelines at x = 0.2995 and 1.3071, rail tops at y = 2.7627. */
  const SRC_GAUGE = 1.3071 - 0.2995;
  const SRC_RAIL_X = (1.3071 + 0.2995) / 2;
  const SRC_RAIL_TOP = 2.7627;
  /** Train's gauge (rails at z = +-0.75, see Track.tsx). */
  const GAUGE = 1.5;
  /**
   * Base colours to merge (rounded to 2 dp): the two near-white girder greys become one
   * "light girder" material. Anything not listed (e.g. the export's yellow ground) is dropped.
   */
  const COLOUR_GROUPS = {
    "0.32,0.33,0.37": "bridge_steel",
    "0.86,0.86,0.86": "bridge_girder",
    "0.79,0.83,0.89": "bridge_girder",
    "0.43,0.35,0.22": "bridge_wood",
  };

  const doc = await io.read(SRC);
  const root = doc.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  console.log("bridge before:", stats(doc));

  // 1. Drop the props and the mesh-less helper nodes.
  for (const node of scene.listChildren()) {
    let hasMesh = false;
    node.traverse((n) => (hasMesh ||= !!n.getMesh()));
    if (DROP.has(node.getName()) || !hasMesh) node.dispose();
  }

  // 2. One material per colour group; primitives in any other colour are removed.
  const merged = {};
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const key = (prim.getMaterial()?.getBaseColorFactor() ?? [0, 0, 0]).slice(0, 3).map((v) => v.toFixed(2)).join(",");
      const name = COLOUR_GROUPS[key];
      if (!name) {
        prim.dispose();
        continue;
      }
      merged[name] ??= prim.getMaterial().clone().setName(name);
      prim.setMaterial(merged[name]);
    }
  }

  // 3. Re-parent everything under one root that carries the alignment transform:
  //    rotate +90 deg about Y (source runs along +Z -> +X), scale to our gauge, then move the
  //    rail centreline's midpoint to the origin.
  const s = GAUGE / SRC_GAUGE;
  const kids = scene.listChildren();
  const rig = doc.createNode("BRIDGE");
  for (const k of kids) {
    scene.removeChild(k);
    rig.addChild(k);
  }
  scene.addChild(rig);
  const half = Math.SQRT1_2;
  rig.setRotation([0, half, 0, half]).setScale([s, s, s]);
  const b0 = getBounds(rig);
  const midX = (b0.min[0] + b0.max[0]) / 2; // the span's centre along the new +X
  // After rotation, source x maps to -z: the rail centre lands at z = -s * SRC_RAIL_X.
  rig.setTranslation([-midX, -s * SRC_RAIL_TOP, s * SRC_RAIL_X]);

  // 4. Bake transforms, join per material, clean up, compress.
  await doc.transform(
    flatten(),
    join({ keepNamed: false }),
    dedup(),
    weld(),
    prune(),
    meshopt({ encoder: MeshoptEncoder, level: "medium" }),
  );
  await write(doc, SRC, OUT);
  console.log("bridge after:", stats(doc));
  const b = getBounds(scene);
  console.log("bridge bounds min", b.min.map(round), "max", b.max.map(round), "scale", round(s));
}

async function cabin() {
  const SRC = "media-inbox/train/subway-interior/source/subway.glb";
  const OUT = "public/models/cabin.glb";
  /** Top of the floor slab in the source (the slab's underside sits 0.1 lower). */
  const SRC_FLOOR_TOP = -0.66;

  const doc = await io.read(SRC);
  const root = doc.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  console.log("cabin before:", stats(doc));

  // 1. One root carrying the re-centring offset (the source sits at x -3..14, z -10.8..-7.4).
  const kids = scene.listChildren();
  const rig = doc.createNode("CABIN");
  for (const k of kids) {
    scene.removeChild(k);
    rig.addChild(k);
  }
  scene.addChild(rig);
  const b0 = getBounds(rig);
  rig.setTranslation([-(b0.min[0] + b0.max[0]) / 2, -SRC_FLOOR_TOP, -(b0.min[2] + b0.max[2]) / 2]);

  // 2-3. Bake transforms, join per material, clean up (UVs go: there are no textures), compress.
  await doc.transform(
    flatten(),
    join({ keepNamed: false }),
    dedup(),
    weld(),
    prune({ keepAttributes: false }),
    meshopt({ encoder: MeshoptEncoder, level: "medium" }),
  );
  await write(doc, SRC, OUT);
  console.log("cabin after:", stats(doc));
  const b = getBounds(scene);
  console.log("cabin bounds min", b.min.map(round), "max", b.max.map(round));
}

// `npm run model -- cabin` rebuilds only the named targets; no names = all of them.
const TARGETS = { train, bridge, cabin };
const only = process.argv.slice(2);
for (const [name, build] of Object.entries(TARGETS)) {
  if (only.length === 0 || only.includes(name)) await build();
}
