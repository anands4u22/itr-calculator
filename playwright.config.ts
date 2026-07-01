import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT ?? "3000";
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;

/** OCR on scanned Form 16 can take several minutes on mobile emulation */
const TEST_TIMEOUT_MS = 600_000;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: TEST_TIMEOUT_MS,
  expect: { timeout: 60_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "tests/output/playwright-report" }],
    ["json", { outputFile: "tests/output/report.json" }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 60_000,
  },
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    /** Always start fresh so tests hit latest code (avoids stale parseLog / parser) */
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      NEXT_PUBLIC_PARSE_DEBUG: "1",
    },
  },
  projects: [
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 7"],
        locale: "en-IN",
        timezoneId: "Asia/Kolkata",
      },
    },
  ],
});
