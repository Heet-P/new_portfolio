import { test, expect } from "@playwright/test";

// Smoke test: the statically exported home page renders the owner's name as h1.
test("home page has an h1 with the owner's name", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("Heet Parikh");
});

// Phone width: the Express page must never scroll sideways (16px gutter, wrapping chips).
test("no horizontal scroll at 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(375);
});
