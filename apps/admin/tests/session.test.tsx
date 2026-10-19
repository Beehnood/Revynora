import { afterEach, expect, it, vi } from "vitest";
import { readAdminSession } from "../lib/admin-session";
import { adminApiOrigin } from "../lib/api-origin";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("exige une origine explicite en production et HTTPS sur Vercel et hors loopback", () => {
  expect(() => adminApiOrigin({ NODE_ENV: "production" })).toThrow();
  expect(() => adminApiOrigin({ VERCEL: "1" })).toThrow();
  for (const API_URL of [
    "http://api.example.test",
    "https://user:password@api.example.test",
    "https://api.example.test/path",
  ])
    expect(() => adminApiOrigin({ NODE_ENV: "production", API_URL })).toThrow();
  expect(() =>
    adminApiOrigin({ VERCEL: "1", API_URL: "http://127.0.0.1:3001" }),
  ).toThrow();
  expect(
    adminApiOrigin({
      NODE_ENV: "production",
      API_URL: "http://127.0.0.1:3001",
    }),
  ).toBe("http://127.0.0.1:3001");
  expect(adminApiOrigin({ NODE_ENV: "development" })).toBe(
    "http://127.0.0.1:3001",
  );
  expect(
    adminApiOrigin({
      NODE_ENV: "production",
      API_URL: "https://api.example.test",
    }),
  ).toBe("https://api.example.test");
});
it("refuse les sessions absentes et invalides sans requête", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  expect(await readAdminSession(undefined)).toBe("signin");
  expect(await readAdminSession("invalid")).toBe("signin");
  expect(fetch).not.toHaveBeenCalled();
});
it("distingue expiration, refus, panne et profil malformé", async () => {
  vi.stubEnv("API_URL", "https://api.example.test");
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  for (const [response, state] of [
    [new Response(null, { status: 401 }), "signin"],
    [new Response(null, { status: 403 }), "forbidden"],
    [new Response(null, { status: 500 }), "unavailable"],
    [Response.json({ id: "u", role: "STUDENT" }), "forbidden"],
    [Response.json({ id: "u", role: "ADMIN" }), "authenticated"],
    [Response.json({ role: "ADMIN" }), "unavailable"],
    [Response.json({ id: "u", role: "SUPERADMIN" }), "unavailable"],
    [new Response("invalid json"), "unavailable"],
  ] as const) {
    fetch.mockResolvedValueOnce(response);
    expect(await readAdminSession("a".repeat(43))).toBe(state);
  }
  expect(fetch).toHaveBeenCalledWith(
    "https://api.example.test/api/v1/users/me",
    expect.objectContaining({ cache: "no-store", redirect: "error" }),
  );
  fetch.mockRejectedValueOnce(new Error("timeout"));
  expect(await readAdminSession("a".repeat(43))).toBe("unavailable");
});
it("ne contacte jamais localhost si API_URL manque en production", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("API_URL", "");
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  expect(await readAdminSession("a".repeat(43))).toBe("unavailable");
  expect(fetch).not.toHaveBeenCalled();
});
