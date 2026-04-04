import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Pixel 5 defaults to chromium — tests mobile viewport (393×851, sm breakpoint not reached)
    { name: "chromium-mobile", use: { ...devices["Pixel 5"] } },
    // Custom tablet viewport using chromium (768px — sm: breakpoint active, md: not yet)
    {
      name: "chromium-tablet",
      use: { browserName: "chromium", viewport: { width: 768, height: 1024 } },
    },
  ],
  // Start dev server automatically when running locally
  webServer: process.env.CI
    ? undefined
    : {
        command: "npm run dev:app",
        url: "http://localhost:5173",
        reuseExistingServer: true,
        timeout: 30000,
      },
});
