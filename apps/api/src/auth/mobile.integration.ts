/* eslint-disable @typescript-eslint/no-explicit-any -- HTTP integration response assertions. */
import "reflect-metadata";
import { beforeAll, afterAll, it, expect } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { loadEnvironment } from "../shared/config/environment";
import { AppModule } from "../app.module";
import { configureApp } from "../shared/http/configure";
loadEnvironment();
const url = new URL(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL!);
url.pathname = "/revynora_test";
process.env.DATABASE_URL = url.toString();
process.env.WORKER_ENABLED = "false";
let app: INestApplication,
  db: PrismaClient,
  base: string,
  token: string,
  cookie: string,
  userId: string,
  otherToken: string;
const email = "mobile-" + crypto.randomUUID() + "@example.test",
  password = "Phase4-Mobile!2026";
const ids: string[] = [];
async function call(
  path: string,
  method = "GET",
  body?: unknown,
  headers: Record<string, string> = {},
) {
  const r = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Revynora-Client": "mobile",
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return {
    status: r.status,
    data: (await r.json()) as any,
    cookie: r.headers.get("set-cookie"),
  };
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
});
afterAll(async () => {
  if (db) {
    await db.quiz.deleteMany({ where: { ownerId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  }
  await app?.close();
});
it("inscrit un étudiant natif avec token opaque haché, expiration et aucun cookie", async () => {
  const r = await call("/auth/mobile/register", "POST", {
    name: "Mobile Test",
    email,
    password,
    termsAccepted: true,
  });
  expect(r.status).toBe(201);
  token = r.data.token;
  userId = r.data.user.id;
  ids.push(userId);
  expect(token).toMatch(/^[a-zA-Z0-9_-]{43}$/);
  expect(r.cookie).toBeNull();
  expect(new Date(r.data.expiresAt).getTime()).toBeGreaterThan(Date.now());
  const row = await db.session.findFirstOrThrow({ where: { userId } });
  expect(row.tokenHash).not.toBe(token);
  expect(
    (
      await call("/users/me", "GET", undefined, {
        Authorization: "Bearer " + token,
      })
    ).data.id,
  ).toBe(userId);
});
it("refuse de créer une session native depuis un navigateur et conserve les cookies Web", async () => {
  expect(
    (
      await call(
        "/auth/mobile/login",
        "POST",
        { email, password },
        { Origin: "http://localhost:3000" },
      )
    ).status,
  ).toBe(403);
  const login = await call(
    "/auth/login",
    "POST",
    { email, password },
    { "X-Revynora-Client": "web" },
  );
  expect(login.status).toBe(201);
  expect(login.cookie).toContain("HttpOnly");
  cookie = login.cookie!.split(";")[0]!;
  const bad = await call("/users/me", "GET", undefined, {
    Authorization: "Bearer invalid",
    Cookie: cookie,
  });
  expect(bad.status).toBe(401);
});
it("les cours créés en mobile sont retrouvés sur le Web, et inversement", async () => {
  const auth = { Authorization: "Bearer " + token };
  const course = await call(
    "/courses",
    "POST",
    {
      title: "Cours mobile",
      domain: "Sciences",
      content: "La cellule contient une membrane et du cytoplasme.",
    },
    auth,
  );
  expect(course.status).toBe(201);
  const web = await call("/courses", "GET", undefined, {
    "X-Revynora-Client": "web",
    Cookie: cookie,
  });
  expect(web.data.items.some((c: any) => c.id === course.data.id)).toBe(true);
  expect((await call("/progress", "GET", undefined, auth)).data).toEqual(
    (
      await call("/progress", "GET", undefined, {
        "X-Revynora-Client": "web",
        Cookie: cookie,
      })
    ).data,
  );
  const other = await call("/auth/mobile/register", "POST", {
    name: "Autre Mobile",
    email: "mobile-" + crypto.randomUUID() + "@example.test",
    password,
    termsAccepted: true,
  });
  otherToken = other.data.token;
  ids.push(other.data.user.id);
  expect(
    (
      await call("/courses", "GET", undefined, {
        Authorization: "Bearer " + otherToken,
      })
    ).data.items.some((c: any) => c.id === course.data.id),
  ).toBe(false);
  expect((await call("/leitner/cards", "GET", undefined, auth)).status).toBe(
    403,
  );
});
it("synchronise scores, flashcards, révisions, planning et abonnement entre bearer et cookies", async () => {
  const sub = await db.subscription.upsert({
    where: { code: "PRO" },
    create: { code: "PRO", name: "PRO", priceCents: 500 },
    update: {},
  });
  await db.userSubscriptionHistory.create({
    data: {
      userId,
      subscriptionId: sub.id,
      provider: "test-fixture",
      providerSubscriptionId: "sync-" + crypto.randomUUID(),
      priceCents: 500,
      currency: "eur",
      status: "ACTIVE",
      startsAt: new Date(Date.now() - 1000),
      endsAt: new Date(Date.now() + 86400000),
    },
  });
  const native = { Authorization: "Bearer " + token },
    web = { "X-Revynora-Client": "web", Cookie: cookie };
  const card = await call(
    "/leitner/cards",
    "POST",
    { front: "Une moitié plus une moitié ?", back: "Une unité." },
    native,
  );
  expect(card.status).toBe(201);
  expect(
    (await call("/leitner/cards", "GET", undefined, web)).data.items.some(
      (c: any) => c.id === card.data.id,
    ),
  ).toBe(true);
  expect(
    (
      await call(
        "/leitner/cards/" + card.data.id + "/review",
        "POST",
        { version: 0, remembered: true, requestId: crypto.randomUUID() },
        native,
      )
    ).status,
  ).toBe(201);
  const day = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const plan = await call(
    "/study-plans/generate",
    "POST",
    {
      title: "Synchronisation",
      timeZone: "UTC",
      tasks: [
        {
          title: "Révision mobile",
          localStart: day + "T10:00",
          durationMinutes: 45,
        },
      ],
    },
    native,
  );
  expect(plan.status).toBe(201);
  const from = day,
    to = new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10);
  expect(
    (
      await call(
        "/study-plans?from=" + from + "&to=" + to,
        "GET",
        undefined,
        web,
      )
    ).data.items.some((i: any) => i.id === plan.data.items[0].id),
  ).toBe(true);
  const quiz = await call(
    "/quizzes/diagnostic",
    "POST",
    { domain: "Sciences", topic: "Les cellules", level: "Débutant" },
    native,
  );
  expect(quiz.status).toBe(201);
  const attempt = await call(
    "/quizzes/" + quiz.data.id + "/attempts",
    "POST",
    undefined,
    native,
  );
  for (const q of quiz.data.questions)
    expect(
      (
        await call(
          "/attempts/" + attempt.data.id + "/answers/" + q.id,
          "PUT",
          { selectedOptionIds: [q.options[0].id] },
          native,
        )
      ).status,
    ).toBe(200);
  expect(
    (
      await call(
        "/attempts/" + attempt.data.id + "/submit",
        "POST",
        undefined,
        native,
      )
    ).status,
  ).toBe(201);
  for (const path of [
    "/attempts/" + attempt.data.id,
    "/leitner/stats",
    "/progress",
    "/subscriptions/me",
  ])
    expect((await call(path, "GET", undefined, native)).data).toEqual(
      (await call(path, "GET", undefined, web)).data,
    );
  expect(
    (
      await call("/attempts/" + attempt.data.id, "GET", undefined, {
        Authorization: "Bearer " + otherToken,
      })
    ).status,
  ).toBe(404);
});
it("expiration et révocation s’appliquent aussi aux sessions natives", async () => {
  await db.session.updateMany({
    where: { userId },
    data: { expiresAt: new Date(0) },
  });
  expect(
    (
      await call("/users/me", "GET", undefined, {
        Authorization: "Bearer " + token,
      })
    ).status,
  ).toBe(401);
  const login = await call("/auth/mobile/login", "POST", { email, password });
  expect(login.status).toBe(201);
  token = login.data.token;
  expect(
    (
      await call("/auth/logout", "POST", undefined, {
        Authorization: "Bearer " + token,
      })
    ).status,
  ).toBe(201);
  expect(
    (
      await call("/users/me", "GET", undefined, {
        Authorization: "Bearer " + token,
      })
    ).status,
  ).toBe(401);
});

it("un compte Admin ne peut pas ouvrir de session native étudiant", async () => {
  const other = await db.user.findFirstOrThrow({
    where: { id: { in: ids }, NOT: { id: userId } },
  });
  await db.user.update({ where: { id: other.id }, data: { role: "ADMIN" } });
  const before = await db.session.count({ where: { userId: other.id } });
  expect(
    (await call("/auth/mobile/login", "POST", { email: other.email, password }))
      .status,
  ).toBe(403);
  expect(await db.session.count({ where: { userId: other.id } })).toBe(before);
});
