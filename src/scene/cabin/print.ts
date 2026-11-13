import { STATIONS, type Station } from "@/content/route";
import { deckOf, EDITION_VOLUME, formatDateline, headlineOf, nextStopLabel, SECTION } from "@/newspaper/edition";
import { ILLUSTRATIONS } from "@/newspaper/illustrations";
import { FADED, INK, readFonts, RED, rng } from "../inkPrint";

/**
 * Prints a stop's front page of "The Project Post" onto a canvas: the texture of the 3D
 * newspaper on the cabin seat. It is a close impression of the HTML front page (same nameplate,
 * headline, deck, At a Glance box, clipping and two-column story), so when the HTML fades in
 * over the unfolded paper the page seems to come into focus rather than swap.
 * Pure canvas 2D; fonts are the page's own (next/font families, read from the CSS variables).
 */

/** A touch warmer than --paper: the cabin's tone mapping greys the print slightly. */
const PAPER = "#ecdcb4";
const PAPER_LIGHT = "#f8f2e2";


/** Resolves once the page's fonts are usable in canvas (the canvas never triggers a font load). */
export function loadPrintFonts(): Promise<unknown> {
  const f = readFonts();
  return Promise.all([
    document.fonts.load(`40px ${f.blackletter}`),
    document.fonts.load(`900 40px ${f.headline}`),
    document.fonts.load(`italic 40px ${f.headline}`),
    document.fonts.load(`40px ${f.body}`),
  ]).catch(() => undefined);
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

/** A dry-brush red stroke from (x0, y) to (x1, y): tapered, a little uneven. */
function brush(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, t: number) {
  ctx.fillStyle = RED;
  ctx.beginPath();
  ctx.moveTo(x0, y + t * 0.6);
  ctx.bezierCurveTo(x0 + (x1 - x0) * 0.3, y - t * 0.2, x0 + (x1 - x0) * 0.7, y - t * 0.1, x1, y - t * 0.6);
  ctx.lineTo(x1 + t * 0.2, y - t * 0.1);
  ctx.bezierCurveTo(x0 + (x1 - x0) * 0.7, y + t * 0.5, x0 + (x1 - x0) * 0.3, y + t * 0.6, x0 + t * 0.4, y + t);
  ctx.closePath();
  ctx.fill();
}

/** Fill the sheet: paper, a sun-faded edge and fine grain. */
function paper(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.35, w / 2, h * 0.45, Math.max(w, h) * 0.75);
  g.addColorStop(0, "rgba(120, 92, 48, 0)");
  g.addColorStop(1, "rgba(120, 92, 48, 0.18)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const r = rng(seed);
  for (let i = 0; i < (w * h) / 220; i++) {
    ctx.fillStyle = `rgba(90, 70, 40, ${0.03 + r() * 0.06})`;
    ctx.fillRect(r() * w, r() * h, 1 + r() * 1.5, 1 + r() * 1.5);
  }
}

/**
 * Print `station` (STATIONS[index]) onto `canvas` at its current size. `art` is the stop's
 * illustration if it has loaded (drawn as the pasted clipping), else an ornament box.
 * Landscape canvases get the desktop layout (lede beside the clipping, two columns below);
 * portrait ones the phone layout (one column).
 */
export function printFrontPage(canvas: HTMLCanvasElement, station: Station, index: number, art: HTMLImageElement | null) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  const f = readFonts();
  const wide = W / H >= 1.1;
  // Sizes as fractions of the width, matching the HTML front page at its usual widths.
  const s = wide
    ? { m: 0.035, plate: 0.075, ear: 0.017, head: 0.075, deck: 0.033, glance: 0.021, body: 0.017 }
    : { m: 0.047, plate: 0.105, ear: 0.047, head: 0.117, deck: 0.073, glance: 0.058, body: 0.047 };
  const px = (k: number) => k * W;
  const m = px(s.m);

  paper(ctx, W, H, index + 1);
  ctx.textBaseline = "alphabetic";

  // --- Masthead: ears under thin rules, the blackletter nameplate, double rule, edition line.
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.font = `${px(s.plate)}px ${f.blackletter}`;
  ctx.textAlign = "center";
  const plateW = ctx.measureText("The Project Post").width;
  let y = m + px(s.plate) * 0.95;
  ctx.fillText("The Project Post", W / 2, y);
  // Ears sit a little above the nameplate's baseline, as on the HTML page.
  const earY = wide ? y - px(s.ear) * 0.9 : y + px(s.ear) * 1.6;
  ctx.font = `${px(s.ear)}px ${f.body}`;
  ctx.lineWidth = Math.max(1, W / 900);
  const earRule = wide ? earY - px(s.ear) * 1.4 : y + px(s.ear) * 0.3;
  const earEnd = wide ? W / 2 - plateW / 2 - px(0.02) : W / 2 - px(0.02);
  ctx.beginPath();
  ctx.moveTo(m, earRule);
  ctx.lineTo(earEnd, earRule);
  ctx.moveTo(W - earEnd, earRule);
  ctx.lineTo(W - m, earRule);
  ctx.stroke();
  ctx.textAlign = "left";
  ctx.fillText(`${EDITION_VOLUME}, No. ${index + 1}`, m, earY);
  ctx.textAlign = "right";
  ctx.fillText(formatDateline(station.dates), W - m, earY);
  y = earY + px(s.ear) * 0.8;
  ctx.fillRect(m, y, W - 2 * m, Math.max(2, W / 340));
  ctx.fillRect(m, y + Math.max(5, W / 160), W - 2 * m, Math.max(1, W / 900));
  y += px(s.ear) * 2.2;
  ctx.font = `italic ${px(s.ear)}px ${f.body}`;
  ctx.fillStyle = FADED;
  ctx.textAlign = "left";
  const last = STATIONS.length - 1;
  ctx.fillText(index === 0 ? "Now departing" : index === last ? "End of the line" : "Now arriving", m, y);
  if (index < last) {
    ctx.textAlign = "right";
    ctx.fillText(`Next stop: ${nextStopLabel(STATIONS[index + 1])}`, W - m, y);
  }
  y += px(s.ear) * 0.7;
  ctx.fillStyle = INK;
  ctx.fillRect(m, y, W - 2 * m, Math.max(1, W / 900));
  y += px(s.ear) * 2.6;

  // --- Lede column (left on wide pages, full width on narrow ones).
  const colW = wide ? (W - 2 * m) * 0.43 : W - 2 * m;
  ctx.textAlign = "left";
  ctx.font = `700 ${px(s.ear)}px ${f.body}`;
  ctx.fillText(SECTION[station.kind].toUpperCase(), m, y);
  y += px(s.ear) * 0.6;
  const ledeTop = y;

  const headSize = px(station.kind === "open" || station.kind === "end" ? s.head * 0.75 : s.head);
  ctx.font = `900 ${headSize}px ${f.headline}`;
  const lines = wrap(ctx, headlineOf(station), colW);
  for (const line of lines) {
    y += headSize * 1.06;
    ctx.fillText(line, m, y);
  }
  // Brush under the last word of the last line.
  const lastLine = lines[lines.length - 1] ?? "";
  const lastWord = lastLine.split(" ").pop() ?? "";
  const lineW = ctx.measureText(lastLine).width;
  const wordW = ctx.measureText(lastWord).width;
  brush(ctx, m + lineW - wordW * 1.08, m + lineW + wordW * 0.1, y + headSize * 0.17, headSize * 0.12);
  ctx.fillStyle = INK; // brush() leaves the fill red

  const deck = deckOf(station);
  if (deck) {
    ctx.font = `italic ${px(s.deck)}px ${f.headline}`;
    y += px(s.deck) * 0.5;
    for (const line of wrap(ctx, deck, colW)) {
      y += px(s.deck) * 1.38;
      ctx.fillText(line, m, y);
    }
  }

  // --- The clipping: beside the lede on wide pages, under it on narrow ones.
  const artW = wide ? W - 2 * m - colW - px(0.04) : W - 2 * m;
  const artH = (artW * 2) / 3;
  const artX = wide ? W - m - artW : m;
  const artY = wide ? ledeTop : y + px(0.06);
  const tilt = ((ILLUSTRATIONS[station.id]?.tilt ?? 0) * Math.PI) / 180;
  ctx.save();
  ctx.translate(artX + artW / 2, artY + artH / 2);
  ctx.rotate(tilt);
  ctx.shadowColor = "rgba(60, 40, 12, 0.4)";
  ctx.shadowBlur = px(0.02);
  ctx.shadowOffsetY = px(0.01);
  if (art) ctx.drawImage(art, -artW / 2, -artH / 2, artW, artH);
  else {
    ctx.fillStyle = "#e2d4b2";
    ctx.fillRect(-artW / 2, -artH / 2, artW, artH);
  }
  ctx.restore();
  if (!wide) y = artY + artH;

  // --- At a Glance: a ruled box with the red label tab and red square bullets.
  if (station.stats) {
    const g = px(s.glance);
    const boxTop = y + g * 2.4;
    const boxH = g * 1.5 * station.stats.length + g * 2.6;
    ctx.lineWidth = Math.max(1, W / 900);
    ctx.strokeRect(m, boxTop, colW, boxH);
    ctx.font = `italic ${g}px ${f.headline}`;
    const labelW = ctx.measureText("At a Glance").width + g * 2;
    ctx.fillStyle = RED;
    ctx.fillRect(m + g * 0.8, boxTop - g * 0.9, labelW, g * 1.7);
    ctx.fillStyle = PAPER_LIGHT;
    ctx.fillText("At a Glance", m + g * 1.8, boxTop + g * 0.35);
    let ly = boxTop + g * 2.4;
    for (const stat of station.stats) {
      ctx.fillStyle = RED;
      ctx.fillRect(m + g * 0.9, ly - g * 0.62, g * 0.55, g * 0.55);
      ctx.fillStyle = INK;
      ctx.font = `900 ${g}px ${f.headline}`;
      ctx.fillText(stat.value, m + g * 2, ly);
      const vw = ctx.measureText(`${stat.value} `).width;
      ctx.font = `${g}px ${f.body}`;
      ctx.fillText(stat.label, m + g * 2 + vw, ly, colW - g * 3 - vw);
      ly += g * 1.5;
    }
    y = boxTop + boxH;
  }

  // --- The story, in two columns (one on narrow pages), running off the bottom of the sheet.
  const b = px(s.body);
  const top = Math.max(y, wide ? artY + artH : y) + b * 2.4;
  ctx.fillStyle = INK;
  ctx.font = `${b}px ${f.body}`;
  const cols = wide ? 2 : 1;
  const gap = px(0.04);
  const cw = (W - 2 * m - gap * (cols - 1)) / cols;
  const text = station.body.join(" ");
  const bodyLines = wrap(ctx, text, cw);
  const perCol = Math.max(1, Math.floor((H - m - top) / (b * 1.5)));
  bodyLines.slice(0, perCol * cols).forEach((line, i) => {
    const c = Math.floor(i / perCol);
    ctx.fillText(line, m + c * (cw + gap), top + (i % perCol) * b * 1.5 + b);
  });
  if (cols === 2) {
    ctx.fillStyle = "rgba(29, 25, 21, 0.28)";
    ctx.fillRect(m + cw + gap / 2, top, Math.max(1, W / 900), Math.min(perCol, Math.ceil(bodyLines.length / 2)) * b * 1.5);
  }
}
