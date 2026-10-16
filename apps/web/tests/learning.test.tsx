import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import type { Attempt, PublicQuiz, UserProfile } from "@revynora/types";
import { AuthForm } from "../components/learning/auth-form";
import { StudentShell } from "../components/learning/student-shell";
import { StudentHome } from "../components/learning/student-home";
import { DiagnosticForm } from "../components/learning/diagnostic-form";
import { AttemptView } from "../components/learning/attempt-view";
import { HistoryView } from "../components/learning/history-view";
import { CoursesView } from "../components/learning/courses-view";
import { ProfileView } from "../components/learning/profile-view";
import { ResourceState } from "../components/learning/resource-state";
import { api, RequestError } from "../lib/api";
const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  reload: vi.fn(),
  data: new Map<string, unknown>(),
  error: "",
  loading: false,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
    replace: mocks.replace,
    refresh: mocks.refresh,
  }),
  usePathname: () => "/app",
}));
vi.mock("../lib/use-resource", () => ({
  useResource: (path: string) => ({
    data: mocks.data.get(path) ?? mocks.data.get(path.split("?")[0]) ?? null,
    error: mocks.error,
    loading: mocks.loading,
    reload: mocks.reload,
  }),
}));
vi.mock("../lib/api", async (original) => ({
  ...(await original<typeof import("../lib/api")>()),
  api: vi.fn(),
}));
const user: UserProfile = {
  id: "student",
  name: "Emma",
  email: "emma@example.test",
  role: "STUDENT",
  plan: "FREE",
  createdAt: "2026-10-16T08:00:00Z",
};
const quiz: PublicQuiz = {
  id: "quiz",
  domain: "Sciences",
  topic: "Les cellules",
  level: "Débutant",
  provider: "mock",
  createdAt: user.createdAt,
  questions: Array.from({ length: 5 }, (_, i) => ({
    id: "q" + i,
    position: i,
    text: `Question pédagogique numéro ${i + 1} ?`,
    type: i === 3 ? "MULTIPLE" : "SINGLE",
    options: [
      { id: "a" + i, text: "Option A " + i },
      { id: "b" + i, text: "Option B " + i },
      { id: "c" + i, text: "Option C " + i },
    ],
  })),
};
const draft: Attempt = {
  id: "attempt",
  startedAt: user.createdAt,
  submittedAt: null,
  score: null,
  quiz,
  answers: [],
  result: null,
};
const done: Attempt = {
  ...draft,
  submittedAt: user.createdAt,
  score: 60,
  answers: quiz.questions.map((q) => ({
    questionId: q.id,
    selectedOptionIds: [q.options[0].id],
  })),
  result: {
    score: 60,
    mastered: ["Membrane"],
    weak: ["Noyau"],
    miniCourse: "Une cellule est l’unité de base du vivant.",
    corrected: quiz.questions.map((q, i) => ({
      questionId: q.id,
      concept: "Notion " + i,
      correct: i < 3,
    })),
    questions: quiz.questions.map((q) => ({
      id: q.id,
      text: q.text,
      concept: "Notion",
      explanation: "Explication pédagogique détaillée.",
      correctOptionIds: [q.options[0].id],
    })),
  },
};
const history = {
  id: draft.id,
  startedAt: user.createdAt,
  submittedAt: user.createdAt,
  score: 60,
  quiz: {
    topic: quiz.topic,
    domain: quiz.domain,
    level: quiz.level,
    provider: "mock",
  },
};
const config = {
  provider: "mock",
  mockTopics: [
    { domain: "Sciences", topic: "Les cellules" },
    { domain: "Mathématiques", topic: "Les fractions" },
  ],
  dailyLimit: 10,
  remaining: 10,
  used: 0,
  reset: "00:00 UTC",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.data.clear();
  mocks.loading = false;
  mocks.error = "";
  vi.mocked(api).mockResolvedValue({});
});
function shell(child: React.ReactNode) {
  return render(<StudentShell user={user}>{child}</StudentShell>);
}
describe("Parcours pédagogique Web", () => {
  it("valide l’inscription et annonce les erreurs de connexion sans divulgation", async () => {
    vi.mocked(api).mockRejectedValue(
      new RequestError("Informations incorrectes.", "AUTH_INVALID", 401),
    );
    render(<AuthForm register />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Créer mon compte gratuit",
      }),
    );
    expect(screen.getByLabelText("Prénom")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    fireEvent.change(screen.getByLabelText("Prénom"), {
      target: { value: "Emma" },
    });
    fireEvent.change(screen.getByLabelText("Adresse e-mail"), {
      target: { value: user.email },
    });
    fireEvent.change(screen.getByLabelText("Mot de passe", { exact: true }), {
      target: { value: "UnePhraseLongue!42" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Afficher le mot de passe" }),
    );
    expect(
      screen.getByLabelText("Mot de passe", { exact: true }),
    ).toHaveAttribute("type", "text");
    fireEvent.click(
      screen.getByRole("button", { name: "Masquer le mot de passe" }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Créer mon compte gratuit",
      }),
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Informations incorrectes.",
      ),
    );
  });
  it("affiche le formulaire de connexion et les erreurs réseau", async () => {
    vi.mocked(api).mockRejectedValue(new Error("Connexion interrompue"));
    render(<AuthForm />);
    fireEvent.change(screen.getByLabelText("Adresse e-mail"), {
      target: { value: user.email },
    });
    fireEvent.change(screen.getByLabelText("Mot de passe", { exact: true }), {
      target: { value: "UnePhraseLongue!42" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Me connecter" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Connexion interrompue",
      ),
    );
  });
  it("présente le dashboard vide puis les résultats réellement chargés", () => {
    mocks.data.set("/learning/summary", {
      completed: 0,
      lastScore: null,
      average: null,
      weak: [],
      recent: [],
    });
    const view = shell(<StudentHome />);
    expect(screen.getByText("Ton premier déclic t’attend")).toBeVisible();
    mocks.data.set("/learning/summary", {
      completed: 1,
      lastScore: 60,
      average: 60,
      weak: ["Noyau"],
      recent: [history],
    });
    view.rerender(
      <StudentShell user={user}>
        <StudentHome />
      </StudentShell>,
    );
    expect(screen.getAllByText("60 %")).toHaveLength(2);
    expect(screen.getByText("Noyau")).toBeVisible();
    mocks.data.set("/learning/summary", {
      completed: 1,
      lastScore: 100,
      average: 100,
      weak: [],
      recent: [{ ...history, submittedAt: null }],
    });
    view.rerender(
      <StudentShell user={user}>
        <StudentHome />
      </StudentShell>,
    );
    expect(screen.getByText("Un beau point de départ !")).toBeVisible();
    expect(screen.getByText("À terminer")).toBeVisible();
  });
  it("gère le menu et la déconnexion sans masquer une panne", async () => {
    vi.mocked(api).mockRejectedValueOnce(new Error("Déconnexion impossible"));
    shell(<ProfileView />);
    expect(screen.getByText(user.email)).toBeVisible();
    const toggle = screen.getByRole("button", { name: "Ouvrir la navigation" });
    fireEvent.click(toggle);
    fireEvent.keyDown(screen.getByRole("complementary"), { key: "Escape" });
    expect(toggle).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("complementary"), { key: "Tab" });
    fireEvent.click(toggle);
    const historyLink = screen.getByRole("link", { name: "Mes tests" });
    historyLink.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(historyLink);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(screen.getByRole("button", { name: "Me déconnecter" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Déconnexion impossible",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Me déconnecter" }));
    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith("/connexion"),
    );
  });
  it("génère le diagnostic mock et ouvre une tentative", async () => {
    mocks.data.set("/learning/config", config);
    vi.mocked(api)
      .mockResolvedValueOnce(quiz)
      .mockResolvedValueOnce({ id: "attempt" });
    render(<DiagnosticForm />);
    fireEvent.change(screen.getByLabelText("Domaine"), {
      target: { value: "Mathématiques" },
    });
    expect(screen.getByLabelText("Sujet à explorer")).toHaveValue(
      "Les fractions",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Lancer mon diagnostic" }),
    );
    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith("/app/tentatives/attempt"),
    );
  });
  it("reprend une tentative préparée après un échec de création", async () => {
    mocks.data.set("/learning/config", config);
    vi.mocked(api)
      .mockResolvedValueOnce(quiz)
      .mockRejectedValueOnce(new Error("Ouverture interrompue"))
      .mockResolvedValueOnce({ id: "resumed" });
    render(<DiagnosticForm />);
    fireEvent.click(
      screen.getByRole("button", { name: "Lancer mon diagnostic" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Ouverture interrompue",
      ),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Ouvrir le test préparé" }),
    );
    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith("/app/tentatives/resumed"),
    );
    expect(api).toHaveBeenCalledTimes(3);
  });
  it("valide le sujet libre OpenAI et rend la panne IA visible", async () => {
    mocks.data.set("/learning/config", {
      ...config,
      provider: "openai",
      mockTopics: [],
    });
    vi.mocked(api).mockRejectedValue(new Error("Fournisseur indisponible"));
    render(<DiagnosticForm />);
    fireEvent.change(screen.getByLabelText("Sujet à explorer"), {
      target: { value: "a" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Lancer mon diagnostic" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Précisez votre sujet");
    fireEvent.change(screen.getByLabelText("Sujet à explorer"), {
      target: { value: "Les molécules" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Lancer mon diagnostic" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Fournisseur indisponible",
      ),
    );
    expect(mocks.reload).toHaveBeenCalled();
  });
  it("empêche la génération lorsque le quota est épuisé", () => {
    mocks.data.set("/learning/config", { ...config, remaining: 0 });
    render(<DiagnosticForm />);
    expect(
      screen.getByRole("button", { name: "Lancer mon diagnostic" }),
    ).toBeDisabled();
  });
  it("sauvegarde les réponses, exige confirmation et affiche le résultat serveur", async () => {
    mocks.data.set("/attempts/attempt", draft);
    vi.mocked(api).mockImplementation(async (path) =>
      path.endsWith("/submit") ? done : { saved: true },
    );
    vi.stubGlobal("scrollTo", vi.fn());
    render(<AttemptView id="attempt" />);
    const groups = screen.getAllByRole("group");
    for (const [index, group] of groups.entries())
      fireEvent.click(
        within(group).getAllByRole(index === 3 ? "checkbox" : "radio")[0],
      );
    const multiple = within(groups[3]).getAllByRole("checkbox");
    fireEvent.click(multiple[1]);
    fireEvent.click(multiple[1]);
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer mes réponses" }),
    );
    await waitFor(() =>
      expect(
        screen.getByText("Tes réponses sont sauvegardées.", { exact: false }),
      ).toBeVisible(),
    );
    expect(
      screen.getByRole("button", { name: "Soumettre et voir ma correction" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /J’ai vérifié/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Soumettre et voir ma correction" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          name: "Chaque réponse t’apprend quelque chose.",
        }),
      ).toBeVisible(),
    );
    expect(screen.getByText("60", { exact: true })).toBeVisible();
    vi.unstubAllGlobals();
  });
  it("affiche une panne de sauvegarde et de soumission sans perdre la sélection", async () => {
    mocks.data.set("/attempts/attempt", { ...draft, answers: done.answers });
    vi.mocked(api).mockRejectedValue(new Error("Sauvegarde interrompue"));
    render(<AttemptView id="attempt" />);
    fireEvent.click(screen.getAllByRole("radio")[1]);
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer mes réponses" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Sauvegarde interrompue",
      ),
    );
    vi.mocked(api)
      .mockResolvedValueOnce({ saved: true })
      .mockRejectedValueOnce(new Error("Soumission interrompue"));
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer mes réponses" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("checkbox", { name: /J’ai vérifié/ }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("checkbox", { name: /J’ai vérifié/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Soumettre et voir ma correction" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Soumission interrompue",
      ),
    );
  });
  it.each([0, 100])(
    "présente le résultat %s et ses notions sans faux score",
    (score) => {
      mocks.data.set("/attempts/attempt", {
        ...done,
        score,
        quiz: { ...quiz, provider: "openai" },
        result: {
          ...done.result,
          score,
          mastered: score ? ["Membrane"] : [],
          weak: score ? [] : ["Membrane"],
        },
      });
      render(<AttemptView id="attempt" />);
      expect(
        screen.getByRole("heading", { name: "Le mini-cours pour consolider" }),
      ).toBeVisible();
      expect(screen.getByText("Contenu généré par IA")).toBeVisible();
    },
  );
  it("pagine l’historique et rend l’état vide", () => {
    mocks.data.set("/attempts", {
      items: [history],
      total: 12,
      page: 1,
      pageSize: 5,
    });
    const view = render(<HistoryView />);
    fireEvent.click(screen.getByRole("button", { name: "Suivant" }));
    expect(screen.getByText(/Page 2 sur 3/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Précédent" }));
    mocks.data.set("/attempts", { items: [], total: 0, page: 1, pageSize: 5 });
    view.rerender(<HistoryView />);
    expect(screen.getByText("Ton premier déclic t’attend")).toBeVisible();
  });
  it("crée un cours avec validation, erreur puis succès et pagination", async () => {
    mocks.data.set("/courses", {
      items: [
        {
          id: "c1",
          title: "Cours initial",
          content: "Texte pédagogique.",
          domain: "Sciences",
          source: "USER",
        },
      ],
      total: 8,
    });
    vi.mocked(api)
      .mockRejectedValueOnce(new Error("Enregistrement impossible"))
      .mockResolvedValueOnce({ id: "new" });
    render(<CoursesView />);
    fireEvent.click(screen.getByRole("button", { name: "Suivant" }));
    fireEvent.click(screen.getByRole("button", { name: "Précédent" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Créer un cours personnel" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer mon cours" }),
    );
    expect(screen.getByLabelText("Titre")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(
      screen.getByText("Indiquez un titre d’au moins 3 caractères."),
    ).toBeVisible();
    fireEvent.change(screen.getByLabelText("Titre"), {
      target: { value: "Mes cellules" },
    });
    fireEvent.change(screen.getByLabelText("Contenu du cours"), {
      target: { value: "La cellule est une unité du vivant." },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer mon cours" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Enregistrement impossible",
      ),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer mon cours" }),
    );
    await waitFor(() =>
      expect(screen.queryByLabelText("Titre")).not.toBeInTheDocument(),
    );
    expect(mocks.reload).toHaveBeenCalled();
  });
  it("présente les cours vides, éditoriaux et générés", () => {
    mocks.data.set("/courses", { items: [], total: 0 });
    const view = render(<CoursesView />);
    expect(
      screen.getByText("Tes premières idées prendront place ici"),
    ).toBeVisible();
    mocks.data.set("/courses", {
      items: [
        {
          id: "a",
          title: "Éditorial",
          domain: "Sciences",
          source: "ADMIN",
          content: "Contenu",
        },
        {
          id: "b",
          title: "Mini-cours",
          domain: "Langues",
          source: "AI",
          content: "Un autre contenu",
        },
      ],
      total: 2,
    });
    view.rerender(<CoursesView />);
    expect(screen.getByText("Ressource éditoriale")).toBeVisible();
    expect(screen.getByText("Mini-cours après diagnostic")).toBeVisible();
  });
  it("présente les chargements et les erreurs avec une reprise explicite", () => {
    const retry = vi.fn();
    render(
      <ResourceState loading error="Chargement impossible" retry={retry} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Chargement impossible",
    );
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(retry).toHaveBeenCalled();
  });
});
