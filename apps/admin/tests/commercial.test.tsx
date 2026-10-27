import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { it, expect, vi, beforeEach } from "vitest";
import { CommercialPanel } from "../modules/commercial/commercial-panel";
const api = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ api, message: (e: Error) => e.message }));
const reload = vi.hoisted(() => vi.fn());
const fixture = vi.hoisted(() => ({
  error: "",
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
          name: "Plus nouveau",
          priceCents: 333,
          currency: "eur",
          interval: "month",
          active: true,
          features: ["leitner"],
          reason: "Nouvelle version validée",
          state: "DRAFT",
          bindings: [],
        },
      ],
    },
  ],
}));
vi.mock("@/lib/use-resource", () => ({
  useResource: (path: string) => ({
    loading: false,
    error: fixture.error,
    data: path.includes("history") ? [] : fixture.data,
    reload,
  }),
}));
beforeEach(() => {
  api.mockReset().mockResolvedValue({});
  reload.mockClear();
  fixture.error = "";
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
