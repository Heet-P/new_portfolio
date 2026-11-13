import { test, expect, type Page } from "@playwright/test";

/*
 * The Express whimsy pass in a real browser (media queries, CSS animations, IntersectionObserver).
 * The Express is chosen up front (nt-mode), so these run on the plain page, not the ride.
 */
async function openExpress(page: Page) {
  await page.addInitScript(() => localStorage.setItem("nt-mode", "express"));
  await page.goto("/");
  await expect(page.locator("#express")).toBeVisible();
}

/** Names of the CSS animations currently on the page (CSS Modules prefix them; match on the end). */
const animationNames = (page: Page) =>
  page.evaluate(() => document.getAnimations().map((a) => (a as CSSAnimation).animationName ?? ""));

test("the ink train chugs in and the Solar article inks in when scrolled to", async ({ page }) => {
  await openExpress(page);
  expect((await animationNames(page)).some((n) => n.endsWith("train-chug"))).toBe(true);

  const solar = page.locator("#solar article");
  await expect(solar).toHaveAttribute("data-ink", "pending");
  await page.locator("#solar").scrollIntoViewIfNeeded();
  await expect(solar).toHaveAttribute("data-ink", "in");
  await expect(page.locator("#solar [data-stop-press]")).toBeVisible();
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("the Express whimsy is completely still: no animations, no parallax, nothing held back", async ({ page }) => {
    await openExpress(page);
    await page.locator("#solar").scrollIntoViewIfNeeded();
    // Give an IntersectionObserver or a stray transition every chance to start.
    await page.waitForTimeout(400);
    expect(await animationNames(page)).toEqual([]);
    expect(await page.locator("article[data-ink]").count()).toBe(0);
    for (const value of await page.locator("figure[data-parallax]").evaluateAll((els) => els.map((e) => e.getAttribute("data-parallax")))) {
      expect(value).toBe("off");
    }
    // The Stop press stamp is simply there, at full strength.
    const stamp = page.locator("#solar [data-stop-press]");
    await expect(stamp).toBeVisible();
    expect(await stamp.evaluate((e) => getComputedStyle(e).opacity)).toBe("1");
  });
});
