import { test, expect } from "@playwright/test";

// Smoke test: the statically exported home page renders the owner's name as h1.
test("home page has an h1 with the owner's name", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("Heet Parikh");
});
