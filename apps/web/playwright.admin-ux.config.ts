import { defineConfig } from "@playwright/test";
// Read-only UI acceptance: existing local account, no Prisma fixtures or seed.
export default defineConfig({
  testDir: "./tests/admin-e2e",
  testMatch: "ux-g7.spec.ts",
  workers: 1,
  fullyParallel: false,
  timeout: 180000,
  outputDir:
    process.env.UX_ARTIFACT_DIR ?? "/private/tmp/revynora-g7-browser-results",
  use: { baseURL: "http://127.0.0.1:3412", headless: true },
  reporter: [["list"]],
  webServer: {
    command:
      "pnpm --filter @revynora/admin exec next start --hostname 127.0.0.1 --port 3412",
    url: "http://127.0.0.1:3412/connexion",
    reuseExistingServer: false,
    env: { API_URL: "http://127.0.0.1:3001" },
  },
});
