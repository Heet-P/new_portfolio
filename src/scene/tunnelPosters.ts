import { FADED, type Fonts, INK, readFonts, RED, rng } from "./inkPrint";
import { ATLAS, atlasRect, type ReelEntry, type Rect } from "./tunnelReel";

/**
 * Prints the tunnel posters onto one canvas (the texture atlas): a vintage paper bill per skill
 * (small red group label, the skill in big ink serif, a thin double-rule frame) and the blackletter
 * "The Project Post, Skills Supplement" title card that opens each tunnel. Pure canvas 2D,
 * in the page's own fonts (read from the CSS variables, as scene/cabin/print.ts does).
 */

/** Warmer and more saturated than --paper (#efe5cc): ACES tone mapping pulls bright cream toward grey, and this lands near it. */
const PAPER = "#e9d49b";


/** Fill a sheet of paper: base colour, a sun-faded edge and fine grain. */
function paper(ctx: CanvasRenderingContext2D, r: Rect, seed: number) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const g = ctx.createRadialGradient(cx, cy, Math.min(r.w, r.h) * 0.3, cx, cy, Math.max(r.w, r.h) * 0.75);
  g.addColorStop(0, "rgba(120, 92, 48, 0)");
  g.addColorStop(1, "rgba(120, 92, 48, 0.22)");
  ctx.fillStyle = g;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  const rand = rng(seed);
  for (let i = 0; i < (r.w * r.h) / 260; i++) {
    ctx.fillStyle = `rgba(90, 70, 40, ${0.03 + rand() * 0.06})`;
    ctx.fillRect(r.x + rand() * r.w, r.y + rand() * r.h, 1 + rand() * 1.5, 1 + rand() * 1.5);
  }
}

/** A thin double rule: a heavy outer line and a hairline inside it. */
function doubleRule(ctx: CanvasRenderingContext2D, r: Rect, outer: number, inner: number, heavy: number) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = heavy;
  ctx.strokeRect(r.x + outer, r.y + outer, r.w - 2 * outer, r.h - 2 * outer);
  ctx.lineWidth = Math.max(1, heavy / 3);
  ctx.strokeRect(r.x + inner, r.y + inner, r.w - 2 * inner, r.h - 2 * inner);
}

/** Width of `text` drawn with `tracking` px between letters. */
function trackedWidth(ctx: CanvasRenderingContext2D, text: string, tracking: number): number {
  return ctx.measureText(text).width + tracking * Math.max(0, text.length - 1);
}

/** Centre `text` on `cx`, letter-spaced (canvas letterSpacing is not in every browser). Leaves the text alignment as it found it. */
function tracked(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, tracking: number) {
  const align = ctx.textAlign;
  ctx.textAlign = "left";
  let x = cx - trackedWidth(ctx, text, tracking) / 2;
  for (const ch of text) {
    ctx.fillText(ch, x, y);
    x += ctx.measureText(ch).width + tracking;
  }
  ctx.textAlign = align;
}

/** Greedy word wrap to `max` px. */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > max) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** The group as a label: "AI and Machine Learning" reads "AI & MACHINE LEARNING" in small caps. */
function labelOf(group: string): string {
  return group.replace(/\band\b/g, "&").toUpperCase();
}

/** One skill's poster, printed into atlas cell `r`. */
function poster(ctx: CanvasRenderingContext2D, r: Rect, entry: ReelEntry, seed: number, f: Fonts) {
  paper(ctx, r, seed);
  doubleRule(ctx, r, 9, 15, 3);
  const cx = r.x + r.w / 2;
  const inner = r.w - 64;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = RED;

  // Group label: small red caps, tighter and then smaller if the group's name is long.
  const text = labelOf(entry.group);
  let label = 16;
  let track = 0.14;
  ctx.font = `700 ${label}px ${f.body}`;
  while (label > 9 && trackedWidth(ctx, text, label * track) > inner) {
    if (track > 0.06 && label <= 12) track = 0.06;
    else label--;
    ctx.font = `700 ${label}px ${f.body}`;
  }
  tracked(ctx, text, cx, r.y + 52, label * track);
  ctx.fillRect(cx - 18, r.y + 64, 36, 3);

  // The skill, as big as it can be in up to three lines.
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  const top = r.y + 84;
  const bottom = r.y + r.h - 76;
  let size = 58;
  let lines: string[] = [];
  for (; size > 18; size -= 2) {
    ctx.font = `900 ${size}px ${f.headline}`;
    lines = wrap(ctx, entry.skill, inner);
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (lines.length <= 3 && widest <= inner && lines.length * size * 1.1 <= bottom - top) break;
  }
  const block = lines.length * size * 1.1;
  let y = top + (bottom - top - block) / 2 + size * 0.88;
  for (const line of lines) {
    ctx.fillText(line, cx, y);
    y += size * 1.1;
  }

  // Footer: a rule and the paper's name in faded italic.
  ctx.fillRect(r.x + 32, r.y + r.h - 62, r.w - 64, 1.5);
  ctx.fillStyle = FADED;
  ctx.font = `italic 15px ${f.headline}`;
  ctx.fillText("The Project Post", cx, r.y + r.h - 36);
}

/** The title card that opens each tunnel: the blackletter nameplate stacked, "Skills Supplement" beneath. */
function titleCard(ctx: CanvasRenderingContext2D, r: Rect, f: Fonts) {
  paper(ctx, r, 99);
  doubleRule(ctx, r, 9, 15, 3);
  const cx = r.x + r.w / 2;
  const inner = r.w - 64;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";
  ctx.fillStyle = INK;
  // "The / Project / Post": as large as the widest line allows.
  const lines = ["The", "Project", "Post"];
  let size = 76;
  for (; size > 30; size -= 2) {
    ctx.font = `${size}px ${f.blackletter}`;
    if (Math.max(...lines.map((l) => ctx.measureText(l).width)) <= inner) break;
  }
  let y = r.y + 34 + size * 0.8;
  for (const line of lines) {
    ctx.fillText(line, cx, y);
    y += size * 0.88;
  }
  ctx.fillRect(r.x + 32, y - size * 0.3, r.w - 64, 3);
  ctx.fillRect(r.x + 32, y - size * 0.3 + 7, r.w - 64, 1.2);
  ctx.fillStyle = RED;
  ctx.font = `700 15px ${f.body}`;
  tracked(ctx, "SKILLS SUPPLEMENT", cx, r.y + r.h - 44, 3.2);
  ctx.fillStyle = FADED;
  ctx.font = `italic 13px ${f.headline}`;
  ctx.fillText("Printed overnight, between stations", cx, r.y + r.h - 26);
}

/**
 * Print every poster (cell i = reel[i]) and the title card (the cell after them) onto `canvas`
 * (ATLAS.size square).
 * Call again once the page's fonts have loaded: a canvas never waits for a web font.
 */
export function paintAtlas(canvas: HTMLCanvasElement, reel: ReelEntry[]) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const f = readFonts();
  ctx.clearRect(0, 0, ATLAS.size, ATLAS.size);
  reel.forEach((entry, i) => poster(ctx, atlasRect(i), entry, i + 1, f));
  titleCard(ctx, atlasRect(reel.length), f);
}
