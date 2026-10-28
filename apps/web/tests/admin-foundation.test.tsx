import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Layout from "../app/admin/layout";
import { readAdminSession } from "../lib/admin-session";
const state = vi.hoisted(() => ({
  token: "a".repeat(43) as string | undefined,
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (state.token ? { value: state.token } : undefined),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw Error("REDIRECT:" + path);
  },
}));
const fetcher = vi.fn();
const children = <h1>Administration</h1>;
beforeEach(() => {
  state.token = "a".repeat(43);
  vi.stubEnv("API_URL", "https://api.example.test");
  vi.stubEnv("ADMIN_ORIGIN", "https://admin.example.test");
  vi.stubEnv("ADMIN_WEB_INTEGRATION_ENABLED", "true");
  vi.stubGlobal("fetch", fetcher);
  fetcher.mockReset();
  fetcher.mockImplementation(async () =>
    Response.json({ id: "admin", role: "ADMIN", disabledAt: null }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it.each([undefined, "", "invalid", "a\r\nb"])(
  "refuse le cookie absent ou invalide (%s), sans appel API",
  async (token) => {
    state.token = token;
    await expect(Layout({ children })).rejects.toThrow(
      "REDIRECT:/connexion?retour=%2Fadmin",
    );
    expect(fetcher).not.toHaveBeenCalled();
  },
);
it.each([401, 403])(
  "refuse une session rejetée par l’API (%s)",
  async (status) => {
    fetcher.mockResolvedValueOnce(new Response(null, { status }));
    await expect(Layout({ children })).rejects.toThrow(
      status === 401 ? "REDIRECT:/connexion?retour=%2Fadmin" : "REDIRECT:/app",
    );
  },
);
it("refuse STUDENT et ne rend pas le contenu protégé", async () => {
  fetcher.mockResolvedValueOnce(
    Response.json({ id: "student", role: "STUDENT", disabledAt: null }),
  );
  await expect(Layout({ children })).rejects.toThrow("REDIRECT:/app");
});
it("refuse également un profil explicitement suspendu", async () => {
  fetcher.mockResolvedValueOnce(
    Response.json({
      id: "admin",
      role: "ADMIN",
      disabledAt: "2026-10-28T10:00:00Z",
    }),
  );
  await expect(Layout({ children })).rejects.toThrow(
    "REDIRECT:/connexion?retour=%2Fadmin",
  );
});
it("rend le socle ADMIN sans accorder ni appeler des droits G8/G9", async () => {
  render(await Layout({ children }));
  expect(screen.getByRole("heading", { name: "Administration" })).toBeVisible();
  expect(
    screen.getByRole("link", { name: "Mon espace pédagogique" }),
  ).toHaveAttribute("href", "/app");
  expect(screen.getByRole("link", { name: "Vue générale" })).toHaveAttribute(
    "href",
    "/admin",
  );
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher).toHaveBeenCalledWith(
    "https://api.example.test/api/v1/users/me",
    expect.objectContaining({
      headers: { cookie: "revynora_session=" + state.token },
      cache: "no-store",
      redirect: "error",
      signal: expect.any(AbortSignal),
    }),
  );
});
it.each([undefined, "false", "TRUE", "1"])(
  "conserve le pont historique si l’activation n’est pas exactement true (%s)",
  async (flag) => {
    if (flag === undefined) delete process.env.ADMIN_WEB_INTEGRATION_ENABLED;
    else vi.stubEnv("ADMIN_WEB_INTEGRATION_ENABLED", flag);
    await expect(Layout({ children })).rejects.toThrow(
      "REDIRECT:https://admin.example.test",
    );
  },
);
it("conserve les destinations locales et de connexion du mode historique", async () => {
  vi.stubEnv("ADMIN_WEB_INTEGRATION_ENABLED", "false");
  delete process.env.ADMIN_ORIGIN;
  await expect(Layout({ children })).rejects.toThrow(
    "REDIRECT:http://localhost:3002",
  );
  state.token = undefined;
  await expect(Layout({ children })).rejects.toThrow("REDIRECT:/connexion");
});
it.each([500, "network", "json", "missing-id", "unknown-role", "null"])(
  "ferme l’accès sans rendre les enfants si l’API est indisponible ou malformée (%s)",
  async (mode) => {
    if (mode === 500)
      fetcher.mockResolvedValueOnce(new Response(null, { status: 500 }));
    else if (mode === "network")
      fetcher.mockRejectedValueOnce(new Error("timeout"));
    else if (mode === "json")
      fetcher.mockResolvedValueOnce(new Response("invalid"));
    else
      fetcher.mockResolvedValueOnce(
        Response.json(
          mode === "null"
            ? null
            : mode === "missing-id"
              ? { role: "ADMIN" }
              : { id: "admin", role: "OTHER" },
        ),
      );
    render(await Layout({ children }));
    expect(screen.getByRole("heading")).toHaveTextContent(
      "Administration indisponible",
    );
    expect(screen.queryByText(/Bienvenue/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Réessayer" })).toHaveAttribute(
      "href",
      "/admin",
    );
  },
);
it("exige une origine API explicite en production sans exposer le cookie à une redirection", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("API_URL", "");
  expect(await readAdminSession(state.token)).toBe("unavailable");
  expect(fetcher).not.toHaveBeenCalled();
});
it.each([
  "http://api.example.test",
  "https://user:pass@api.example.test",
  "https://api.example.test/path",
  "https://api.example.test/",
])("refuse une origine de production invalide (%s)", async (origin) => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("API_URL", origin);
  expect(await readAdminSession(state.token)).toBe("unavailable");
  expect(fetcher).not.toHaveBeenCalled();
});
it("refuse même loopback HTTP sur Vercel et autorise le loopback local hors Vercel", async () => {
  vi.stubEnv("API_URL", "http://127.0.0.1:3001");
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("VERCEL", "1");
  expect(await readAdminSession(state.token)).toBe("unavailable");
  vi.stubEnv("VERCEL", "");
  expect(await readAdminSession(state.token)).toBe("authenticated");
});
it("utilise l’API loopback seulement en développement sans API_URL", async () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("VERCEL", "");
  delete process.env.API_URL;
  expect(await readAdminSession(state.token)).toBe("authenticated");
  expect(fetcher.mock.calls[0][0]).toBe(
    "http://127.0.0.1:3001/api/v1/users/me",
  );
});
