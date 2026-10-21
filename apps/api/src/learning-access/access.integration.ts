/* eslint-disable @typescript-eslint/no-explicit-any -- HTTP integration assertions inspect JSON. */
import "reflect-metadata";
import { beforeAll, afterAll, it, expect } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { AppModule } from "../app.module";
import { configureApp } from "../shared/http/configure";
import { ReminderWorker } from "../notifications/infrastructure/reminder.worker";
const raw = process.env.TEST_DATABASE_URL;
if (!raw) throw new Error("TEST_DATABASE_URL explicite obligatoire");
const url = new URL(raw);
if (
  url.pathname !== "/revynora_test" ||
  !["127.0.0.1", "localhost"].includes(url.hostname) ||
  process.env.G8_ISOLATED_TEST_DB !== "true"
)
  throw new Error("Base G8 isolée requise");
process.env.DATABASE_URL = raw;
process.env.WORKER_ENABLED = "false";
process.env.MAIL_PROVIDER = "local";
process.env.AI_PROVIDER = "mock";
process.env.BILLING_PROVIDER = "mock";
process.env.AI_DAILY_LIMIT = "3";
let app: INestApplication, db: PrismaClient, base: string;
let owner: any,
  other: any,
  student: any,
  grantId: string,
  quizId: string,
  cardId: string;
const ids: string[] = [];
const password = "G8-Isolated-Fixture!42";
async function req(
  path: string,
  method = "GET",
  body?: unknown,
  cookie = "",
  extra = {},
) {
  const response = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Revynora-Client": "web",
      cookie,
      ...extra,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return {
    status: response.status,
    data: (await response.json()) as any,
    cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "",
  };
}
async function account(role: "ADMIN" | "STUDENT") {
  const email = "g8-" + crypto.randomUUID() + "@example.test";
  const result = await req("/auth/register", "POST", {
    email,
    name: "G8 test",
    password,
    termsAccepted: true,
  });
  expect(result.status).toBe(201);
  ids.push(result.data.id);
  if (role === "ADMIN")
    await db.user.update({ where: { id: result.data.id }, data: { role } });
  return { id: result.data.id, email, cookie: result.cookie };
}
beforeAll(async () => {
  db = new PrismaClient();
  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = configureApp(
    module.createNestApplication({ logger: false, rawBody: true }),
  );
  await app.listen(0, "127.0.0.1");
  base = (await app.getUrl()) + "/api/v1";
  owner = await account("ADMIN");
  other = await account("ADMIN");
  student = await account("STUDENT");
});
afterAll(async () => {
  if (db) {
    const items = await db.studyPlanItem.findMany({
      where: { plan: { userId: { in: ids } } },
      select: { id: true },
    });
    await db.reminderDelivery.deleteMany({
      where: { itemId: { in: items.map((i) => i.id) } },
    });
    await db.auditLog.deleteMany({ where: { actorId: { in: ids } } });
    await db.internalLearningGrant.deleteMany({
      where: { userId: { in: ids } },
    });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  }
  await app?.close();
});
it("refuse ADMIN sans attribution, anonyme, usurpation étudiant et mutations commerciales ADMIN", async () => {
  expect((await req("/learning/summary")).status).toBe(401);
  expect(
    (await req("/learning/summary", "GET", undefined, owner.cookie)).status,
  ).toBe(403);
  expect(
    (await req("/learning/access", "GET", undefined, owner.cookie)).data,
  ).toMatchObject({ allowed: false, commercialPlan: "FREE", source: "NONE" });
  expect(
    (
      await req(
        "/admin/users/" + owner.id + "/learning-grants",
        "POST",
        {},
        student.cookie,
      )
    ).status,
  ).toBe(403);
  expect(
    (await req("/admin/metrics", "GET", undefined, student.cookie)).status,
  ).toBe(403);
  expect(
    (await req("/leitner/cards", "GET", undefined, student.cookie)).status,
  ).toBe(403);
  expect(
    (
      await req(
        "/billing/checkout-session",
        "POST",
        { plan: "PRO" },
        owner.cookie,
      )
    ).status,
  ).toBe(403);
});
it("attribue explicitement, refuse doublon/concurrence et ne crée aucun abonnement ou paiement", async () => {
  const input = {
    startsAt: new Date(Date.now() - 1000).toISOString(),
    provenance: "LOCAL_REVIEW",
    justification: "Attribution de recette isolée",
  };
  expect(
    (
      await req(
        "/admin/users/" + student.id + "/learning-grants",
        "POST",
        input,
        owner.cookie,
      )
    ).status,
  ).toBe(422);
  expect(
    (
      await req(
        "/admin/users/" + owner.id + "/learning-grants",
        "POST",
        { ...input, userId: student.id },
        owner.cookie,
      )
    ).status,
  ).toBe(400);
  const results = await Promise.all(
    [1, 2].map(() =>
      req(
        "/admin/users/" + owner.id + "/learning-grants",
        "POST",
        input,
        owner.cookie,
      ),
    ),
  );
  expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  grantId = results.find((r) => r.status === 201)!.data.id;
  expect(
    (await req("/learning/access", "GET", undefined, owner.cookie)).data,
  ).toMatchObject({
    allowed: true,
    effectivePlan: "PRO",
    commercialPlan: "FREE",
    source: "INTERNAL",
  });
  expect(
    await db.userSubscriptionHistory.count({
      where: { userId: owner.id, subscription: { code: { not: "FREE" } } },
    }),
  ).toBe(0);
  expect(await db.payment.count({ where: { userId: owner.id } })).toBe(0);
  expect(
    await db.auditLog.count({
      where: { entityId: grantId, action: "INTERNAL_LEARNING_GRANTED" },
    }),
  ).toBe(1);
  expect(
    (await req("/users/me", "GET", undefined, owner.cookie)).data.role,
  ).toBe("ADMIN");
  expect(
    (
      await req("/learning/summary", "GET", undefined, "", {
        Authorization: "Bearer " + owner.cookie.split("=")[1],
        "X-Revynora-Client": "mobile",
      })
    ).status,
  ).toBe(403);
  const history = await req(
    "/admin/users/" + owner.id + "/learning-grants",
    "GET",
    undefined,
    owner.cookie,
  );
  expect(history.status).toBe(200);
  expect(history.data.map((g: { id: string }) => g.id)).toEqual([grantId]);
  expect(
    (
      await req(
        "/admin/users/" + owner.id + "/learning-grants",
        "GET",
        undefined,
        student.cookie,
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await req(
        "/admin/users/" + owner.id + "/learning-grants?userId=" + student.id,
        "GET",
        undefined,
        owner.cookie,
      )
    ).status,
  ).toBe(400);
});
it("isole cours, diagnostics, tentatives et cartes ; maintient le quota IA en concurrence", async () => {
  const course = await req(
    "/courses",
    "POST",
    { title: "Cours privé G8", domain: "Sciences", content: "Contenu privé" },
    owner.cookie,
  );
  expect(course.status).toBe(201);
  expect(
    await db.course.findUnique({ where: { id: course.data.id } }),
  ).toMatchObject({ ownerId: owner.id, source: "USER" });
  const diagnostic = await req(
    "/quizzes/diagnostic",
    "POST",
    { topic: "Les cellules", domain: "Sciences", level: "Débutant" },
    owner.cookie,
  );
  expect(diagnostic.status).toBe(201);
  quizId = diagnostic.data.id;
  expect(
    (await req("/quizzes/" + quizId, "GET", undefined, student.cookie)).status,
  ).toBe(404);
  const attempt = await req(
    "/quizzes/" + quizId + "/attempts",
    "POST",
    {},
    owner.cookie,
  );
  expect(attempt.status).toBe(201);
  expect(
    (
      await req(
        "/attempts/" + attempt.data.id,
        "GET",
        undefined,
        student.cookie,
      )
    ).status,
  ).toBe(404);
  const quota = await Promise.all(
    Array.from({ length: 4 }, () =>
      req(
        "/quizzes/diagnostic",
        "POST",
        { topic: "Les cellules", domain: "Sciences", level: "Débutant" },
        owner.cookie,
      ),
    ),
  );
  expect(quota.filter((r) => r.status === 201)).toHaveLength(2);
  expect(quota.filter((r) => r.status === 429)).toHaveLength(2);
  const card = await req(
    "/leitner/cards",
    "POST",
    { front: "Question privée G8", back: "Réponse privée" },
    owner.cookie,
  );
  expect(card.status).toBe(201);
  cardId = card.data.id;
  const reviewed = await req(
    "/leitner/cards/" + cardId + "/review",
    "POST",
    {
      requestId: crypto.randomUUID(),
      version: card.data.version,
      remembered: true,
    },
    owner.cookie,
  );
  expect(reviewed.status).toBe(201);
  expect(
    (await req("/learning/summary", "GET", undefined, owner.cookie)).status,
  ).toBe(200);
  expect((await req("/progress", "GET", undefined, owner.cookie)).status).toBe(
    200,
  );
});
it("garde les règles commerciales des étudiants et les ressources privées séparées", async () => {
  for (const [code, priceCents] of [
    ["FREE", 0],
    ["PLUS", 250],
    ["PRO", 500],
  ] as const)
    await db.subscription.upsert({
      where: { code },
      create: { code, name: code, priceCents },
      update: {},
    });
  const checkout = await req(
    "/billing/checkout-session",
    "POST",
    { plan: "PRO" },
    student.cookie,
  );
  expect(checkout.status).toBe(201);
  expect(
    (
      await req(
        "/billing/mock-complete",
        "POST",
        { intentId: checkout.data.intentId, success: true },
        student.cookie,
      )
    ).status,
  ).toBe(201);
  expect(
    (await req("/learning/access", "GET", undefined, student.cookie)).data,
  ).toMatchObject({ effectivePlan: "PRO", source: "COMMERCIAL" });
  expect(
    (
      await req(
        "/leitner/cards/" + cardId,
        "PATCH",
        { front: "Vol", back: "Vol", version: 0 },
        student.cookie,
      )
    ).status,
  ).toBe(404);
  const studentCourse = await req(
    "/courses",
    "POST",
    {
      title: "Cours étudiant secret G8",
      domain: "Sciences",
      content: "Contenu privé de l’étudiant",
    },
    student.cookie,
  );
  expect(studentCourse.status).toBe(201);
  const ownerCourses = await req("/courses", "GET", undefined, owner.cookie);
  expect(JSON.stringify(ownerCourses.data)).not.toContain(
    "Cours étudiant secret G8",
  );
  const studentQuiz = await req(
    "/quizzes/diagnostic",
    "POST",
    { topic: "Les cellules", domain: "Sciences", level: "Débutant" },
    student.cookie,
  );
  expect(studentQuiz.status).toBe(201);
  expect(
    (
      await req(
        "/quizzes/" + studentQuiz.data.id,
        "GET",
        undefined,
        owner.cookie,
      )
    ).status,
  ).toBe(404);
  const studentAttempt = await req(
    "/quizzes/" + studentQuiz.data.id + "/attempts",
    "POST",
    {},
    student.cookie,
  );
  expect(studentAttempt.status).toBe(201);
  expect(
    (
      await req(
        "/attempts/" + studentAttempt.data.id,
        "GET",
        undefined,
        owner.cookie,
      )
    ).status,
  ).toBe(404);
  const studentCard = await req(
    "/leitner/cards",
    "POST",
    { front: "Carte privée étudiant", back: "Réponse confidentielle" },
    student.cookie,
  );
  expect(studentCard.status).toBe(201);
  expect(
    (
      await req(
        "/leitner/cards/" + studentCard.data.id,
        "PATCH",
        { front: "Vol", back: "Vol", version: 0 },
        owner.cookie,
      )
    ).status,
  ).toBe(404);
  expect(
    (
      await req(
        "/leitner/cards",
        "POST",
        { front: "Vol", back: "Vol", courseId: studentCourse.data.id },
        owner.cookie,
      )
    ).status,
  ).toBe(404);
  const studentPlan = await db.studyPlan.create({
    data: {
      userId: student.id,
      title: "Planning étudiant privé",
      timeZone: "UTC",
    },
  });
  expect(
    (
      await req(
        "/study-plans/" + studentPlan.id,
        "PATCH",
        { title: "Vol" },
        owner.cookie,
      )
    ).status,
  ).toBe(404);

  expect(
    (await req("/admin/metrics", "GET", undefined, student.cookie)).status,
  ).toBe(403);
});
it("respecte attribution future/expirée/révoquée et annule le rappel après révocation", async () => {
  const future = await db.internalLearningGrant.create({
    data: {
      userId: other.id,
      issuedById: owner.id,
      startsAt: new Date(Date.now() + 60000),
      provenance: "TEST",
      justification: "Test de période future",
    },
  });
  expect(
    (await req("/learning/summary", "GET", undefined, other.cookie)).status,
  ).toBe(403);
  await db.internalLearningGrant.update({
    where: { id: future.id },
    data: {
      startsAt: new Date(Date.now() - 60000),
      expiresAt: new Date(Date.now() - 1000),
    },
  });
  expect(
    (await req("/learning/summary", "GET", undefined, other.cookie)).status,
  ).toBe(403);
  const localStart = new Date(Date.now() + 172800000)
    .toISOString()
    .slice(0, 16);
  expect(
    (
      await req(
        "/study-availability",
        "PUT",
        { timeZone: "UTC", slots: [{ localStart, durationMinutes: 60 }] },
        owner.cookie,
      )
    ).status,
  ).toBe(200);
  const proposed = await req(
    "/study-plans/ai/propose",
    "POST",
    { timeZone: "UTC" },
    owner.cookie,
  );
  expect(proposed.status).toBe(201);
  const confirmed = await req(
    "/study-plans/ai/confirm",
    "POST",
    {
      timeZone: "UTC",
      proposal: proposed.data.proposal,
      requestId: crypto.randomUUID(),
    },
    owner.cookie,
  );
  expect(confirmed.status).toBe(201);
  const plan = await db.studyPlan.create({
    data: { userId: owner.id, title: "Planning privé", timeZone: "UTC" },
  });
  const item = await db.studyPlanItem.create({
    data: {
      planId: plan.id,
      title: "Révision privée",
      startsAt: new Date(Date.now() + 3600000),
      endsAt: new Date(Date.now() + 7200000),
      reminderMinutes: 5,
    },
  });
  const delivery = await db.reminderDelivery.create({
    data: {
      itemId: item.id,
      version: item.version,
      dueAt: new Date(Date.now() - 1000),
    },
  });
  expect(
    (
      await req(
        "/notifications/preferences",
        "PUT",
        { enabled: true, timeZone: "UTC" },
        owner.cookie,
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await req(
        "/study-plans?from=2026-01-01&to=2026-01-02",
        "GET",
        undefined,
        owner.cookie,
      )
    ).status,
  ).toBe(200);
  const sentItem = await db.studyPlanItem.create({
    data: {
      planId: plan.id,
      title: "Rappel consenti",
      startsAt: new Date(Date.now() + 10800000),
      endsAt: new Date(Date.now() + 14400000),
      reminderMinutes: 5,
    },
  });
  const activeDelivery = await db.reminderDelivery.create({
    data: {
      itemId: sentItem.id,
      version: sentItem.version,
      dueAt: new Date(Date.now() - 1000),
    },
  });
  await app.get(ReminderWorker).deliver(activeDelivery.id);
  expect(
    (
      await db.reminderDelivery.findUniqueOrThrow({
        where: { id: activeDelivery.id },
      })
    ).status,
  ).toBe("SENT");
  const revoke = await req(
    "/admin/learning-grants/" + grantId + "/revoke",
    "PATCH",
    { reason: "Révocation contrôlée de recette" },
    owner.cookie,
  );
  expect(revoke.status).toBe(200);
  expect(
    (await req("/learning/summary", "GET", undefined, owner.cookie)).status,
  ).toBe(403);
  await app.get(ReminderWorker).deliver(delivery.id);
  expect(
    (
      await db.reminderDelivery.findUniqueOrThrow({
        where: { id: delivery.id },
      })
    ).status,
  ).toBe("CANCELLED");
  expect(
    await db.emailMessage.count({
      where: { userId: owner.id, kind: "REMINDER" },
    }),
  ).toBe(1);
  expect(
    await db.auditLog.count({
      where: { entityId: grantId, action: "INTERNAL_LEARNING_REVOKED" },
    }),
  ).toBe(1);
});
it("préserve les refus mobile, suspension et expiration des sessions", async () => {
  const historical = await db.internalLearningGrant.findFirstOrThrow({
    where: { userId: other.id },
  });
  await db.user.update({
    where: { id: other.id },
    data: { disabledAt: new Date() },
  });
  expect(
    (
      await req(
        "/admin/learning-grants/" + historical.id + "/revoke",
        "PATCH",
        { reason: "Révocation du bénéficiaire suspendu" },
        owner.cookie,
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await req(
        "/admin/learning-grants/" + grantId + "/revoke",
        "PATCH",
        { reason: "Nouvelle demande déjà traitée" },
        owner.cookie,
      )
    ).status,
  ).toBe(200);
  expect(
    await db.auditLog.count({
      where: { entityId: grantId, action: "INTERNAL_LEARNING_REVOKED" },
    }),
  ).toBe(1);
  expect(
    (
      await req(
        "/auth/mobile/login",
        "POST",
        { email: owner.email, password },
        "",
        { "X-Revynora-Client": "mobile" },
      )
    ).status,
  ).toBe(403);
  await db.user.update({
    where: { id: owner.id },
    data: { disabledAt: new Date() },
  });
  expect(
    (await req("/learning/access", "GET", undefined, owner.cookie)).status,
  ).toBe(401);
  await db.session.updateMany({
    where: { userId: other.id },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  expect(
    (await req("/learning/access", "GET", undefined, other.cookie)).status,
  ).toBe(401);
});
