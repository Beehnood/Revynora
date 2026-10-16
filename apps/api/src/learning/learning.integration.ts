import "reflect-metadata";
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { loadEnvironment } from "../shared/config/environment";
import { AppModule } from "../app.module";
import { configureApp } from "../shared/http/configure";
import { AiProvider, MockProvider, ProviderError } from "../ai/ai.provider";
import type { DiagnosticInput } from "../ai/ai.schema";
import type { Attempt, PublicQuiz, UserProfile } from "@revynora/types";
loadEnvironment();
const url = new URL(
  process.env.TEST_DATABASE_URL ??
    process.env.DATABASE_URL!.replace("/revynora?", "/revynora_test?"),
);
if (url.pathname !== "/revynora_test")
  throw new Error("Base de test dédiée revynora_test obligatoire");
process.env.DATABASE_URL = url.toString();
process.env.AI_PROVIDER = "mock";
process.env.WORKER_ENABLED = "false";
process.env.BILLING_PROVIDER = "mock";
process.env.AI_DAILY_LIMIT = "3";
process.env.AI_MAX_ATTEMPTS = "2";
let app: INestApplication, base: string, db: PrismaClient;
const ids: string[] = [];
const provider = new MockProvider();
let fail = false;
let generatedCalls = 0;
const fakeProvider = {
  name: "mock",
  async generate(input: DiagnosticInput) {
    generatedCalls++;
    if (fail) throw new ProviderError("AI_UNAVAILABLE", true);
    return provider.generate(input);
  },
};
const password = "Phase1-Integration!42";
let cookieA = "",
  cookieB = "",
  userA: UserProfile,
  userB: UserProfile;
let quiz: PublicQuiz;
let attemptId = "";
async function request<T = Record<string, unknown>>(
  path: string,
  method = "GET",
  data?: unknown,
  cookie = "",
  headers: Record<string, string> = {},
) {
  const response = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Revynora-Client": "web",
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const value = await response.json();
  return {
    status: response.status,
    data: value as T,
    cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "",
    headers: response.headers,
  };
}
async function register(label: string) {
  const result = await request<UserProfile>("/auth/register", "POST", {
    name: label,
    email: `phase1-${label}-${crypto.randomUUID()}@example.test`,
    password,
    termsAccepted: true,
  });
  expect(result.status).toBe(201);
  ids.push(result.data.id);
  return result;
}
beforeAll(async () => {
  db = new PrismaClient();
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(AiProvider)
    .useValue(fakeProvider)
    .compile();
  app = configureApp(module.createNestApplication({ logger: false }));
  await app.listen(0, "127.0.0.1");
  base = (await app.getUrl()) + "/api/v1";
  const a = await register("Alice");
  const b = await register("Bob");
  cookieA = a.cookie;
  cookieB = b.cookie;
  userA = a.data;
  userB = b.data;
});
afterAll(async () => {
  vi.restoreAllMocks();
  if (db) {
    await db.quiz.deleteMany({ where: { ownerId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  }
  if (app) await app.close();
});
describe.sequential("MVP sur PostgreSQL et HTTP réels", () => {
  it("crée FREE, hash et cookie HttpOnly ; normalise l’e-mail et protège les sessions", async () => {
    expect(userA.plan).toBe("FREE");
    expect(userA.role).toBe("STUDENT");
    expect(userA).not.toHaveProperty("passwordHash");
    const row = await db.user.findUniqueOrThrow({ where: { id: userA.id } });
    expect(row.passwordHash).not.toBe(password);
    expect((await request("/users/me")).status).toBe(401);
    expect(
      (await request("/users/me", "GET", undefined, cookieA)).data.id,
    ).toBe(userA.id);
    const login = await request("/auth/login", "POST", {
      email: userA.email.toUpperCase(),
      password,
    });
    expect(login.status).toBe(201);
    expect(login.headers.get("set-cookie")).toContain("HttpOnly");
    expect(login.headers.get("set-cookie")).toContain("SameSite=Lax");
    expect(login.headers.get("cache-control")).toBe("no-store");
    expect(
      (
        await request("/auth/login", "POST", {
          email: userA.email,
          password: "IncorrectPassword!42",
        })
      ).data.message,
    ).toBe("E-mail ou mot de passe incorrect.");
    expect(
      (
        await request("/auth/register", "POST", {
          name: "Alice",
          email: userA.email.toUpperCase(),
          password,
          termsAccepted: true,
        })
      ).status,
    ).toBe(409);
  });
  it("refuse CSRF, sur-attribution des droits et données invalides", async () => {
    expect(
      (
        await request(
          "/auth/register",
          "POST",
          { name: "X", email: "a@b.test", password },
          "",
          { "X-Revynora-Client": "" },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await request("/auth/login", "POST", {}, "", {
          Origin: "https://evil.example",
        })
      ).status,
    ).toBe(403);
    const invalid = await request("/auth/register", "POST", {
      name: "Admin",
      email: "x@example.test",
      password,
      role: "ADMIN",
      plan: "FREE",
    });
    expect(invalid.status).toBe(400);
    expect(invalid.data).toHaveProperty("requestId");
    expect(invalid.data.code).toBe("VALIDATION");
    expect(
      (await request("/attempts/not-a-uuid", "GET", undefined, cookieA)).status,
    ).toBe(400);
    await db.user.update({ where: { id: userB.id }, data: { role: "ADMIN" } });
    expect(
      (await request("/learning/summary", "GET", undefined, cookieB)).status,
    ).toBe(403);
    await db.user.update({
      where: { id: userB.id },
      data: { role: "STUDENT" },
    });
  });
  it("génère exactement cinq questions sans solution, justification ou mini-cours avant soumission", async () => {
    const generated = await request<PublicQuiz>(
      "/quizzes/diagnostic",
      "POST",
      { domain: "Sciences", topic: "Les cellules", level: "Débutant" },
      cookieA,
    );
    expect(generated.status).toBe(201);
    quiz = generated.data;
    expect(quiz.questions).toHaveLength(5);
    const raw = JSON.stringify(quiz);
    expect(raw).not.toContain("correct");
    expect(raw).not.toContain("explanation");
    expect(raw).not.toContain("miniCourse");
    const drafts = await Promise.all([
      request(`/quizzes/${quiz.id}/attempts`, "POST", undefined, cookieA),
      request(`/quizzes/${quiz.id}/attempts`, "POST", undefined, cookieA),
    ]);
    expect(drafts[0].data.id).toBe(drafts[1].data.id);
    attemptId = drafts[0].data.id as string;
    const draft = await request(
      `/attempts/${attemptId}`,
      "GET",
      undefined,
      cookieA,
    );
    expect(draft.data.result).toBeNull();
    expect(
      JSON.stringify(
        (await request("/courses", "GET", undefined, cookieA)).data,
      ),
    ).not.toContain("Comprendre : Les cellules");
  });
  it("isole ressources et cours de deux étudiants", async () => {
    expect(
      (await request(`/quizzes/${quiz.id}`, "GET", undefined, cookieB)).status,
    ).toBe(404);
    expect(
      (
        await request(
          `/quizzes/${quiz.id}/attempts`,
          "POST",
          undefined,
          cookieB,
        )
      ).status,
    ).toBe(404);
    expect(
      (await request(`/attempts/${attemptId}`, "GET", undefined, cookieB))
        .status,
    ).toBe(404);
    expect(
      (
        await request(
          `/attempts/${attemptId}/submit`,
          "POST",
          undefined,
          cookieB,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await request(
          `/attempts/${attemptId}/answers/${quiz.questions[0].id}`,
          "PUT",
          { selectedOptionIds: [quiz.questions[0].options[0].id] },
          cookieB,
        )
      ).status,
    ).toBe(404);
    const course = await request(
      "/courses",
      "POST",
      {
        title: "Note privée Alice",
        domain: "Sciences",
        content: "Une explication réservée à Alice.",
      },
      cookieA,
    );
    expect(course.status).toBe(201);
    expect(
      JSON.stringify(
        (await request("/courses", "GET", undefined, cookieB)).data,
      ),
    ).not.toContain("Note privée Alice");
  });
  it("sauvegarde, efface une sélection et refuse les options étrangères et la soumission incomplète", async () => {
    expect(
      (
        await request(
          `/attempts/${attemptId}/submit`,
          "POST",
          undefined,
          cookieA,
        )
      ).status,
    ).toBe(409);
    const first = quiz.questions[0];
    const bad = await request(
      `/attempts/${attemptId}/answers/${first.id}`,
      "PUT",
      { selectedOptionIds: [quiz.questions[1].options[0].id] },
      cookieA,
    );
    expect(bad.status).toBe(400);
    await request(
      `/attempts/${attemptId}/answers/${first.id}`,
      "PUT",
      { selectedOptionIds: [first.options[0].id] },
      cookieA,
    );
    const resume = await request<Attempt>(
      `/attempts/${attemptId}`,
      "GET",
      undefined,
      cookieA,
    );
    expect(resume.data.answers[0].selectedOptionIds).toEqual([
      first.options[0].id,
    ]);
    expect(
      (
        await request(
          `/attempts/${attemptId}/answers/${first.id}`,
          "PUT",
          { selectedOptionIds: [] },
          cookieA,
        )
      ).status,
    ).toBe(200);
    expect(
      (await request(`/attempts/${attemptId}`, "GET", undefined, cookieA)).data
        .answers,
    ).toHaveLength(0);
  });
  it("corrige de façon déterministe et atomique malgré deux soumissions simultanées", async () => {
    const stored = await db.question.findMany({
      where: { quizId: quiz.id },
      orderBy: { position: "asc" },
      include: { options: true },
    });
    for (const [index, q] of stored.entries()) {
      const options =
        index < 3
          ? q.options.filter((o) => o.correct)
          : q.options.filter((o) => !o.correct).slice(0, 1);
      expect(
        (
          await request(
            `/attempts/${attemptId}/answers/${q.id}`,
            "PUT",
            { selectedOptionIds: options.map((o) => o.id) },
            cookieA,
          )
        ).status,
      ).toBe(200);
    }
    const [a, b] = await Promise.all([
      request(`/attempts/${attemptId}/submit`, "POST", undefined, cookieA),
      request(`/attempts/${attemptId}/submit`, "POST", undefined, cookieA),
    ]);
    expect(a.status).toBe(201);
    expect(b.data).toEqual(a.data);
    const result = a.data as Attempt;
    expect(result.score).toBe(60);
    expect(result.result!.weak).toHaveLength(2);
    expect(result.result!.miniCourse).toContain("cellule");
    expect(result.result!.questions[0]).toHaveProperty("correctOptionIds");
    expect(
      (
        await request(
          `/attempts/${attemptId}/answers/${quiz.questions[0].id}`,
          "PUT",
          { selectedOptionIds: [] },
          cookieA,
        )
      ).status,
    ).toBe(409);
    expect(await db.answer.count({ where: { attemptId } })).toBe(5);
    expect(
      JSON.stringify(
        (await request("/courses", "GET", undefined, cookieA)).data,
      ),
    ).toContain("Comprendre : Les cellules");
    const summary = await request(
      "/learning/summary",
      "GET",
      undefined,
      cookieA,
    );
    expect(summary.data).toMatchObject({
      completed: 1,
      lastScore: 60,
      average: 60,
    });
    const history = await request(
      "/attempts?page=1&pageSize=1",
      "GET",
      undefined,
      cookieA,
    );
    expect(history.data.total).toBe(1);
    expect(history.data.items).toHaveLength(1);
    expect(
      (await request("/attempts?page=2&pageSize=1", "GET", undefined, cookieA))
        .data.items,
    ).toHaveLength(0);
  });
  it("borne les retries, trace l’erreur sans prompt et ne crée aucun quiz en échec", async () => {
    fail = true;
    generatedCalls = 0;
    const result = await request(
      "/quizzes/diagnostic",
      "POST",
      { domain: "Sciences", topic: "Les cellules", level: "Débutant" },
      cookieB,
    );
    fail = false;
    expect(result.status).toBe(503);
    expect(generatedCalls).toBe(2);
    expect(await db.quiz.count({ where: { ownerId: userB.id } })).toBe(0);
    const usage = await db.aIUsage.findFirstOrThrow({
      where: { userId: userB.id },
    });
    expect(usage).toMatchObject({
      status: "ERROR",
      errorCode: "AI_UNAVAILABLE",
      attempts: 2,
    });
    expect(usage).not.toHaveProperty("prompt");
  });
  it("réserve le quota en transaction face aux générations concurrentes", async () => {
    const calls = await Promise.all(
      Array.from({ length: 4 }, () =>
        request(
          "/quizzes/diagnostic",
          "POST",
          { domain: "Sciences", topic: "Les cellules", level: "Débutant" },
          cookieA,
        ),
      ),
    );
    expect(calls.filter((r) => r.status === 201)).toHaveLength(2);
    expect(calls.filter((r) => r.status === 429)).toHaveLength(2);
    expect(
      (await request("/learning/config", "GET", undefined, cookieA)).data
        .remaining,
    ).toBe(0);
    expect(await db.aIUsage.count({ where: { userId: userA.id } })).toBe(3);
  });
  it("rejette le sujet mock non pris en charge sans retry ni succès fictif", async () => {
    generatedCalls = 0;
    const failure = await request(
      "/quizzes/diagnostic",
      "POST",
      { domain: "Sciences", topic: "Sujet inconnu", level: "Débutant" },
      cookieB,
    );
    expect(failure.status).toBe(400);
    expect(failure.data.code).toBe("MOCK_TOPIC_UNSUPPORTED");
    expect(generatedCalls).toBe(1);
    expect(
      (
        await request(
          "/courses",
          "POST",
          { title: "x", domain: "Sciences", content: "court" },
          cookieA,
        )
      ).status,
    ).toBe(400);
    expect(
      (await request("/users/me", "GET", undefined, "revynora_session=bad"))
        .status,
    ).toBe(401);
  });
  it("expire et révoque les sessions ; expose le contrat OpenAPI", async () => {
    await db.session.updateMany({
      where: { userId: userB.id },
      data: { expiresAt: new Date(0) },
    });
    expect(
      (await request("/learning/summary", "GET", undefined, cookieB)).status,
    ).toBe(401);
    const login = await request("/auth/login", "POST", {
      email: userB.email,
      password,
    });
    expect(login.status).toBe(201);
    expect(
      (await request("/auth/logout", "POST", undefined, login.cookie)).status,
    ).toBe(201);
    expect(
      (await request("/users/me", "GET", undefined, login.cookie)).status,
    ).toBe(401);
    const doc = await request("/openapi.json");
    expect(doc.status).toBe(200);
    expect(doc.data.paths).toHaveProperty("/api/v1/quizzes/diagnostic");
    expect(JSON.stringify(doc.data.paths)).not.toContain('"$schema"');
  });
  it("limite les tentatives d’authentification répétées", async () => {
    let status = 0;
    for (let index = 0; index < 22; index++)
      status = (
        await request("/auth/login", "POST", {
          email: "missing@example.test",
          password,
        })
      ).status;
    expect(status).toBe(429);
  });
});
