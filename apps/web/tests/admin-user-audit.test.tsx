import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UserAudit } from "../modules/admin/users/user-audit";
const m = vi.hoisted(() => ({
  data: null as unknown,
  loading: false,
  error: "",
  reload: vi.fn(),
}));
vi.mock("../lib/use-resource", () => ({ useResource: () => m }));
beforeEach(() => {
  m.data = null;
  m.loading = false;
  m.error = "";
  vi.clearAllMocks();
});
it("borne le journal visible et exclut les autres cibles et événements", () => {
  m.data = {
    audit: [
      {
        id: "1",
        targetUserId: "target",
        actorId: "actor",
        action: "USER_DISABLED",
        reason: "USER_REQUEST",
        result: "SUCCESS",
        createdAt: "2026-01-01",
      },
      {
        id: "2",
        targetUserId: "target",
        actorId: null,
        action: "USER_ENABLED",
        reason: null,
        result: "LEGACY",
        createdAt: "2026-01-02",
      },
      { id: "3", targetUserId: "other", action: "USER_DISABLED" },
      { id: "4", targetUserId: "target", action: "OTHER_EVENT" },
    ],
  };
  render(<UserAudit userId="target" />);
  expect(screen.getByText(/pas un historique exhaustif/)).toBeVisible();
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  expect(screen.getByText(/Demande du titulaire/)).toBeVisible();
  expect(screen.getByText(/historique indisponible/)).toBeVisible();
});
it("gère vide, panne, absence et masquage des anciennes entrées", () => {
  m.loading = true;
  const view = render(<UserAudit userId="target" />);
  expect(screen.queryByRole("list")).not.toBeInTheDocument();
  m.loading = false;
  m.error = "Panne";
  view.rerender(<UserAudit userId="target" />);
  fireEvent.click(screen.getByRole("button", { name: "Réessayer le journal" }));
  expect(m.reload).toHaveBeenCalledOnce();
  m.error = "";
  view.rerender(<UserAudit userId="target" />);
  expect(screen.getByText("Journal non disponible.")).toBeVisible();
  m.data = { audit: [] };
  view.rerender(<UserAudit userId="target" />);
  expect(screen.getByText(/Aucun changement d’accès visible/)).toBeVisible();
});
