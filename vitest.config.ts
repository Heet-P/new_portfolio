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
  },
});
