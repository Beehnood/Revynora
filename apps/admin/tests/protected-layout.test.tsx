import { it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import Layout from "../app/(protected)/layout";
import { readAdminSession } from "../lib/admin-session";
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "a".repeat(43) }) }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  redirect: (path: string) => {
    throw new Error("REDIRECT:" + path);
  },
}));
vi.mock("../lib/admin-session", () => ({ readAdminSession: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
it("redirige une session expirée sans rendre les enfants", async () => {
  vi.mocked(readAdminSession).mockResolvedValue("signin");
  await expect(Layout({ children: <p>Contenu protégé</p> })).rejects.toThrow(
    "REDIRECT:/connexion",
  );
});
it.each(["unavailable", "forbidden"] as const)(
  "ne rend pas les enfants quand la session est %s",
  async (state) => {
    vi.mocked(readAdminSession).mockResolvedValue(state);
    render(<>{await Layout({ children: <p>Contenu protégé</p> })}</>);
    expect(screen.queryByText("Contenu protégé")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      state === "unavailable"
        ? "Administration indisponible"
        : "Accès administrateur requis",
    );
  },
);
it("rend uniquement le contenu autorisé", async () => {
  vi.mocked(readAdminSession).mockResolvedValue("authenticated");
  render(<>{await Layout({ children: <p>Contenu protégé</p> })}</>);
  expect(screen.getByText("Contenu protégé")).toBeVisible();
});
