import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import CatalogPage from "../app/admin/cours/page";
import CatalogDetailPage from "../app/admin/cours/[id]/page";
vi.mock("../lib/use-resource", () => ({
  useResource: () => ({
    data: null,
    loading: false,
    error: "",
    reload: vi.fn(),
  }),
}));
it("branche la liste des cours sur le catalogue en lecture seule", () => {
  render(<CatalogPage />);
  expect(screen.getByRole("heading", { name: "Cours" })).toBeVisible();
});
it("branche les paramètres de route de détail sans importer une autre application", async () => {
  render(
    await CatalogDetailPage({ params: Promise.resolve({ id: "course" }) }),
  );
  expect(screen.getByRole("heading", { name: "Fiche du cours" })).toBeVisible();
  expect(
    screen.getByRole("link", { name: "Retour aux cours" }),
  ).toHaveAttribute("href", "/admin/cours");
});
