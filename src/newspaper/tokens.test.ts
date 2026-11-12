import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { contrast } from "./contrast";

/** Reads the colour tokens straight from globals.css, so the test can never drift from the CSS. */
const css = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
function token(name: string): string {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i").exec(css);
  if (!match) throw new Error(`token --${name} not found`);
  return match[1];
}

describe("contrast()", () => {
  it("matches the WCAG reference values", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
    expect(contrast("#ffffff", "#000000")).toBeCloseTo(21, 5); // order does not matter
  });
});

describe("newspaper tokens", () => {
  // Every text colour on every paper it is printed on (>= 4.5:1, WCAG AA for normal text).
  const pairs: [text: string, background: string][] = [
    ["ink", "paper"],
    ["ink-faded", "paper"],
    ["red", "paper"],
    ["ink", "paper-shade"],
    ["ink-faded", "paper-shade"],
    ["ink", "paper-light"],
    ["ink-faded", "paper-light"],
    ["red", "paper-light"],
    ["paper-light", "red"], // the "At a Glance" label: light paper on the red brush
  ];

  for (const [text, bg] of pairs) {
    it(`--${text} on --${bg} is at least 4.5:1`, () => {
      expect(contrast(token(text), token(bg))).toBeGreaterThanOrEqual(4.5);
    });
  }
});
