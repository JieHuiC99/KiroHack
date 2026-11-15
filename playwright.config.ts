import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// E2E runs a production build against the app_test database on its own port, so it never
// collides with your `npm run dev` on :3000 or touches demo data.
if (existsSync(".env.test")) process.loadEnvFile(".env.test");
const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // one shared emergency state,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  // No sign-in on the demo flows, so no auth setup project (see README "Decisions").
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], channel: process.env.PW_CHANNEL } }],
  webServer: {
    // Always the production build: it is what judges see, and Next 16 refuses a second
    // `next dev` in the same folder (your own dev server on :3000 keeps running).
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
