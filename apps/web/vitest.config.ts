import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      include: [
        "components/**/*.{ts,tsx}",
        "modules/admin/**/*.{ts,tsx}",
        "app/page.tsx",
        "app/admin/**/*.{ts,tsx}",
        "lib/**/*.ts",
      ],
      reporter: ["text", "html", "json-summary"],
      thresholds: { lines: 85, functions: 85, branches: 75, statements: 85 },
    },
  },
});
