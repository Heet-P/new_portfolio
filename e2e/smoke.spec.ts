import { test, expect } from "@playwright/test";

// Smoke test: the statically exported home page renders the owner's name as h1.
test("home page has an h1 with the owner's name", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("Heet Parikh");
});

// Phone width: neither view may ever scroll sideways (16px gutter, wrapping chips, the route strip).
for (const mode of ["express", "ride"] as const) {
  test(`no horizontal scroll at 375px (${mode})`, async ({ page }) => {
    await page.addInitScript((m) => window.localStorage.setItem("nt-mode", m), mode);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await expect(page.locator("#express")).toBeVisible({ visible: mode === "express" });
    if (mode === "ride") await expect(page.getByRole("navigation", { name: "Route map" })).toBeVisible();
    // Give late layout (fonts, the scene's canvas) a moment, then measure.
    await page.waitForTimeout(500);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(375);
  });
}

// Task 13: the page is titled for search and sharing, with a description and a social card.
test("has the title, description and Open Graph image", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Heet Parikh — Full-Stack & AI Developer");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /Heet Parikh/);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /opengraph-image.jpg/);
  await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute("content", /.{20,}/);
});

// Task 13: keyboard only, the resume is reachable from the top of the Express page, every
// control on the way shows a visible focus ring.
test("keyboard Tab reaches the resume link, with visible focus all the way", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("nt-mode", "express"));
  await page.goto("/");
  await expect(page.getByRole("button", { name: /^Ride the train/ })).toBeVisible();
  const seen: string[] = [];
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press("Tab");
    const focus = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const style = getComputedStyle(el);
      return { text: (el.getAttribute("aria-label") ?? el.textContent ?? "").trim(), href: el.getAttribute("href"), outline: style.outlineStyle, width: style.outlineWidth };
    });
    expect(focus).not.toBeNull();
    // A real ring, not outline: none.
    expect(focus!.outline, focus!.text).not.toBe("none");
    expect(parseFloat(focus!.width), focus!.text).toBeGreaterThanOrEqual(2);
    seen.push(focus!.text);
    if (focus!.href?.endsWith(".pdf")) break;
  }
  // The two toggles come first, the resume soon after (it sits right under the lead's deck).
  expect(seen[0]).toBe("Sound");
  expect(seen[1]).toMatch(/^Ride the train/);
  expect(seen.some((t) => /resume/i.test(t))).toBe(true);
});

// Task 13: in the ride, Tab reaches both toggles and every route-map stop.
test("keyboard reaches the toggles and every route map stop in the ride", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("nt-mode", "ride"));
  await page.goto("/#vaani");
  await expect(page.getByRole("navigation", { name: "Route map" })).toBeVisible();
  const seen = new Set<string>();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    seen.add(await page.evaluate(() => (document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent ?? "").trim()));
  }
  expect(seen).toContain("Sound");
  expect([...seen].some((t) => t.startsWith("Express"))).toBe(true);
  for (const stop of ["Departure", "Vaani AI", "SAHARA", "Terminus"]) expect(seen).toContain(stop);
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
    // Task 13: Express means no 3D at all: the scene chunk never mounts a canvas.
    await expect(page.locator("#express")).toBeVisible();
    await page.waitForTimeout(500);
    await expect(page.locator("canvas")).toHaveCount(0);
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
  // Task 13: remembered "on" can't play before a gesture, so it shows as pending (was: plain
  // pressed). Tapping the pending ticket starts the sound; the next tap switches it off.
  await expect(sound).toHaveAttribute("data-pending", "true");
  await sound.click();
  await expect(sound).toHaveAttribute("aria-pressed", "true");
  await expect(sound).not.toHaveAttribute("data-pending");
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
