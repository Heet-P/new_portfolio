import { test, expect, type Page } from "@playwright/test";

/*
 * Task 17: the cabin newspaper reads first, then rides on. Scrolling inside the paper scrolls
 * the page; past its end (once armed) the scroll is handed to the train. The page ends with
 * "Continued at the next stop" and stop buttons; phones keep the train in view around the paper
 * and get a sticky stop bar.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("nt-mode", "ride");
    window.sessionStorage.setItem("nt-intro-seen", "1");
  });
});

const currentStop = (page: Page) => page.getByRole("navigation", { name: "Route map" }).locator("[aria-current=step]");

/** Deep link to a stop and wait until its paper has fully faded in (the hand-off waits for that too). */
async function openPaper(page: Page, hash: string, name: string) {
  await page.goto(`/#${hash}`);
  const display = page.getByRole("region", { name });
  await expect(display).toBeVisible({ timeout: 20000 });
  await expect(page.locator("[data-display] > div")).toHaveCSS("opacity", "1", { timeout: 20000 });
  return display;
}

/** True when the paper's page is scrolled to its end. */
const atBottom = (page: Page) =>
  page.locator("[data-paper-scroller]").evaluate((el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 1);

test("wheeling past the end of the paper rides on from Vaani to YieldGuard", async ({ page }) => {
  // Headless WebGL is software-rendered: with the cabin drawn, every round trip takes seconds.
  test.setTimeout(240_000);
  const display = await openPaper(page, "vaani", "Vaani AI");
  const box = (await display.locator("[data-paper-scroller]").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const startY = await page.evaluate(() => window.scrollY);

  // Inside the paper the wheel reads the page (one long wheel: the page takes what it has left,
  // the rest is never chained to the window); the train stays put.
  await page.mouse.wheel(0, 3000);
  await expect.poll(() => atBottom(page), { timeout: 30000 }).toBe(true);
  await expect(display.getByTestId("paper-footer")).toContainText("Continued at the next stop: YieldGuard AI");
  expect(await page.evaluate(() => window.scrollY)).toBe(startY);

  // Edge resistance: the first notch past the end (a new gesture) only arms the hand-off.
  await page.mouse.wheel(0, 100);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.scrollY)).toBe(startY);
  await expect(currentStop(page)).toHaveAttribute("aria-label", "Vaani AI");

  // Keep wheeling: the train leaves Vaani and pulls into YieldGuard.
  await expect(async () => {
    await page.mouse.wheel(0, 400);
    await expect(currentStop(page)).toHaveAttribute("aria-label", "YieldGuard AI", { timeout: 2000 });
  }).toPass({ timeout: 180_000 });
  await expect(page).toHaveURL(/#yieldguard$/);
});

test("'Next stop' at the end of the paper rides to the next stop", async ({ page }) => {
  test.setTimeout(120_000);
  const display = await openPaper(page, "vaani", "Vaani AI");
  await display.getByTestId("paper-footer").getByRole("button", { name: "Next stop" }).click();
  await expect(currentStop(page)).toHaveAttribute("aria-label", "YieldGuard AI", { timeout: 10000 });
  // The cabin opens once the train has pulled in (slow under a loaded, software-rendered run).
  await expect(page.getByRole("region", { name: "YieldGuard AI" })).toBeVisible({ timeout: 40000 });
});

test("the first open paper says how it scrolls, until the reader reaches the end of a page", async ({ page }) => {
  test.setTimeout(120_000);
  const display = await openPaper(page, "vaani", "Vaani AI");
  const hint = display.getByTestId("paper-hint");
  await expect(hint).toHaveAttribute("data-visible", "true");
  await expect(hint.getByText("Scroll to read · keep scrolling to ride on")).toBeVisible();
  // One hint at a time: the Departure hint is not up as well.
  await expect(page.getByTestId("scroll-hint")).not.toHaveAttribute("data-visible");

  await display.locator("[data-paper-scroller]").evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
  await expect(hint).toHaveCount(0, { timeout: 3000 });
  expect(await page.evaluate(() => sessionStorage.getItem("nt-paper-hint-seen"))).toBe("1");
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test("the paper leaves the ride in view around it, with a sticky stop bar", async ({ page }) => {
    test.setTimeout(120_000);
    const display = await openPaper(page, "vaani", "Vaani AI");
    const box = (await display.boundingBox())!;
    // Cabin visible either side and a clear band of the ride above the paper.
    expect(box.x).toBeGreaterThanOrEqual(16);
    expect(375 - (box.x + box.width)).toBeGreaterThanOrEqual(16);
    expect(box.y).toBeGreaterThanOrEqual(812 * 0.12);
    expect(box.y).toBeLessThanOrEqual(812 * 0.18);

    const bar = display.getByTestId("paper-bar");
    await expect(bar).toBeVisible();
    await expect(bar).toContainText("Vaani AI");
    const b = (await bar.boundingBox())!;
    expect(b.y + b.height).toBeLessThanOrEqual(box.y + box.height + 0.5);
    for (const name of ["Previous stop", "Next stop"]) {
      const button = (await bar.getByRole("button", { name }).boundingBox())!;
      expect(button.height).toBeGreaterThanOrEqual(44);
      expect(button.width).toBeGreaterThanOrEqual(44);
    }
    const size = await bar.getByRole("button", { name: "Next stop" }).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(size).toBeGreaterThanOrEqual(16);
    // Swipe wording on a touch screen.
    await expect(display.getByTestId("paper-hint").getByText("Swipe to read · keep swiping to ride on")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);

    await bar.getByRole("button", { name: "Next stop" }).tap();
    await expect(currentStop(page)).toHaveAttribute("aria-label", "YieldGuard AI", { timeout: 10000 });
  });
});
