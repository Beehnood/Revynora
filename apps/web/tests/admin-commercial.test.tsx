import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { it, expect, vi, beforeEach } from "vitest";
import { CommercialPanel } from "../modules/admin/commercial/commercial-panel";
const api = vi.hoisted(() => vi.fn());
import Page from "../app/admin/offres/page";
import { RequestError } from "@/lib/api";
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  api,
  message: (e: Error) => e.message,
}));
const reload = vi.hoisted(() => vi.fn());
const fixture = vi.hoisted(() => ({
  error: "",
  loading: false,
  historyError: "",
  historyLoading: false,
  history: [] as unknown[] | null,
  data: [
    {
      id: "offer",
      code: "PLUS",
      revision: 1,
      currentVersionId: "old",
      name: "Plus",
      priceCents: 250,
      currency: "eur",
      interval: "month",
      active: true,
      versions: [
        {
          id: "draft",
          number: 2,
          basedOnRevision: 1,
          basedOnVersionId: "old",
          name: "Plus nouveau",
          priceCents: 333,
          currency: "eur",
          interval: "month",
          active: true,
          features: ["leitner"],
          reason: "Nouvelle version validée",
          state: "DRAFT",
          bindings: [] as { priceId: string; environment: string }[],
        },
      ],
    },
  ],
}));
vi.mock("@/lib/use-resource", () => ({
  useResource: (path: string) => ({
    loading: path.includes("history")
      ? fixture.historyLoading
      : fixture.loading,
    error: path.includes("history") ? fixture.historyError : fixture.error,
    data: path.includes("history") ? fixture.history : fixture.data,
    reload,
  }),
}));
const originalData = structuredClone(fixture.data);
beforeEach(() => {
  api.mockReset().mockResolvedValue({});
  reload.mockClear();
  fixture.error = "";
  fixture.loading = false;
  fixture.historyError = "";
  fixture.historyLoading = false;
  fixture.history = [];
  fixture.data = structuredClone(originalData);
});
it("exige une confirmation explicite après comparaison et publie la révision affichée", async () => {
  render(<CommercialPanel />);
  fireEvent.click(screen.getByText("Version 2 · Brouillon"));
  expect(screen.getByRole("table")).toHaveTextContent("333 eur");
  const publish = screen.getByRole("button", { name: "Publier la version 2" });
  expect(publish).toBeDisabled();
  fireEvent.click(
    screen.getByRole("checkbox", { name: /Je confirme la publication/ }),
  );
  fireEvent.click(publish);
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      "/admin/commercial/versions/draft/publish",
      expect.objectContaining({
        body: JSON.stringify({
          expectedRevision: 1,
          confirmVersionId: "draft",
        }),
      }),
    ),
  );
});
it("affiche le conflit serveur sans annoncer de publication réussie", async () => {
  api.mockRejectedValueOnce(new Error("Le catalogue a changé"));
  render(<CommercialPanel />);
  fireEvent.click(screen.getByText("Version 2 · Brouillon"));
  fireEvent.click(screen.getByRole("checkbox", { name: /Je confirme/ }));
  fireEvent.click(screen.getByRole("button", { name: "Publier la version 2" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Le catalogue a changé",
  );
  expect(reload).not.toHaveBeenCalled();
});
it("affiche le refus de permission et permet de réessayer", () => {
  fixture.error = "Permission explicite requise";
  render(<CommercialPanel />);
  expect(screen.getAllByRole("alert")[0]).toHaveTextContent(
    "Permission explicite requise",
  );
});
it("prépare un brouillon complet sans publier ni altérer les contrats", async () => {
  render(<CommercialPanel />);
  fireEvent.click(
    screen.getByRole("button", { name: "Préparer une nouvelle version PLUS" }),
  );
  fireEvent.change(screen.getByLabelText("Nom de l’offre"), {
    target: { value: "Plus 2027" },
  });
  fireEvent.change(screen.getByLabelText("Prix en centimes d’euro"), {
    target: { value: "499" },
  });
  fireEvent.change(screen.getByLabelText("Motif administratif"), {
    target: { value: "Nouvelle grille pour les futurs contrats" },
  });
  fireEvent.click(screen.getByRole("checkbox", { name: "Planning" }));
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Rappels facultatifs" }),
  );
  fireEvent.click(
    screen.getByRole("checkbox", {
      name: "Disponible pour les nouvelles souscriptions",
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Créer le brouillon" }));
  await waitFor(() => expect(api).toHaveBeenCalledTimes(1));
  expect(JSON.parse(api.mock.calls[0][1].body)).toMatchObject({
    expectedRevision: 1,
    priceCents: 499,
    active: false,
    features: ["leitner", "planning", "reminders"],
  });
  await waitFor(() => expect(reload).toHaveBeenCalled());
});
it("conserve le formulaire et signale un refus de création du brouillon", async () => {
  api.mockRejectedValueOnce(new Error("Configuration commerciale incohérente"));
  render(<CommercialPanel />);
  fireEvent.click(
    screen.getByRole("button", { name: "Préparer une nouvelle version PLUS" }),
  );
  fireEvent.change(screen.getByLabelText("Motif administratif"), {
    target: { value: "Motif de test explicite" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Créer le brouillon" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Configuration commerciale incohérente",
  );
  expect(reload).not.toHaveBeenCalled();
});
it("vérifie uniquement le prix test renseigné avant publication", async () => {
  render(<CommercialPanel />);
  fireEvent.click(screen.getByText("Version 2 · Brouillon"));
  fireEvent.change(
    screen.getByLabelText("Identifiant d’un prix Stripe test existant"),
    { target: { value: "price_fixture" } },
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Vérifier le prix existant" }),
  );
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      "/admin/commercial/versions/draft/verify-price",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ priceId: "price_fixture" }),
      }),
    ),
  );
  expect(api).toHaveBeenCalledTimes(1);
});
it("masque catalogue et historique pendant chargement ou refus malgré les anciennes données", () => {
  fixture.loading = true;
  const view = render(<CommercialPanel />);
  expect(screen.queryByText("PLUS · Plus")).not.toBeInTheDocument();
  expect(screen.queryByText("Historique commercial")).not.toBeInTheDocument();
  fixture.loading = false;
  fixture.error = "Permission refusée";
  view.rerender(<CommercialPanel />);
  expect(screen.queryByText("PLUS · Plus")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
  expect(reload).toHaveBeenCalled();
});
it("distingue catalogue absent, vide et historique sans versions", () => {
  fixture.data = null as unknown as typeof fixture.data;
  const view = render(<CommercialPanel />);
  expect(screen.getByText("Catalogue non disponible.")).toBeVisible();
  fixture.data = [];
  view.rerender(<CommercialPanel />);
  expect(screen.getByText("Aucune offre disponible.")).toBeVisible();
  fixture.data = structuredClone(originalData);
  fixture.data[0].versions = [];
  view.rerender(<CommercialPanel />);
  expect(screen.getByText(/Catalogue historique/)).toBeVisible();
});
it("borne, masque et permet la reprise de l’historique", () => {
  fixture.history = Array.from({ length: 20 }, (_, i) => ({
    id: String(i),
    actorId: "actor",
    versionId: "version",
    action: "VERSION_PUBLISHED",
    reason: "Motif",
    createdAt: "2026-10-01",
  }));
  const view = render(<CommercialPanel />);
  fireEvent.click(screen.getByRole("button", { name: "Historique suivant" }));
  expect(screen.getByText("Page 2")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Historique précédent" }));
  expect(screen.getByText("Page 1")).toBeVisible();
  fixture.historyLoading = true;
  view.rerender(<CommercialPanel />);
  expect(screen.queryByText(/VERSION_PUBLISHED/)).not.toBeInTheDocument();
  fixture.historyLoading = false;
  fixture.historyError = "Historique indisponible";
  view.rerender(<CommercialPanel />);
  fireEvent.click(
    screen.getByRole("button", { name: "Réessayer l’historique" }),
  );
  expect(reload).toHaveBeenCalled();
  fixture.historyError = "";
  fixture.history = null;
  view.rerender(<CommercialPanel />);
  expect(screen.getByText("Historique non disponible.")).toBeVisible();
});
it("conserve Free gratuit et actif, et n’offre aucune mutation d’une version publiée", () => {
  const offer = fixture.data[0];
  offer.code = "FREE";
  offer.name = "Free";
  offer.priceCents = 0;
  offer.versions[0].state = "PUBLISHED";
  offer.currentVersionId = "draft";
  render(<CommercialPanel />);
  fireEvent.click(
    screen.getByRole("button", { name: "Préparer une nouvelle version FREE" }),
  );
  expect(screen.getByLabelText("Prix en centimes d’euro")).toBeDisabled();
  expect(
    screen.getByRole("checkbox", {
      name: "Disponible pour les nouvelles souscriptions",
    }),
  ).toBeDisabled();
  expect(
    screen.queryByRole("button", { name: /Publier la version/ }),
  ).not.toBeInTheDocument();
});
it("compare une version source connue, et bloque un brouillon devenu obsolète", () => {
  const offer = fixture.data[0];
  offer.versions.push({
    ...offer.versions[0],
    id: "old",
    state: "PUBLISHED",
    number: 1,
    active: false,
    features: [],
  });
  offer.revision = 2;
  render(<CommercialPanel />);
  for (const summary of document.querySelectorAll("summary"))
    fireEvent.click(summary);
  expect(screen.getAllByRole("table")[0]).toHaveTextContent("Retirée");
  fireEvent.click(screen.getAllByRole("checkbox", { name: /Je confirme/ })[0]);
  expect(
    screen.getByRole("button", { name: "Publier la version 2" }),
  ).toBeDisabled();
  expect(screen.getByRole("status")).toHaveTextContent("Le catalogue a changé");
});
it.each([401, 403, 409, 503])(
  "traite le refus %s de publication et exige une nouvelle confirmation",
  async (status) => {
    api.mockRejectedValueOnce(
      new RequestError("Refus commercial", "REFUSED", status),
    );
    render(<CommercialPanel />);
    fireEvent.click(screen.getByText("Version 2 · Brouillon"));
    const confirm = screen.getByRole("checkbox", { name: /Je confirme/ });
    fireEvent.click(confirm);
    fireEvent.click(
      screen.getByRole("button", { name: "Publier la version 2" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Refus commercial",
    );
    await waitFor(() => expect(confirm).not.toBeChecked());
    if ([401, 403].includes(status)) expect(reload).toHaveBeenCalled();
    else {
      expect(reload).not.toHaveBeenCalled();
      fireEvent.click(
        screen.getByRole("button", { name: "Actualiser le catalogue" }),
      );
      expect(reload).toHaveBeenCalled();
    }
  },
);
it.each([401, 403])(
  "revalide les lectures après un refus %s de brouillon",
  async (status) => {
    api.mockRejectedValueOnce(
      new RequestError("Refus commercial", "REFUSED", status),
    );
    render(<CommercialPanel />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Préparer une nouvelle version PLUS",
      }),
    );
    fireEvent.change(screen.getByLabelText("Motif administratif"), {
      target: { value: "Motif administratif complet" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Créer le brouillon" }));
    await waitFor(() => expect(reload).toHaveBeenCalled());
  },
);
it("bloque les doubles publications et affiche un prix fournisseur déjà lié", async () => {
  let done!: (value: unknown) => void;
  api.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        done = resolve;
      }),
  );
  fixture.data[0].versions[0].bindings = [
    { priceId: "price_fixture", environment: "test" },
  ];
  render(<CommercialPanel />);
  fireEvent.click(screen.getByText("Version 2 · Brouillon"));
  fireEvent.click(screen.getByRole("checkbox", { name: /Je confirme/ }));
  const publish = screen.getByRole("button", { name: "Publier la version 2" });
  fireEvent.click(publish);
  fireEvent.click(publish);
  expect(api).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/Prix fournisseur vérifié/)).toHaveTextContent(
    "test",
  );
  expect(
    screen.getByRole("button", { name: "Vérifier le prix existant" }),
  ).toBeDisabled();
  done({});
  await waitFor(() => expect(reload).toHaveBeenCalled());
});

it("rend la route intégrée des offres", () => {
  render(<Page />);
  expect(
    screen.getByRole("heading", { name: "Gestion commerciale" }),
  ).toBeVisible();
});
