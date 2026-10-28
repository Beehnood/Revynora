import { it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { api, RequestError, safeReturn, message } from "../lib/api";
import { useResource } from "../lib/use-resource";
afterEach(() => vi.unstubAllGlobals());
it("limite les retours aux routes internes de l’espace étudiant", () => {
  for (const path of [
    "https://evil.test",
    "//evil.test",
    "/app/../../evil",
    "/app\\evil",
    null,
  ]) {
    expect(safeReturn(path)).toBe("/app");
  }
  expect(safeReturn("/app/tentatives/id")).toBe("/app/tentatives/id");
  expect(message({})).toContain("Une erreur");
});
it("envoie le marqueur anti-CSRF et distingue réseau, JSON invalide et erreurs API", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ ok: true })));
  vi.stubGlobal("fetch", fetcher);
  expect(await api("/auth/logout", { method: "POST" })).toEqual({ ok: true });
  expect(fetcher.mock.calls[0][1].headers["X-Revynora-Client"]).toBe("web");
  fetcher.mockRejectedValueOnce(new Error("network"));
  await expect(api("/courses")).rejects.toMatchObject({ code: "NETWORK" });
  fetcher.mockResolvedValueOnce(new Response("bad", { status: 503 }));
  await expect(api("/courses")).rejects.toMatchObject({ code: "UNAVAILABLE" });
  fetcher.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        code: "VALIDATION",
        message: "Vérifiez les champs",
        details: [{ field: "name", message: "Nom invalide" }],
      }),
      { status: 400 },
    ),
  );
  await expect(api("/auth/register")).rejects.toBeInstanceOf(RequestError);
});
it("gère le chargement, l’erreur puis une reprise effective", async () => {
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ value: "Données chargées" })),
    );
  vi.stubGlobal("fetch", fetcher);
  function Probe() {
    const state = useResource<{ value: string }>("/probe");
    return (
      <>
        <p>{state.loading ? "Chargement" : state.error || state.data?.value}</p>
        <button onClick={state.reload}>Reprendre</button>
      </>
    );
  }
  render(<Probe />);
  expect(screen.getByText("Chargement")).toBeVisible();
  await waitFor(() =>
    expect(screen.getByText(/Le service est inaccessible/)).toBeVisible(),
  );
  fireEvent.click(screen.getByRole("button"));
  await waitFor(() =>
    expect(screen.getByText("Données chargées")).toBeVisible(),
  );
});

it("autorise uniquement le retour Admin racine, sans redirection externe ou traversée", () => {
  expect(safeReturn("/admin")).toBe("/admin");
  for (const path of [
    "/administrator",
    "/admin/../evil",
    "/admin//evil",
    "/admin?retour=https://evil.test",
    "/admin#evil",
    "/%2f%2fevil.test",
    "/admin\\evil",
  ]) {
    expect(safeReturn(path)).toBe("/app");
  }
});
it.each(["/admin", "/admin/offres", "/app", "/app/profil"])(
  "reconnecte une session expirée sur %s en conservant le cookie same-origin",
  async (pathname) => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { pathname, assign } });
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: "AUTH_REQUIRED" }), {
        status: 401,
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    await expect(api("/users/me")).rejects.toMatchObject({ status: 401 });
    expect(assign).toHaveBeenCalledWith(
      "/connexion?retour=" +
        encodeURIComponent(pathname.startsWith("/admin") ? "/admin" : pathname),
    );
    expect(fetcher.mock.calls[0][1].credentials).toBe("same-origin");
  },
);
it.each(["/connexion", "/administrator", "/application", "/"])(
  "ne redirige pas une page publique sur un 401 (%s)",
  async (pathname) => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { pathname, assign } });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({}), { status: 401 })),
    );
    await expect(api("/users/me")).rejects.toMatchObject({ status: 401 });
    expect(assign).not.toHaveBeenCalled();
  },
);
