import { test, expect, type Page } from "@playwright/test";

// Force ride mode before any page script runs (the saved choice wins when WebGL is available).
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("nt-mode", "ride"));
});

/** The route map button that is currently marked as the train's position. */
const currentStop = (page: Page) => page.getByRole("navigation", { name: "Route map" }).locator("[aria-current=step]");

test("ride mode hides Express and shows the route map", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Route map" })).toBeVisible();
  await expect(page.locator("#express")).toBeHidden();
  await expect(page.getByRole("navigation", { name: "Route map" }).getByRole("button")).toHaveCount(9);
});

test("deep link opens the ride at that station", async ({ page }) => {
  await page.goto("/#yieldguard");
  await expect(currentStop(page)).toHaveAttribute("aria-label", "YieldGuard AI");
  await expect(page).toHaveURL(/#yieldguard$/);
});

// Review Focus 1: unknown hash -> Departure, and the URL is corrected.
test("unknown hash opens at Departure and is corrected", async ({ page }) => {
  await page.goto("/#nope");
  await expect(currentStop(page)).toHaveAttribute("aria-label", "Departure");
  await expect(page).toHaveURL(/#departure$/);
});

// Review Focus 4: rotating the screen mid-ride keeps the visitor at the same station.
test("resize / orientation change keeps the current station", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/#vaani");
  await expect(currentStop(page)).toHaveAttribute("aria-label", "Vaani AI");
  await page.setViewportSize({ width: 800, height: 1280 });
  // Give the resize handler a couple of frames, then make sure it did not drift away.
  await page.waitForTimeout(300);
  await expect(currentStop(page)).toHaveAttribute("aria-label", "Vaani AI");
  await expect(page).toHaveURL(/#vaani$/);
});

// Review Focus 2: rapid clicks retarget; the ride ends at the last clicked station.
test("rapid route map clicks end at the last clicked station", async ({ page }) => {
  await page.goto("/");
  const map = page.getByRole("navigation", { name: "Route map" });
  await map.getByRole("button", { name: "Terminus" }).click();
  await map.getByRole("button", { name: "QuizzX" }).click();
  await expect(currentStop(page)).toHaveAttribute("aria-label", "QuizzX", { timeout: 5000 });
  await expect(page).toHaveURL(/#quizzx$/);
  // Arrived and stays there (the earlier Terminus target must not resume).
  await page.waitForTimeout(500);
  await expect(currentStop(page)).toHaveAttribute("aria-label", "QuizzX");
});

test("switching to Express lands on the same station's section", async ({ page }) => {
  await page.goto("/#formai");
  await expect(currentStop(page)).toHaveAttribute("aria-label", "FormAI");
  await page.getByRole("button", { name: /^Express/ }).click();
  await expect(page.locator("#express")).toBeVisible();
  await expect(page.locator("#formai")).toBeInViewport();
});

// Task 7: the 3D scene exists only in ride mode (lazy chunk), and fades in once drawn.
test("ride mode mounts the 3D scene; Express removes it", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(page.getByTestId("ride-scene")).toHaveCSS("opacity", "1", { timeout: 15000 });
  await page.getByRole("button", { name: /^Express/ }).click();
  await expect(page.locator("#express")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
});
