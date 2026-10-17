import { afterEach, it, expect, vi } from "vitest";
import { loadEnvironment } from "./environment";
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
