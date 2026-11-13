import { defineConfig, devices } from "@playwright/test";

// Dedicated port so e2e never collides with `next dev` (3000).
const PORT = 3123;

export default defineConfig({
  testDir: "./e2e",
  // Headless Chromium renders WebGL in software (SwiftShader), so while the 3D scene builds,
  // Playwright's clicks wait seconds for stable frames; with 3 workers sharing the CPU the
  // route-map ride test ran ~20-30 s (measured the same before Task 13). 60 s, not 30 s.
  timeout: 60_000,
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Serve the static export. `npm run e2e` builds first, so `out/` is fresh.
  webServer: {
    command: `npx serve out -l ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});
