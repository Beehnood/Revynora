import { config } from "dotenv";
import { afterEach, it, expect, vi } from "vitest";
import { loadEnvironment } from "./environment";
vi.mock("dotenv", () => ({ config: vi.fn(() => ({ parsed: {} })) }));
afterEach(() => vi.unstubAllEnvs());
it("le runtime production refuse cookies non sécurisés et origines non HTTPS", () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost/test");
  vi.stubEnv("COOKIE_SECURE", "false");
  expect(() => loadEnvironment()).toThrow("Production requires");
  vi.stubEnv("COOKIE_SECURE", "true");
  vi.stubEnv("WEB_ORIGIN", "http://localhost:3000");
  vi.stubEnv("ADMIN_ORIGIN", "https://admin.revynora.watercode.dev");
  expect(() => loadEnvironment()).toThrow("Production requires");
  vi.stubEnv("WEB_ORIGIN", "https://revynora.watercode.dev");
  expect(loadEnvironment().COOKIE_SECURE).toBe("true");
});

it("loads private API settings before shared defaults, without overriding process variables", () => {
  vi.stubEnv("DATABASE_URL", "postgresql://test:test@127.0.0.1/revynora_test");
  vi.stubEnv("AI_PROVIDER", "gemini");
  vi.stubEnv("GEMINI_API_KEY", "synthetic-backend-key");
  vi.mocked(config).mockClear();
  expect(loadEnvironment().GEMINI_API_KEY).toBe("synthetic-backend-key");
  const calls = vi.mocked(config).mock.calls;
  expect(String(calls[0][0]?.path)).toMatch(/apps\/api\/\.env\.local$/);
  expect(String(calls[1][0]?.path)).toMatch(/\/\.env$/);
  expect(String(calls[1][0]?.path)).not.toContain("/apps/api/");
  expect(
    calls.every(
      ([options]) => options?.quiet === true && options?.override !== true,
    ),
  ).toBe(true);
});
