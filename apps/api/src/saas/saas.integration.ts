/* eslint-disable @typescript-eslint/no-explicit-any -- HTTP assertions inspect heterogeneous JSON responses. */
import "reflect-metadata";
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { Logger } from "@nestjs/common";
import { readStatistics } from "../admin/infrastructure/statistics.repository";
import { PrismaAdminRepository } from "../admin/infrastructure/admin.repository";
import { decodeAccessAudit } from "../admin/domain/audit";
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
    await db.auditLog.deleteMany({
      where: { OR: [{ actorId: { in: ids } }, { targetUserId: { in: ids } }] },
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
  it("G2: la fiche est réservée aux administrateurs et ne divulgue que les champs autorisés", async () => {
    const student = await register("g2-student");
    const manager = await register("g2-admin");
    await db.user.update({
      where: { id: manager.id },
      data: { role: "ADMIN" },
    });
    expect((await req("/admin/users/" + student.id)).status).toBe(401);
    expect(
      (
        await req(
          "/admin/users/" + student.id,
          "GET",
          undefined,
          student.cookie,
        )
      ).status,
    ).toBe(403);
    const detail = await req(
      "/admin/users/" + student.id,
      "GET",
      undefined,
      manager.cookie,
    );
    expect(detail.status).toBe(200);
    expect(Object.keys(detail.data).sort()).toEqual(
      ["id", "name", "email", "role", "disabledAt", "createdAt"].sort(),
    );
    expect(detail.data.id).toBe(student.id);
    expect(
      (await req("/admin/users/invalid", "GET", undefined, manager.cookie))
        .status,
    ).toBe(400);
    expect(
      (
        await req(
          "/admin/users/" + crypto.randomUUID(),
          "GET",
          undefined,
          manager.cookie,
        )
      ).status,
    ).toBe(404);
  });
  it("G3: agrégats privés exacts, jours UTC, devises et simulations séparés", async () => {
    const u = await register("g3-statistics");
    const end = await register("g3-end-boundary");
    await db.user.update({
      where: { id: u.id },
      data: { createdAt: new Date("2051-01-01T00:00:00Z") },
    });
    await db.user.update({
      where: { id: end.id },
      data: { createdAt: new Date("2051-01-04T00:00:00Z") },
    });
    const offer = await db.subscription.findUniqueOrThrow({
      where: { code: "PLUS" },
    });
    await db.userSubscriptionHistory.create({
      data: {
        userId: u.id,
        subscriptionId: offer.id,
        provider: "mock",
        providerSubscriptionId: crypto.randomUUID(),
        priceCents: 250,
        currency: "eur",
        status: "CANCELLED",
        startsAt: new Date("2051-01-02"),
        endsAt: new Date("2051-02-02"),
      },
    });
    await db.aIUsage.createMany({
      data: [
        {
          userId: u.id,
          provider: "mock",
          status: "SUCCESS",
          createdAt: new Date("2051-01-01"),
          estimatedCostUsd: null,
        },
        {
          userId: u.id,
          provider: "openai",
          status: "ERROR",
          createdAt: new Date("2051-01-03T23:59:59Z"),
          inputTokens: 23,
          outputTokens: 5,
          estimatedCostUsd: "0.00012345",
        },
        {
          userId: u.id,
          provider: "openai",
          status: "SUCCESS",
          createdAt: new Date("2051-01-04"),
          estimatedCostUsd: "99",
        },
      ],
    });
    try {
      for (const [provider, currency, amountCents, status] of [
        ["mock", "eur", 250, "PAID"],
        ["stripe", "eur", 500, "PAID"],
        ["stripe", "usd", 700, "PAID"],
        ["stripe", "eur", 100, "FAILED"],
      ] as const)
        await db.payment.create({
          data: {
            userId: u.id,
            provider,
            currency,
            amountCents,
            status,
            providerReference: crypto.randomUUID(),
            createdAt: new Date("2051-01-02"),
          },
        });
      const path = "/admin/statistics?from=2051-01-01&to=2051-01-04";
      expect((await req(path)).status).toBe(401);
      expect((await req(path, "GET", undefined, u.cookie)).status).toBe(403);
      const r = await req(path, "GET", undefined, admin.cookie);
      expect(r.status).toBe(200);
      expect(r.data.registrations).toEqual([
        { date: "2051-01-01", count: 1 },
        { date: "2051-01-02", count: 0 },
        { date: "2051-01-03", count: 0 },
      ]);
      expect(r.data.subscriptions).toEqual([
        { offer: "PLUS", status: "CANCELLED", periods: 1 },
      ]);
      expect(r.data.ai).toEqual([
        {
          provider: "mock",
          status: "SUCCESS",
          requests: 1,
          inputTokens: "0",
          outputTokens: "0",
          estimatedCostUsd: null,
          estimatedRequests: 0,
        },
        {
          provider: "openai",
          status: "ERROR",
          requests: 1,
          inputTokens: "23",
          outputTokens: "5",
          estimatedCostUsd: "0.00012345",
          estimatedRequests: 1,
        },
      ]);
      expect(r.data.payments).toHaveLength(4);
      expect(r.data.payments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            provider: "mock",
            environment: "SIMULATION",
            currency: "eur",
            amountCents: "250",
          }),
          expect.objectContaining({
            provider: "stripe",
            environment: "UNVERIFIED",
            currency: "usd",
            amountCents: "700",
          }),
          expect.objectContaining({
            provider: "stripe",
            status: "FAILED",
            amountCents: "100",
          }),
        ]),
      );
      const shiftedSession = {
        $transaction: async <T>(
          work: (
            tx: import("@prisma/client").Prisma.TransactionClient,
          ) => Promise<T>,
          options?: {
            isolationLevel?: import("@prisma/client").Prisma.TransactionIsolationLevel;
            maxWait?: number;
            timeout?: number;
          },
        ) =>
          db.$transaction(async (tx) => {
            await tx.$executeRaw`SET LOCAL TIME ZONE 'Pacific/Auckland'`;
            return work(tx);
          }, options),
      } as unknown as PrismaClient;
      const shifted = await readStatistics(shiftedSession, {
        from: new Date("2051-01-01"),
        to: new Date("2051-01-04"),
      });
      expect(shifted).toEqual(r.data);
      expect(r.data.billedAiCostUsd).toBeNull();
      expect(JSON.stringify(r.data)).not.toContain(u.id);
      const empty = await req(
        "/admin/statistics?from=2052-01-01&to=2052-01-02",
        "GET",
        undefined,
        admin.cookie,
      );
      expect(empty.data.ai).toEqual([]);
      expect(empty.data.payments).toEqual([]);
      expect(empty.data.registrations).toEqual([
        { date: "2052-01-01", count: 0 },
      ]);
      for (const query of [
        "from=2051-01-01&to=2053-01-01",
        "from=2051-01-02&to=2051-01-01",
        "from=bad&to=2051-01-01",
        "from=2051-01-01&to=2051-01-02&userId=" + u.id,
      ])
        expect(
          (
            await req(
              "/admin/statistics?" + query,
              "GET",
              undefined,
              admin.cookie,
            )
          ).status,
        ).toBe(400);
    } finally {
      await db.payment.deleteMany({ where: { userId: u.id } });
    }
  });
  it("G4: catalogue strictement global, pagination, recherche littérale et contenu borné", async () => {
    const tag = "g4-" + crypto.randomUUID();
    const courseIds = Array.from({ length: 31 }, () => crypto.randomUUID());
    const common = {
      domain: "Sciences",
      content: "Texte du catalogue",
      createdAt: new Date("2025-01-01"),
    };
    try {
      await db.course.createMany({
        data: [
          ...courseIds.slice(0, 23).map((id, i) => ({
            ...common,
            id,
            title: tag + " Titre " + i.toString().padStart(2, "0"),
            source: "ADMIN" as const,
            ownerId: null,
          })),
          {
            ...common,
            id: courseIds[23]!,
            title: tag + " 100%_",
            domain: "Matière " + tag,
            source: "ADMIN",
            ownerId: null,
          },
          {
            ...common,
            id: courseIds[24]!,
            title: tag + " Privé",
            source: "USER",
            ownerId: a.id,
          },
          {
            ...common,
            id: courseIds[25]!,
            title: tag + " IA privée",
            source: "AI",
            ownerId: a.id,
          },
          {
            ...common,
            id: courseIds[26]!,
            title: tag + " ADMIN propriétaire",
            source: "ADMIN",
            ownerId: a.id,
          },
          {
            ...common,
            id: courseIds[29]!,
            title: "Contenu excessif",
            content: "x".repeat(10001),
            source: "ADMIN",
            ownerId: null,
          },
          {
            ...common,
            id: courseIds[30]!,
            title: "T".repeat(161),
            source: "ADMIN",
            ownerId: null,
          },
        ],
      });
      for (const [i, source] of [
        [27, "USER"],
        [28, "AI"],
      ] as const)
        await expect(
          db.course.create({
            data: {
              ...common,
              id: courseIds[i]!,
              title: tag + " Sans propriétaire",
              source,
              ownerId: null,
            },
          }),
        ).rejects.toThrow();
      const path = "/admin/catalog/courses";
      expect((await req(path)).status).toBe(401);
      expect((await req(path, "GET", undefined, a.cookie)).status).toBe(403);
      expect((await req(path + "/" + courseIds[0])).status).toBe(401);
      expect(
        (await req(path + "/" + courseIds[0], "GET", undefined, a.cookie))
          .status,
      ).toBe(403);
      const first = await req(
        path + "?search=" + tag.toUpperCase(),
        "GET",
        undefined,
        admin.cookie,
      );
      expect(first.status).toBe(200);
      expect(first.data.total).toBe(24);
      expect(first.data.items).toHaveLength(20);
      expect(first.data.pageSize).toBe(20);
      const second = await req(
        path + "?search=" + tag + "&page=2",
        "GET",
        undefined,
        admin.cookie,
      );
      expect(second.data.items).toHaveLength(4);
      const all = [...first.data.items, ...second.data.items];
      expect(new Set(all.map((r: { id: string }) => r.id)).size).toBe(24);
      for (const row of all) {
        expect(Object.keys(row).sort()).toEqual(
          ["id", "title", "domain", "source", "createdAt"].sort(),
        );
        expect(row.source).toBe("ADMIN");
      }
      expect(JSON.stringify(all)).not.toContain("Privé");
      const literal = await req(
        path + "?search=" + encodeURIComponent(tag + " 100%_"),
        "GET",
        undefined,
        admin.cookie,
      );
      expect(literal.status).toBe(200);
      expect(literal.data.total).toBe(1);
      const subject = await req(
        path + "?search=" + encodeURIComponent("MATIÈRE " + tag),
        "GET",
        undefined,
        admin.cookie,
      );
      expect(subject.status).toBe(200);
      expect(subject.data.total).toBe(1);
      expect(
        (
          await req(
            path + "?search=" + "T".repeat(100),
            "GET",
            undefined,
            admin.cookie,
          )
        ).status,
      ).toBe(422);
      const detail = await req(
        path + "/" + courseIds[0],
        "GET",
        undefined,
        admin.cookie,
      );
      expect(detail.status).toBe(200);
      expect(Object.keys(detail.data).sort()).toEqual(
        ["id", "title", "domain", "source", "createdAt", "content"].sort(),
      );
      expect(detail.data.content).toBe(common.content);
      for (const id of [...courseIds.slice(24, 29), crypto.randomUUID()])
        expect(
          (await req(path + "/" + id, "GET", undefined, admin.cookie)).status,
        ).toBe(404);
      expect(
        (await req(path + "/" + courseIds[29], "GET", undefined, admin.cookie))
          .status,
      ).toBe(422);
      expect(
        (await req(path + "/" + courseIds[30], "GET", undefined, admin.cookie))
          .status,
      ).toBe(422);
      expect(
        (await req(path + "/invalid", "GET", undefined, admin.cookie)).status,
      ).toBe(400);
      for (const query of [
        "page=0",
        "page=10001",
        "search=" + "x".repeat(101),
        "source=USER",
        "ownerId=" + a.id,
        "pageSize=100",
      ])
        expect(
          (await req(path + "?" + query, "GET", undefined, admin.cookie))
            .status,
        ).toBe(400);
      const empty = await req(
        path + "?search=" + tag + "&page=3",
        "GET",
        undefined,
        admin.cookie,
      );
      expect(empty.data.items).toEqual([]);
      expect(empty.data.total).toBe(24);
      expect(
        (
          await req(
            path + "?search=" + crypto.randomUUID(),
            "GET",
            undefined,
            admin.cookie,
          )
        ).data.total,
      ).toBe(0);
      for (const method of ["POST", "PATCH", "DELETE"])
        expect(
          (
            await req(
              path + "/" + courseIds[0],
              method,
              undefined,
              admin.cookie,
            )
          ).status,
        ).toBe(404);
      expect(
        (await req("/courses", "GET", undefined, admin.cookie)).status,
      ).toBe(403);
      expect(
        (
          await req(
            "/courses",
            "POST",
            {
              title: "Faux catalogue",
              domain: "Sciences",
              content: "Texte privé",
              source: "ADMIN",
              ownerId: null,
            },
            a.cookie,
          )
        ).status,
      ).toBe(400);
    } finally {
      await db.course.deleteMany({ where: { id: { in: courseIds } } });
    }
  });
  it("G4: bornes SQL/UTF-16 exactes, erreur explicite sans page partielle ni fuite privée", async () => {
    const id = crypto.randomUUID();
    const privateId = crypto.randomUUID();
    const tag = "unicode-" + crypto.randomUUID();
    const path = "/admin/catalog/courses";
    const read = (suffix: string) =>
      req(path + suffix, "GET", undefined, admin.cookie);
    try {
      await db.course.create({
        data: {
          id,
          source: "ADMIN",
          ownerId: null,
          title: tag,
          domain: "Sciences",
          content: "Texte",
        },
      });
      await db.course.create({
        data: {
          id: privateId,
          source: "USER",
          ownerId: a.id,
          title: tag,
          domain: "x".repeat(81),
          content: "PRIVE-UNICODE",
        },
      });
      for (const [field, limit] of [
        ["title", 160],
        ["domain", 80],
        ["content", 10000],
      ] as const) {
        for (const unit of ["a", "😀", "𐐀", "e\u0301"]) {
          const exact = unit.repeat(limit / unit.length);
          await db.course.update({
            where: { id },
            data: {
              title: tag,
              domain: "Sciences",
              content: "Texte",
              [field]: exact,
            },
          });
          const detail = await read("/" + id);
          expect(detail.status).toBe(200);
          expect(detail.data[field]).toBe(exact);
          const search = field === "title" ? unit : tag;
          const list = await read("?search=" + encodeURIComponent(search));
          expect(list.status).toBe(200);
          expect(
            list.data.items.some((row: { id: string }) => row.id === id),
          ).toBe(true);
          await db.course.update({
            where: { id },
            data: { [field]: exact + "a" },
          });
          const excessive = await read("/" + id);
          expect(excessive.status).toBe(422);
          expect(JSON.stringify(excessive.data)).toContain(
            "limites de consultation",
          );
          const page = await read("?search=" + encodeURIComponent(search));
          if (field === "content") expect(page.status).toBe(200);
          else {
            expect(page.status).toBe(422);
            expect(page.data.items).toBeUndefined();
            expect(JSON.stringify(page.data)).toContain(
              "limites de consultation",
            );
          }
          const hidden = await read("/" + privateId);
          expect(hidden.status).toBe(404);
          expect(JSON.stringify(hidden.data)).not.toContain("PRIVE-UNICODE");
        }
      }
    } finally {
      await db.course.deleteMany({ where: { id: { in: [id, privateId] } } });
    }
  });
  it("inscription atomique avec historique FREE sans paiement", async () => {
    const history = (
      await req("/subscriptions/history", "GET", undefined, a.cookie)
    ).data;
    expect(history.total).toBe(1);
    expect(history.items[0]).toMatchObject({
      provider: "internal",
      priceCents: 0,
      subscription: { code: "FREE" },
    });
    expect(await db.payment.count({ where: { userId: a.id } })).toBe(0);
    expect(
      (await req("/subscriptions/me", "GET", undefined, a.cookie)).data.period,
    ).toBeNull();
  });
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
    ).toBe(3);
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
  it("conserve les versions d’une tâche, refuse le passé et protège leur propriété", async () => {
    const item = await db.studyPlanItem.findFirstOrThrow({
      where: { plan: { userId: a.id }, status: "PLANNED" },
    });
    const oldDue = await db.reminderDelivery.findFirstOrThrow({
      where: { itemId: item.id, status: "PENDING" },
    });
    const nextDay = new Date(Date.now() + 10 * 86400000)
      .toISOString()
      .slice(0, 10);
    const changed = await req(
      "/study-plan-items/" + item.id,
      "PATCH",
      {
        version: item.version,
        title: "Séance reportée",
        localStart: nextDay + "T12:00",
      },
      a.cookie,
    );
    expect(changed.status).toBe(200);
    const history = await req(
      "/study-plan-items/" + item.id + "/history",
      "GET",
      undefined,
      a.cookie,
    );
    expect(history.status).toBe(200);
    expect(history.data.items.map((v: any) => v.version)).toEqual([1, 0]);
    expect(history.data.items[1].startsAt).toBe(item.startsAt.toISOString());
    expect(
      (
        await db.reminderDelivery.findUniqueOrThrow({
          where: { id: oldDue.id },
        })
      ).status,
    ).toBe("CANCELLED");
    expect(
      await db.reminderDelivery.count({
        where: { itemId: item.id, status: "PENDING" },
      }),
    ).toBe(1);
    expect(
      (
        await req(
          "/study-plan-items/" + item.id,
          "PATCH",
          { version: 1, localStart: "2020-01-01T12:00" },
          a.cookie,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await req(
          "/study-plan-items/" + item.id + "/history?page=0",
          "GET",
          undefined,
          a.cookie,
        )
      ).status,
    ).toBe(400);
    const c = await register("Charlie");
    await paid(c);
    expect(
      (
        await req(
          "/study-plan-items/" + item.id + "/history",
          "GET",
          undefined,
          c.cookie,
        )
      ).status,
    ).toBe(404);
    await expect(
      db.studyPlanItemVersion.update({
        where: { itemId_version: { itemId: item.id, version: 0 } },
        data: { title: "Modification interdite" },
      }),
    ).rejects.toThrow();
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
      where: { userId: b.id, status: "ACTIVE", provider: "mock" },
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
    const before = await db.auditLog.count({ where: { targetUserId: b.id } });
    for (const body of [
      { disabled: true },
      { disabled: true, confirmed: false, reason: "SECURITY_REVIEW" },
      {
        disabled: true,
        confirmed: true,
        reason: "personal email@example.test",
      },
    ]) {
      expect(
        (await req("/admin/users/" + b.id, "PATCH", body, admin.cookie)).status,
      ).toBe(400);
    }
    expect(await db.auditLog.count({ where: { targetUserId: b.id } })).toBe(
      before,
    );
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: b.id } })).disabledAt,
    ).toBeNull();
    expect((await req("/users/me", "GET", undefined, b.cookie)).status).toBe(
      200,
    );
    expect(
      (
        await req(
          "/admin/users/" + b.id,
          "PATCH",
          { disabled: true, confirmed: true, reason: "SECURITY_REVIEW" },
          a.cookie,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await req(
          "/admin/users/" + admin.id,
          "PATCH",
          { disabled: true, confirmed: true, reason: "SECURITY_REVIEW" },
          admin.cookie,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await req(
          "/admin/users/" + b.id,
          "PATCH",
          { disabled: true, confirmed: true, reason: "SECURITY_REVIEW" },
          admin.cookie,
        )
      ).status,
    ).toBe(200);
    const audit = await req("/admin/events", "GET", undefined, admin.cookie);
    expect(audit.data.audit).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorId: admin.id,
          targetUserId: b.id,
          action: "USER_DISABLED",
          reason: "SECURITY_REVIEW",
          result: "SUCCESS",
        }),
        expect.objectContaining({ targetUserId: admin.id, result: "REJECTED" }),
      ]),
    );
    expect(JSON.stringify(audit.data.audit)).not.toContain("passwordHash");
    expect((await req("/users/me", "GET", undefined, b.cookie)).status).toBe(
      401,
    );
    expect(
      (
        await req(
          "/admin/users/" + b.id,
          "PATCH",
          { disabled: false, confirmed: true, reason: "REVIEW_COMPLETED" },
          admin.cookie,
        )
      ).status,
    ).toBe(200);
  });
  it("sérialise deux suspensions concurrentes, conserve les deux auteurs et ne restaure aucune session", async () => {
    const target = await register("ConcurrentTarget");
    const second = await register("ConcurrentAdmin");
    await db.user.update({ where: { id: second.id }, data: { role: "ADMIN" } });
    const results = await Promise.all([
      req(
        "/admin/users/" + target.id,
        "PATCH",
        { disabled: true, confirmed: true, reason: "SECURITY_REVIEW" },
        admin.cookie,
      ),
      req(
        "/admin/users/" + target.id,
        "PATCH",
        { disabled: true, confirmed: true, reason: "POLICY_REVIEW" },
        second.cookie,
      ),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: target.id } }))
        .disabledAt,
    ).not.toBeNull();
    expect(await db.session.count({ where: { userId: target.id } })).toBe(0);
    const rows = await db.auditLog.findMany({
      where: { targetUserId: target.id },
    });
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.actorId))).toEqual(
      new Set([admin.id, second.id]),
    );
    expect(rows.map((r) => decodeAccessAudit(r.action))).toEqual(
      expect.arrayContaining([
        {
          action: "USER_DISABLED",
          reason: "SECURITY_REVIEW",
          result: "SUCCESS",
        },
        { action: "USER_DISABLED", reason: "POLICY_REVIEW", result: "SUCCESS" },
      ]),
    );
    expect(
      (await req("/users/me", "GET", undefined, target.cookie)).status,
    ).toBe(401);
    expect(
      (
        await req(
          "/admin/users/" + target.id,
          "PATCH",
          { disabled: false, confirmed: true, reason: "REVIEW_COMPLETED" },
          admin.cookie,
        )
      ).status,
    ).toBe(200);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: target.id } }))
        .disabledAt,
    ).toBeNull();
    expect(
      (await req("/users/me", "GET", undefined, target.cookie)).status,
    ).toBe(401);
  });
  it("rollback réel : l’échec de l’audit atomique ne suspend pas le compte ni ne révoque sa session", async () => {
    const target = await register("AuditRollback");
    const log = vi
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => {});
    try {
      // A nonexistent actor forces the audit foreign-key constraint to fail, without changing the schema.
      await expect(
        new PrismaAdminRepository(db).disable(crypto.randomUUID(), target.id, {
          disabled: true,
          confirmed: true,
          reason: "SECURITY_REVIEW",
        }),
      ).rejects.toMatchObject({ code: "P2003" });
      expect(log).toHaveBeenCalledOnce();
      expect(
        (await db.user.findUniqueOrThrow({ where: { id: target.id } }))
          .disabledAt,
      ).toBeNull();
      expect(
        (await req("/users/me", "GET", undefined, target.cookie)).status,
      ).toBe(200);
      expect(
        await db.auditLog.count({ where: { targetUserId: target.id } }),
      ).toBe(0);
    } finally {
      log.mockRestore();
    }
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
