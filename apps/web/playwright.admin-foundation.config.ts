import { defineConfig } from "@playwright/test";
const database = process.env.TEST_DATABASE_URL;
if (
  process.env.G8_ISOLATED_TEST_DB !== "true" ||
  !database ||
  new URL(database).hostname !== "127.0.0.1" ||
  new URL(database).pathname !== "/revynora_test"
)
  throw new Error("Explicit loopback revynora_test database required");
export default defineConfig({
  testDir: "./tests/admin-foundation-e2e",
  workers: 1,
  fullyParallel: false,
  use: { baseURL: "http://127.0.0.1:3450", headless: true },
  reporter: [["list"]],
  webServer: [
    {
      command: "node ../api/dist/main.js",
      url: "http://127.0.0.1:3451/api/v1/health/ready",
      reuseExistingServer: false,
      env: {
        DATABASE_URL: database,
        NODE_ENV: "test",
        HOST: "127.0.0.1",
        PORT: "3451",
        WEB_ORIGIN: "http://127.0.0.1:3450",
        ADMIN_ORIGIN: "http://127.0.0.1:3450",
        COOKIE_SECURE: "false",
        AI_PROVIDER: "mock",
        BILLING_PROVIDER: "mock",
        MAIL_PROVIDER: "local",
        WORKER_ENABLED: "false",
      },
    },
    {
      command: "pnpm exec next start --hostname 127.0.0.1 --port 3450",
      url: "http://127.0.0.1:3450/connexion",
      reuseExistingServer: false,
      env: {
        API_URL: "http://127.0.0.1:3451",
        ADMIN_WEB_INTEGRATION_ENABLED: "true",
      },
    },
  ],
});
