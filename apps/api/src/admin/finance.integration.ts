import "reflect-metadata";
import { beforeAll, afterAll, it, expect } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { AppModule } from "../app.module";
import { configureApp } from "../shared/http/configure";
const url = process.env.TEST_DATABASE_URL!;
if (
  !url ||
  !["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname) ||
  new URL(url).pathname !== "/revynora_test"
)
  throw Error("Base de test locale existante obligatoire");
process.env.DATABASE_URL = url;
process.env.WORKER_ENABLED = "false";
const db = new PrismaClient({ datasources: { db: { url } } }),
  ids: string[] = [],
  paymentIds: string[] = [],
  periodIds: string[] = [];
let app: INestApplication, base: string, admin: string, student: string;
async function account(role: "ADMIN" | "STUDENT") {
  const u = await db.user.create({
    data: {
      name: "G6 fixture",
      email: randomUUID() + "@example.test",
      passwordHash: "TEST_ONLY_NOT_A_PASSWORD",
      role,
    },
  });
  ids.push(u.id);
  const token = randomBytes(32).toString("base64url");
  await db.session.create({
    data: {
      userId: u.id,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 600000),
    },
  });
  return "revynora_session=" + token;
}
async function get(path: string, cookie = admin) {
  const r = await fetch(base + path, { headers: { cookie } });
  return { status: r.status, data: await r.json() };
}
beforeAll(async () => {
  admin = await account("ADMIN");
  student = await account("STUDENT");
  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = configureApp(module.createNestApplication());
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
  base += "/api/v1/admin";
  for (let i = 0; i < 22; i++) {
    const id = randomUUID();
    paymentIds.push(id);
    await db.payment.create({
      data: {
        id,
        userId: ids[0],
        provider: "g6-unknown",
        providerReference: "PRIVATE_REF_" + id,
        receiptUrl: "https://private.example/receipt",
        amountCents: i === 0 ? 2147483647 : i === 1 ? 0 : 250,
        currency: "eur",
        status: "PAID",
        createdAt: new Date(Date.UTC(2099, 0, 1, 0, 0, i)),
      },
    });
  }
  for (const [provider, status] of [
    ["mock", "FAILED"],
    ["stripe", "PENDING"],
    ["stripe", "REFUNDED"],
    ["mock", "PAID"],
  ] as const) {
    const id = randomUUID();
    paymentIds.push(id);
    await db.payment.create({
      data: {
        id,
        userId: ids[0],
        provider,
        providerReference: "PRIVATE_REF_" + id,
        amountCents: 0,
        currency: "usd",
        status,
        createdAt: new Date("2099-02-01"),
      },
    });
  }
  const offer = await db.subscription.findUniqueOrThrow({
    where: { code: "FREE" },
  });
  const period = await db.userSubscriptionHistory.create({
    data: {
      userId: ids[0]!,
      subscriptionId: offer.id,
      provider: "internal",
      providerSubscriptionId: "PRIVATE_SUB_" + randomUUID(),
      priceCents: 0,
      currency: "eur",
      status: "ACTIVE",
      startsAt: new Date("2020-01-01"),
      endsAt: new Date("2020-02-01"),
    },
  });
  periodIds.push(period.id);
  for (const status of ["PAST_DUE", "CANCELLED", "INCOMPLETE"] as const) {
    const row = await db.userSubscriptionHistory.create({
      data: {
        userId: ids[0]!,
        subscriptionId: offer.id,
        provider: "internal",
        providerSubscriptionId: "PRIVATE_SUB_" + randomUUID(),
        priceCents: 0,
        currency: "eur",
        status,
        startsAt: new Date("2020-01-01"),
        endsAt: new Date("2020-02-01"),
      },
    });
    periodIds.push(row.id);
  }
}, 30000);
afterAll(async () => {
  await app?.close();
  await db.userSubscriptionHistory.deleteMany({
    where: { id: { in: periodIds } },
  });
  await db.payment.deleteMany({ where: { id: { in: paymentIds } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});
it("refuse anonyme et STUDENT pour toutes les nouvelles lectures", async () => {
  for (const path of ["/payments", "/subscriptions", "/offers"]) {
    expect((await get(path, "")).status).toBe(401);
    expect((await get(path, student)).status).toBe(403);
  }
});
it("filtre et pagine sans doublons ni champs privés ; conserve les montants exacts", async () => {
  await expect(
    db.payment.create({
      data: {
        userId: ids[0],
        provider: "mock",
        providerReference: "negative-" + randomUUID(),
        amountCents: -1,
        currency: "eur",
        status: "PENDING",
      },
    }),
  ).rejects.toThrow();
  const a = await get("/payments?provider=other&status=PAID"),
    b = await get("/payments?provider=other&status=PAID&page=2");
  expect(a.status).toBe(200);
  expect(a.data.items).toHaveLength(20);
  expect(b.data.items.length).toBeGreaterThanOrEqual(2);
  const rows = [...a.data.items, ...b.data.items];
  expect(new Set(rows.map((x) => x.id)).size).toBe(rows.length);
  expect(rows.find((x) => x.id === paymentIds[0]).amountCents).toBe(2147483647);
  expect(rows.find((x) => x.id === paymentIds[1]).amountCents).toBe(0);
  for (const row of rows) {
    expect(Object.keys(row).sort()).toEqual(
      [
        "id",
        "provider",
        "amountCents",
        "currency",
        "status",
        "createdAt",
        "verification",
      ].sort(),
    );
    expect(row.provider).toBe("other");
    expect(row.verification).toBe("UNVERIFIED");
  }
  expect(JSON.stringify(a.data)).not.toMatch(
    /PRIVATE_REF|receipt|userId|password|example.test/,
  );
  expect((await get("/payments?page=10000")).data.items).toEqual([]);
  for (const query of [
    "page=0",
    "page=1.2",
    "page=10001",
    "status=SUCCESS",
    "provider=unknown",
    "userId=x",
  ]) {
    expect((await get("/payments?" + query)).status).toBe(400);
  }
});
it("différencie simulations, statuts Stripe et périodes historiques", async () => {
  for (const [provider, status] of [
    ["mock", "FAILED"],
    ["stripe", "PENDING"],
    ["stripe", "REFUNDED"],
    ["mock", "PAID"],
  ]) {
    const r = await get(`/payments?provider=${provider}&status=${status}`);
    expect(r.status).toBe(200);
    expect(r.data.items.length).toBeGreaterThan(0);
    for (const row of r.data.items) {
      expect(row.status).toBe(status);
      expect(row.verification).toBe(
        provider === "mock" ? "SIMULATION" : "UNVERIFIED",
      );
    }
  }
  const r = await get(
    "/subscriptions?plan=FREE&provider=internal&status=ACTIVE",
  );
  expect(r.status).toBe(200);
  const row = r.data.items.find((x: { id: string }) => x.id === periodIds[0]);
  expect(row.endsAt).toBe("2020-02-01T00:00:00.000Z");
  expect(Object.keys(row).sort()).toEqual(
    [
      "id",
      "provider",
      "status",
      "priceCents",
      "currency",
      "startsAt",
      "endsAt",
      "cancelAtPeriodEnd",
      "plan",
    ].sort(),
  );
  expect(row).not.toHaveProperty("userId");
  expect(JSON.stringify(r.data)).not.toContain("PRIVATE_SUB");

  for (const status of ["PAST_DUE", "CANCELLED", "INCOMPLETE"]) {
    const page = await get(
      "/subscriptions?provider=internal&plan=FREE&status=" + status,
    );
    expect(page.status).toBe(200);
    expect(page.data.items.length).toBeGreaterThan(0);
    expect(
      page.data.items.every((row: { status: string }) => row.status === status),
    ).toBe(true);
  }
  expect((await get("/subscriptions?plan=VIP")).status).toBe(400);
});

it("pagine les périodes sans doublons et applique simultanément offre, statut et fournisseur", async () => {
  const offer = await db.subscription.findUniqueOrThrow({
    where: { code: "PLUS" },
  });
  const created = Array.from({ length: 23 }, () => randomUUID());
  periodIds.push(...created);
  await db.userSubscriptionHistory.createMany({
    data: created.map((id, i) => ({
      id,
      userId: ids[0]!,
      subscriptionId: offer.id,
      provider: "g6-private-provider",
      providerSubscriptionId: randomUUID(),
      priceCents: 250,
      currency: "eur",
      status: "INCOMPLETE" as const,
      startsAt: new Date("2020-01-01"),
      endsAt: new Date("2020-02-01"),
      createdAt: new Date(Date.UTC(2099, 1, 1, 0, 0, i)),
    })),
  });
  const first = await get(
    "/subscriptions?provider=other&plan=PLUS&status=INCOMPLETE",
  );
  const second = await get(
    "/subscriptions?provider=other&plan=PLUS&status=INCOMPLETE&page=2",
  );
  expect(first.status).toBe(200);
  expect(second.status).toBe(200);
  expect(first.data.items).toHaveLength(20);
  const selected = [...first.data.items, ...second.data.items];
  expect(new Set(selected.map((row) => row.id)).size).toBe(selected.length);
  for (const id of created)
    expect(selected.some((row) => row.id === id)).toBe(true);
  for (const row of selected) {
    expect(row.plan).toBe("PLUS");
    expect(row.status).toBe("INCOMPLETE");
    expect(row.provider).toBe("other");
  }
  for (const query of [
    "page=0",
    "pageSize=100",
    "userId=private",
    "provider=live",
    "status=PAID",
  ])
    expect((await get("/subscriptions?" + query)).status).toBe(400);
});
