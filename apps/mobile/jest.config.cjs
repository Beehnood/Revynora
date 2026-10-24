module.exports = {
  preset: "jest-expo",
  testMatch: ["**/tests/**/*.test.ts", "**/tests/**/*.test.tsx"],
  collectCoverageFrom: ["App.tsx", "src/**/*.ts", "src/**/*.tsx"],
  coverageReporters: ["text", "html", "json-summary"],
  coverageDirectory: "coverage",
  coverageThreshold: {
    global: { statements: 70, branches: 60, functions: 50, lines: 70 },
    "./src/session.ts": { statements: 90, branches: 80, lines: 90 },
  },
  transformIgnorePatterns: [
    "node_modules/(?!(?:\\.pnpm/)?(?:@react-native|react-native|@react-navigation|expo|@expo|@revynora|jest-expo|@unimodules|unimodules))",
  ],
};
