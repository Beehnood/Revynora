import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UsersView } from "../modules/admin/users/users-view";
import { UserDetail } from "../modules/admin/users/user-detail";
import UsersPage from "../app/admin/utilisateurs/page";
import DetailPage from "../app/admin/utilisateurs/[id]/page";
const state = vi.hoisted(() => ({
  data: null as unknown,
  error: "",
  loading: false,
  reload: vi.fn(),
  paths: [] as string[],
}));
vi.mock("../lib/use-resource", () => ({
  useResource: (path: string) => {
    state.paths.push(path);
    return state;
  },
}));
const user = {
  id: "user",
  name: "Alice",
  email: "alice@example.test",
  role: "STUDENT",
  createdAt: "2026-01-01",
  disabledAt: null,
};
beforeEach(() => {
  state.data = null;
  state.error = "";
  state.loading = false;
  state.paths = [];
  vi.clearAllMocks();
});
it("liste, recherche encodée, pagination et absence de commandes de mutation", () => {
  state.data = {
    items: [
      user,
      {
        ...user,
        id: "admin",
        name: "Admin",
        role: "ADMIN",
        disabledAt: "2026-01-02",
      },
    ],
    total: 24,
  };
  render(<UsersPage />);
  expect(screen.getByRole("link", { name: "Alice" })).toHaveAttribute(
    "href",
    "/admin/utilisateurs/user",
  );
  expect(screen.getByText("Étudiant")).toBeVisible();
  expect(screen.getByText("Administrateur")).toBeVisible();
  expect(screen.getByText("Suspendu")).toBeVisible();
  expect(screen.getByText("Actif")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Suivant" }));
  expect(state.paths.at(-1)).toContain("page=2");
  fireEvent.click(screen.getByRole("button", { name: "Précédent" }));
  expect(state.paths.at(-1)).toContain("page=1");
  fireEvent.click(screen.getByRole("button", { name: "Suivant" }));
  fireEvent.change(screen.getByLabelText("Rechercher par nom ou e-mail"), {
    target: { value: "a&b" },
  });
  expect(state.paths.at(-1)).toBe("/admin/users?page=1&search=a%26b");
  expect(
    screen.queryByRole("button", {
      name: /suspendre|réactiver|supprimer|modifier/i,
    }),
  ).not.toBeInTheDocument();
});
it("liste vide, page vide et absence de réponse sans données inventées", () => {
  const view = render(<UsersView />);
  expect(screen.getByRole("status")).toHaveTextContent(
    "Utilisateurs non disponibles",
  );
  state.data = { items: [], total: 0 };
  view.rerender(<UsersView />);
  expect(screen.getByRole("status")).toHaveTextContent(
    "Aucun utilisateur trouvé",
  );
  state.data = { items: [], total: 1 };
  view.rerender(<UsersView />);
  expect(screen.getByRole("status")).toHaveTextContent("sur cette page");
  expect(screen.getByText("1 compte")).toBeVisible();
});
it.each(["loading", "permission", "expired", "unavailable"])(
  "masque les données conservées en mémoire en cas de %s",
  (mode) => {
    state.data = { items: [user], total: 1 };
    state.loading = mode === "loading";
    state.error = mode === "loading" ? "" : "Accès refusé";
    render(<UsersView />);
    expect(screen.queryByText(user.email)).not.toBeInTheDocument();
    if (state.error) {
      fireEvent.click(
        screen.getByRole("button", { name: "Réessayer les utilisateurs" }),
      );
      expect(state.reload).toHaveBeenCalledOnce();
    }
  },
);
it.each([false, true])(
  "fiche utilisateur consultable sans mutation (suspendu=%s)",
  async (disabled) => {
    state.data = {
      ...user,
      role: disabled ? "ADMIN" : "STUDENT",
      disabledAt: disabled ? "2026-01-02" : null,
    };
    render(await DetailPage({ params: Promise.resolve({ id: "user" }) }));
    expect(screen.getByText(user.email)).toBeVisible();
    expect(state.paths.at(-1)).toBe("/admin/users/user");
    expect(
      screen.getByRole("link", { name: "Retour aux utilisateurs" }),
    ).toHaveAttribute("href", "/admin/utilisateurs");
    expect(screen.getByText(disabled ? "Suspendu" : "Actif")).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  },
);
it("fiche : chargement, null, erreur/404/403 et reprise sans fuite de données", () => {
  state.data = user;
  state.loading = true;
  const view = render(<UserDetail id="a&b" />);
  expect(state.paths.at(-1)).toBe("/admin/users/a%26b");
  expect(screen.queryByText(user.email)).not.toBeInTheDocument();
  state.loading = false;
  state.error = "Ressource introuvable";
  view.rerender(<UserDetail id="a&b" />);
  expect(screen.queryByText(user.email)).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Réessayer la fiche utilisateur" }),
  );
  expect(state.reload).toHaveBeenCalledOnce();
  state.error = "";
  state.data = null;
  view.rerender(<UserDetail id="a&b" />);
  expect(screen.getByRole("status")).toHaveTextContent(
    "Utilisateur non disponible",
  );
});
