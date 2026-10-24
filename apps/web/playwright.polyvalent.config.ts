import { defineConfig } from "@playwright/test";
import admin from "./playwright.admin.config";
if (process.env.G8_ISOLATED_TEST_DB !== "true")
  throw new Error("Base G8 isolée explicitement requise");
export default defineConfig({
  ...admin,
  testMatch:
    /(?:admin-g2|statistics-g3|catalog-g4|billing-g6|ux-g7|polyvalent-g8)\.spec\.ts/,
  timeout: 180000,
  outputDir:
    process.env.UX_ARTIFACT_DIR ?? "/private/tmp/revynora-g8-browser-results",
  webServer: [
    ...(Array.isArray(admin.webServer) ? admin.webServer : []),
    {
      command:
        "pnpm --filter @revynora/web exec next start --hostname 127.0.0.1 --port 3410",
      url: "http://127.0.0.1:3410/connexion",
      reuseExistingServer: false,
      env: {
        API_URL: "http://127.0.0.1:3411",
        ADMIN_ORIGIN: "http://127.0.0.1:3412",
      },
    },
  ],
});
