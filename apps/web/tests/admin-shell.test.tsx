import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AdminShell } from "../components/admin/admin-shell";
import { api } from "../lib/api";
const navigation = vi.hoisted(() => ({ path: "/admin" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.path }));
vi.mock("../lib/api", async (original) => ({
  ...(await original<typeof import("../lib/api")>()),
  api: vi.fn(),
}));
beforeEach(() => {
  vi.clearAllMocks();
  navigation.path = "/admin";
});
afterEach(() => vi.unstubAllGlobals());
it("active uniquement les routes intégrées, sans liens vers les écrans futurs", () => {
  render(
    <AdminShell>
      <h1>Administration</h1>
    </AdminShell>,
  );
  expect(screen.getByRole("main")).toContainElement(
    screen.getByRole("heading"),
  );
  const link = screen.getByRole("link", { name: "Vue générale" });
  expect(link).toHaveAttribute("href", "/admin");
  expect(link).toHaveAttribute("aria-current", "page");
  expect(
    screen.getByRole("link", { name: "Gestion commerciale" }),
  ).toHaveAttribute("href", "/admin/offres");
  expect(
    screen.getByRole("link", { name: "Mon espace pédagogique" }),
  ).toHaveAttribute("href", "/app");
});
it("ouvre le menu, le ferme avec Échap ou la navigation et restaure le focus", () => {
  render(<AdminShell>Contenu</AdminShell>);
  const toggle = screen.getByRole("button", { name: "Ouvrir le menu" });
  fireEvent.keyDown(toggle, { key: "Escape" });
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  fireEvent.keyDown(screen.getByRole("navigation"), { key: "Escape" });
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(toggle).toHaveFocus();
  fireEvent.click(toggle);
  const overview = screen.getByRole("link", { name: "Vue générale" });
  overview.addEventListener("click", (event) => event.preventDefault());
  fireEvent.click(overview);
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(toggle).toHaveFocus();
});
it("permet de reprendre une déconnexion refusée sans double appel concurrent", async () => {
  let reject!: (error: Error) => void;
  vi.mocked(api).mockImplementationOnce(
    () =>
      new Promise((_, fail) => {
        reject = fail;
      }),
  );
  render(<AdminShell>Contenu</AdminShell>);
  const logout = screen.getByRole("button", { name: "Se déconnecter" });
  fireEvent.click(logout);
  fireEvent.click(logout);
  expect(api).toHaveBeenCalledTimes(1);
  expect(logout).toBeDisabled();
  reject(new Error("API indisponible"));
  await screen.findByRole("alert");
  await waitFor(() => expect(logout).not.toBeDisabled());
  vi.mocked(api).mockRejectedValueOnce(new Error("Session indisponible"));
  fireEvent.click(logout);
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent("Session indisponible"),
  );
  expect(api).toHaveBeenCalledWith("/auth/logout", { method: "POST" });
});
it("efface l’état privé avec une navigation complète après déconnexion réussie", async () => {
  vi.mocked(api).mockResolvedValueOnce({ ok: true });
  render(<AdminShell>Contenu</AdminShell>);
  const assign = vi.fn();
  const originalWindow = window;
  vi.stubGlobal(
    "window",
    new Proxy(originalWindow, {
      get(target, key) {
        return key === "location"
          ? { assign, href: "http://localhost/" }
          : Reflect.get(target, key);
      },
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Se déconnecter" }));
  await waitFor(() => expect(assign).toHaveBeenCalledWith("/connexion"));
  vi.unstubAllGlobals();
});

it.each([
  "/admin/utilisateurs",
  "/admin/utilisateurs/id",
  "/admin/cours",
  "/admin/cours/id",
  "/admin/abonnements",
  "/admin/paiements",
  "/admin/offres",
])("active la rubrique intégrée correspondant à %s", (path) => {
  navigation.path = path;
  render(<AdminShell>Contenu</AdminShell>);
  expect(
    screen.getByRole("link", {
      name: path.startsWith("/admin/utilisateurs")
        ? "Utilisateurs"
        : path === "/admin/abonnements"
          ? "Abonnements"
          : path === "/admin/paiements"
            ? "Paiements"
            : path === "/admin/offres"
              ? "Gestion commerciale"
              : "Cours",
    }),
  ).toHaveAttribute("aria-current", "page");
  expect(
    screen.getByRole("link", { name: "Vue générale" }),
  ).not.toHaveAttribute("aria-current");
});
