import { it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AdminShell } from "../components/admin-shell";
import { UserDetail } from "../modules/users/user-detail";
import { UsersView } from "../modules/users/users-view";
import { api } from "../lib/api";
const state = vi.hoisted(() => ({
  path: "/utilisateurs/u",
  data: null as unknown,
  error: "",
  loading: false,
  reload: vi.fn(),
  paths: [] as string[],
}));
vi.mock("next/navigation", () => ({ usePathname: () => state.path }));
vi.mock("../lib/api", async (original) => ({
  ...(await original<typeof import("../lib/api")>()),
  api: vi.fn(),
}));
vi.mock("../lib/use-resource", () => ({
  useResource: (path: string) => {
    state.paths.push(path);
    return {
      data: state.data,
      error: state.error,
      loading: state.loading,
      reload: state.reload,
    };
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  state.data = null;
  state.error = "";
  state.loading = false;
  state.paths = [];
});
it("navigation active, menu mobile clavier et échec de déconnexion", async () => {
  vi.mocked(api).mockRejectedValueOnce(new Error("Service indisponible"));
  render(
    <AdminShell>
      <h1>Contenu</h1>
    </AdminShell>,
  );
  expect(screen.getByRole("link", { name: "Utilisateurs" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  const toggle = screen.getByRole("button", { name: "Ouvrir le menu" });
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  fireEvent.keyDown(screen.getByRole("navigation"), { key: "Escape" });
  expect(toggle).toHaveFocus();
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(toggle);
  fireEvent.click(screen.getByRole("link", { name: "Vue générale" }));
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(screen.getByRole("button", { name: "Se déconnecter" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Service indisponible",
  );
});
it("liste vide, reprise et recherche encodée sans faux filtre", () => {
  state.data = { items: [], total: 0 };
  const view = render(<UsersView />);
  expect(screen.getByRole("status")).toHaveTextContent("Aucun utilisateur");
  fireEvent.change(screen.getByLabelText("Rechercher par nom ou e-mail"), {
    target: { value: "a&b" },
  });
  expect(state.paths.at(-1)).toContain("search=a%26b");
  state.error = "Échec";
  view.rerender(<UsersView />);
  fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
  expect(state.reload).toHaveBeenCalledOnce();
});
it("fiche: identité autorisée, confirmation obligatoire et rafraîchissement", async () => {
  state.data = {
    id: "u",
    name: "Alice",
    email: "alice@example.test",
    role: "STUDENT",
    disabledAt: null,
    createdAt: "2026-10-19T00:00:00Z",
  };
  vi.mocked(api).mockResolvedValueOnce({ ok: true });
  render(<UserDetail id="u" />);
  expect(screen.getByText("alice@example.test")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Suspendre" }));
  expect(
    screen.getByRole("button", { name: "Confirmer la suspension" }),
  ).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Motif obligatoire"), {
    target: { value: "USER_REQUEST" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(
    screen.getByRole("button", { name: "Confirmer la suspension" }),
  );
  await waitFor(() => expect(state.reload).toHaveBeenCalledOnce());
  expect(api).toHaveBeenCalledWith("/admin/users/u", {
    method: "PATCH",
    body: JSON.stringify({
      disabled: true,
      confirmed: true,
      reason: "USER_REQUEST",
    }),
  });
});
it("fiche: administrateur protégé, chargement et erreur", () => {
  state.data = {
    id: "a",
    name: "Admin",
    role: "ADMIN",
    createdAt: "2026-10-19",
  };
  const view = render(<UserDetail id="a" />);
  expect(
    screen.queryByRole("button", { name: "Suspendre" }),
  ).not.toBeInTheDocument();
  state.loading = true;
  view.rerender(<UserDetail id="a" />);
  expect(
    screen.queryByRole("heading", { name: "Admin" }),
  ).not.toBeInTheDocument();
  state.loading = false;
  state.error = "Ressource introuvable";
  view.rerender(<UserDetail id="a" />);
  expect(screen.getByRole("alert")).toHaveTextContent("Ressource introuvable");
});
