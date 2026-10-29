import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  LearningGrantsPanel,
  type LearningGrant,
} from "../modules/admin/learning-grants/learning-grants-panel";
import { api, RequestError } from "../lib/api";
const m = vi.hoisted(() => ({
  data: [] as LearningGrant[] | null,
  loading: false,
  error: "",
  reload: vi.fn(),
  paths: [] as string[],
}));
vi.mock("../lib/use-resource", () => ({
  useResource: (path: string) => {
    m.paths.push(path);
    return m;
  },
}));
vi.mock("../lib/api", async (original) => ({
  ...(await original<typeof import("../lib/api")>()),
  api: vi.fn(),
}));
const user = {
  id: "admin",
  name: "Administrateur cible",
  email: "admin@example.test",
  role: "ADMIN" as const,
  createdAt: "2026-01-01",
  disabledAt: null,
};
const grant: LearningGrant = {
  id: "grant",
  userId: user.id,
  level: "PRO",
  startsAt: "2026-01-01",
  expiresAt: null,
  provenance: "TEST",
  justification: "Justification de test",
  issuedById: "actor",
  createdAt: "2026-01-01",
  revokedAt: null,
  revokedById: null,
  revocationReason: null,
};
beforeEach(() => {
  m.data = [];
  m.loading = false;
  m.error = "";
  m.paths = [];
  vi.clearAllMocks();
});
function issue() {
  fireEvent.change(screen.getByLabelText("Début (UTC)"), {
    target: { value: "2026-01-01T12:00" },
  });
  fireEvent.change(screen.getByLabelText("Provenance"), {
    target: { value: "LOCAL_REVIEW" },
  });
  fireEvent.change(screen.getByLabelText("Justification"), {
    target: { value: "Attribution de recette isolée" },
  });
  fireEvent.click(
    screen.getByLabelText(
      "Je confirme l’attribution pédagogique à ce bénéficiaire",
    ),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Confirmer l’attribution pédagogique" }),
  );
}
function revoke() {
  fireEvent.click(
    screen.getByRole("button", { name: "Révoquer cette attribution" }),
  );
  fireEvent.change(screen.getByLabelText("Motif de révocation"), {
    target: { value: "Révocation de recette isolée" },
  });
  fireEvent.click(
    screen.getByLabelText("Je confirme cette révocation pédagogique"),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Confirmer la révocation" }),
  );
}
it("affiche explicitement la séparation commerciale et ne crée rien automatiquement", () => {
  render(<LearningGrantsPanel user={user} />);
  expect(screen.getByText(/Elle ne crée aucun paiement/)).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Confirmer l’attribution pédagogique" }),
  ).toBeDisabled();
  expect(api).not.toHaveBeenCalled();
  expect(m.paths.at(-1)).toBe("/admin/users/admin/learning-grants?page=1");
});
it.each([false, true])(
  "attribue uniquement le contrat autorisé avec confirmation (expiration=%s)",
  async (expiry) => {
    vi.mocked(api).mockResolvedValueOnce(grant);
    render(<LearningGrantsPanel user={user} />);
    if (expiry)
      fireEvent.change(screen.getByLabelText("Expiration facultative (UTC)"), {
        target: { value: "2099-01-01T12:00" },
      });
    issue();
    await waitFor(() => expect(m.reload).toHaveBeenCalledOnce());
    expect(api).toHaveBeenCalledWith("/admin/users/admin/learning-grants", {
      method: "POST",
      body: JSON.stringify({
        startsAt: "2026-01-01T12:00:00.000Z",
        ...(expiry ? { expiresAt: "2099-01-01T12:00:00.000Z" } : {}),
        provenance: "LOCAL_REVIEW",
        justification: "Attribution de recette isolée",
      }),
    });
  },
);
it("rejette des dates incohérentes avant mutation", () => {
  render(<LearningGrantsPanel user={user} />);
  fireEvent.change(screen.getByLabelText("Expiration facultative (UTC)"), {
    target: { value: "2020-01-01T12:00" },
  });
  issue();
  expect(screen.getByRole("alert")).toHaveTextContent("Vérifiez les dates");
  expect(api).not.toHaveBeenCalled();
});
it("borne la pagination et réserve l’attribution à un ADMIN actif", () => {
  m.data = Array.from({ length: 20 }, (_, i) => ({
    ...grant,
    id: "g" + i,
    revokedAt: "2026-02-01",
    revokedById: "actor",
    revocationReason: "Motif conservé",
  }));
  render(<LearningGrantsPanel user={{ ...user, disabledAt: "2026-03-01" }} />);
  expect(screen.queryByLabelText("Provenance")).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Attributions suivantes" }),
  );
  expect(m.paths.at(-1)).toContain("page=2");
  fireEvent.click(
    screen.getByRole("button", { name: "Attributions précédentes" }),
  );
  expect(m.paths.at(-1)).toContain("page=1");
  expect(screen.getAllByText(/Motif conservé/)).toHaveLength(20);
});
it("annule la révocation sans mutation et restaure le focus", () => {
  m.data = [grant];
  render(<LearningGrantsPanel user={user} />);
  const trigger = screen.getByRole("button", {
    name: "Révoquer cette attribution",
  });
  fireEvent.click(trigger);
  expect(
    screen.getByRole("button", { name: "Confirmer la révocation" }),
  ).toBeDisabled();
  fireEvent.click(
    screen.getByRole("button", { name: "Annuler la révocation" }),
  );
  expect(trigger).toHaveFocus();
  expect(api).not.toHaveBeenCalled();
});
it("révoque avec un motif et actualise la liste", async () => {
  m.data = [{ ...grant, expiresAt: "2099-01-01" }];
  vi.mocked(api).mockResolvedValueOnce({});
  render(<LearningGrantsPanel user={user} />);
  revoke();
  await waitFor(() => expect(m.reload).toHaveBeenCalledOnce());
  expect(api).toHaveBeenCalledWith("/admin/learning-grants/grant/revoke", {
    method: "PATCH",
    body: JSON.stringify({ reason: "Révocation de recette isolée" }),
  });
});
it.each([401, 403, 409, 503])(
  "traite les erreurs %s de création et réinitialise la confirmation",
  async (status) => {
    vi.mocked(api).mockRejectedValueOnce(
      new RequestError("Refus " + status, "REFUSED", status),
    );
    render(<LearningGrantsPanel user={user} />);
    issue();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Refus " + status,
    );
    expect(
      screen.getByLabelText(
        "Je confirme l’attribution pédagogique à ce bénéficiaire",
      ),
    ).not.toBeChecked();
    expect(m.reload).toHaveBeenCalledTimes(
      status === 401 || status === 403 ? 1 : 0,
    );
  },
);
it.each([401, 403, 409, 503])(
  "traite les erreurs %s de révocation sans modifier la preuve historique",
  async (status) => {
    m.data = [grant];
    vi.mocked(api).mockRejectedValueOnce(
      new RequestError("Refus " + status, "REFUSED", status),
    );
    render(<LearningGrantsPanel user={user} />);
    revoke();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Refus " + status,
    );
    expect(
      screen.getByLabelText("Je confirme cette révocation pédagogique"),
    ).not.toBeChecked();
    expect(m.reload).toHaveBeenCalledTimes(
      status === 401 || status === 403 ? 1 : 0,
    );
  },
);
it("n’affiche aucune attribution ou commande quand la lecture n’est pas validée", () => {
  m.data = [grant];
  m.loading = true;
  const view = render(<LearningGrantsPanel user={user} />);
  expect(screen.queryByLabelText("Provenance")).not.toBeInTheDocument();
  m.loading = false;
  m.error = "API indisponible";
  view.rerender(<LearningGrantsPanel user={user} />);
  fireEvent.click(
    screen.getByRole("button", { name: "Réessayer les attributions" }),
  );
  expect(m.reload).toHaveBeenCalledOnce();
  expect(screen.queryByText(grant.justification)).not.toBeInTheDocument();
  m.error = "";
  m.data = null;
  view.rerender(<LearningGrantsPanel user={user} />);
  expect(screen.getByText("Attributions non disponibles.")).toBeVisible();
});
it("ne double pas une attribution en cours", async () => {
  let release!: () => void;
  vi.mocked(api).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = () => resolve({});
      }),
  );
  render(<LearningGrantsPanel user={user} />);
  issue();
  fireEvent.click(
    screen.getByRole("button", { name: "Confirmer l’attribution pédagogique" }),
  );
  expect(api).toHaveBeenCalledOnce();
  release();
  await waitFor(() => expect(m.reload).toHaveBeenCalledOnce());
});
