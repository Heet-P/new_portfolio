import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
 * Static guards on the newspaper's stylesheets (jsdom cannot evaluate media queries, so the
 * rules are checked where they are written):
 * - every keyframe animation (wiggles, wobbles, the chugging train...) is declared only inside
 *   `@media (prefers-reduced-motion: no-preference)`, so reduced motion gets none of them;
 * - every :hover style sits inside `@media (hover: hover) and (pointer: fine)`, so touch
 *   screens never get a sticky hover.
 */

const SHEETS = ["./newspaper.module.css", "../express/express.module.css"].map((p) => ({
  name: p,
  css: readFileSync(fileURLToPath(new URL(p, import.meta.url)), "utf8"),
}));

/** Each rule's selector (or declaration) with the stack of @media conditions around it. */
function walk(css: string, visit: (text: string, media: string[]) => void) {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const stack: string[] = [];
  let buf = "";
  for (const ch of src) {
    if (ch === "{") {
      stack.push(buf.trim());
      buf = "";
    } else if (ch === "}") {
      visit(buf, stack.filter((s) => s.startsWith("@media")));
      // Text before the block's "{" was its selector: report it with its own media context.
      const selector = stack.pop() ?? "";
      visit(selector, stack.filter((s) => s.startsWith("@media")));
      buf = "";
    } else if (ch === ";") {
      visit(buf, stack.filter((s) => s.startsWith("@media")));
      buf = "";
    } else buf += ch;
  }
}

describe("newspaper motion CSS", () => {
  for (const { name, css } of SHEETS) {
    it(`${name}: keyframe animations only play when motion is welcome`, () => {
      const offenders: string[] = [];
      walk(css, (text, media) => {
        const m = /^\s*animation(?:-name)?\s*:\s*(.+)$/.exec(text);
        if (!m || /^none\b/.test(m[1].trim())) return;
        if (!media.some((q) => q.includes("prefers-reduced-motion: no-preference"))) offenders.push(text.trim());
      });
      expect(offenders).toEqual([]);
    });

    it(`${name}: hover styles only for real pointers`, () => {
      const offenders: string[] = [];
      walk(css, (text, media) => {
        if (!text.includes(":hover")) return;
        if (!media.some((q) => q.includes("hover: hover") && q.includes("pointer: fine"))) offenders.push(text.trim());
      });
      expect(offenders).toEqual([]);
    });
  }

  it("actually finds the whimsy animations it guards", () => {
    const all = SHEETS.map((s) => s.css).join("\n");
    for (const name of ["stub-wiggle", "tab-wobble", "train-chug"]) expect(all).toContain(`@keyframes ${name}`);
  });
});
