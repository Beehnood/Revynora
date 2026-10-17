import { TaskHistory } from "../components/saas/task-history";
import { beforeEach, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { BillingView } from "../components/saas/billing-view";
import { LeitnerView } from "../components/saas/leitner-view";
import { PlanningView } from "../components/saas/planning-view";
import { NotificationsView } from "../components/saas/notifications-view";
import { PrivacyControls } from "../components/saas/privacy-controls";
import { api } from "../lib/api";
const m = vi.hoisted(() => ({
  data: new Map<string, unknown>(),
  error: "",
  loading: false,
  reload: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  params: "",
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: m.push, replace: m.replace, refresh: m.refresh }),
  useSearchParams: () => new URLSearchParams(m.params),
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
  m.data.clear();
  m.error = "";
  m.loading = false;
  m.params = "";
  vi.clearAllMocks();
  vi.mocked(api).mockResolvedValue({});
});
const card = {
  id: "card",
  front: "Une question ?",
  back: "Une réponse.",
  box: 1,
  version: 0,
  dueAt: new Date().toISOString(),
};
describe("Écrans SaaS", () => {
  it("charge l’historique à la demande, pagine et permet de réessayer une panne", async () => {
    vi.mocked(api).mockResolvedValueOnce({
      items: [
        {
          id: "v",
          version: 1,
          title: "Séance déplacée",
          startsAt: "2026-10-20T10:00Z",
          status: "PLANNED",
        },
      ],
      total: 21,
      page: 1,
      pageSize: 20,
    });
    render(<TaskHistory itemId="task" timeZone="Europe/Paris" />);
    expect(api).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Historique de la séance" }),
    );
    await screen.findByText("Version 1 · Séance déplacée");
    vi.mocked(api).mockRejectedValueOnce(new Error("Hors ligne"));
    fireEvent.click(screen.getByRole("button", { name: "Version suivante" }));
    await screen.findByRole("alert");
    vi.mocked(api).mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Historique de la séance" }),
    );
    expect(
      screen.queryByLabelText("Versions de la séance"),
    ).not.toBeInTheDocument();
  });

  it("affiche les offres, reprend un paiement et valide une simulation", async () => {
    m.data.set("/subscriptions/me", {
      plan: "FREE",
      mode: "simulation",
      period: null,
      pending: { id: "intent", url: "/app/abonnement?simulation=intent" },
    });
    m.data.set("/subscriptions/plans", [
      { code: "FREE", name: "Free", priceCents: 0 },
      { code: "PLUS", name: "Plus", priceCents: 250 },
      { code: "PRO", name: "Pro", priceCents: 500 },
    ]);
    m.data.set("/payments/me", { items: [] });
    m.params = "simulation=intent";
    render(<BillingView />);
    expect(screen.getByText(/aucun prélèvement/)).toBeVisible();
    expect(screen.getByRole("link", { name: /Reprendre/ })).toHaveAttribute(
      "href",
      "/app/abonnement?simulation=intent",
    );
    fireEvent.click(screen.getByRole("button", { name: "Choisir Plus" }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        "/billing/checkout-session",
        expect.objectContaining({ body: JSON.stringify({ plan: "PLUS" }) }),
      ),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Simuler un paiement accepté" }),
    );
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        "/billing/mock-complete",
        expect.objectContaining({
          body: JSON.stringify({ intentId: "intent", success: true }),
        }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Simuler un refus" }));
    await waitFor(() => expect(m.refresh).toHaveBeenCalled());
  });
  it("gère une résiliation, un changement différé et les erreurs réseau", async () => {
    m.data.set("/subscriptions/me", {
      plan: "PRO",
      mode: "simulation",
      period: { endsAt: "2026-11-01", cancelAtPeriodEnd: true },
    });
    m.data.set("/payments/me", {
      items: [
        {
          id: "p",
          amountCents: 500,
          status: "PAID",
          provider: "mock",
          createdAt: "2026-10-16",
        },
      ],
    });
    render(<BillingView />);
    fireEvent.click(screen.getByRole("button", { name: /Résilier/ }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        "/billing/mock-cancel",
        expect.anything(),
      ),
    );
    vi.mocked(api).mockResolvedValueOnce({ effectiveAt: "2026-11-01" });
    fireEvent.click(screen.getByRole("button", { name: /Passer à Plus/ }));
    await screen.findByText(/Changement programmé/);
    vi.mocked(api).mockRejectedValueOnce(new Error("Hors ligne"));
    fireEvent.click(screen.getByRole("button", { name: /Résilier/ }));
    await screen.findByRole("alert");
  });
  it("navigue vers le checkout local uniquement et montre les chargements", async () => {
    m.loading = true;
    m.data.set("/subscriptions/me", { plan: "FREE", mode: "stripe_test" });
    m.data.set("/subscriptions/plans", [
      { code: "PRO", name: "Pro", priceCents: 500 },
    ]);
    vi.mocked(api).mockResolvedValueOnce({
      url: "/app/abonnement?simulation=x",
    });
    render(<BillingView />);
    fireEvent.click(screen.getByRole("button", { name: "Choisir Pro" }));
    await waitFor(() =>
      expect(m.push).toHaveBeenCalledWith("/app/abonnement?simulation=x"),
    );
    cleanup();
    m.error = "Offre inaccessible";
    render(<BillingView />);
    expect(screen.getByRole("alert")).toHaveTextContent(m.error);
  });
  it("attend la confirmation serveur et affiche seulement les reçus Stripe autorisés", async () => {
    m.params = "retour=paiement";
    m.data.set("/subscriptions/me", {
      plan: "FREE",
      mode: "stripe_test",
      canManage: true,
    });
    m.data.set("/payments/me", {
      items: [
        {
          id: "p",
          amountCents: 250,
          status: "PAID",
          provider: "stripe",
          createdAt: "2026-10-16",
          receiptUrl: "https://invoice.stripe.com/receipt",
        },
      ],
      total: 21,
    });
    render(<BillingView />);
    expect(screen.getByText(/Validation du paiement en cours/)).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Actualiser mon offre" }),
    );
    expect(m.reload).toHaveBeenCalled();
    expect(
      screen.getByRole("link", { name: "Voir le reçu Stripe" }),
    ).toHaveAttribute("rel", "noopener noreferrer");
    fireEvent.click(screen.getByRole("button", { name: "Suivant" }));
    expect(screen.getByText("Page 2")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Précédent" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Gérer mes moyens de paiement" }),
    );
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        "/billing/portal-session",
        expect.anything(),
      ),
    );
  });
  it("crée, retourne et révise des cartes au clavier puis archive", async () => {
    m.data.set("/leitner/cards", { items: [card], total: 1 });
    m.data.set("/leitner/cards/due", { items: [card], total: 1 });
    render(<LeitnerView />);
    fireEvent.change(screen.getByLabelText("Question"), {
      target: { value: "Autre question" },
    });
    fireEvent.change(screen.getByLabelText("Réponse"), {
      target: { value: "Autre réponse" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Créer la carte" }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith("/leitner/cards", expect.anything()),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Commencer la révision" }),
    );
    fireEvent.keyDown(window, { code: "Space" });
    expect(screen.getByText("Une réponse.")).toBeVisible();
    fireEvent.keyDown(window, { key: "2" });
    await screen.findByText("Séance terminée !");
    fireEvent.click(
      screen.getByRole("button", { name: "Revenir à mes cartes" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Archiver" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmer l’archivage" }),
    );
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith("/leitner/cards/card", {
        method: "DELETE",
      }),
    );
  });
  it("révision oubliée, carte périmée et contrôle d’accès restent explicites", async () => {
    m.data.set("/leitner/cards", { items: [card], total: 101 });
    m.data.set("/leitner/cards/due", { items: [card], total: 1 });
    render(<LeitnerView />);
    fireEvent.click(
      screen.getByRole("button", { name: "Commencer la révision" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Afficher la réponse" }),
    );
    vi.mocked(api).mockRejectedValueOnce(new Error("Carte modifiée"));
    fireEvent.click(screen.getByRole("button", { name: "À revoir (1)" }));
    await screen.findByRole("alert");
    cleanup();
    m.error = "Plus requis";
    render(<LeitnerView />);
    expect(
      screen.getByRole("link", { name: /Voir les offres/ }),
    ).toHaveAttribute("href", "/app/abonnement");
  });
  it("modifie une carte et affiche les cinq boîtes et l’historique", async () => {
    m.data.set("/leitner/cards", { items: [card], total: 1 });
    m.data.set("/leitner/cards/due", { items: [], total: 0 });
    m.data.set("/leitner/stats", {
      boxes: [{ box: 1, _count: 1 }],
      totalReviews: 2,
      recent: [{ id: "r", remembered: true, createdAt: "2026-10-16" }],
    });
    render(<LeitnerView />);
    expect(screen.getByText("2 révisions enregistrées")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Modifier" }));
    fireEvent.change(screen.getByLabelText("Réponse"), {
      target: { value: "Réponse modifiée" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer la carte" }),
    );
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        "/leitner/cards/card",
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Modifier" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Annuler la modification" }),
    );
    expect(screen.getByLabelText("Question")).toHaveValue("");
  });
  it("planning : création, consentement séparé, dates et annulation", async () => {
    const task = {
      id: "task",
      title: "Maths",
      startsAt: "2026-10-20T08:00Z",
      endsAt: "2026-10-20T08:45Z",
      status: "PLANNED",
      version: 0,
      plan: { timeZone: "Europe/Paris" },
    };
    m.data.set("/study-plans", { items: [task], total: 1 });
    render(<PlanningView />);
    fireEvent.change(screen.getByLabelText("À partir du"), {
      target: { value: "2026-10-20" },
    });
    fireEvent.change(screen.getByLabelText("Vue"), {
      target: { value: "month" },
    });
    fireEvent.change(screen.getByLabelText("Matière ou objectif"), {
      target: { value: "Physique" },
    });
    fireEvent.change(screen.getByLabelText("Date et heure locale"), {
      target: { value: "2026-10-21T10:00" },
    });
    fireEvent.change(screen.getByLabelText("Fuseau horaire IANA"), {
      target: { value: "UTC" },
    });
    fireEvent.change(screen.getByLabelText("Durée en minutes"), {
      target: { value: "30" },
    });
    fireEvent.click(screen.getByLabelText(/Décaler/));
    fireEvent.click(screen.getByLabelText(/Prévoir un rappel/));
    fireEvent.click(
      screen.getByRole("button", { name: "Ajouter au planning" }),
    );
    await screen.findByText(/Séance ajoutée/);
    expect(api).toHaveBeenCalledWith(
      "/study-plans/generate",
      expect.objectContaining({
        body: expect.stringContaining('"reminderMinutes":15'),
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Terminer" }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        "/study-plan-items/task",
        expect.objectContaining({
          body: JSON.stringify({ version: 0, status: "DONE" }),
        }),
      ),
    );
    vi.mocked(api).mockRejectedValueOnce(new Error("Conflit"));
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    await screen.findByRole("alert");
  });
  it("planning fermé et notifications facultatives gèrent les échecs", async () => {
    m.error = "Pro requis";
    render(<PlanningView />);
    expect(screen.getByRole("link", { name: "Découvrir Pro" })).toBeVisible();
    cleanup();
    m.error = "";
    m.data.set("/notifications/preferences", {
      timeZone: "Europe/Paris",
      remindersEnabled: false,
    });
    m.data.set("/notifications/me", {
      mode: "local",
      items: [
        {
          id: "mail",
          subject: "Bienvenue",
          body: "Ton compte",
          status: "SENT",
          createdAt: "2026-10-16",
        },
      ],
    });
    render(<NotificationsView />);
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByLabelText("Fuseau horaire IANA"), {
      target: { value: "UTC" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer mes préférences" }),
    );
    await screen.findByText(/Préférences enregistrées/);
    expect(api).toHaveBeenCalledWith(
      "/notifications/preferences",
      expect.objectContaining({
        body: JSON.stringify({ enabled: true, timeZone: "UTC" }),
      }),
    );
    vi.mocked(api).mockRejectedValueOnce(new Error("Non disponible"));
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer mes préférences" }),
    );
    await screen.findByRole("alert");
  });
  it("suppression : saisie explicite obligatoire et mot de passe vérifié", async () => {
    render(<PrivacyControls />);
    fireEvent.click(screen.getByText("Supprimer définitivement mon compte"));
    expect(
      screen.getByRole("button", { name: "Supprimer mon compte" }),
    ).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Mot de passe"), {
      target: { value: "wrong" },
    });
    fireEvent.change(screen.getByLabelText("Saisis SUPPRIMER"), {
      target: { value: "SUPPRIMER" },
    });
    vi.mocked(api).mockRejectedValueOnce(new Error("Mot de passe incorrect"));
    fireEvent.click(
      screen.getByRole("button", { name: "Supprimer mon compte" }),
    );
    await screen.findByRole("alert");
    expect(screen.getByRole("link", { name: /Exporter/ })).toHaveAttribute(
      "href",
      "/api/v1/privacy/export",
    );
  });
});
