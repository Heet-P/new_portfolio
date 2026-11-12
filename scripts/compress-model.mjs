/**
 * Compress Heet's Blender train export for the web.
 *
 *   npm run model
 *
 * media-inbox/train/train.glb (git-ignored source) -> public/models/train.glb (committed).
 *
 * Steps:
 *  1. Drop the scene props (ground plane, rail, station square): the site builds its own
 *     world, only the TRAIN subtree is used.
 *  2. Recentre TRAIN so the train's bounding box is centred on x/z = 0 with its wheels on y = 0.
 *     The scene can then place the train without magic offsets.
 *  3. Dedup + weld + prune (lossless clean-up). No simplification: it is a hard-surface model
 *     and at ~46k triangles it is cheap enough; simplifying chipped the window frames.
 *  4. Meshopt compression (quantized attributes + EXT_meshopt_compression), decoded at runtime
 *     by drei's useGLTF.
 */
import { mkdirSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { NodeIO, getBounds } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, weld } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";

const SRC = "media-inbox/train/train.glb";
const OUT = "public/models/train.glb";
/** The only top-level node we keep. */
const KEEP = "TRAIN";

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });

const doc = await io.read(SRC);
const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];

// 1. Keep only the train. Disposing the props lets prune() drop their meshes/materials.
let train;
for (const node of scene.listChildren()) {
  if (node.getName() === KEEP) train = node;
  else node.dispose();
}
if (!train) throw new Error(`No "${KEEP}" node in ${SRC}`);

// 2. Recentre: shift the TRAIN root so its world bounds are centred on the origin, floor at y = 0.
const { min, max } = getBounds(train);
const [tx, ty, tz] = train.getTranslation();
train.setTranslation([tx - (min[0] + max[0]) / 2, ty - min[1], tz - (min[2] + max[2]) / 2]);

// 3-4. Lossless clean-up, then meshopt (medium level = good quantization, no visible loss).
await doc.transform(dedup(), weld(), prune(), meshopt({ encoder: MeshoptEncoder, level: "medium" }));

mkdirSync(dirname(OUT), { recursive: true });
await io.write(OUT, doc);

const kb = (p) => `${(statSync(p).size / 1024).toFixed(0)} KB`;
const b = getBounds(train);
console.log(`${SRC} ${kb(SRC)} -> ${OUT} ${kb(OUT)}`);
console.log("train bounds min", b.min.map((v) => +v.toFixed(2)), "max", b.max.map((v) => +v.toFixed(2)));
