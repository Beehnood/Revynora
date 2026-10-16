import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["src/**/*.integration.ts", "src/**/*.spec.ts"],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: "v8",
      include: [
        "src/auth/**/*.ts",
        "src/billing/**/*.ts",
        "src/leitner/**/*.ts",
        "src/planning/**/*.ts",
        "src/notifications/**/*.ts",
        "src/admin/**/*.ts",
        "src/privacy/**/*.ts",
        "src/shared/domain/**/*.ts",
        "src/learning/**/*.ts",
        "src/ai/**/*.ts",
        "src/shared/http/**/*.ts",
        "src/database/database.service.ts",
      ],
      exclude: ["**/*.spec.ts", "**/*.integration.ts", "**/*.module.ts"],
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "coverage/integration",
      thresholds: { lines: 80, branches: 70, functions: 80, statements: 80 },
    },
  },
});
