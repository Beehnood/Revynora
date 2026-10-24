import { beforeEach, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { PlanningAssistant } from "../components/saas/planning-assistant";
import { PlanningView } from "../components/saas/planning-view";
import { ProgressView } from "../components/saas/progress-view";
import { api } from "../lib/api";
import type { ProgressSummary } from "@revynora/types";
const m = vi.hoisted(() => ({
  data: new Map<string, unknown>(),
  error: "",
  loading: false,
  reload: vi.fn(),
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
// JSDOM has no layout engine; graphs are exercised with their real layout in Playwright.
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
beforeEach(() => {
  m.data.clear();
  m.error = "";
  m.loading = false;
  vi.clearAllMocks();
  vi.mocked(api).mockResolvedValue({});
});
const proposal = {
  title: "Mon programme",
  rationale: "Priorité aux fractions",
  tasks: [
    {
      title: "Réviser",
      courseId: "12345678-1234-4234-8234-123456789012",
      localStart: "2027-01-02T10:00",
      durationMinutes: 45,
      priority: 3,
    },
  ],
};
describe("Interfaces Phase 3", () => {
  it("ne confirme jamais une proposition sans action explicite", async () => {
    m.data.set("/study-availability", [
      { id: "a", startsAt: "2027-01-02T10:00Z", endsAt: "2027-01-02T12:00Z" },
    ]);
    vi.mocked(api).mockResolvedValueOnce({ provider: "mock", proposal });
    render(<PlanningAssistant timeZone="UTC" onApplied={m.reload} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Proposer un planning IA" }),
    );
    await screen.findByRole("button", { name: "Confirmer ce planning" });
    expect(api).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Simulation locale/)).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmer ce planning" }),
    );
    await screen.findByText("Planning confirmé et enregistré.");
    expect(api).toHaveBeenLastCalledWith(
      "/study-plans/ai/confirm",
      expect.objectContaining({
        body: expect.stringContaining('"timeZone":"UTC"'),
      }),
    );
    expect(m.reload).toHaveBeenCalled();
  });
  it("conserve une proposition après conflit, permet de l’écarter et affiche les pannes", async () => {
    m.data.set("/study-availability", [
      { id: "a", startsAt: "2027-01-02T10:00Z", endsAt: "2027-01-02T12:00Z" },
    ]);
    vi.mocked(api).mockResolvedValueOnce({ provider: "openai", proposal });
    render(<PlanningAssistant timeZone="UTC" onApplied={m.reload} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Proposer un planning IA" }),
    );
    await screen.findByRole("button", { name: "Confirmer ce planning" });
    vi.mocked(api).mockRejectedValueOnce(new Error("Conflit"));
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmer ce planning" }),
    );
    await screen.findByRole("alert");
    expect(
      screen.getByRole("button", { name: "Confirmer ce planning" }),
    ).toBeEnabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Écarter la proposition" }),
    );
    expect(
      screen.queryByLabelText("Proposition de planning"),
    ).not.toBeInTheDocument();
    vi.mocked(api).mockRejectedValueOnce(new Error("Indisponible"));
    fireEvent.click(
      screen.getByRole("button", { name: "Proposer un planning IA" }),
    );
    await screen.findByText("Indisponible");
  });
  it("ajoute des disponibilités et exige la confirmation de retrait", async () => {
    m.data.set("/study-availability", []);
    const { rerender } = render(
      <PlanningAssistant timeZone="UTC" onApplied={m.reload} />,
    );
    expect(
      screen.getByRole("button", { name: "Proposer un planning IA" }),
    ).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Début de disponibilité"), {
      target: { value: "2027-01-02T10:00" },
    });
    fireEvent.change(screen.getByLabelText("Minutes disponibles"), {
      target: { value: "90" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Ajouter une disponibilité" }),
    );
    await screen.findByText("Disponibilités enregistrées.");
    expect(api).toHaveBeenCalledWith(
      "/study-availability",
      expect.objectContaining({
        body: JSON.stringify({
          timeZone: "UTC",
          slots: [{ localStart: "2027-01-02T10:00", durationMinutes: 90 }],
        }),
      }),
    );
    m.data.set("/study-availability", [
      { id: "a", startsAt: "2027-01-02T10:00Z", endsAt: "2027-01-02T12:00Z" },
    ]);
    rerender(<PlanningAssistant timeZone="UTC" onApplied={m.reload} />);
    fireEvent.click(screen.getByRole("button", { name: "Retirer ce créneau" }));
    expect(api).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Garder ce créneau" }));
    fireEvent.click(screen.getByRole("button", { name: "Retirer ce créneau" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmer le retrait" }),
    );
    await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
  });
  it("les erreurs de disponibilité ne simulent pas une sauvegarde", async () => {
    m.data.set("/study-availability", []);
    vi.mocked(api).mockRejectedValue(new Error("Horaires invalides"));
    render(<PlanningAssistant timeZone="UTC" onApplied={m.reload} />);
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Ajouter une disponibilité" })
        .closest("form")!,
    );
    await screen.findByText("Horaires invalides");
  });
  it("la liste filtre les cours, identifie les retards et permet de renommer le programme", async () => {
    m.data.set("/courses", {
      items: [{ id: "c", title: "Fractions", domain: "Maths" }],
    });
    m.data.set("/study-plans", {
      items: [
        {
          id: "t",
          planId: "p",
          title: "Examen",
          startsAt: "2020-01-01T10:00Z",
          endsAt: "2020-01-01T11:00Z",
          status: "PLANNED",
          version: 0,
          courseId: "c",
          kind: "EXAM",
          priority: 3,
          plan: { title: "Mon ancien programme", timeZone: "UTC" },
        },
      ],
      total: 1,
    });
    render(<PlanningView />);
    expect(screen.getByText("En retard")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Vue"), {
      target: { value: "list" },
    });
    expect(
      screen.queryByLabelText("Calendrier des séances"),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Filtrer par cours"), {
      target: { value: "c" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Renommer le programme" }),
    );
    fireEvent.change(screen.getByLabelText("Titre du programme"), {
      target: { value: "Examens à venir" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer le programme" }),
    );
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        "/study-plans/p",
        expect.objectContaining({
          body: JSON.stringify({ title: "Examens à venir" }),
        }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Modifier" }));
    expect(screen.getByLabelText("Type de tâche")).toHaveValue("EXAM");
    expect(screen.getByLabelText("Priorité")).toHaveValue("3");
    fireEvent.change(screen.getByLabelText("Cours associé"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Type de tâche"), {
      target: { value: "REVISION" },
    });
    fireEvent.change(screen.getByLabelText("Priorité"), {
      target: { value: "1" },
    });
  });
  it("progression : rend les résultats réels, tableaux accessibles et période mensuelle", () => {
    const data: ProgressSummary = {
      totalReviews: 2,
      remembered: 1,
      successRate: 50,
      revisionSeconds: 60,
      timedReviews: 1,
      completedQuizzes: 1,
      averageScore: 80,
      boxes: [{ box: 2, count: 1 }],
      scores: [{ date: "2027-01-01T10:00Z", subject: "Maths", score: 80 }],
      subjects: [
        {
          subject: "Maths",
          quizzes: 1,
          averageScore: 80,
          latestScore: 80,
          reviews: 1,
        },
      ],
      weekly: [{ date: "2027-01-01", reviews: 2, quizzes: 1 }],
      monthly: [{ date: "2027-01-01", reviews: 2, quizzes: 1 }],
      activity: [
        {
          id: "a",
          kind: "QUIZ",
          date: "2027-01-01T10:00Z",
          title: "Fractions · 80 %",
        },
        {
          id: "b",
          kind: "LEITNER",
          date: "2027-01-01T10:00Z",
          title: "Carte retenue",
        },
      ],
    };
    m.data.set("/progress", data);
    render(<ProgressView />);
    expect(screen.getByText("80 %", { selector: "h2" })).toBeVisible();
    fireEvent.click(screen.getByText("Consulter les scores en tableau"));
    expect(
      screen.getByRole("table", { name: "Historique des scores" }),
    ).toBeVisible();
    fireEvent.change(screen.getByLabelText("Période d’activité"), {
      target: { value: "monthly" },
    });
    fireEvent.click(screen.getByText("Consulter l’activité en tableau"));
    expect(
      screen.getByRole("table", { name: "Activité par jour" }),
    ).toBeVisible();
    expect(screen.getByRole("progressbar")).toHaveAttribute("value", "80");
  });
  it("progression : états vide, chargement, erreur et réessai", () => {
    m.loading = true;
    m.error = "Hors ligne";
    render(<ProgressView />);
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(m.reload).toHaveBeenCalled();
    cleanup();
    m.error = "";
    m.loading = false;
    m.data.set("/progress", {
      totalReviews: 0,
      completedQuizzes: 0,
      averageScore: null,
      successRate: null,
      revisionSeconds: 0,
      timedReviews: 0,
      boxes: [],
      scores: [],
      subjects: [],
      weekly: [],
      monthly: [],
      activity: [],
    });
    render(<ProgressView />);
    expect(screen.getByText("Ton parcours commence ici")).toBeVisible();
    expect(screen.getByText("Aucune activité enregistrée.")).toBeVisible();
  });
});
