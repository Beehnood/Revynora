import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["src/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      include: ["src/health/**/*.ts", "src/database/database.service.ts"],
      exclude: ["**/*.spec.ts"],
      reporter: ["text", "html", "json-summary"],
      thresholds: { lines: 90, functions: 90, branches: 80, statements: 90 },
    },
  },
});
