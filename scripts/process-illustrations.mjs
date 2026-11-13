/**
 * Illustration pipeline: media-inbox/newspaper/illustrations/*.png -> public/illustrations/*.webp
 *
 * Heet's ink-sketch "clippings" (one per stop) arrive as 1536x1024 PNGs of ~4 MB each. For the
 * page they become three WebP widths (1200w for desktop / retina cards, 900w for high-DPR phones,
 * 600w for phones) that the
 * newspaper's <Clipping> serves through srcSet. Run with `npm run illustrations`; the outputs are
 * committed (media-inbox/ is git-ignored), so the build never needs the originals.
 *
 * A very light colour pass pulls the cards' saturated orange toward the page's yellowed paper
 * (less saturation, a touch brighter) so eight separately generated cards read as one set, while
 * keeping them warmer than the page on purpose: they are pasted-in clippings, not the page itself.
 */
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SRC = "media-inbox/newspaper/illustrations";
const OUT = "public/illustrations";
/** File names that don't match a station id (the source has a typo). */
const RENAME = { yeildguard: "yieldguard" };
const WIDTHS = [
  { w: 1200, suffix: "" },
  { w: 900, suffix: "-900" },
  { w: 600, suffix: "-600" },
];
const QUALITY = 78;
/** Trim this fraction off every edge: the outer few px are background behind the deckled edge. */
const TRIM = 0.01;

await mkdir(OUT, { recursive: true });
const files = (await readdir(SRC)).filter((f) => f.toLowerCase().endsWith(".png"));
if (files.length === 0) throw new Error(`No PNGs in ${SRC}`);

for (const file of files) {
  const base = path.basename(file, path.extname(file)).toLowerCase();
  const id = RENAME[base] ?? base;
  const input = path.join(SRC, file);
  const { width, height } = await sharp(input).metadata();
  const dx = Math.round(width * TRIM);
  const dy = Math.round(height * TRIM);

  for (const { w, suffix } of WIDTHS) {
    const out = path.join(OUT, `${id}${suffix}.webp`);
    const info = await sharp(input)
      .extract({ left: dx, top: dy, width: width - dx * 2, height: height - dy * 2 })
      .resize({ width: w })
      // Toward the page paper: calmer orange, slightly lighter. Kept subtle on purpose.
      .modulate({ saturation: 0.8, brightness: 1.04 })
      .webp({ quality: QUALITY, effort: 6 })
      .toFile(out);
    console.log(`${out}  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)} KB`);
  }
}
