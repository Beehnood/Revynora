import { config } from "dotenv";
import { resolve } from "node:path";
config({
  path: resolve(__dirname, "../../.env"),
  quiet: true,
});
import { defineConfig } from "@playwright/test";
const database =
  process.env.TEST_DATABASE_URL ??
  (() => {
    const url = new URL(
      process.env.DATABASE_URL ??
        "postgresql://revynora:local_dev_only@localhost:5433/revynora?schema=public",
    );
    url.pathname = "/revynora_test";
    return url.toString();
  })();
process.env.TEST_DATABASE_URL = database;
if (new URL(database).pathname !== "/revynora_test")
  throw new Error("Base revynora_test obligatoire pour Playwright");
export default defineConfig({
  testDir: "./tests/e2e",
  expect: { timeout: 10000 },
  fullyParallel: true,
  workers: 2,
  globalTeardown: "./tests/e2e/cleanup.ts",
  use: {
    baseURL: "http://127.0.0.1:3000",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node ../api/dist/main.js",
      url: "http://127.0.0.1:3001/api/v1/health/ready",
      reuseExistingServer: false,
      timeout: 30000,
      env: {
        DATABASE_URL: database,
        AI_PROVIDER: "mock",
        BILLING_PROVIDER: "mock",
        WORKER_ENABLED: "false",
        AI_DAILY_LIMIT: "10",
        PORT: "3001",
        COOKIE_SECURE: "false",
      },
    },
    {
      command: "pnpm exec next start --hostname 127.0.0.1 --port 3000",
      url: "http://127.0.0.1:3000",
      reuseExistingServer: false,
      timeout: 60000,
    },
  ],
  reporter: [["list"], ["html", { open: "never" }]],
});
