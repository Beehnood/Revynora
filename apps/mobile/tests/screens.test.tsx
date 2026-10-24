import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react-native";
import { AuthScreen } from "../src/screens/auth";
import { ProgressScreen, SubscriptionScreen } from "../src/screens/account";
import { LeitnerScreen } from "../src/screens/leitner";
import { api, session } from "../src/api";
const records = new Map<string, unknown>();
jest.mock("../src/api", () => ({
  api: jest.fn(),
  session: {
    authenticate: jest.fn(),
    logout: jest.fn(),
    refreshUser: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (fn: () => void) => require("react").useEffect(fn, [fn]),
}));
const mocked = jest.mocked(api);
beforeEach(() => {
  jest.clearAllMocks();
  records.clear();
  mocked.mockImplementation(async (path) => records.get(path) as never);
});
test("native login validates input and never exposes password by default", async () => {
  jest.mocked(session.authenticate).mockResolvedValue(undefined);
  await render(<AuthScreen />);
  await fireEvent.changeText(
    screen.getByLabelText("Adresse e-mail"),
    "emma@example.test",
  );
  const password = screen.getByLabelText("Mot de passe");
  expect(password.props.secureTextEntry).toBe(true);
  await fireEvent.changeText(password, "A-long-password!2026");
  await fireEvent.press(screen.getByRole("button", { name: "Me connecter" }));
  await waitFor(() =>
    expect(session.authenticate).toHaveBeenCalledWith("login", {
      email: "emma@example.test",
      password: "A-long-password!2026",
    }),
  );
});
test("registration requires explicit terms acceptance", async () => {
  await render(<AuthScreen />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Créer un compte" }),
  );
  await fireEvent.changeText(screen.getByLabelText("Prénom"), "Emma");
  await fireEvent.changeText(
    screen.getByLabelText("Adresse e-mail"),
    "emma@example.test",
  );
  await fireEvent.changeText(
    screen.getByLabelText("Mot de passe"),
    "A-long-password!2026",
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Créer mon compte gratuit" }),
  );
  await screen.findByRole("alert");
  expect(session.authenticate).not.toHaveBeenCalled();
});
test("actual progression data and empty states render accessibly", async () => {
  records.set("/progress", {
    totalReviews: 0,
    completedQuizzes: 0,
    averageScore: null,
    successRate: null,
    revisionSeconds: 0,
    timedReviews: 0,
    boxes: [{ box: 1, count: 0 }],
    scores: [],
    subjects: [],
    weekly: [],
    monthly: [],
    activity: [],
  });
  await render(<ProgressScreen />);
  await screen.findByText("Aucune activité enregistrée.");
  expect(screen.getByText("Boîte 1 : 0 cartes actives")).toBeTruthy();
});
test("subscription screen is informational without a payment action", async () => {
  records.set("/subscriptions/me", {
    plan: "FREE",
    period: null,
    mode: "simulation",
  });
  await render(<SubscriptionScreen />);
  await screen.findByText("FREE");
  expect(screen.getByText(/aucun prélèvement/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Acheter/ })).toBeNull();
});
test("Leitner requires revelation before remembering and records an idempotent request after revelation", async () => {
  const card = {
    id: "card",
    front: "Question",
    back: "Réponse",
    box: 1,
    version: 0,
    dueAt: "2026-10-17",
    courseId: null,
  };
  records.set("/leitner/cards?page=1", {
    items: [card],
    total: 1,
    page: 1,
    pageSize: 100,
  });
  records.set("/leitner/cards/due", {
    items: [card],
    total: 1,
    page: 1,
    pageSize: 100,
  });
  records.set("/leitner/stats", {
    boxes: [],
    intervals: [1, 3, 7, 14, 30],
    totalReviews: 0,
    recent: [],
  });
  await render(<LeitnerScreen />);
  await screen.findByText("Question");
  await fireEvent.press(
    screen.getByRole("button", { name: "Commencer une révision" }),
  );
  expect(screen.queryByText("Réponse")).toBeNull();
  await fireEvent.press(
    screen.getByRole("button", { name: "Révéler la réponse" }),
  );
  expect(screen.getByText("Réponse")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Je savais" }));
  await screen.findByText("Séance terminée ! Tes échéances sont enregistrées.");
  expect(mocked).toHaveBeenCalledWith(
    "/leitner/cards/card/review",
    expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"remembered":true'),
    }),
  );
});

jest.mock("expo-crypto", () => ({
  randomUUID: () => "12345678-1234-4234-8234-123456789012",
}));
test("native course creation validates and writes through the central API", async () => {
  const { CoursesScreen } = require("../src/screens/learning");
  records.set("/courses?page=1", {
    items: [],
    total: 0,
    page: 1,
    pageSize: 10,
  });
  await render(<CoursesScreen navigation={{ navigate: jest.fn() }} />);
  await screen.findByText("Aucun cours pour le moment.");
  await fireEvent.changeText(
    screen.getByLabelText("Titre du cours"),
    "Biologie cellulaire",
  );
  await fireEvent.changeText(
    screen.getByLabelText("Contenu"),
    "Une cellule possède une membrane et du cytoplasme.",
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Enregistrer le cours" }),
  );
  await screen.findByText("Cours enregistré.");
  expect(mocked).toHaveBeenCalledWith(
    "/courses",
    expect.objectContaining({
      method: "POST",
      body: expect.stringContaining("Biologie cellulaire"),
    }),
  );
});
test("diagnostic creates a server quiz then opens its resumable attempt", async () => {
  const { DiagnosticScreen } = require("../src/screens/learning");
  records.set("/learning/config", { provider: "mock", remaining: 10 });
  const replace = jest.fn();
  mocked.mockImplementation(async (path, options) => {
    if (path === "/quizzes/diagnostic") return { id: "quiz" } as never;
    if (path === "/quizzes/quiz/attempts") return { id: "attempt" } as never;
    return records.get(path) as never;
  });
  await render(<DiagnosticScreen navigation={{ replace }} />);
  await screen.findByText(/Mode démonstration/);
  await fireEvent.press(
    screen.getByRole("button", { name: "Lancer mon diagnostic" }),
  );
  await waitFor(() =>
    expect(replace).toHaveBeenCalledWith("Attempt", { id: "attempt" }),
  );
});
test("native QCM conceals correction, persists answers then requires submission confirmation", async () => {
  const { AttemptScreen } = require("../src/screens/learning");
  const attempt = {
    id: "attempt",
    startedAt: "2026-10-17",
    submittedAt: null,
    score: null,
    answers: [],
    result: null,
    quiz: {
      topic: "Cellule",
      provider: "mock",
      questions: [
        {
          id: "question",
          text: "Quelle structure ?",
          type: "SINGLE",
          options: [{ id: "option", text: "Membrane" }],
        },
      ],
    },
  };
  records.set("/attempts/attempt", attempt);
  await render(<AttemptScreen route={{ params: { id: "attempt" } }} />);
  await screen.findByText("1. Quelle structure ?");
  expect(screen.queryByText("Ton mini-cours")).toBeNull();
  await fireEvent.press(screen.getByRole("radio", { name: "Membrane" }));
  await fireEvent.press(
    screen.getByRole("button", { name: "Enregistrer mes réponses" }),
  );
  await screen.findByText("Tes réponses sont sauvegardées.");
  await fireEvent.press(
    screen.getByRole("button", { name: "Terminer et vérifier mes réponses" }),
  );
  expect(mocked.mock.calls.some(([p]) => p.endsWith("/submit"))).toBe(false);
  await fireEvent.press(
    screen.getByRole("button", { name: "Je confirme la soumission" }),
  );
  await waitFor(() =>
    expect(mocked).toHaveBeenCalledWith("/attempts/attempt/submit", {
      method: "POST",
    }),
  );
});
test("planning preview stays unpersisted until explicit confirmation", async () => {
  const { PlanningScreen } = require("../src/screens/planning");
  records.set("/study-plans", { items: [], total: 0 });
  records.set("/courses?pageSize=20", { items: [], total: 0 });
  records.set("/study-availability", [
    { id: "slot", startsAt: "2027-01-02T10:00Z", endsAt: "2027-01-02T12:00Z" },
  ]);
  const proposal = {
    title: "Mon programme IA",
    rationale: "Des cartes dues",
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
  mocked.mockImplementation(async (path) =>
    path.startsWith("/study-plans?")
      ? ({ items: [], total: 0 } as never)
      : path === "/study-plans/ai/propose"
        ? ({ proposal, provider: "mock" } as never)
        : (records.get(path) as never),
  );
  await render(<PlanningScreen />);
  await screen.findByText("Aucune séance sur cette période.");
  await fireEvent.press(
    screen.getByRole("button", { name: "Proposer un planning IA" }),
  );
  await screen.findByText("Mon programme IA");
  expect(mocked.mock.calls.some(([p]) => p.endsWith("/confirm"))).toBe(false);
  await fireEvent.press(
    screen.getByRole("button", { name: "Confirmer ce planning" }),
  );
  await screen.findByText("Planning confirmé et enregistré.");
  expect(mocked).toHaveBeenCalledWith(
    "/study-plans/ai/confirm",
    expect.objectContaining({
      body: expect.stringContaining(
        '"requestId":"12345678-1234-4234-8234-123456789012"',
      ),
    }),
  );
});

test("dashboard navigation and course detail use the current student context", async () => {
  const {
    HomeScreen,
    CourseScreen,
    Pagination,
  } = require("../src/screens/learning");
  const { AuthContext } = require("../src/auth-context");
  const navigate = jest.fn();
  records.set("/learning/summary", {
    completed: 2,
    average: 80,
    weak: ["Fractions"],
  });
  await render(
    <AuthContext.Provider
      value={{
        id: "u",
        name: "Emma",
        email: "e@example.test",
        role: "STUDENT",
        plan: "PLUS",
        createdAt: "2026-10-17",
      }}
    >
      <HomeScreen navigation={{ navigate }} />
    </AuthContext.Provider>,
  );
  await screen.findByText(/2 tests terminés/);
  for (const label of [
    "Nouveau diagnostic",
    "Mes cours",
    "Mes tests et résultats",
    "Révisions Leitner",
    "Mon planning",
    "Ma progression",
    "Profil et paramètres",
    "Mon abonnement",
  ])
    await fireEvent.press(screen.getByRole("button", { name: label }));
  expect(navigate).toHaveBeenCalledTimes(8);
});
test("profile opt-in is explicit and saved on the server", async () => {
  const { ProfileScreen } = require("../src/screens/account");
  const { AuthContext } = require("../src/auth-context");
  records.set("/notifications/preferences", {
    timeZone: "Europe/Paris",
    remindersEnabled: false,
  });
  await render(
    <AuthContext.Provider
      value={{
        id: "u",
        name: "Emma",
        email: "e@example.test",
        role: "STUDENT",
        plan: "PRO",
        createdAt: "2026-10-17",
      }}
    >
      <ProfileScreen />
    </AuthContext.Provider>,
  );
  await screen.findByText("Paramètres et rappels");
  await fireEvent.changeText(screen.getByLabelText("Fuseau horaire"), "UTC");
  await fireEvent(
    screen.getByLabelText("Activer les rappels avec mon consentement"),
    "valueChange",
    true,
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Enregistrer mes préférences" }),
  );
  await screen.findByText("Préférences enregistrées.");
  expect(mocked).toHaveBeenCalledWith(
    "/notifications/preferences",
    expect.objectContaining({
      body: JSON.stringify({ timeZone: "UTC", enabled: true }),
    }),
  );
});
test("progression presents populated scores and monthly activity without mock metrics", async () => {
  records.set("/progress", {
    totalReviews: 2,
    completedQuizzes: 1,
    averageScore: 80,
    successRate: 50,
    revisionSeconds: 120,
    timedReviews: 2,
    boxes: [{ box: 2, count: 1 }],
    scores: [{ date: "2026-10-17", score: 80, subject: "Maths" }],
    subjects: [
      { subject: "Maths", averageScore: 80, latestScore: 80, reviews: 2 },
    ],
    weekly: [],
    monthly: [{ date: "2026-10-17", reviews: 2, quizzes: 1 }],
    activity: [
      { kind: "QUIZ", id: "a", date: "2026-10-17", title: "Fractions · 80 %" },
    ],
  });
  await render(<ProgressScreen />);
  await screen.findByText(/Fractions · 80 %/);
  await fireEvent.press(screen.getByRole("radio", { name: "30 jours" }));
  expect(screen.getByText("2026-10-17 · 2 révisions · 1 QCM")).toBeTruthy();
});
