import { defineConfig, devices } from "@playwright/test";
import { baseURL, isLocal, localPort } from "./helpers/env.js";

/*
 * Live (default): BASE_URL=https://ghostfacemodz.github.io/ghostlinks/ npx playwright test
 * Local:          E2E_LOCAL=1 npx playwright test   (serves the repo root on E2E_PORT, default 4317)
 * The app derives its base path from location.pathname (js/route.js siteBase()),
 * so the same specs work under /ghostlinks/ on Pages and under / locally.
 */
export default defineConfig({
  testDir: "./specs",
  outputDir: "./test-results",
  globalSetup: "./wait-for-deploy.js",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // No retries: a flaky test should show up red, not pass quietly on the second try.
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : [["list"]],
  use: {
    baseURL: baseURL(),
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
    navigationTimeout: 20_000,
  },
  webServer: isLocal()
    ? {
        command: `node server.js ${localPort()}`,
        url: `http://127.0.0.1:${localPort()}/index.html`,
        reuseExistingServer: false,
        timeout: 15_000,
        stdout: "ignore",
      }
    : undefined,
  projects: [
    { name: "desktop", use: { browserName: "chromium", viewport: { width: 1280, height: 800 } } },
    // Real phone emulation: 390x664 viewport, DPR 3, isMobile, hasTouch, iOS Safari UA.
    // iPhone 13 defaults to WebKit; CI only installs Chromium, so force it here.
    { name: "phone", use: { ...devices["iPhone 13"], browserName: "chromium" } },
  ],
});
