import { it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AdminView } from "../components/admin-view";
import { api } from "../lib/api";
const m = vi.hoisted(() => ({
  data: new Map<string, unknown>(),
  error: "",
  loading: false,
  reload: vi.fn(),
}));
vi.mock("../lib/use-resource", () => ({
  useResource: (path: string) => ({
    data: m.data.get(path.split("?")[0]!) ?? null,
    error: m.error,
    loading: m.loading,
    reload: m.reload,
  }),
}));
vi.mock("../lib/api", async (original) => ({
  ...(await original<typeof import("../lib/api")>()),
  api: vi.fn(),
}));
beforeEach(() => {
  vi.clearAllMocks();
  m.data.clear();
  m.error = "";
  m.loading = false;
  vi.mocked(api).mockResolvedValue({});
});
it("admin : filtres, pagination, suspension et distinction des revenus simulés", async () => {
  m.data.set("/admin/metrics", {
    users: 42,
    newUsers: 3,
    billingMode: "mock",
    workerEnabled: false,
    payments: [
      {
        provider: "mock",
        status: "PAID",
        _sum: { amountCents: 500 },
        _count: 1,
      },
    ],
    ai: { _count: 2, _sum: { estimatedCostUsd: null } },
  });
  m.data.set("/admin/users", {
    items: [
      {
        id: "u",
        name: "Alice",
        email: "a@example.test",
        role: "STUDENT",
        disabledAt: null,
      },
    ],
    total: 40,
  });
  m.data.set("/admin/events", {
    items: [
      {
        id: "event",
        eventType: "invoice.paid",
        status: "ACTIVE",
        createdAt: "2026-10-16",
      },
    ],
    audit: [{ id: "audit", action: "USER_ENABLED", createdAt: "2026-10-16" }],
    total: 1,
  });
  m.data.set("/admin/offers", [{ code: "FREE", priceCents: 0, active: true }]);
  render(<AdminView />);
  expect(screen.getByText(/simulation locale/)).toBeVisible();
  fireEvent.change(screen.getByLabelText("Du"), {
    target: { value: "2026-10-01" },
  });
  fireEvent.change(screen.getByLabelText("Au (exclu)"), {
    target: { value: "2026-11-01" },
  });
  fireEvent.change(screen.getByLabelText("Rechercher par nom ou e-mail"), {
    target: { value: "Alice" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Suivant" }));
  expect(screen.getByText("Page 2")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Précédent" }));
  fireEvent.click(screen.getByRole("button", { name: "Suspendre" }));
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      "/admin/users/u",
      expect.objectContaining({ body: JSON.stringify({ disabled: true }) }),
    ),
  );
  vi.mocked(api).mockRejectedValueOnce(new Error("Refus"));
  fireEvent.click(screen.getByRole("button", { name: "Suspendre" }));
  await screen.findByRole("alert");
});

it("états vides et chargement restent explicites", () => {
  m.loading = true;
  m.data.set("/admin/metrics", {
    users: 0,
    newUsers: 0,
    billingMode: "stripe",
    workerEnabled: true,
    payments: [],
    ai: { _count: 0, _sum: { estimatedCostUsd: "0.001" } },
  });
  m.data.set("/admin/users", { items: [], total: 0 });
  m.data.set("/admin/events", { items: [], audit: [], total: 0 });
  m.data.set("/admin/offers", [
    { code: "PLUS", priceCents: 250, active: false },
  ]);
  render(<AdminView />);
  expect(screen.getByText("Aucun paiement.")).toBeVisible();
  expect(
    screen.getByText("Aucune action journalisée sur cette période."),
  ).toBeVisible();
  expect(screen.getByText(/Coût estimé : 0.001/)).toBeVisible();
});
it("réactive un compte suspendu et laisse les administrateurs protégés", async () => {
  m.data.set("/admin/users", {
    items: [
      {
        id: "suspended",
        name: "Bob",
        email: "bob@example.test",
        role: "STUDENT",
        disabledAt: "2026-10-16",
      },
      {
        id: "admin",
        name: "Admin",
        email: "admin@example.test",
        role: "ADMIN",
        disabledAt: null,
      },
    ],
    total: 2,
  });
  render(<AdminView />);
  fireEvent.click(screen.getByRole("button", { name: "Réactiver" }));
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      "/admin/users/suspended",
      expect.objectContaining({ body: JSON.stringify({ disabled: false }) }),
    ),
  );
  expect(
    screen.queryByRole("button", { name: "Suspendre" }),
  ).not.toBeInTheDocument();
});
it("expose une erreur de chargement sans afficher de métriques inventées", () => {
  m.error = "API inaccessible";
  render(<AdminView />);
  expect(screen.getByRole("alert")).toHaveTextContent("API inaccessible");
});
