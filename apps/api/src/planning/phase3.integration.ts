/* eslint-disable @typescript-eslint/no-explicit-any -- Real HTTP response assertions. */
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
process.env.AI_PROVIDER = "mock";
process.env.WORKER_ENABLED = "false";
let db: PrismaClient, app: INestApplication, base: string;
const users: { id: string; cookie: string }[] = [];
let course: string, card: string;
const day = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
async function req(user: number, path: string, method = "GET", body?: unknown) {
  const response = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Revynora-Client": "web",
      cookie: users[user]?.cookie ?? "",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return {
    status: response.status,
    data: (await response.json()) as any,
    cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "",
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
  for (const plan of ["FREE", "PLUS", "PRO", "PRO"] as const) {
    const r = await req(-1, "/auth/register", "POST", {
      name: "Phase trois",
      email: "phase3-" + crypto.randomUUID() + "@example.test",
      password: "Phase3-Integration!42",
      termsAccepted: true,
    });
    expect(r.status).toBe(201);
    users.push({ id: r.data.id, cookie: r.cookie });
    if (plan !== "FREE") {
      const subscription = await db.subscription.upsert({
        where: { code: plan },
        create: {
          code: plan,
          name: plan,
          priceCents: plan === "PRO" ? 500 : 250,
        },
        update: {},
      });
      // Test-only entitlement fixture; never exposed to clients or applied to real users.
      await db.userSubscriptionHistory.create({
        data: {
          userId: r.data.id,
          subscriptionId: subscription.id,
          provider: "test-fixture",
          providerSubscriptionId: "fixture-" + crypto.randomUUID(),
          priceCents: subscription.priceCents,
          currency: "eur",
          status: "ACTIVE",
          startsAt: new Date(Date.now() - 1000),
          endsAt: new Date(Date.now() + 86400000),
        },
      });
    }
  }
  course = (
    await db.course.create({
      data: {
        ownerId: users[2]!.id,
        title: "Fractions",
        domain: "Mathématiques",
        content: "Addition et division des fractions.",
      },
    })
  ).id;
});
afterAll(async () => {
  if (db) {
    const items = await db.studyPlanItem.findMany({
      where: { plan: { userId: { in: users.map((u) => u.id) } } },
      select: { id: true },
    });
    await db.reminderDelivery.deleteMany({
      where: { itemId: { in: items.map((i) => i.id) } },
    });
    await db.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
    await db.$disconnect();
  }
  await app?.close();
});
it("les droits Free/Plus/Pro et la progression privée sont imposés côté API", async () => {
  expect((await req(0, "/leitner/cards")).status).toBe(403);
  for (const user of [0, 1])
    for (const path of ["/study-availability", "/study-plans/ai/propose"])
      expect(
        (
          await req(
            user,
            path,
            path.endsWith("propose") ? "POST" : "GET",
            path.endsWith("propose") ? { timeZone: "UTC" } : undefined,
          )
        ).status,
      ).toBe(403);
  expect((await req(-1, "/progress")).status).toBe(401);
  expect((await req(0, "/progress")).data.totalReviews).toBe(0);
});
it("Leitner : cinq boîtes, dates exactes, échec, plafond et concurrence", async () => {
  const created = await req(1, "/leitner/cards", "POST", {
    front: "Question",
    back: "Réponse",
  });
  expect(created.status).toBe(201);
  card = created.data.id;
  expect(created.data.box).toBe(1);
  const intervals = [1, 3, 7, 14, 30];
  for (let box = 1; box <= 5; box++) {
    const c = await db.leitnerCard.update({
      where: { id: card },
      data: { box, dueAt: new Date(0) },
    });
    const before = Date.now();
    const r = await req(1, "/leitner/cards/" + card + "/review", "POST", {
      version: c.version,
      remembered: true,
      requestId: crypto.randomUUID(),
      durationSeconds: 12,
    });
    expect(r.status).toBe(201);
    expect(r.data.toBox).toBe(Math.min(box + 1, 5));
    expect(+new Date(r.data.nextDueAt) - before).toBeGreaterThanOrEqual(
      intervals[Math.min(box, 4)]! * 86400000,
    );
  }
  const c = await db.leitnerCard.update({
      where: { id: card },
      data: { dueAt: new Date(0) },
    }),
    requestId = crypto.randomUUID();
  const payload = { requestId, version: c.version, remembered: false };
  const retry = await Promise.all([
    req(1, "/leitner/cards/" + card + "/review", "POST", payload),
    req(1, "/leitner/cards/" + card + "/review", "POST", payload),
  ]);
  expect(retry.map((r) => r.status)).toEqual([201, 201]);
  expect(retry[0].data.id).toBe(retry[1].data.id);
  expect(retry[0].data.toBox).toBe(1);
  expect(await db.revision.count({ where: { requestId } })).toBe(1);
  expect(
    (
      await req(2, "/leitner/cards/" + card, "PATCH", {
        front: "Vol",
        back: "Non",
        version: 0,
      })
    ).status,
  ).toBe(404);
  expect((await req(2, "/leitner/cards/" + card, "DELETE")).status).toBe(404);
});
it("planning : examen, priorité, cours privé, version et modification de programme", async () => {
  expect(
    (
      await req(3, "/study-plans/generate", "POST", {
        title: "Foreign",
        timeZone: "UTC",
        tasks: [
          {
            title: "Vol",
            courseId: course,
            localStart: day + "T10:00",
            durationMinutes: 45,
          },
        ],
      })
    ).status,
  ).toBe(404);
  const plan = await req(2, "/study-plans/generate", "POST", {
    title: "Examens",
    timeZone: "UTC",
    tasks: [
      {
        title: "Examen fractions",
        courseId: course,
        kind: "EXAM",
        priority: 3,
        localStart: day + "T15:00",
        durationMinutes: 60,
        reminderMinutes: 15,
      },
    ],
  });
  expect(plan.status).toBe(201);
  const task = plan.data.items[0];
  expect(
    (
      await req(2, "/study-plan-items/" + task.id, "PATCH", {
        version: 0,
        priority: 1,
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await req(2, "/study-plan-items/" + task.id, "PATCH", {
        version: 0,
        title: "Périmée",
      })
    ).status,
  ).toBe(409);
  expect(
    (await req(3, "/study-plans/" + plan.data.id, "PATCH", { title: "Autre" }))
      .status,
  ).toBe(404);
  expect(
    (
      await req(2, "/study-plans/" + plan.data.id, "PATCH", {
        title: "Mon examen",
      })
    ).status,
  ).toBe(200);
  const snapshots = await req(2, "/study-plan-items/" + task.id + "/history");
  expect(snapshots.data.items[0]).toMatchObject({
    kind: "EXAM",
    priority: 1,
    courseId: course,
    reminderMinutes: 15,
  });
});
it("disponibilités et IA : proposition sans mutation, confirmation idempotente et conflits réévalués", async () => {
  expect(
    (
      await req(2, "/study-availability", "PUT", {
        timeZone: "UTC",
        slots: [
          { localStart: day + "T10:00", durationMinutes: 120 },
          { localStart: day + "T11:00", durationMinutes: 120 },
        ],
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await req(2, "/study-availability", "PUT", {
        timeZone: "UTC",
        slots: [{ localStart: day + "T10:00", durationMinutes: 120 }],
      })
    ).status,
  ).toBe(200);
  const before = await db.studyPlan.count({ where: { userId: users[2]!.id } });
  const proposed = await req(2, "/study-plans/ai/propose", "POST", {
    timeZone: "UTC",
  });
  expect(proposed.status).toBe(201);
  expect(proposed.data.provider).toBe("mock");
  expect(await db.studyPlan.count({ where: { userId: users[2]!.id } })).toBe(
    before,
  );
  const payload = {
    timeZone: "UTC",
    proposal: proposed.data.proposal,
    requestId: crypto.randomUUID(),
  };
  const results = await Promise.all([
    req(2, "/study-plans/ai/confirm", "POST", payload),
    req(2, "/study-plans/ai/confirm", "POST", payload),
  ]);
  expect(results.map((r) => r.status)).toEqual([201, 201]);
  expect(results[0].data.id).toBe(results[1].data.id);
  expect(
    (
      await req(2, "/study-plans/ai/confirm", "POST", {
        ...payload,
        requestId: crypto.randomUUID(),
      })
    ).status,
  ).toBe(409);
  expect(
    (await req(3, "/study-plans/ai/confirm", "POST", payload)).status,
  ).toBe(409);
  expect(
    (
      await req(2, "/study-plans/ai/confirm", "POST", {
        ...payload,
        proposal: { ...payload.proposal, tasks: [] },
      })
    ).status,
  ).toBe(400);
  await req(2, "/study-availability", "PUT", { timeZone: "UTC", slots: [] });
  expect(
    (
      await req(2, "/study-plans/ai/confirm", "POST", {
        ...payload,
        requestId: crypto.randomUUID(),
      })
    ).status,
  ).toBe(409);
});
it("les statistiques sont exactes et n’exposent aucun autre étudiant", async () => {
  const progress = await req(1, "/progress");
  expect(progress.status).toBe(200);
  expect(progress.data).toMatchObject({
    totalReviews: 6,
    timedReviews: 5,
    revisionSeconds: 60,
    successRate: 83,
    completedQuizzes: 0,
  });
  expect((await req(0, "/progress")).data.totalReviews).toBe(0);
  expect(progress.data.boxes.find((b: any) => b.box === 1).count).toBe(1);
});
