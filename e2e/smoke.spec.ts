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

// Sound: off by default, beside the mode toggle in both views, a true toggle (aria-pressed), remembered.
test("sound toggle is off by default, 44px+, in both views, and remembered", async ({ page }) => {
  await page.goto("/");
  // The mode toggle only renders once the page has hydrated, so clicks below reach React.
  await expect(page.getByRole("button", { name: /^(Express|Ride the train)/ })).toBeVisible();
  const sound = page.getByRole("button", { name: "Sound", exact: true });
  await expect(sound).toBeVisible();
  await expect(sound).toHaveAttribute("aria-pressed", "false");
  const box = await sound.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await sound.click();
  await expect(sound).toHaveAttribute("aria-pressed", "true");
  // The other view has it too, still on.
  await page.getByRole("button", { name: /^(Express|Ride the train)/ }).click();
  await expect(sound).toBeVisible();
  await expect(sound).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.getByRole("button", { name: /^(Express|Ride the train)/ })).toBeVisible();
  await expect(sound).toHaveAttribute("aria-pressed", "true");
  await sound.click();
  await expect(sound).toHaveAttribute("aria-pressed", "false");
});

// Review Focus 3: storage that throws (some private modes) still gives a working toggle, off by default.
test("sound toggle works when localStorage throws", async ({ page }) => {
  await page.addInitScript(() => {
    const fail = () => {
      throw new DOMException("denied", "SecurityError");
    };
    Object.defineProperty(window, "localStorage", { get: fail, configurable: true });
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: /^(Express|Ride the train)/ })).toBeVisible();
  const sound = page.getByRole("button", { name: "Sound", exact: true });
  await expect(sound).toHaveAttribute("aria-pressed", "false");
  await sound.click();
  await expect(sound).toHaveAttribute("aria-pressed", "true");
});
