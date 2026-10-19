import { it, expect, vi } from "vitest";
import { adminCatalogQuerySchema } from "@revynora/validation";
import {
  literalSearch,
  checkedCatalogQuery,
  checkedCatalogText,
} from "./catalog";
import { requireAdminPermission } from "./permissions";
import { AdminUseCases } from "../application/admin.use-cases";
import type { AdminRepository } from "./admin";
it("autorise seulement la lecture nommée du catalogue pour ADMIN", () => {
  expect(() =>
    requireAdminPermission("ADMIN", "catalogCourses", "read"),
  ).not.toThrow();
  for (const role of ["ADMIN", "STUDENT"] as const) {
    expect(() => requireAdminPermission(role, "courses", "read")).toThrow();
    for (const action of ["create", "publish", "update", "delete"])
      expect(() =>
        requireAdminPermission(role, "catalogCourses", action),
      ).toThrow();
  }
  const repo = {
    catalogCourses: vi.fn(),
    catalogCourse: vi.fn(),
  } as unknown as AdminRepository;
  const use = new AdminUseCases(repo);
  expect(() =>
    use.catalogCourses({ page: 1, search: "" }, "STUDENT"),
  ).toThrow();
  expect(() => use.catalogCourse("id", "STUDENT")).toThrow();
  expect(repo.catalogCourses).not.toHaveBeenCalled();
  expect(repo.catalogCourse).not.toHaveBeenCalled();
});
it("borne strictement la pagination et refuse tout sélecteur de contenu privé", () => {
  expect(adminCatalogQuerySchema.parse({})).toEqual({ page: 1, search: "" });
  for (const q of [
    { page: 0 },
    { page: 10001 },
    { page: 1.5 },
    { pageSize: 100 },
    { source: "USER" },
    { ownerId: "id" },
    { search: "x".repeat(101) },
  ])
    expect(adminCatalogQuerySchema.safeParse(q).success).toBe(false);
  expect(() => checkedCatalogQuery({ page: 0, search: "" })).toThrow();
  expect(() =>
    checkedCatalogQuery({ page: 1, search: "x".repeat(101) }),
  ).toThrow();
  expect(literalSearch("100%_\\")).toBe("%100\\%\\_\\\\%");
});
it("refuse les ressources excessives plutôt que de retourner du texte tronqué", () => {
  expect(() =>
    checkedCatalogText({
      title: "A",
      domain: "Sciences",
      content: "<script>texte</script>",
    }),
  ).not.toThrow();
  for (const row of [
    { title: "", domain: "Sciences" },
    { title: "A".repeat(161), domain: "Sciences" },
    { title: "A", domain: "B".repeat(81) },
    { title: "A", domain: "Sciences", content: "x".repeat(10001) },
  ])
    expect(() => checkedCatalogText(row)).toThrow();
});

it("mesure les bornes en unités UTF-16 sans tronquer les caractères supplémentaires", () => {
  for (const [field, limit] of [
    ["title", 160],
    ["domain", 80],
    ["content", 10000],
  ] as const) {
    for (const unit of ["a", "😀", "𐐀", "e\u0301"]) {
      const exact = unit.repeat(limit / unit.length);
      const row = {
        title: "Valide",
        domain: "Sciences",
        content: "Texte",
        [field]: exact,
      };
      expect(checkedCatalogText(row)[field]).toBe(exact);
      expect(() =>
        checkedCatalogText({ ...row, [field]: exact + "a" }),
      ).toThrowError(
        expect.objectContaining({ status: 422, code: "CATALOG_LIMIT" }),
      );
    }
  }
});
