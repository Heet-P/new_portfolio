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
  await expect(page.getByRole("navigation", { name: "Route map" }).getByRole("button")).toHaveCount(8);
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

// Task 10d: the retired internship hash (#mct) is no longer a station, so an old link opens at Departure.
test("the old #mct link falls back to Departure", async ({ page }) => {
  await page.goto("/#mct");
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
  await map.getByRole("button", { name: "SAHARA" }).click();
  await expect(currentStop(page)).toHaveAttribute("aria-label", "SAHARA", { timeout: 5000 });
  await expect(page).toHaveURL(/#sahara$/);
  // Arrived and stays there (the earlier Terminus target must not resume).
  await page.waitForTimeout(500);
  await expect(currentStop(page)).toHaveAttribute("aria-label", "SAHARA");
});

test("switching to Express lands on the same station's section", async ({ page }) => {
  await page.goto("/#sahara");
  await expect(currentStop(page)).toHaveAttribute("aria-label", "SAHARA");
  await page.getByRole("button", { name: /^Express/ }).click();
  await expect(page.locator("#express")).toBeVisible();
  await expect(page.locator("#sahara")).toBeInViewport();
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

// Task 10b: parked at a station, the camera is inside the cabin and the on-board display shows that stop.
test("deep link settles in the cabin in front of the station's display", async ({ page }) => {
  await page.goto("/#vaani");
  const display = page.getByRole("region", { name: "Vaani AI" });
  await expect(display).toBeVisible({ timeout: 20000 });
  await expect(display.getByRole("heading", { name: "Vaani AI" })).toBeVisible();
  // Every outbound link on the display opens in a new tab without handing over the opener.
  for (const link of await display.locator("a[href^='http']").all()) {
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
  }
});

// Task 10d: SAHARA's display carries GitHub plus both demo videos, all opening in a new tab.
test("/#sahara shows the SAHARA display with GitHub and two demos", async ({ page }) => {
  await page.goto("/#sahara");
  const display = page.getByRole("region", { name: "SAHARA" });
  await expect(display).toBeVisible({ timeout: 20000 });
  await expect(display.getByRole("heading", { name: "SAHARA" })).toBeVisible();
  for (const name of ["GitHub", "Watch demo", "Watch demo 2"]) {
    const link = display.getByRole("link", { name, exact: true });
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
  }
});

test("the Terminus display hands over the resume as a download ticket", async ({ page }) => {
  await page.goto("/#terminus");
  const display = page.getByRole("region", { name: "Terminus" });
  await expect(display).toBeVisible({ timeout: 20000 });
  await expect(display.getByRole("link", { name: /resume/i })).toHaveAttribute("download", "");
});

// Task 13 (deferred race): a cold load straight onto a deep link must always open at that
// station, never at a neighbour, however the page's first scroll events land. Fresh browser
// contexts, three times per hash, so a flaky race shows up here rather than for a visitor.
test("cold deep links always open at the right station", async ({ browser }) => {
  test.setTimeout(400_000);
  const cases = [
    { hash: "departure", name: "Departure" },
    { hash: "sahara", name: "SAHARA" },
    { hash: "terminus", name: "Terminus" },
  ];
  for (const { hash, name } of cases) {
    for (let run = 0; run < 3; run++) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.addInitScript(() => {
        window.localStorage.setItem("nt-mode", "ride");
        // Record every announcement the ride makes, from the first frame on.
        const said: string[] = ((window as unknown as { said: string[] }).said = []);
        new MutationObserver(() => {
          const text = document.querySelector("p[aria-live]")?.textContent;
          if (text && said[said.length - 1] !== text) said.push(text);
        }).observe(document, { subtree: true, childList: true, characterData: true });
      });
      await page.goto(`/#${hash}`);
      // The cabin display only comes up once the train is parked there (slow under load: CI-ish).
      await expect(page.locator("p[aria-live]"), `${hash} run ${run}`).toHaveText(`Now at ${name}`, { timeout: 40000 });
      await expect(currentStop(page)).toHaveAttribute("aria-label", name);
      await expect(page).toHaveURL(new RegExp(`#${hash}$`));
      await page.waitForTimeout(500);
      await expect(currentStop(page)).toHaveAttribute("aria-label", name);
      expect(await page.evaluate(() => (window as unknown as { said: string[] }).said)).toEqual([`Now at ${name}`]);
      await context.close();
    }
  }
});

// Task 13 (deferred): coming back from Express onto a different station snaps the train there
// (no glide past the stops in between): the display of that station is up within a moment.
test("re-entering the ride from Express snaps to the hash's station", async ({ page }) => {
  await page.goto("/#vaani");
  await expect(page.getByRole("region", { name: "Vaani AI" })).toBeVisible({ timeout: 20000 });
  await page.getByRole("button", { name: /^Express/ }).click();
  await expect(page.locator("#express")).toBeVisible();
  // A stale hash from elsewhere (e.g. an in-page link) while on Express.
  await page.evaluate(() => history.replaceState(null, "", "#terminus"));
  await page.getByRole("button", { name: /^Ride the train/ }).click();
  await expect(currentStop(page)).toHaveAttribute("aria-label", "Terminus");
  // A glide from Vaani to the Terminus takes ~10 s at the train's top speed; a snap shows the page at once.
  await expect(page.getByRole("region", { name: "Terminus" })).toBeVisible({ timeout: 4000 });
});

// Task 13 (deferred): keyboard scrolling takes over from a route-map ride, like the wheel does.
test("a keyboard scroll interrupts a route map ride", async ({ page }) => {
  await page.goto("/#departure");
  const map = page.getByRole("navigation", { name: "Route map" });
  await map.getByRole("button", { name: "Terminus" }).click();
  await page.waitForTimeout(300);
  // Home = native jump to the top of the page, which must win over the 2.4 s ride.
  await page.keyboard.press("Home");
  await page.waitForTimeout(3000);
  await expect(currentStop(page)).toHaveAttribute("aria-label", "Departure");
});

// Task 13 (deferred): losing the WebGL context (GPU reset, a phone reclaiming memory) is not a
// React error, so the boundary never saw it; now the visitor lands on Express instead.
test("a lost WebGL context drops the visitor into Express", async ({ page }) => {
  await page.goto("/#vaani");
  await expect(page.getByTestId("ride-scene")).toHaveCSS("opacity", "1", { timeout: 20000 });
  await page.evaluate(() => {
    const canvas = document.querySelector("canvas")!;
    const gl = (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) as WebGLRenderingContext;
    gl.getExtension("WEBGL_lose_context")!.loseContext();
  });
  await expect(page.locator("#express")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Ride the train/ })).toBeVisible();
});
