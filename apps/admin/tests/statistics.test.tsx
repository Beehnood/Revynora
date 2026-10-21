import { it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  StatisticsPanel,
  formatCents,
} from "../modules/statistics/statistics-panel";
const mock = vi.hoisted(() => ({
  data: null as unknown,
  error: "",
  loading: false,
  reload: vi.fn(),
}));
vi.mock("../lib/use-resource", () => ({ useResource: () => mock }));
beforeEach(() => {
  mock.data = null;
  mock.error = "";
  mock.loading = false;
  vi.clearAllMocks();
});
it("distingue simulation, environnement inconnu, estimations partielles et montants exacts", () => {
  mock.data = {
    registrations: [
      { date: "2026-01-01", count: 2 },
      { date: "2026-01-02", count: 0 },
    ],
    subscriptions: [{ offer: "PLUS", status: "ACTIVE", periods: 3 }],
    ai: [
      {
        provider: "openai",
        status: "ERROR",
        requests: 2,
        inputTokens: "100",
        outputTokens: "5",
        estimatedCostUsd: "0.00012345",
        estimatedRequests: 1,
      },
      {
        provider: "mock",
        status: "SUCCESS",
        requests: 1,
        inputTokens: "0",
        outputTokens: "0",
        estimatedCostUsd: null,
        estimatedRequests: 0,
      },
    ],
    payments: [
      {
        provider: "mock",
        environment: "SIMULATION",
        currency: "eur",
        status: "PAID",
        count: 1,
        amountCents: "250",
      },
      {
        provider: "stripe",
        environment: "UNVERIFIED",
        currency: "usd",
        status: "PAID",
        count: 1,
        amountCents: "700",
      },
    ],
  };
  render(<StatisticsPanel from="2026-01-01" to="2026-01-03" />);
  expect(
    screen.getByRole("img", { name: "Inscriptions quotidiennes" }),
  ).toBeVisible();
  expect(screen.getByText("0.00012345")).toBeVisible();
  expect(screen.getByText("1 / 2")).toBeVisible();
  expect(screen.getByText("Non disponible")).toBeVisible();
  expect(screen.getByText("2,50 €")).toBeVisible();
  expect(
    screen.getByText("700 unités stockées (échelle non vérifiée) USD"),
  ).toBeVisible();
  expect(screen.getByText("Non vérifiable (test/réel)")).toBeVisible();
  fireEvent.click(screen.getByText("Tableau des inscriptions quotidiennes"));
  expect(
    screen.getByRole("table", { name: "Inscriptions par date UTC" }),
  ).toBeVisible();
  expect(formatCents("9007199254740993123", "eur")).toBe(
    "90071992547409931,23",
  );
  expect(formatCents("-5", "EUR")).toBe("−0,05");
  for (const currency of ["jpy", "kwd", "usd", "unknown", ""])
    expect(formatCents("12345", currency)).toBe(
      "12345 unités stockées (échelle non vérifiée)",
    );
  expect(formatCents("-5", "jpy")).toBe(
    "-5 unités stockées (échelle non vérifiée)",
  );
});
it("affiche absence de données, chargement et reprise d'erreur", () => {
  mock.loading = true;
  const view = render(<StatisticsPanel from="2026-01-01" to="2026-01-02" />);
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  mock.loading = false;
  mock.error = "Indisponible";
  view.rerender(<StatisticsPanel from="2026-01-01" to="2026-01-02" />);
  fireEvent.click(
    screen.getByRole("button", { name: "Réessayer les statistiques" }),
  );
  expect(mock.reload).toHaveBeenCalledOnce();
  mock.error = "";
  mock.data = {
    registrations: [{ date: "2026-01-01", count: 0 }],
    subscriptions: [],
    ai: [],
    payments: [],
  };
  view.rerender(<StatisticsPanel from="2026-01-01" to="2026-01-02" />);
  expect(screen.getByRole("status")).toHaveTextContent("Aucune inscription");
  expect(screen.getByText("Aucun paiement.")).toBeVisible();
});
