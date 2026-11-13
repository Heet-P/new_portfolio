import { test, expect, type Page } from "@playwright/test";

/*
 * Task 14: the ticket-printer intro ("Take the journey"). A fresh session that starts the ride at
 * the top of the route gets a ticket printed before boarding; deep links, Express and a second
 * load in the same session go straight in. Ride mode is chosen up front (nt-mode) so each test
 * is deterministic; sessionStorage starts empty in every new Playwright context.
 */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("nt-mode", "ride"));
});

const dialog = (page: Page) => page.getByRole("dialog", { name: "Your ticket" });
const status = (page: Page) => dialog(page).getByRole("status");
const take = (page: Page) => page.getByRole("button", { name: "Take the journey" });
const routeMap = (page: Page) => page.getByRole("navigation", { name: "Route map" });

test("a fresh ride at / prints a ticket, then 'Take the journey' boards", async ({ page }) => {
  await page.goto("/");
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page)).toHaveAttribute("aria-modal", "true");
  await expect(status(page)).toContainText("Checking the timetable…");
  // The 3D world loads behind the machine meanwhile.
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(status(page)).toContainText("Printing your ticket…", { timeout: 6000 });
  await expect(status(page)).toContainText("Ticket ready — all aboard", { timeout: 6000 });
  // The ticket is real text: the whole route can be read.
  const route = dialog(page).getByRole("list", { name: "Route" });
  await expect(route.getByRole("listitem")).toHaveCount(8);
  await expect(route.getByRole("listitem").first()).toContainText("Departure");
  await expect(route.getByRole("listitem").last()).toContainText("Terminus");
  await expect(take(page)).toBeFocused();
  const box = await take(page).boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);

  await take(page).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(routeMap(page)).toBeVisible();
  await expect(page).toHaveURL(/#departure$/);
  expect(await page.evaluate(() => sessionStorage.getItem("nt-intro-seen"))).toBe("1");
  // The ride works straight away: a route map stop can be clicked.
  await routeMap(page).getByRole("button", { name: "Vaani AI" }).click();
  await expect(page).toHaveURL(/#vaani$/, { timeout: 8000 });
});

// Task 15: boarding tears the ticket along its perforation, then the ride shows.
test("'Take the journey' tears the ticket, then the ride is visible", async ({ page }) => {
  await page.goto("/");
  await expect(take(page)).toBeVisible({ timeout: 10000 });
  // The torn pieces only live for ~0.8 s, quicker than a slow headless frame: note them as they appear.
  await page.evaluate(() => {
    const w = window as unknown as { torn: string[] };
    w.torn = [];
    new MutationObserver(() => {
      for (const el of document.querySelectorAll("[data-tear]")) {
        const piece = el.getAttribute("data-tear")!;
        if (!w.torn.includes(piece)) w.torn.push(piece);
      }
    }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-tear"] });
  });
  await take(page).click();
  // The ticket came apart in two (body above the tear, the stub left behind)...
  await expect.poll(() => page.evaluate(() => (window as unknown as { torn: string[] }).torn.sort())).toEqual(["body", "stub"]);
  // ...then the night fades and the ride is there.
  await expect(dialog(page)).toHaveCount(0, { timeout: 3000 });
  await expect(routeMap(page)).toBeVisible();
  await expect(page).toHaveURL(/#departure$/);
});

// Task 15: a first-time rider is told how the train moves, once.
test("after boarding at Departure the scroll hint shows, and a wheel scroll dismisses it for the session", async ({ page }) => {
  const hint = page.getByTestId("scroll-hint");
  await page.goto("/");
  // Never under the intro.
  await expect(take(page)).toBeVisible({ timeout: 10000 });
  await expect(hint).not.toHaveAttribute("data-visible");
  await take(page).click();
  await expect(dialog(page)).toHaveCount(0, { timeout: 3000 });
  await expect(hint).toHaveAttribute("data-visible", "true", { timeout: 8000 });
  await expect(hint.getByText("Scroll to depart")).toBeVisible();
  await expect(hint).toHaveAttribute("role", "status");
  const size = await hint.getByText("Scroll to depart").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(size).toBeGreaterThanOrEqual(16);

  await page.mouse.move(700, 400);
  await page.mouse.wheel(0, 300);
  await expect(hint).not.toHaveAttribute("data-visible");
  // (Faded, then the words leave; a busy headless frame can hold the timer up for a while.)
  await expect(hint).toHaveText("", { timeout: 8000 });
  expect(await page.evaluate(() => sessionStorage.getItem("nt-hint-seen"))).toBe("1");

  // Back at Departure on a reload in the same session: no hint.
  await page.goto("/#departure");
  await expect(routeMap(page)).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(hint).not.toHaveAttribute("data-visible");
});

test("a deep link skips the intro", async ({ page }) => {
  await page.goto("/#sahara");
  await expect(routeMap(page).locator("[aria-current=step]")).toHaveAttribute("aria-label", "SAHARA");
  await page.waitForTimeout(800);
  await expect(dialog(page)).toHaveCount(0);
});

test("a second load in the same session skips it", async ({ page }) => {
  await page.goto("/");
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  await page.reload();
  await expect(routeMap(page)).toBeVisible();
  await page.waitForTimeout(800);
  await expect(dialog(page)).toHaveCount(0);
});

test("'In a hurry?' goes to the Express page", async ({ page }) => {
  await page.goto("/");
  // (Not via Skip: under load a click can land after the ticket is out, when Skip is gone.)
  await expect(status(page)).toContainText("Ticket ready — all aboard", { timeout: 10000 });
  await dialog(page).getByRole("button", { name: /^In a hurry\?/ }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.locator("#express")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
});

test("keyboard only: Tab to Skip, Enter, then 'Take the journey' is focused and boards", async ({ page }) => {
  await page.goto("/");
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(dialog(page).getByRole("button", { name: "Skip" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(status(page)).toContainText("Ticket ready — all aboard");
  await expect(take(page)).toBeFocused();
  // Focus stays in the dialog: Tab cycles between its two buttons.
  await page.keyboard.press("Tab");
  await expect(dialog(page).getByRole("button", { name: /^In a hurry\?/ })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(take(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog(page)).toHaveCount(0);
  // Focus lands on the ride: the current stop on the route map.
  await expect(routeMap(page).locator("[aria-current=step]")).toBeFocused();
});

test("the train doesn't move behind the dialog when the visitor scrolls", async ({ page }) => {
  await page.goto("/");
  await expect(dialog(page)).toBeVisible();
  await page.mouse.move(640, 360);
  await page.mouse.wheel(0, 1200);
  await page.keyboard.press("PageDown");
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page).toHaveURL(/#departure$/);
});

test("no horizontal scroll at 375px with the intro up", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await expect(take(page)).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  expect(await dialog(page).evaluate((el) => el.scrollWidth)).toBeLessThanOrEqual(375);
});

/** Collects the text of every script the page downloads (to see which chunks were fetched). */
function recordScripts(page: Page): Promise<string>[] {
  const bodies: Promise<string>[] = [];
  page.on("response", (r) => {
    if (r.request().resourceType() === "script") bodies.push(r.text().catch(() => ""));
  });
  return bodies;
}
/** A string only the lazily loaded printer chunk contains. */
const INTRO_MARKER = "Take the journey";

// Fix round: the printer is its own chunk. Express never pays for it; the ride's first visit does.
test("Express never downloads the intro's code", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("nt-mode", "express"));
  const scripts = recordScripts(page);
  await page.goto("/");
  await expect(page.locator("#express")).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  expect((await Promise.all(scripts)).some((t) => t.includes(INTRO_MARKER))).toBe(false);
});

test("a fresh ride does download it (the check above can see the chunk)", async ({ page }) => {
  const scripts = recordScripts(page);
  await page.goto("/");
  await expect(dialog(page)).toBeVisible();
  expect((await Promise.all(scripts)).some((t) => t.includes(INTRO_MARKER))).toBe(true);
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("a visitor who chose the ride sees the finished ticket at once, nothing moving", async ({ page }) => {
    await page.goto("/");
    await expect(dialog(page)).toBeVisible();
    await expect(status(page)).toContainText("Ticket ready — all aboard");
    await expect(take(page)).toBeFocused();
    expect(await dialog(page).evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
    await take(page).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(routeMap(page)).toBeVisible();
  });
});
