import "reflect-metadata";
import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { AppModule } from "../app.module";
import { configureApp } from "../shared/http/configure";
import { DocumentAi } from "./document-ai";
import { textPdf } from "./pdf.fixture";
import { diagnosticFixture, quizAnalysis, quizPages } from "./pdf-quiz.fixture";
import { validatePdfQuiz } from "./pdf-quiz.schema";
import type { DocumentPages } from "./document.schema";
import { ApiError } from "../shared/http/errors";
const raw = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (
  !raw ||
  new URL(raw).pathname !== "/revynora_test" ||
  !["localhost", "127.0.0.1"].includes(new URL(raw).hostname)
)
  throw Error("Isolated local revynora_test required");
process.env.DATABASE_URL = raw;
process.env.WORKER_ENABLED = "false";
process.env.AI_PROVIDER = "mock";
process.env.BILLING_PROVIDER = "mock";
process.env.MAIL_PROVIDER = "local";
process.env.COOKIE_SECURE = "false";
process.env.AI_DAILY_LIMIT = "10";
const db = new PrismaClient();
let app: INestApplication, base: string;
let available = true,
  fail = false,
  calls = 0;
let questionCount = 5;
let gate: Promise<void> | undefined;
const users: string[] = [];
const fake = {
  available: () => available,
  analyze: async () => quizAnalysis,
  diagnostic: async (pages: DocumentPages, analysis: unknown) => {
    calls++;
    if (gate) await gate;
    await new Promise((r) => setTimeout(r, 80));
    if (fail) throw new ApiError(503, "PDF_QUIZ_FAILED", "Synthetic failure");
    const value = diagnosticFixture();
    if (questionCount === 10)
      value.questions.push(
        ...value.questions.map((q) => ({
          ...q,
          text: q.text + " Et pour un autre cas ?",
        })),
      );
    return validatePdfQuiz(value, pages, analysis);
  },
};
async function req(
  path: string,
  cookie = "",
  method = "GET",
  body?: unknown,
  csrf = true,
) {
  const multipart = body instanceof FormData;
  const r = await fetch(base + path, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(csrf ? { "X-Revynora-Client": "web" } : {}),
      ...(!multipart && body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
    },
    body:
      body === undefined ? undefined : multipart ? body : JSON.stringify(body),
  });
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers.get("set-cookie")?.split(";")[0] ?? "",
  };
}
async function account() {
  const r = await req("/auth/register", "", "POST", {
    name: "PDF diagnostic fixture",
    email: `pdf-quiz-${crypto.randomUUID()}@example.test`,
    password: "Synthetic-quiz-test!42",
    termsAccepted: true,
  });
  expect(r.status).toBe(201);
  users.push(r.data.id);
  return { id: r.data.id, cookie: r.cookie };
}
async function document(cookie: string, analyze = true) {
  const f = new FormData();
  f.append(
    "file",
    new Blob(
      [
        new Uint8Array(
          textPdf(
            quizPages.map((p) => p.text),
            2,
          ),
        ),
      ],
      { type: "application/pdf" },
    ),
    "synthetic.pdf",
  );
  const r = await req("/documents", cookie, "POST", f);
  expect(r.status).toBe(201);
  if (analyze)
    expect(
      (await req(`/documents/${r.data.id}/analyze`, cookie, "POST")).status,
    ).toBe(201);
  return r.data.id as string;
}
beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DocumentAi)
    .useValue(fake)
    .compile();
  app = configureApp(mod.createNestApplication({ logger: false }));
  await app.listen(0, "127.0.0.1");
  base = (await app.getUrl()) + "/api/v1";
});
afterAll(async () => {
  for (const id of users) {
    const quizzes = await db.quiz.findMany({
      where: { ownerId: id },
      select: { courseId: true },
    });
    await db.quiz.deleteMany({ where: { ownerId: id } });
    await db.course.deleteMany({
      where: { id: { in: quizzes.map((q) => q.courseId) } },
    });
    await db.user.deleteMany({ where: { id } });
  }
  await app?.close();
  await db.$disconnect();
  vi.unstubAllEnvs();
});
it("generates from an extracted/analyzed PDF once, hides solutions, grades and preserves history until document deletion", async () => {
  const owner = await account(),
    other = await account();
  const id = await document(owner.cookie);
  expect((await req(`/documents/${id}/quiz`, "", "POST")).status).toBe(401);
  expect(
    (await req(`/documents/${id}/quiz`, other.cookie, "POST")).status,
  ).toBe(404);
  expect(
    (await req(`/documents/${id}/quiz`, owner.cookie, "POST", undefined, false))
      .status,
  ).toBe(403);
  expect(
    (await req(`/documents/${id}/quiz-attempts`, other.cookie)).status,
  ).toBe(404);
  const start = calls;
  const pair = await Promise.all([
    req(`/documents/${id}/quiz`, owner.cookie, "POST"),
    req(`/documents/${id}/quiz`, owner.cookie, "POST"),
  ]);
  expect(pair.map((r) => r.status).sort()).toEqual([201, 409]);
  expect(calls - start).toBe(1);
  const quizId = pair.find((r) => r.status === 201)!.data.id;
  expect(
    (await req(`/documents/${id}/quiz`, owner.cookie, "POST")).data.id,
  ).toBe(quizId);
  expect(calls - start).toBe(1);
  const quiz = await req(`/quizzes/${quizId}`, owner.cookie);
  expect(quiz.data.questions).toHaveLength(5);
  expect(JSON.stringify(quiz.data)).not.toMatch(
    /correct|explanation|sourceQuote/,
  );
  const attempts = await Promise.all([
    req(`/quizzes/${quizId}/attempts`, owner.cookie, "POST", { mode: "TEST" }),
    req(`/quizzes/${quizId}/attempts`, owner.cookie, "POST", { mode: "TEST" }),
  ]);
  const aid = attempts[0].data.id;
  expect(attempts[1].data.id).toBe(aid);
  expect((await req(`/attempts/${aid}`, owner.cookie)).data.result).toBe(null);
  expect((await req(`/attempts/${aid}`, other.cookie)).status).toBe(404);
  const stored = await db.question.findMany({
    where: { quizId },
    include: { options: true },
    orderBy: { position: "asc" },
  });
  expect(
    (await req(`/attempts/${aid}/submit`, owner.cookie, "POST")).status,
  ).toBe(409);
  for (const [i, q] of stored.entries()) {
    const option = q.options.find((o) => (i === 0 ? !o.correct : o.correct))!;
    expect(
      (
        await req(`/attempts/${aid}/answers/${q.id}`, owner.cookie, "PUT", {
          selectedOptionIds: [option.id],
        })
      ).status,
    ).toBe(200);
  }
  const submitted = await Promise.all([
    req(`/attempts/${aid}/submit`, owner.cookie, "POST"),
    req(`/attempts/${aid}/submit`, owner.cookie, "POST"),
  ]);
  for (const r of submitted) {
    expect(r.status).toBe(201);
    expect(r.data.score).toBe(80);
    expect(r.data.result.weak).toContain("Membrane");
    expect(r.data.result.questions[0].reference).toEqual({
      page: 1,
      quote: quizPages[0].text,
    });
  }
  const date = (await db.quizAttempt.findUniqueOrThrow({ where: { id: aid } }))
    .submittedAt;
  expect(
    (
      await req(
        `/attempts/${aid}/answers/${stored[0].id}`,
        owner.cookie,
        "PUT",
        { selectedOptionIds: [] },
      )
    ).status,
  ).toBe(409);
  await req(`/attempts/${aid}/submit`, owner.cookie, "POST");
  expect(
    (await db.quizAttempt.findUniqueOrThrow({ where: { id: aid } }))
      .submittedAt,
  ).toEqual(date);
  expect(await db.answer.count({ where: { attemptId: aid } })).toBe(5);
  const second = await req(
    `/quizzes/${quizId}/attempts`,
    owner.cookie,
    "POST",
    { mode: "DISCOVER" },
  );
  expect(second.data.id).not.toBe(aid);
  expect(
    (await req(`/documents/${id}/quiz-attempts`, owner.cookie)).data.items,
  ).toHaveLength(2);
  const course = (await db.quiz.findUniqueOrThrow({ where: { id: quizId } }))
    .courseId;
  expect((await req(`/documents/${id}`, owner.cookie, "DELETE")).status).toBe(
    200,
  );
  expect((await req(`/quizzes/${quizId}`, owner.cookie)).status).toBe(404);
  expect((await req(`/attempts/${aid}`, owner.cookie)).status).toBe(404);
  expect(await db.quizAttempt.count({ where: { quizId } })).toBe(0);
  expect(await db.question.count({ where: { quizId } })).toBe(0);
  expect(await db.answer.count({ where: { attemptId: aid } })).toBe(0);
  expect(await db.course.count({ where: { id: course } })).toBe(0);
  expect(
    await db.aIUsage.count({
      where: { userId: owner.id, documentId: null, status: "SUCCESS" },
    }),
  ).toBe(1);
  expect(
    (await db.pdfDocument.findUniqueOrThrow({ where: { id } })).analysis,
  ).toBe(null);
});
it("requires completed analysis, does not charge an unavailable provider, and bounds failed generations", async () => {
  const owner = await account();
  const id = await document(owner.cookie, false);
  expect(
    (await req(`/documents/${id}/quiz`, owner.cookie, "POST")).status,
  ).toBe(409);
  await req(`/documents/${id}/analyze`, owner.cookie, "POST");
  available = false;
  expect(
    (await req(`/documents/${id}/quiz`, owner.cookie, "POST")).status,
  ).toBe(503);
  expect(await db.aIUsage.count({ where: { userId: owner.id } })).toBe(0);
  available = true;
  fail = true;
  for (let i = 0; i < 3; i++)
    expect(
      (await req(`/documents/${id}/quiz`, owner.cookie, "POST")).status,
    ).toBe(503);
  expect(
    (await req(`/documents/${id}/quiz`, owner.cookie, "POST")).status,
  ).toBe(429);
  expect(await db.quiz.count({ where: { documentId: id } })).toBe(0);
  expect(
    await db.aIUsage.count({ where: { documentId: id, status: "ERROR" } }),
  ).toBe(3);
  fail = false;
});

it("supports ten questions, reuses a saved quiz when offline, and bounds attempts without touching analysis quota", async () => {
  const owner = await account();
  const id = await document(owner.cookie);
  questionCount = 10;
  const generated = await req(`/documents/${id}/quiz`, owner.cookie, "POST");
  questionCount = 5;
  expect(generated.status).toBe(201);
  const quizId = generated.data.id;
  available = false;
  expect(
    (await req(`/documents/${id}/quiz`, owner.cookie, "POST")).data.id,
  ).toBe(quizId);
  available = true;
  expect((await req("/documents/config", owner.cookie)).data.used).toBe(1);
  const started = await req(
    `/quizzes/${quizId}/attempts`,
    owner.cookie,
    "POST",
    { mode: "DISCOVER" },
  );
  const aid = started.data.id;
  const questions = await db.question.findMany({
    where: { quizId },
    include: { options: true },
  });
  expect(questions).toHaveLength(10);
  for (const q of questions)
    await req(`/attempts/${aid}/answers/${q.id}`, owner.cookie, "PUT", {
      selectedOptionIds: [q.options.find((o) => o.correct)!.id],
    });
  const result = await req(`/attempts/${aid}/submit`, owner.cookie, "POST");
  expect(result.data.score).toBe(100);
  expect(result.data.mode).toBe("DISCOVER");
  expect(result.data.result.corrected).toHaveLength(10);
  await db.quizAttempt.createMany({
    data: Array.from({ length: 19 }, () => ({
      userId: owner.id,
      quizId,
      submittedAt: new Date(),
      score: 100,
      mode: "TEST",
    })),
  });
  expect(
    (await req(`/quizzes/${quizId}/attempts`, owner.cookie, "POST")).status,
  ).toBe(429);
});
it("shares the existing daily AI limit and recovers an expired generation lease", async () => {
  const owner = await account();
  const id = await document(owner.cookie);
  await db.aIUsage.createMany({
    data: Array.from({ length: 10 }, () => ({
      userId: owner.id,
      provider: "fixture",
      status: "ERROR" as const,
    })),
  });
  const before = calls;
  expect(
    (await req(`/documents/${id}/quiz`, owner.cookie, "POST")).status,
  ).toBe(429);
  expect(calls).toBe(before);
  const next = await account();
  const doc = await document(next.cookie);
  const stale = await db.aIUsage.create({
    data: {
      userId: next.id,
      documentId: doc,
      provider: "fixture",
      createdAt: new Date(Date.now() - 360000),
    },
  });
  expect(
    (await req(`/documents/${doc}/quiz`, next.cookie, "POST")).status,
  ).toBe(201);
  expect(
    (await db.aIUsage.findUniqueOrThrow({ where: { id: stale.id } })).status,
  ).toBe("ERROR");
});
it("does not resurrect quiz content when a document is deleted during generation", async () => {
  const owner = await account();
  const id = await document(owner.cookie);
  let release!: () => void;
  gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const before = calls;
  const pending = req(`/documents/${id}/quiz`, owner.cookie, "POST");
  try {
    await vi.waitFor(() => expect(calls).toBe(before + 1));
    expect((await req(`/documents/${id}`, owner.cookie, "DELETE")).status).toBe(
      200,
    );
  } finally {
    release();
    gate = undefined;
  }
  expect((await pending).status).toBe(409);
  expect(await db.quiz.count({ where: { documentId: id } })).toBe(0);
  expect(await db.course.count({ where: { ownerId: owner.id } })).toBe(0);
  expect(
    (await db.pdfDocument.findUniqueOrThrow({ where: { id } })).pages,
  ).toBe(null);
});
