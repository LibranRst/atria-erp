import { defineConfig } from "@playwright/test";
import { browserTestEnvironment } from "./e2e/environment";

const settings = browserTestEnvironment();
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.pw.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  outputDir: "./test-results",
  use: {
    baseURL: settings.webUrl,
    browserName: "chromium",
    viewport: { width: 390, height: 844 },
    contextOptions: { reducedMotion: "reduce" },
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "bun --no-env-file e2e/start-server.ts api",
      url: `${settings.apiUrl}/ready`,
      reuseExistingServer: process.env.ATRIA_E2E_REUSE_SERVERS === "true",
      timeout: 120_000,
      env: { ATRIA_E2E_ENV_FILE: process.env.ATRIA_E2E_ENV_FILE ?? "" },
    },
    {
      command: "bun --no-env-file e2e/start-server.ts web",
      url: `${settings.webUrl}/login`,
      reuseExistingServer: process.env.ATRIA_E2E_REUSE_SERVERS === "true",
      timeout: 120_000,
      env: { ATRIA_E2E_ENV_FILE: process.env.ATRIA_E2E_ENV_FILE ?? "" },
    },
  ],
});
