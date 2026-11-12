import { defineConfig, devices } from "@playwright/test";

// Dedicated port so e2e never collides with `next dev` (3000).
const PORT = 3123;

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Serve the static export. `npm run e2e` builds first, so `out/` is fresh.
  webServer: {
    command: `npx serve out -l ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});
