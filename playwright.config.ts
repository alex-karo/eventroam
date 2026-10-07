import { defineConfig, devices } from "@playwright/test";

if (
  !process.env.E2E_DATABASE_PATH ||
  process.env.DATABASE_PATH !== process.env.E2E_DATABASE_PATH
) {
  throw new Error(
    "Run Playwright through npm run test:e2e to use a temporary fixture database.",
  );
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://festivals.localhost:3137",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], browserName: "chromium" },
    },
  ],
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3137",
    url: "http://festivals.localhost:3137",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_PATH: process.env.E2E_DATABASE_PATH,
      PUBLIC_APEX_ORIGIN: "http://localhost:3137",
      PUBLIC_FESTIVALS_ORIGIN: "http://festivals.localhost:3137",
      NEXT_PUBLIC_MAPBOX_TOKEN: "",
    },
  },
});
