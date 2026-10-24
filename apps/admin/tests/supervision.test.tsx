import { it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SupervisionPanel } from "../modules/supervision/supervision-panel";
const mock = vi.hoisted(() => ({
  data: null as unknown,
  error: "",
  loading: false,
  reload: vi.fn(),
  path: "",
}));
vi.mock("../lib/use-resource", () => ({
  useResource: (path: string) => {
    mock.path = path;
    return mock;
  },
}));
beforeEach(() => {
  mock.data = null;
  mock.error = "";
  mock.loading = false;
  vi.clearAllMocks();
});
it("applique les périodes et fournit une alternative textuelle sans détail privé", () => {
  mock.data = {
    rows: [
      { category: "REVIEWS", status: "RECORDED", count: 2 },
      { category: "REMINDERS", status: "SENT", count: 1 },
    ],
  };
  render(<SupervisionPanel from="2057-01-01" to="2057-01-03" />);
  expect(mock.path).toBe("/admin/supervision?from=2057-01-01&to=2057-01-03");
  expect(screen.getByRole("table")).toBeVisible();
  expect(screen.getByText("Envoi enregistré (local ou distant)")).toBeVisible();
});
it("chargement, vide et erreur avec reprise", () => {
  mock.loading = true;
  const view = render(<SupervisionPanel from="2057-01-01" to="2057-01-03" />);
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  mock.loading = false;
  mock.error = "Indisponible";
  view.rerender(<SupervisionPanel from="2057-01-01" to="2057-01-03" />);
  fireEvent.click(
    screen.getByRole("button", { name: "Réessayer la supervision" }),
  );
  expect(mock.reload).toHaveBeenCalledOnce();
  mock.error = "";
  mock.data = { rows: [] };
  view.rerender(<SupervisionPanel from="2057-01-01" to="2057-01-03" />);
  expect(
    screen.getByText("Aucune activité de supervision sur cette période."),
  ).toBeVisible();
});
