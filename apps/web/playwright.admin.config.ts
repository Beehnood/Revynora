import { defineConfig } from "@playwright/test";
const database = process.env.TEST_DATABASE_URL;
if (
  !database ||
  new URL(database).pathname !== "/revynora_test" ||
  !["localhost", "127.0.0.1", "::1"].includes(new URL(database).hostname)
)
  throw new Error("Base locale revynora_test obligatoire");
export default defineConfig({
  testDir: "./tests/admin-e2e",
  testMatch: "admin-g2.spec.ts",
  workers: 1,
  fullyParallel: false,
  use: { baseURL: "http://127.0.0.1:3412", headless: true },
  reporter: [["list"]],
  webServer: [
    {
      command: "node ../api/dist/main.js",
      url: "http://127.0.0.1:3411/api/v1/health/ready",
      reuseExistingServer: false,
      env: {
        DATABASE_URL: database,
        TEST_DATABASE_URL: database,
        NODE_ENV: "test",
        PORT: "3411",
        HOST: "127.0.0.1",
        ADMIN_ORIGIN: "http://127.0.0.1:3412",
        WEB_ORIGIN: "http://127.0.0.1:3410",
        COOKIE_SECURE: "false",
        WORKER_ENABLED: "false",
        AI_PROVIDER: "mock",
        BILLING_PROVIDER: "mock",
        MAIL_PROVIDER: "local",
      },
    },
    {
      command:
        "pnpm --filter @revynora/admin exec next start --hostname 127.0.0.1 --port 3412",
      url: "http://127.0.0.1:3412/connexion",
      reuseExistingServer: false,
      env: { API_URL: "http://127.0.0.1:3411" },
    },
  ],
});
