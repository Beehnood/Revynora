import { it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LoginForm } from "../components/login-form";
import { api } from "../lib/api";
const m = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => m }));
vi.mock("../lib/api", async (original) => ({
  ...(await original<typeof import("../lib/api")>()),
  api: vi.fn(),
}));
beforeEach(() => vi.clearAllMocks());
it("réutilise la connexion centrale et ouvre uniquement un compte Admin", async () => {
  vi.mocked(api).mockResolvedValueOnce({ role: "ADMIN" });
  render(<LoginForm />);
  fireEvent.change(screen.getByLabelText("Adresse e-mail"), {
    target: { value: "admin@example.test" },
  });
  fireEvent.change(screen.getByLabelText("Mot de passe"), {
    target: { value: "Admin-Password!42" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Me connecter" }));
  await waitFor(() => expect(m.replace).toHaveBeenCalledWith("/"));
  expect(api).toHaveBeenCalledWith(
    "/auth/login",
    expect.objectContaining({ method: "POST" }),
  );
});
it("explique un rôle étudiant et conserve la connexion administrateur fermée", async () => {
  vi.mocked(api).mockResolvedValueOnce({ role: "STUDENT" });
  render(<LoginForm />);
  fireEvent.submit(
    screen.getByRole("button", { name: "Me connecter" }).closest("form")!,
  );
  await screen.findByRole("alert");
  expect(m.replace).not.toHaveBeenCalled();
});
it("annonce une panne et permet une nouvelle tentative", async () => {
  vi.mocked(api).mockRejectedValueOnce(new Error("Indisponible"));
  render(<LoginForm />);
  fireEvent.submit(
    screen.getByRole("button", { name: "Me connecter" }).closest("form")!,
  );
  await screen.findByText("Indisponible");
  expect(screen.getByRole("button", { name: "Me connecter" })).toBeEnabled();
});
