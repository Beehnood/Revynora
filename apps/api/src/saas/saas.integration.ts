/* eslint-disable @typescript-eslint/no-explicit-any -- HTTP assertions inspect heterogeneous JSON responses. */
import "reflect-metadata";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { loadEnvironment } from "../shared/config/environment";
import { AppModule } from "../app.module";
import { configureApp } from "../shared/http/configure";
import { BILLING_PROVIDER } from "../billing/domain/billing";
import { MockBillingProvider } from "../billing/infrastructure/billing.provider";
import { ProcessBillingWebhook } from "../billing/application/billing.use-cases";
import { ReminderWorker } from "../notifications/infrastructure/reminder.worker";
loadEnvironment();
const url = new URL(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL!);
url.pathname = "/revynora_test";
process.env.DATABASE_URL = url.toString();
process.env.WORKER_ENABLED = "false";
process.env.BILLING_PROVIDER = "mock";
process.env.MAIL_PROVIDER = "local";
let app: INestApplication, db: PrismaClient, base: string;
const ids: string[] = [];
let a: { id: string; cookie: string },
  b: { id: string; cookie: string },
  admin: { id: string; cookie: string };
const password = "Phase2-Integration!42";
async function req(path: string, method = "GET", body?: unknown, cookie = "") {
  const r = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Revynora-Client": "web",
      cookie,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return {
    status: r.status,
    data: (await r.json()) as any,
    cookie: r.headers.get("set-cookie")?.split(";")[0] ?? "",
  };
}
async function register(label: string) {
  const r = await req("/auth/register", "POST", {
    name: label,
    email: "phase2-" + label + "-" + crypto.randomUUID() + "@example.test",
    password,
    termsAccepted: true,
  });
  expect(r.status).toBe(201);
  ids.push(r.data.id);
  return { id: r.data.id as string, cookie: r.cookie };
}
async function paid(user: typeof a, plan = "PRO", success = true) {
  const checkout = await req(
    "/billing/checkout-session",
    "POST",
    { plan },
    user.cookie,
  );
  expect(checkout.status).toBe(201);
  const result = await req(
    "/billing/mock-complete",
    "POST",
    { intentId: checkout.data.intentId, success },
    user.cookie,
  );
  expect(result.status).toBe(201);
  return checkout.data.intentId as string;
}
beforeAll(async () => {
  db = new PrismaClient();
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
  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = configureApp(
    module.createNestApplication({ logger: false, rawBody: true }),
  );
  await app.listen(0, "127.0.0.1");
  base = (await app.getUrl()) + "/api/v1";
  a = await register("Alice");
  b = await register("Bob");
  admin = await register("Admin");
  await db.user.update({ where: { id: admin.id }, data: { role: "ADMIN" } });
});
afterAll(async () => {
  if (db) {
    const plans = await db.studyPlanItem.findMany({
      where: { plan: { userId: { in: ids } } },
      select: { id: true },
    });
    await db.reminderDelivery.deleteMany({
      where: { itemId: { in: plans.map((x) => x.id) } },
    });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.mockBillingRecord.deleteMany({
      where: { snapshot: { path: ["userId"], equals: a?.id ?? "" } },
    });
    await db.$disconnect();
  }
  await app?.close();
});
describe.sequential("Phase 2 — PostgreSQL, sessions et webhooks signés", () => {
  it("refuse les accès payants Free, les rôles et les payloads forgés", async () => {
    const contract = (await req("/openapi.json")).data;
    const webhookDoc = contract.paths["/api/v1/webhooks/stripe"].post;
    expect(
      webhookDoc.parameters.some((p: any) => p.name === "Stripe-Signature"),
    ).toBe(true);
    expect(
      webhookDoc.parameters.some((p: any) => p.name === "X-Revynora-Client"),
    ).toBe(false);
    expect(
      contract.paths["/api/v1/leitner/cards/{id}"].patch.requestBody.required,
    ).toBe(true);
    for (const path of [
      "/leitner/cards",
      "/leitner/cards/due",
      "/leitner/stats",
      "/study-plans?from=2026-01-01&to=2026-02-01",
    ])
      expect((await req(path, "GET", undefined, a.cookie)).status).toBe(403);
    expect(
      (await req("/admin/metrics", "GET", undefined, a.cookie)).status,
    ).toBe(403);
    expect((await req("/admin/users")).status).toBe(401);
    expect(
      (
        await req(
          "/billing/checkout-session",
          "POST",
          { plan: "PRO", userId: b.id },
          a.cookie,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await req("/auth/register", "POST", {
          name: "Test",
          email: "x@example.test",
          password,
          termsAccepted: false,
        })
      ).status,
    ).toBe(400);
    expect(
      (await req("/webhooks/stripe", "POST", { plan: "PRO" })).status,
    ).toBe(400);
  });
  it("catalogue, checkout en attente, isolation et refus ne donnent aucun droit", async () => {
    expect(
      (await req("/subscriptions/plans")).data.map(
        (x: { priceCents: number }) => x.priceCents,
      ),
    ).toEqual([0, 250, 500]);
    expect(
      (await req("/billing/portal-session", "POST", {}, b.cookie)).status,
    ).toBe(409);
    const c = await req(
      "/billing/checkout-session",
      "POST",
      { plan: "PLUS" },
      b.cookie,
    );
    expect(
      (await req("/subscriptions/me", "GET", undefined, b.cookie)).data.plan,
    ).toBe("FREE");
    expect(
      (
        await req(
          "/billing/checkout-session",
          "POST",
          { plan: "PRO" },
          b.cookie,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await req(
          "/billing/checkout-status?id=" + c.data.intentId,
          "GET",
          undefined,
          a.cookie,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await req(
          "/billing/mock-complete",
          "POST",
          { intentId: c.data.intentId, success: true },
          a.cookie,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await req(
          "/billing/mock-complete",
          "POST",
          { intentId: c.data.intentId, success: false },
          b.cookie,
        )
      ).status,
    ).toBe(201);
    expect(
      (await req("/subscriptions/me", "GET", undefined, b.cookie)).data.plan,
    ).toBe("FREE");
  });
  it("active Plus via le webhook vérifié, conserve les événements et ferme Pro", async () => {
    await paid(b, "PLUS");
    expect(
      (await req("/subscriptions/me", "GET", undefined, b.cookie)).data,
    ).toMatchObject({ plan: "PLUS", leitner: true, planning: false });
    expect((await req("/users/me", "GET", undefined, b.cookie)).data.plan).toBe(
      "PLUS",
    );
    expect(
      (
        await req(
          "/study-plans?from=2026-01-01&to=2026-02-01",
          "GET",
          undefined,
          b.cookie,
        )
      ).status,
    ).toBe(403);
    expect(
      (await req("/payments/me", "GET", undefined, b.cookie)).data.total,
    ).toBe(2);
    expect(
      (await req("/subscriptions/history", "GET", undefined, b.cookie)).data
        .total,
    ).toBe(2);
    expect(
      (await req("/billing/portal-session", "POST", {}, b.cookie)).data.url,
    ).toContain("/app/abonnement");
    expect(
      (
        await req(
          "/billing/checkout-session",
          "POST",
          { plan: "PRO" },
          b.cookie,
        )
      ).status,
    ).toBe(409);
  });
  it("traite les rejouages une fois et une résiliation conserve la période", async () => {
    await paid(a);
    const provider = app.get<MockBillingProvider>(BILLING_PROVIDER);
    const event = await provider.cancel(a.id);
    const webhook = app.get(ProcessBillingWebhook);
    const first = await webhook.execute(event.raw, event.signature);
    expect(first.duplicate).toBe(false);
    expect((await webhook.execute(event.raw, event.signature)).duplicate).toBe(
      true,
    );
    await expect(webhook.execute(event.raw, "bad")).rejects.toMatchObject({
      code: "INVALID_SIGNATURE",
    });
    expect(
      (await req("/subscriptions/me", "GET", undefined, a.cookie)).data,
    ).toMatchObject({ plan: "PRO", period: { cancelAtPeriodEnd: true } });
    expect(
      (await req("/billing/mock-cancel", "POST", {}, a.cookie)).status,
    ).toBe(201);
  });
  it("crée, modifie et révise les cartes avec concurrence, idempotence et propriété", async () => {
    const c = await req(
      "/leitner/cards",
      "POST",
      { front: "Capitale ?", back: "Paris" },
      a.cookie,
    );
    expect(c.status).toBe(201);
    const id = c.data.id;
    expect(
      (
        await req(
          "/leitner/cards/" + id,
          "PATCH",
          { front: "Voler", back: "Non", version: 0 },
          b.cookie,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await req(
          "/leitner/cards/" + id,
          "PATCH",
          { front: "France ?", back: "Paris", version: 0 },
          a.cookie,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await req(
          "/leitner/cards/" + id,
          "PATCH",
          { front: "France ?", back: "Paris", version: 0 },
          a.cookie,
        )
      ).status,
    ).toBe(409);
    const body = {
      requestId: crypto.randomUUID(),
      version: 1,
      remembered: true,
    };
    const results = await Promise.all([
      req("/leitner/cards/" + id + "/review", "POST", body, a.cookie),
      req("/leitner/cards/" + id + "/review", "POST", body, a.cookie),
    ]);
    expect(results.map((x) => x.status)).toEqual([201, 201]);
    expect(results[0].data.id).toBe(results[1].data.id);
    expect(results[0].data.toBox).toBe(2);
    expect(
      (
        await req(
          "/leitner/cards/" + id + "/review",
          "POST",
          { ...body, requestId: crypto.randomUUID() },
          a.cookie,
        )
      ).status,
    ).toBe(409);
    expect(
      (await req("/leitner/cards/due", "GET", undefined, a.cookie)).data.total,
    ).toBe(0);
    expect(
      (await req("/leitner/stats", "GET", undefined, a.cookie)).data
        .totalReviews,
    ).toBe(1);
    expect(
      (await req("/leitner/cards/" + id, "DELETE", undefined, b.cookie)).status,
    ).toBe(404);
    expect(
      (await req("/leitner/cards/" + id, "DELETE", undefined, a.cookie)).status,
    ).toBe(200);
  });
  it("planifie en UTC, refuse DST et chevauchements puis résout les conflits", async () => {
    const day = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const body = {
      title: "Semaine",
      timeZone: "Europe/Paris",
      tasks: [
        {
          title: "Maths",
          localStart: day + "T10:00",
          durationMinutes: 45,
          reminderMinutes: 15,
        },
      ],
    };
    const p = await req("/study-plans/generate", "POST", body, a.cookie);
    expect(p.status).toBe(201);
    expect(
      (await req("/study-plans/generate", "POST", body, a.cookie)).status,
    ).toBe(409);
    const shifted = await req(
      "/study-plans/generate",
      "POST",
      { ...body, resolveConflicts: true },
      a.cookie,
    );
    expect(shifted.status).toBe(201);
    expect(shifted.data.items[0].startsAt).toBe(p.data.items[0].endsAt);
    const item = p.data.items[0];
    expect(
      (
        await req(
          "/study-plan-items/" + item.id,
          "PATCH",
          { version: 0, status: "DONE" },
          b.cookie,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await req(
          "/study-plan-items/" + item.id,
          "PATCH",
          { version: 0, status: "DONE" },
          a.cookie,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await req(
          "/study-plan-items/" + item.id,
          "PATCH",
          { version: 0, status: "DONE" },
          a.cookie,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await req(
          "/study-plans?from=" +
            day +
            "&to=" +
            new Date(Date.now() + 20 * 86400000).toISOString(),
          "GET",
          undefined,
          a.cookie,
        )
      ).data.total,
    ).toBe(2);
    expect(
      (
        await req(
          "/study-plans?from=2026-01-01&to=2028-01-01",
          "GET",
          undefined,
          a.cookie,
        )
      ).status,
    ).toBe(400);
  });
  it("rappels : opt-in Pro, retrait possible et vérification à la livraison", async () => {
    expect(
      (await req("/notifications/preferences", "GET", undefined, a.cookie)).data
        .remindersEnabled,
    ).toBe(false);
    expect(
      (
        await req(
          "/notifications/preferences",
          "PUT",
          { enabled: true, timeZone: "Europe/Paris" },
          b.cookie,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await req(
          "/notifications/preferences",
          "PUT",
          { enabled: true, timeZone: "Invalid/Zone" },
          a.cookie,
        )
      ).status,
    ).toBe(400);
    const item = await db.studyPlanItem.findFirstOrThrow({
      where: { plan: { userId: a.id }, status: "PLANNED" },
    });
    const row = await db.reminderDelivery.findFirstOrThrow({
      where: { itemId: item.id, status: "PENDING" },
    });
    const worker = app.get(ReminderWorker);
    await db.reminderDelivery.update({
      where: { id: row.id },
      data: { dueAt: new Date() },
    });
    await worker.deliver(row.id);
    expect(
      (await db.reminderDelivery.findUniqueOrThrow({ where: { id: row.id } }))
        .status,
    ).toBe("CANCELLED");
    expect(
      (
        await req(
          "/notifications/preferences",
          "PUT",
          { enabled: true, timeZone: "Europe/Paris" },
          a.cookie,
        )
      ).status,
    ).toBe(200);
    await db.studyPlanItem.update({
      where: { id: item.id },
      data: { version: { increment: 1 } },
    });
    const next = await db.reminderDelivery.create({
      data: { itemId: item.id, version: item.version + 1, dueAt: new Date() },
    });
    await worker.deliver(next.id);
    expect(
      (await db.reminderDelivery.findUniqueOrThrow({ where: { id: next.id } }))
        .status,
    ).toBe("SENT");
    expect(
      (
        await req("/notifications/me", "GET", undefined, a.cookie)
      ).data.items.some((x: { kind: string }) => x.kind === "REMINDER"),
    ).toBe(true);
    expect(
      (
        await req(
          "/notifications/preferences",
          "PUT",
          { enabled: false, timeZone: "Europe/Paris" },
          a.cookie,
        )
      ).status,
    ).toBe(200);
    await worker.send(
      (
        await db.emailMessage.findFirstOrThrow({
          where: { userId: a.id, kind: "WELCOME" },
        })
      ).id,
    );
  });
  it("Redis/BullMQ livre depuis une outbox persistante puis ferme proprement le worker", async () => {
    await req(
      "/notifications/preferences",
      "PUT",
      { enabled: true, timeZone: "Europe/Paris" },
      a.cookie,
    );
    const plan = await db.studyPlan.create({
      data: { userId: a.id, title: "Test queue", timeZone: "Europe/Paris" },
    });
    const item = await db.studyPlanItem.create({
      data: {
        planId: plan.id,
        title: "Rappel BullMQ",
        startsAt: new Date(Date.now() + 300000),
        endsAt: new Date(Date.now() + 360000),
        reminderMinutes: 5,
      },
    });
    const delivery = await db.reminderDelivery.create({
      data: { itemId: item.id, version: 0, dueAt: new Date(Date.now() + 300) },
    });
    const worker = app.get(ReminderWorker);
    process.env.WORKER_ENABLED = "true";
    process.env.QUEUE_NAME = "revynora-test-" + crypto.randomUUID();
    try {
      await worker.onModuleInit();
      await worker.scan();
      await expect
        .poll(
          async () =>
            (
              await db.reminderDelivery.findUniqueOrThrow({
                where: { id: delivery.id },
              })
            ).status,
          { timeout: 10000 },
        )
        .toBe("SENT");
      await worker.deliver(delivery.id);
      expect(
        await db.emailMessage.count({
          where: { idempotencyKey: "reminder_" + delivery.id },
        }),
      ).toBe(1);
    } finally {
      await worker.onModuleDestroy();
      process.env.WORKER_ENABLED = "false";
    }
    await req(
      "/notifications/preferences",
      "PUT",
      { enabled: false, timeZone: "Europe/Paris" },
      a.cookie,
    );
  });
  it("transition Plus vers Pro, ancien événement et expiration préservent l’historique", async () => {
    const provider = app.get<MockBillingProvider>(BILLING_PROVIDER);
    const webhook = app.get(ProcessBillingWebhook);
    const old = await provider.cancel(b.id);
    const prior = await db.userSubscriptionHistory.findFirstOrThrow({
      where: { userId: b.id, status: "ACTIVE" },
    });
    const source = await db.mockBillingRecord.findUniqueOrThrow({
      where: { id: prior.providerSubscriptionId },
    });
    const snapshot = source.snapshot as any;
    const startsAt = new Date();
    await db.mockBillingRecord.update({
      where: { id: source.id },
      data: {
        snapshot: {
          ...snapshot,
          plan: "PRO",
          startsAt: startsAt.toISOString(),
          endsAt: new Date(+startsAt + 30 * 86400000).toISOString(),
          payment: {
            reference: "renewal_" + crypto.randomUUID(),
            amountCents: 500,
            currency: "eur",
            status: "PAID",
            receiptUrl: null,
          },
        },
      },
    });
    const next = await provider.cancel(b.id);
    await webhook.execute(next.raw, next.signature);
    expect(
      (await req("/subscriptions/me", "GET", undefined, b.cookie)).data.plan,
    ).toBe("PRO");
    await webhook.execute(old.raw, old.signature);
    expect(
      (await req("/subscriptions/me", "GET", undefined, b.cookie)).data.plan,
    ).toBe("PRO");
    const history = await db.userSubscriptionHistory.findMany({
      where: { userId: b.id },
      orderBy: { startsAt: "asc" },
    });
    expect(
      history.some((p) => p.priceCents === 250 && +p.endsAt === +startsAt),
    ).toBe(true);
    const current = history.find((p) => p.priceCents === 500)!;
    await db.userSubscriptionHistory.update({
      where: { id: current.id },
      data: { endsAt: new Date() },
    });
    expect(
      (await req("/subscriptions/me", "GET", undefined, b.cookie)).data.plan,
    ).toBe("FREE");
  });
  it("l’échec SMTP est réessayé au plus cinq fois sans faux statut envoyé", async () => {
    const worker = app.get(ReminderWorker);
    const email = await db.emailMessage.create({
      data: {
        userId: a.id,
        kind: "BILLING",
        subject: "Test échec",
        body: "Local test",
        idempotencyKey: crypto.randomUUID(),
      },
    });
    const old = process.env.SMTP_HOST;
    delete process.env.SMTP_HOST;
    process.env.MAIL_PROVIDER = "smtp";
    try {
      for (let i = 0; i < 5; i++)
        await expect(worker.send(email.id)).rejects.toThrow(
          "SMTP configuration",
        );
      const row = await db.emailMessage.findUniqueOrThrow({
        where: { id: email.id },
      });
      expect(row.status).toBe("FAILED");
      expect(row.attempts).toBe(5);
      await worker.send(email.id);
    } finally {
      process.env.MAIL_PROVIDER = "local";
      if (old !== undefined) process.env.SMTP_HOST = old;
    }
  });
  it("admin paginé, agrégats, audit et suspension révoquent la session", async () => {
    for (const path of [
      "/admin/metrics",
      "/admin/users?search=Alice",
      "/admin/events",
      "/admin/offers",
    ])
      expect((await req(path, "GET", undefined, admin.cookie)).status).toBe(
        200,
      );
    expect(
      (
        await req(
          "/admin/metrics?from=2026-10-20&to=2026-10-01",
          "GET",
          undefined,
          admin.cookie,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await req(
          "/admin/users/" + admin.id,
          "PATCH",
          { disabled: true },
          admin.cookie,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await req(
          "/admin/users/" + b.id,
          "PATCH",
          { disabled: true },
          admin.cookie,
        )
      ).status,
    ).toBe(200);
    expect((await req("/users/me", "GET", undefined, b.cookie)).status).toBe(
      401,
    );
    expect(
      (
        await req(
          "/admin/users/" + b.id,
          "PATCH",
          { disabled: false },
          admin.cookie,
        )
      ).status,
    ).toBe(200);
  });
  it("export privé, suppression et anonymisation préservent les faits financiers", async () => {
    const exp = await req("/privacy/export", "GET", undefined, a.cookie);
    expect(exp.status).toBe(200);
    expect(JSON.stringify(exp.data)).not.toContain("passwordHash");
    expect(exp.data.user.id).toBe(a.id);
    expect(
      (
        await req(
          "/privacy/account",
          "DELETE",
          { password: "wrong", confirmation: "SUPPRIMER" },
          a.cookie,
        )
      ).status,
    ).toBe(401);
    const event = await db.userPaymentHistory.findFirstOrThrow({
      where: { userId: a.id },
    });
    await expect(
      db.userPaymentHistory.update({
        where: { id: event.id },
        data: { status: "FORGED" },
      }),
    ).rejects.toThrow();
    expect(
      (
        await req(
          "/privacy/account",
          "DELETE",
          { password, confirmation: "SUPPRIMER" },
          a.cookie,
        )
      ).status,
    ).toBe(200);
    expect((await req("/users/me", "GET", undefined, a.cookie)).status).toBe(
      401,
    );
    expect(
      (
        await db.userPaymentHistory.findUniqueOrThrow({
          where: { id: event.id },
        })
      ).userId,
    ).toBe(null);
  });
});
