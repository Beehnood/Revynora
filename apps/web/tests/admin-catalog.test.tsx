import { it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CatalogList } from "../modules/admin/catalog/catalog-list";
import { CatalogDetail } from "../modules/admin/catalog/catalog-detail";
const mock = vi.hoisted(() => ({
  data: null as unknown,
  error: "",
  loading: false,
  reload: vi.fn(),
  paths: [] as string[],
}));
vi.mock("../lib/use-resource", () => ({
  useResource: (path: string) => {
    mock.paths.push(path);
    return mock;
  },
}));
beforeEach(() => {
  mock.data = null;
  mock.error = "";
  mock.loading = false;
  mock.paths = [];
  vi.clearAllMocks();
});
it("liste, pagination, recherche appliquée et liens vers les seules fiches autorisées", () => {
  mock.data = {
    items: [
      {
        id: "id",
        title: "Rappel actif",
        domain: "Sciences",
        source: "ADMIN",
        createdAt: "2026-01-01",
      },
    ],
    total: 24,
    page: 1,
    pageSize: 20,
  };
  render(<CatalogList />);
  expect(screen.getByRole("link", { name: "Rappel actif" })).toHaveAttribute(
    "href",
    "/admin/cours/id",
  );
  fireEvent.click(screen.getByRole("button", { name: "Cours suivants" }));
  expect(mock.paths.at(-1)).toContain("page=2");
  fireEvent.click(screen.getByRole("button", { name: "Cours précédents" }));
  fireEvent.change(screen.getByLabelText("Rechercher par titre ou matière"), {
    target: { value: "100%_" },
  });
  expect(mock.paths.at(-1)).not.toContain("100");
  fireEvent.click(screen.getByRole("button", { name: "Rechercher les cours" }));
  expect(mock.paths.at(-1)).toBe(
    "/admin/catalog/courses?page=1&search=100%25_",
  );
  expect(
    screen.queryByRole("button", { name: /publier|supprimer|modifier/i }),
  ).not.toBeInTheDocument();
});
it("liste vide, page hors résultat, chargement et reprise", () => {
  mock.loading = true;
  const view = render(<CatalogList />);
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  mock.loading = false;
  mock.error = "Indisponible";
  view.rerender(<CatalogList />);
  fireEvent.click(
    screen.getByRole("button", { name: "Réessayer le catalogue" }),
  );
  expect(mock.reload).toHaveBeenCalledOnce();
  mock.error = "";
  mock.data = { items: [], total: 0 };
  view.rerender(<CatalogList />);
  expect(screen.getByText("Aucun cours du catalogue trouvé.")).toBeVisible();
  mock.data = { items: [], total: 4 };
  view.rerender(<CatalogList />);
  expect(screen.getByText("Aucun cours sur cette page.")).toBeVisible();
});
it("fiche en texte seul et aucune commande de mutation", () => {
  mock.data = {
    id: "id",
    title: "Rappel actif",
    domain: "Sciences",
    createdAt: "2026-01-01",
    source: "ADMIN",
    content: "<script>window.injected=true</script>",
  };
  const { container } = render(<CatalogDetail id="id" />);
  expect(
    screen.getByText("<script>window.injected=true</script>"),
  ).toBeVisible();
  expect(container.querySelector("script")).toBeNull();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(mock.paths.at(-1)).toBe("/admin/catalog/courses/id");
});
it("fiche introuvable ou indisponible ne divulgue aucun contenu", () => {
  mock.error = "Ressource introuvable.";
  const view = render(<CatalogDetail id="private" />);
  expect(screen.getByRole("alert")).toHaveTextContent("introuvable");
  fireEvent.click(screen.getByRole("button", { name: "Réessayer le cours" }));
  expect(mock.reload).toHaveBeenCalledOnce();
  mock.error = "";
  mock.data = {
    id: "id",
    title: "Vide",
    domain: "Sciences",
    createdAt: "2026-01-01",
    content: "",
  };
  view.rerender(<CatalogDetail id="id" />);
  expect(screen.getByText("Aucun contenu disponible.")).toBeVisible();
});

it("masque les données de catalogue obsolètes sur chargement ou refus de permission", () => {
  mock.data = {
    items: [
      {
        id: "id",
        title: "Confidentiel",
        domain: "Sciences",
        createdAt: "2026-01-01",
      },
    ],
    total: 1,
  };
  mock.loading = true;
  const view = render(<CatalogList />);
  expect(screen.queryByText("Confidentiel")).not.toBeInTheDocument();
  mock.loading = false;
  mock.error = "Accès refusé";
  view.rerender(<CatalogList />);
  expect(screen.queryByText("Confidentiel")).not.toBeInTheDocument();
  mock.error = "";
  mock.data = null;
  view.rerender(<CatalogList />);
  expect(screen.getByRole("status")).toHaveTextContent(
    "Catalogue non disponible",
  );
});
it("masque une ancienne fiche sur panne, permission refusée ou chargement", () => {
  mock.data = {
    id: "id",
    title: "Confidentiel",
    domain: "Sciences",
    content: "Privé",
    createdAt: "2026-01-01",
  };
  mock.loading = true;
  const view = render(<CatalogDetail id="id" />);
  expect(screen.queryByText("Privé")).not.toBeInTheDocument();
  mock.loading = false;
  mock.error = "Accès refusé";
  view.rerender(<CatalogDetail id="id" />);
  expect(screen.queryByText("Privé")).not.toBeInTheDocument();
  mock.error = "";
  mock.data = null;
  view.rerender(<CatalogDetail id="id" />);
  expect(screen.getByRole("status")).toHaveTextContent("Cours non disponible");
});
