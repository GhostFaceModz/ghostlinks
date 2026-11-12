import { defineConfig } from "@playwright/test";

function baseURL() {
  const raw = process.env.BASE_URL || "https://ghostfacemodz.github.io/ghostlinks/";
  return raw.endsWith("/") ? raw : `${raw}/`;
}

export default defineConfig({
  testDir: "./specs",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
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
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
    { name: "phone", use: { viewport: { width: 390, height: 844 } } },
  ],
});
