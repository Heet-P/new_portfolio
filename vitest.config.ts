import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  // Mirror the "@/*" -> "src/*" alias from tsconfig so tests import like app code.
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    // jsdom gives component tests a DOM; pure-logic tests simply ignore it.
    environment: "jsdom",
    include: ["src/**/*.test.ts?(x)"],
    // Task 1 ships no unit tests yet; keep `npm test` green until Task 2 adds them.
    passWithNoTests: true,
  },
});
