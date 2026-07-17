import { defineConfig, devices } from "@playwright/test";

// The game is a static file — no dev server, no build step.
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 180_000,
  use: {
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
