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

// Mode toggle: always reachable, big enough to tap, and it flips the label.
test("mode toggle is visible, 44px+ and switches mode", async ({ page }) => {
  await page.goto("/");
  // Reduced motion is not emulated, so a WebGL-capable browser starts in ride mode ("Express" offered).
  const toggle = page.getByRole("button", { name: /^(Express|Ride the train)/ });
  await expect(toggle).toBeVisible();
  const box = await toggle.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  const before = await toggle.innerText();
  await toggle.click();
  await expect(toggle).not.toHaveText(before);
  // The choice survives a reload.
  const chosen = await toggle.innerText();
  await page.reload();
  await expect(toggle).toHaveText(chosen);
});

// Reduced motion with nothing saved starts on the plain Express page.
test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("starts in express mode", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: /^Ride the train/ })).toBeVisible();
  });
});
