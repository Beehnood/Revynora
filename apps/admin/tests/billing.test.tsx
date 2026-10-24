import { it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BillingPanel } from "../modules/billing/billing-panel";
const m = vi.hoisted(() => ({
  data: null as unknown,
  loading: false,
  error: "",
  reload: vi.fn(),
  paths: [] as string[],
}));
vi.mock("../lib/use-resource", () => ({
  useResource: (path: string) => {
    m.paths.push(path);
    return path === "/admin/offers" ? { ...m, data: [] } : m;
  },
}));
beforeEach(() => {
  m.data = null;
  m.loading = false;
  m.error = "";
  m.paths = [];
  vi.clearAllMocks();
});
it("filtres, pagination, centimes exacts et aucune assimilation au réel", () => {
  m.data = {
    items: [
      {
        id: "p",
        provider: "mock",
        amountCents: 250,
        currency: "eur",
        status: "PAID",
        verification: "SIMULATION",
        createdAt: "2026-01-01",
      },
      {
        id: "s",
        provider: "stripe",
        amountCents: 0,
        currency: "usd",
        status: "REFUNDED",
        verification: "UNVERIFIED",
        createdAt: "2026-01-01",
      },
    ],
    total: 21,
  };
  render(<BillingPanel kind="payments" />);
  expect(
    screen.getByText(/Simulation — aucun paiement réel/),
  ).toBeInTheDocument();
  expect(screen.getByText(/Paiement non vérifié/)).toBeInTheDocument();
  expect(screen.getByText(/2,50 €/)).toBeInTheDocument();
  expect(
    screen.getByText(/0 unités stockées \(échelle non vérifiée\) USD/),
  ).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Suivant" }));
  expect(m.paths.at(-1)).toContain("page=2");
  fireEvent.change(screen.getByLabelText("Fournisseur"), {
    target: { value: "stripe" },
  });
  expect(m.paths.at(-1)).toContain("page=1&provider=stripe");
  fireEvent.change(screen.getByLabelText("Statut enregistré"), {
    target: { value: "REFUNDED" },
  });
  expect(m.paths.at(-1)).toContain("status=REFUNDED");
  expect(
    screen.queryByRole("button", { name: /rembourser|modifier|facturer/i }),
  ).not.toBeInTheDocument();
});
it("chargement, erreur, reprise et page vide", () => {
  m.loading = true;
  const view = render(<BillingPanel kind="payments" />);
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  m.loading = false;
  m.error = "Indisponible";
  view.rerender(<BillingPanel kind="payments" />);
  fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
  expect(m.reload).toHaveBeenCalledOnce();
  m.error = "";
  m.data = { items: [], total: 0 };
  view.rerender(<BillingPanel kind="payments" />);
  expect(screen.getByText("Aucun paiement enregistré.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Suivant" })).toBeDisabled();
});
it("périodes historiques sans prétendre accorder un droit actuel", () => {
  m.data = {
    items: [
      {
        id: "period",
        plan: "PRO",
        provider: "internal",
        status: "ACTIVE",
        priceCents: -1,
        currency: "eur",
        startsAt: "2020-01-01",
        endsAt: "2020-02-01",
        cancelAtPeriodEnd: true,
      },
    ],
    total: 1,
  };
  render(<BillingPanel kind="subscriptions" />);
  expect(screen.getByText(/ne prouve pas un droit actuel/)).toBeInTheDocument();
  expect(screen.getByText(/Annulation prévue/)).toBeInTheDocument();
  expect(screen.getByText(/−0,01 €/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Offre"), {
    target: { value: "FREE" },
  });
  expect(m.paths.at(-2)).toContain("plan=FREE");
});

it("distingue une liste vide d’une recherche sans résultat", () => {
  m.data = { items: [], total: 0 };
  render(<BillingPanel kind="payments" />);
  expect(screen.getByText("Aucun paiement enregistré.")).toBeVisible();
  fireEvent.change(screen.getByRole("combobox", { name: "Fournisseur" }), {
    target: { value: "stripe" },
  });
  expect(screen.getByText("Aucun résultat pour ces filtres.")).toBeVisible();
});
