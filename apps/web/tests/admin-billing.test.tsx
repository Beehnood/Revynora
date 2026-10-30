import { it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BillingPanel } from "../modules/admin/billing/billing-panel";
const m = vi.hoisted(() => ({
  data: null as unknown,
  loading: false,
  error: "",
  reload: vi.fn(),
  paths: [] as string[],
  offers: [] as unknown,
}));
vi.mock("../lib/use-resource", () => ({
  useResource: (path: string) => {
    m.paths.push(path);
    return path === "/admin/offers" ? { ...m, data: m.offers } : m;
  },
}));
beforeEach(() => {
  m.data = null;
  m.loading = false;
  m.error = "";
  m.paths = [];
  m.offers = [];
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
  expect(
    m.paths.filter((p) => p.startsWith("/admin/subscriptions")).at(-1),
  ).toContain("plan=FREE");
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

it.each(["payments", "subscriptions"] as const)(
  "aucun résultat hors page, pas de réponse, filtres et précédent (%s)",
  (kind) => {
    const view = render(<BillingPanel kind={kind} />);
    expect(
      screen.getByText("Données financières non disponibles."),
    ).toBeVisible();
    m.data = { items: [], total: 21 };
    view.rerender(<BillingPanel kind={kind} />);
    expect(screen.getByText("Aucun résultat sur cette page.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Suivant" }));
    fireEvent.click(screen.getByRole("button", { name: "Précédent" }));
    expect(
      m.paths.filter((p) => p.startsWith("/admin/" + kind)).at(-1),
    ).toContain("page=1");
    m.data = { items: [], total: 0 };
    view.rerender(<BillingPanel kind={kind} />);
    expect(
      screen.getByText(
        kind === "payments"
          ? "Aucun paiement enregistré."
          : "Aucune période d’abonnement enregistrée.",
      ),
    ).toBeVisible();
    if (kind === "subscriptions") {
      fireEvent.change(screen.getByLabelText("Offre"), {
        target: { value: "PRO" },
      });
      expect(
        screen.getByText("Aucun résultat pour ces filtres."),
      ).toBeVisible();
    }
  },
);
it("préserve les différents contextes historiques et les offres actuelles sans rétroactivité", () => {
  m.offers = [
    { code: "FREE", priceCents: 0, currency: "eur", active: true },
    {
      code: "PRO",
      priceCents: 750,
      currency: "eur",
      active: false,
      features: ["leitner", "planning"],
    },
  ];
  m.data = {
    total: 3,
    items: ["mock", "stripe", "internal"].map((provider, i) => ({
      id: "period" + i,
      plan: "PLUS",
      provider,
      status: "ACTIVE",
      priceCents: 250,
      currency: "eur",
      startsAt: "2020-01-01",
      endsAt: "2020-02-01",
      cancelAtPeriodEnd: false,
    })),
  };
  render(<BillingPanel kind="subscriptions" />);
  expect(screen.getByText(/Offre active/)).toBeVisible();
  expect(screen.getByText(/Offre inactive/)).toBeVisible();
  expect(screen.getByText(/leitner, planning/)).toBeVisible();
  expect(screen.getByText(/Socle gratuit/)).toBeVisible();
  expect(screen.getByText(/Période interne/)).toBeVisible();
  expect(
    screen.getAllByText(/Aucune annulation en fin de période enregistrée/),
  ).toHaveLength(3);
});
it.each(["loading", "401", "403", "404", "503"])(
  "masque les anciennes données financières et offres en cas de %s",
  (mode) => {
    m.data = {
      items: [
        {
          id: "secret-period",
          plan: "PRO",
          provider: "mock",
          priceCents: 250,
          currency: "eur",
          status: "ACTIVE",
          startsAt: "2020-01-01",
          endsAt: "2020-02-01",
          cancelAtPeriodEnd: false,
        },
      ],
      total: 1,
    };
    m.offers = [
      { code: "PRO", priceCents: 995, currency: "eur", active: true },
    ];
    m.loading = mode === "loading";
    m.error = m.loading ? "" : "Accès impossible " + mode;
    render(<BillingPanel kind="subscriptions" />);
    expect(screen.queryByText("secret-period")).not.toBeInTheDocument();
    expect(screen.queryByText(/9,95/)).not.toBeInTheDocument();
    if (!m.loading) {
      fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
      fireEvent.click(
        screen.getByRole("button", { name: "Réessayer les offres" }),
      );
      expect(m.reload).toHaveBeenCalledTimes(2);
    }
  },
);
it("offres absentes ne sont pas inventées", () => {
  m.offers = null;
  render(<BillingPanel kind="subscriptions" />);
  expect(screen.getByText("Offres non disponibles.")).toBeVisible();
});
