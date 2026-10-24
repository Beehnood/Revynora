import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["src/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      include: ["src/index.ts"],
      reporter: ["text", "html", "json-summary"],
      thresholds: { lines: 85, branches: 75, functions: 85, statements: 85 },
    },
  },
});
