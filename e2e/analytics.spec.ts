import { test, expect } from "@playwright/test";

/*
 * Product analytics (PostHog) must stay silent for automated browsers: Playwright sets
 * navigator.webdriver, so the SDK is never even downloaded and no event leaves the page.
 */
test("an automated browser never loads PostHog or sends an analytics request", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("/");
  expect(await page.evaluate(() => navigator.webdriver)).toBe(true);
  // Past the loader's 1.5 s idle deadline: it would have fired by now.
  await page.waitForTimeout(2500);
  expect(requests.filter((u) => /posthog/i.test(u))).toEqual([]);
});
