import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AdminDashboard } from "../components/admin/admin-dashboard";
import Page from "../app/admin/page";
const state = vi.hoisted(() => ({
  metrics: null as unknown,
  error: "",
  loading: false,
  calls: [] as string[],
  reload: vi.fn(),
}));
vi.mock("../lib/use-resource", () => ({
  useResource: (path: string) => {
    state.calls.push(path);
    return {
      data: path.startsWith("/admin/metrics") ? state.metrics : null,
      error: state.error,
      loading: state.loading,
      reload: state.reload,
    };
  },
}));
beforeEach(() => {
  state.metrics = null;
  state.error = "";
  state.loading = false;
  state.calls = [];
  vi.clearAllMocks();
});
it("rend l’accueil sans ouvrir ni appeler de fonctionnalité non migrée", () => {
  render(<Page />);
  expect(screen.getByRole("heading", { name: "Administration" })).toBeVisible();
  expect(screen.getByText("Synthèse non disponible.")).toBeVisible();
  expect(screen.getByText("Statistiques non disponibles.")).toBeVisible();
  expect(screen.getByText("Supervision non disponible.")).toBeVisible();
  expect(
    state.calls.every((path) =>
      /^\/admin\/(metrics|statistics|supervision)\?/.test(path),
    ),
  ).toBe(true);
});
it.each([
  ["mock", false, null, 1, "simulation locale", "désactivé"],
  ["stripe", true, "0.0025", 2, "Stripe test (adaptateur actuel)", "activé"],
  ["other", false, null, 0, "mode non reconnu", "désactivé"],
] as const)(
  "présente les KPI sans revenu inventé (%s)",
  (billingMode, workerEnabled, cost, newUsers, mode, worker) => {
    state.metrics = {
      users: 51,
      newUsers,
      billingMode,
      workerEnabled,
      ai: { _count: 9, _sum: { estimatedCostUsd: cost } },
    };
    render(<AdminDashboard />);
    expect(screen.getByText("51")).toBeVisible();
    expect(screen.getByText("9")).toBeVisible();
    expect(screen.getByText("Facturation : " + mode)).toBeVisible();
    expect(screen.getByText("Rappels automatiques : " + worker)).toBeVisible();
    expect(
      screen.getByText("Coût estimé : " + (cost ?? "non disponible") + " USD"),
    ).toBeVisible();
  },
);
it("n’applique les dates qu’après validation et utilise la même période pour G3 et G5", () => {
  render(<AdminDashboard />);
  fireEvent.change(screen.getByLabelText("Du"), {
    target: { value: "2026-02-01" },
  });
  fireEvent.change(screen.getByLabelText("Au (exclu)"), {
    target: { value: "2026-02-05" },
  });
  expect(state.calls.at(-1)).not.toContain("from=2026-02-01");
  fireEvent.click(screen.getByRole("button", { name: "Appliquer la période" }));
  for (const route of ["metrics", "statistics", "supervision"])
    expect(state.calls).toContain(
      "/admin/" + route + "?from=2026-02-01&to=2026-02-05",
    );
  for (const to of ["2026-01-01", "2028-01-01", ""]) {
    fireEvent.change(screen.getByLabelText("Au (exclu)"), {
      target: { value: to },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Appliquer la période" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("1 à 366 jours UTC");
    expect(state.calls.at(-1)).toContain("to=2026-02-05");
  }
  fireEvent.change(screen.getByLabelText("Au (exclu)"), {
    target: { value: "2026-02-06" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Appliquer la période" }));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
it("masque les anciennes données pendant un chargement ou une panne et permet une reprise", () => {
  state.metrics = {
    users: 51,
    newUsers: 1,
    ai: { _count: 1, _sum: { estimatedCostUsd: null } },
  };
  state.loading = true;
  const view = render(<AdminDashboard />);
  expect(screen.queryByText("51")).not.toBeInTheDocument();
  state.loading = false;
  state.error = "API indisponible";
  view.rerender(<AdminDashboard />);
  expect(screen.queryByText("51")).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Réessayer la synthèse" }),
  );
  expect(state.reload).toHaveBeenCalledOnce();
});
