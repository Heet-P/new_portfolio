import { describe, expect, it } from "vitest";
import { TITLE_CARD } from "./tunnelPosters";

// Task 15: the tunnel's title card speaks in my voice too.
describe("tunnel title card", () => {
  it("keeps the Skills Supplement kicker and a first-person line under it", () => {
    expect(TITLE_CARD.kicker).toBe("SKILLS SUPPLEMENT");
    expect(TITLE_CARD.line).toMatch(/\bI\b/);
    expect(TITLE_CARD.line).not.toMatch(/\b(Heet|he|his)\b/i);
  });
});
