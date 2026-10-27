import Stripe from "stripe";
import "reflect-metadata";
import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { AppModule } from "../app.module";
import { configureApp } from "../shared/http/configure";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { CommercialDraft } from "./domain";
import { CommercialCatalogService } from "./service";
import type { DatabaseService } from "../database/database.service";
import { PrismaBillingRepository } from "../billing/infrastructure/prisma-billing.repository";
import {
  MockBillingProvider,
  StripeBillingProvider,
} from "../billing/infrastructure/billing.provider";
import {
  BillingUseCases,
  GetEntitlements,
  ProcessBillingWebhook,
} from "../billing/application/billing.use-cases";
const raw = process.env.TEST_DATABASE_URL;
if (
  !raw ||
  new URL(raw).pathname !== "/revynora_test" ||
  !["127.0.0.1", "localhost"].includes(new URL(raw).hostname) ||
  process.env.G8_ISOLATED_TEST_DB !== "true"
)
  throw Error("G9 isolated database required");
const db = new PrismaClient({ datasources: { db: { url: raw } } }),
  service = new CommercialCatalogService({ client: db } as DatabaseService),
  ids: string[] = [],
  versions: string[] = [];
let app: INestApplication, base: string;
let actor: string,
  admin: string,
  student: string,
  offer: Awaited<ReturnType<typeof db.subscription.findUniqueOrThrow>>,
  original: {
    name: string;
    priceCents: number;
    currency: string;
    interval: string;
    active: boolean;
    revision: number;
    currentVersionId: string | null;
  };
const input = (
  expectedRevision: number,
  priceCents = 333,
): CommercialDraft => ({
  expectedRevision,
  name: "Plus G9 test",
  priceCents,
  currency: "eur" as const,
  interval: "month" as const,
  active: true,
  features: ["leitner"],
  reason: "Validation commerciale isolée",
});
beforeAll(async () => {
  for (const role of ["ADMIN", "ADMIN", "STUDENT"] as const) {
    const u = await db.user.create({
      data: {
        email: randomUUID() + "@example.test",
        name: "G9 fixture",
        role,
        passwordHash: "TEST_ONLY",
      },
    });
    ids.push(u.id);
  }
  [actor, admin, student] = ids;
  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = configureApp(
    module.createNestApplication({ logger: false, rawBody: true }),
  );
  await app.listen(0, "127.0.0.1");
  base = (await app.getUrl()) + "/api/v1";
  await db.commercialPermission.create({
    data: { userId: actor, provenance: "G9 isolated test fixture" },
  });
  offer = await db.subscription.findUniqueOrThrow({ where: { code: "PLUS" } });
  original = {
    name: offer.name,
    priceCents: offer.priceCents,
    currency: offer.currency,
    interval: offer.interval,
    active: offer.active,
    revision: offer.revision,
    currentVersionId: offer.currentVersionId,
  };
});
afterAll(async () => {
  await app?.close();
  for (const id of ids)
    await db.mockBillingRecord.deleteMany({
      where: { snapshot: { path: ["userId"], equals: id } },
    });
  // Published versions and commercial audits intentionally remain immutable until this isolated database is destroyed.
  await db.subscription.update({ where: { id: offer.id }, data: original });
  await db.commercialPermission.deleteMany({ where: { userId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});
it("refuse ADMIN sans capacité et étudiant même avec rôle commercial injecté", async () => {
  await expect(service.list(admin)).rejects.toMatchObject({ status: 403 });
  await expect(
    service.draft(student, offer.id, input(offer.revision)),
  ).rejects.toMatchObject({ status: 403 });
  await db.commercialPermission.create({
    data: { userId: student, provenance: "negative isolated test" },
  });
  await expect(service.list(student)).rejects.toMatchObject({ status: 403 });
});
it("publie une seule version concurrente, trace et refuse toute mutation d’une version publiée", async () => {
  const a = await service.draft(actor, offer.id, input(offer.revision)),
    b = await service.draft(actor, offer.id, input(offer.revision, 444));
  versions.push(a.id, b.id);
  const results = await Promise.allSettled([
    service.publish(actor, a.id, offer.revision, a.id),
    service.publish(actor, b.id, offer.revision, b.id),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const current = await db.subscription.findUniqueOrThrow({
    where: { id: offer.id },
  });
  expect(current.revision).toBe(offer.revision + 1);
  await expect(
    db.subscription.update({
      where: { id: offer.id },
      data: { priceCents: 1 },
    }),
  ).rejects.toThrow();
  await expect(
    db.commercialOfferVersion.update({
      where: { id: current.currentVersionId! },
      data: { priceCents: 1 },
    }),
  ).rejects.toThrow();
  expect(await service.history(actor, 1)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        action: "VERSION_PUBLISHED",
        versionId: current.currentVersionId,
      }),
    ]),
  );
});
it("fige le checkout et conserve son contrat après une nouvelle publication", async () => {
  const repo = new PrismaBillingRepository(db),
    provider = new MockBillingProvider(db),
    billing = new BillingUseCases(repo, provider, new GetEntitlements(repo)),
    webhook = new ProcessBillingWebhook(repo, provider);
  const checkout = await billing.checkout(student, "PLUS"),
    intent = await db.checkoutIntent.findUniqueOrThrow({
      where: { id: checkout.intentId },
    });
  const current = await db.subscription.findUniqueOrThrow({
      where: { id: offer.id },
    }),
    v = await service.draft(actor, offer.id, {
      ...input(current.revision, 777),
      features: ["leitner", "planning", "reminders"],
    });
  versions.push(v.id);
  await service.publish(actor, v.id, current.revision, v.id);
  const e = await provider.complete(student, intent.id, true);
  await webhook.execute(e.raw, e.signature);
  await webhook.execute(e.raw, e.signature);
  const periods = await db.userSubscriptionHistory.findMany({
    where: { userId: student },
  });
  expect(periods).toHaveLength(1);
  expect(periods[0]).toMatchObject({
    priceCents: intent.acceptedPriceCents,
    commercialVersionId: intent.commercialVersionId,
    features: intent.acceptedFeatures,
  });
  expect(
    (await db.payment.findFirstOrThrow({ where: { userId: student } }))
      .amountCents,
  ).toBe(intent.acceptedPriceCents);
  await expect(
    db.userSubscriptionHistory.update({
      where: { id: periods[0].id },
      data: { priceCents: 1 },
    }),
  ).rejects.toThrow();
  await expect(
    db.checkoutIntent.update({
      where: { id: intent.id },
      data: { acceptedPriceCents: 1 },
    }),
  ).rejects.toThrow();
});
it("refuse la publication sans confirmation et sans preuve Stripe test", async () => {
  const c = await db.subscription.findUniqueOrThrow({
      where: { id: offer.id },
    }),
    v = await service.draft(actor, offer.id, input(c.revision));
  versions.push(v.id);
  await expect(
    service.publish(actor, v.id, c.revision, randomUUID()),
  ).rejects.toMatchObject({ status: 422 });
  const previous = process.env.BILLING_PROVIDER;
  process.env.BILLING_PROVIDER = "stripe";
  try {
    await expect(
      service.publish(actor, v.id, c.revision, v.id),
    ).rejects.toMatchObject({ code: "PROVIDER_PRICE_REQUIRED" });
  } finally {
    process.env.BILLING_PROVIDER = previous ?? "mock";
  }
});

it("vérifie la capacité commerciale sur les routes API et refuse les corps inconnus", async () => {
  async function cookie(userId: string) {
    const token = randomBytes(32).toString("base64url");
    await db.session.create({
      data: {
        userId,
        tokenHash: createHash("sha256").update(token).digest("hex"),
        expiresAt: new Date(Date.now() + 60000),
      },
    });
    return "revynora_session=" + token;
  }
  const unprivileged = await cookie(admin),
    allowed = await cookie(actor);
  const headers = {
    "Content-Type": "application/json",
    "X-Revynora-Client": "web",
    Origin: "http://localhost:3002",
  };
  expect(
    (
      await fetch(base + "/admin/commercial/offers", {
        headers: { ...headers, cookie: unprivileged },
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await fetch(base + "/admin/commercial/offers", {
        headers: { ...headers, cookie: allowed },
      })
    ).status,
  ).toBe(200);
  const c = await db.subscription.findUniqueOrThrow({
    where: { id: offer.id },
  });
  expect(
    (
      await fetch(base + "/admin/commercial/offers/" + offer.id + "/drafts", {
        method: "POST",
        headers: { ...headers, cookie: allowed },
        body: JSON.stringify({ ...input(c.revision), unexpected: true }),
      })
    ).status,
  ).toBe(400);
  const created = await fetch(
    base + "/admin/commercial/offers/" + offer.id + "/drafts",
    {
      method: "POST",
      headers: { ...headers, cookie: allowed },
      body: JSON.stringify(input(c.revision)),
    },
  );
  expect(created.status).toBe(201);
  const draft = (await created.json()) as { id: string };
  expect(
    (
      await fetch(base + "/admin/commercial/history", {
        headers: { ...headers, cookie: allowed },
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await fetch(
        base + "/admin/commercial/versions/" + draft.id + "/verify-price",
        {
          method: "POST",
          headers: { ...headers, cookie: allowed },
          body: JSON.stringify({ priceId: "price_fixture" }),
        },
      )
    ).status,
  ).toBe(422);
  expect(
    (
      await fetch(
        base + "/admin/commercial/versions/" + draft.id + "/publish",
        {
          method: "POST",
          headers: { ...headers, cookie: allowed },
          body: JSON.stringify({
            expectedRevision: c.revision,
            confirmVersionId: draft.id,
          }),
        },
      )
    ).status,
  ).toBe(201);
  await db.user.update({
    where: { id: actor },
    data: { disabledAt: new Date() },
  });
  await expect(service.list(actor)).rejects.toMatchObject({ status: 403 });
  await db.user.update({ where: { id: actor }, data: { disabledAt: null } });
});

it("vérifie uniquement par lectures Stripe test, associe et publie sans mutation distante", async () => {
  const c = await db.subscription.findUniqueOrThrow({
      where: { id: offer.id },
    }),
    v = await service.draft(actor, offer.id, input(c.revision, 888));
  versions.push(v.id);
  const oldKey = process.env.STRIPE_SECRET_KEY,
    oldProvider = process.env.BILLING_PROVIDER;
  const stripe = new Stripe("sk_test_g9_fixture"),
    client = vi.spyOn(service, "stripeClient").mockReturnValue(stripe);
  const price = {
    id: "price_g9_fixture_" + randomUUID().replaceAll("-", ""),
    active: true,
    livemode: false,
    type: "recurring",
    unit_amount: 888,
    currency: "eur",
    billing_scheme: "per_unit",
    recurring: { interval: "month", interval_count: 1, usage_type: "licensed" },
    transform_quantity: null,
    custom_unit_amount: null,
  };
  const retrieve = vi
    .spyOn(stripe.prices, "retrieve")
    .mockResolvedValue(price as Stripe.Response<Stripe.Price>);
  vi.spyOn(stripe.accounts, "retrieve").mockResolvedValue({
    id: "acct_g9_fixture",
  } as Stripe.Response<Stripe.Account>);
  process.env.STRIPE_SECRET_KEY = "sk_test_g9_fixture";
  process.env.BILLING_PROVIDER = "stripe";
  try {
    retrieve.mockResolvedValueOnce({
      ...price,
      livemode: true,
    } as Stripe.Response<Stripe.Price>);
    await expect(
      service.verifyStripe(actor, v.id, price.id),
    ).rejects.toMatchObject({ code: "UNVERIFIED_PROVIDER_PRICE" });
    const binding = await service.verifyStripe(actor, v.id, price.id);
    expect(binding.environment).toBe("test");
    expect((await service.verifyStripe(actor, v.id, price.id)).id).toBe(
      binding.id,
    );
    await service.publish(actor, v.id, c.revision, v.id);
    await expect(
      service.verifyStripe(actor, v.id, price.id),
    ).rejects.toMatchObject({ code: "IMMUTABLE_VERSION" });
    await expect(
      db.commercialProviderPrice.update({
        where: { id: binding.id },
        data: { priceId: "price_other" },
      }),
    ).rejects.toThrow();
    expect(client).toHaveBeenCalled();
  } finally {
    vi.restoreAllMocks();
    if (oldKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = oldKey;
    process.env.BILLING_PROVIDER = oldProvider ?? "mock";
  }
});

it("annule toute publication si son audit atomique échoue", async () => {
  const c = await db.subscription.findUniqueOrThrow({
      where: { id: offer.id },
    }),
    v = await service.draft(actor, offer.id, input(c.revision, 999));
  await db.$executeRawUnsafe(
    `CREATE FUNCTION g9_fixture_audit_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='VERSION_PUBLISHED' THEN RAISE EXCEPTION 'G9 isolated audit failure'; END IF; RETURN NEW; END $$`,
  );
  await db.$executeRawUnsafe(
    `CREATE TRIGGER g9_fixture_audit_fail BEFORE INSERT ON "CommercialAudit" FOR EACH ROW EXECUTE FUNCTION g9_fixture_audit_fail()`,
  );
  try {
    await expect(
      service.publish(actor, v.id, c.revision, v.id),
    ).rejects.toThrow();
    expect(
      (await db.subscription.findUniqueOrThrow({ where: { id: offer.id } }))
        .currentVersionId,
    ).toBe(c.currentVersionId);
    expect(
      (
        await db.commercialOfferVersion.findUniqueOrThrow({
          where: { id: v.id },
        })
      ).state,
    ).toBe("DRAFT");
  } finally {
    await db.$executeRawUnsafe(
      `DROP TRIGGER g9_fixture_audit_fail ON "CommercialAudit"`,
    );
    await db.$executeRawUnsafe(`DROP FUNCTION g9_fixture_audit_fail()`);
  }
});
it("retire les nouvelles ventes sans retirer les droits du contrat existant", async () => {
  const repo = new PrismaBillingRepository(db),
    provider = new MockBillingProvider(db),
    access = new GetEntitlements(repo),
    billing = new BillingUseCases(repo, provider, access);
  const before = await access.execute(student),
    c = await db.subscription.findUniqueOrThrow({ where: { id: offer.id } }),
    v = await service.draft(actor, offer.id, {
      ...input(c.revision),
      active: false,
    });
  await service.publish(actor, v.id, c.revision, v.id);
  expect(await access.execute(student)).toEqual(before);
  const u = await db.user.create({
    data: {
      email: randomUUID() + "@example.test",
      name: "G9 new customer",
      passwordHash: "TEST_ONLY",
    },
  });
  ids.push(u.id);
  await expect(billing.checkout(u.id, "PLUS")).rejects.toMatchObject({
    code: "PLAN_NOT_FOUND",
  });
});
it("refuse un tarif non prouvé au lieu de le reconstruire depuis le catalogue", async () => {
  const repo = new PrismaBillingRepository(db),
    u = await db.user.findUniqueOrThrow({ where: { id: student } }),
    event = {
      id: "unproven_" + randomUUID(),
      type: "invoice.paid",
      created: 1,
    };
  await expect(
    repo.apply(
      event,
      {
        userId: student,
        customerId: u.stripeCustomerId!,
        subscriptionId: "unknown_" + randomUUID(),
        plan: "PLUS",
        status: "ACTIVE",
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 10000),
        cancelAtPeriodEnd: false,
      },
      "mock",
    ),
  ).rejects.toMatchObject({ code: "CONTRACT_PRICE_UNPROVEN" });
  expect(
    await db.userPaymentHistory.findUnique({
      where: { providerEventId: event.id },
    }),
  ).toBeNull();
});

it("refuse le prix Stripe incompatible avant toute intention et protège le catalogue contre la course", async () => {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_g9_regression");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_g9_regression");
  const repo = new PrismaBillingRepository(db),
    provider = new StripeBillingProvider(db);
  const current = await db.subscription.findUniqueOrThrow({
    where: { id: offer.id },
  });
  const v = await service.draft(actor, offer.id, input(current.revision, 1201));
  const priceId = "price_g9_regression_" + randomUUID().replaceAll("-", "");
  const price = {
    id: priceId,
    active: true,
    livemode: false,
    type: "recurring",
    unit_amount: v.priceCents,
    currency: "eur",
    billing_scheme: "per_unit",
    recurring: { interval: "month", interval_count: 1, usage_type: "licensed" },
    transform_quantity: null,
    custom_unit_amount: null,
  };
  const accountId = "acct_g9_" + randomUUID().replaceAll("-", "");
  vi.spyOn(service, "stripeClient").mockReturnValue(provider.stripe);
  vi.spyOn(provider.stripe.accounts, "retrieve").mockResolvedValue({
    id: accountId,
  } as Stripe.Response<Stripe.Account>);
  const prices = vi
    .spyOn(provider.stripe.prices, "retrieve")
    .mockResolvedValue(price as Stripe.Response<Stripe.Price>);
  const sessions = vi
    .spyOn(provider.stripe.checkout.sessions, "create")
    .mockRejectedValue(new Error("Unexpected synthetic session mutation"));
  const customers = vi
    .spyOn(provider.stripe.customers, "create")
    .mockRejectedValue(new Error("Unexpected synthetic customer mutation"));
  try {
    await service.verifyStripe(actor, v.id, priceId);
    await service.publish(actor, v.id, current.revision, v.id);
    const user = await db.user.create({
      data: {
        email: randomUUID() + "@example.test",
        name: "G9 preflight fixture",
        passwordHash: "TEST_ONLY",
      },
    });
    ids.push(user.id);
    const billing = new BillingUseCases(
      repo,
      provider,
      new GetEntitlements(repo),
    );
    for (const incompatible of [
      { ...price, recurring: { ...price.recurring, interval_count: 12 } },
      { ...price, active: false },
    ]) {
      prices.mockResolvedValue(incompatible as Stripe.Response<Stripe.Price>);
      await expect(billing.checkout(user.id, "PLUS")).rejects.toMatchObject({
        code: "BILLING_UNAVAILABLE",
      });
      expect(
        await db.checkoutIntent.count({ where: { userId: user.id } }),
      ).toBe(0);
    }
    expect(sessions).not.toHaveBeenCalled();
    expect(customers).not.toHaveBeenCalled();
    const mock = new MockBillingProvider(db),
      mockBilling = new BillingUseCases(repo, mock, new GetEntitlements(repo));
    const validate = mock.validateQuote.bind(mock);
    vi.spyOn(mock, "validateQuote").mockImplementationOnce(
      async (quote, plan) => {
        await validate(quote, plan);
        const c = await db.subscription.findUniqueOrThrow({
          where: { id: offer.id },
        });
        const next = await service.draft(
          actor,
          offer.id,
          input(c.revision, 1202),
        );
        await service.publish(actor, next.id, c.revision, next.id);
      },
    );
    await expect(mockBilling.checkout(user.id, "PLUS")).rejects.toMatchObject({
      code: "COMMERCIAL_CONFLICT",
    });
    expect(await db.checkoutIntent.count({ where: { userId: user.id } })).toBe(
      0,
    );
  } finally {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  }
});

it("un webhook Stripe incohérent préserve les périodes ; sa reprise valide reste idempotente", async () => {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_g9_reconciliation");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_g9_reconciliation");
  const provider = new StripeBillingProvider(db),
    repo = new PrismaBillingRepository(db);
  const handler = new ProcessBillingWebhook(repo, provider);
  const binding = await db.commercialProviderPrice.findFirstOrThrow({
    where: {
      provider: "stripe",
      environment: "test",
      version: { subscriptionId: offer.id, state: "PUBLISHED" },
    },
    include: { version: true },
  });
  const customerId = "cus_g9_" + randomUUID(),
    subscriptionId = "sub_g9_" + randomUUID();
  const start = Math.floor(Date.now() / 1000),
    end = start + 2592000;
  const user = await db.user.create({
    data: {
      email: randomUUID() + "@example.test",
      name: "G9 reconciliation fixture",
      passwordHash: "TEST_ONLY",
      stripeCustomerId: customerId,
    },
  });
  ids.push(user.id);
  await db.userSubscriptionHistory.create({
    data: {
      userId: user.id,
      subscriptionId: offer.id,
      provider: "stripe",
      providerSubscriptionId: subscriptionId,
      commercialVersionId: binding.versionId,
      providerPriceId: binding.priceId,
      contractEvidence: "VERSIONED",
      features: binding.version.features,
      priceCents: binding.version.priceCents,
      currency: binding.version.currency,
      status: "ACTIVE",
      startsAt: new Date(start * 1000),
      endsAt: new Date(end * 1000),
    },
  });
  const periodBefore = await db.userSubscriptionHistory.findMany({
    where: { userId: user.id },
  });
  const auditsBefore = await db.commercialAudit.count();
  const sub = {
    id: subscriptionId,
    customer: customerId,
    livemode: false,
    status: "active",
    cancel_at_period_end: false,
    latest_invoice: "in_g9_" + randomUUID(),
    metadata: { commercialVersionId: binding.versionId },
    items: {
      data: [
        {
          quantity: 1,
          price: {
            id: binding.priceId,
            livemode: false,
            active: false,
            type: "recurring",
            unit_amount: binding.version.priceCents,
            currency: "eur",
            billing_scheme: "per_unit",
            recurring: {
              interval: "month",
              interval_count: 1,
              usage_type: "licensed",
            },
          },
          current_period_start: start,
          current_period_end: end,
        },
      ],
    },
  };
  vi.spyOn(provider.stripe.accounts, "retrieve").mockResolvedValue({
    id: binding.accountId,
  } as Stripe.Response<Stripe.Account>);
  const subscriptions = vi
    .spyOn(provider.stripe.subscriptions, "retrieve")
    .mockResolvedValue(sub as unknown as Stripe.Response<Stripe.Subscription>);
  vi.spyOn(provider.stripe.invoices, "retrieve").mockResolvedValue({
    id: sub.latest_invoice,
    customer: customerId,
    livemode: false,
    currency: "eur",
    amount_due: binding.version.priceCents,
    status: "paid",
    hosted_invoice_url: null,
    parent: { subscription_details: { subscription: subscriptionId } },
  } as Stripe.Response<Stripe.Invoice>);
  const eventId = "evt_g9_" + randomUUID();
  function signed(account: string) {
    const payload = JSON.stringify({
      id: eventId,
      account,
      type: "invoice.paid",
      created: start,
      livemode: false,
      data: {
        object: {
          id: sub.latest_invoice,
          object: "invoice",
          customer: customerId,
          parent: { subscription_details: { subscription: subscriptionId } },
        },
      },
    });
    return {
      raw: Buffer.from(payload),
      signature: provider.stripe.webhooks.generateTestHeaderString({
        payload,
        secret: "whsec_g9_reconciliation",
      }),
    };
  }
  try {
    const wrong = signed("acct_unrelated");
    await expect(
      handler.execute(wrong.raw, wrong.signature),
    ).rejects.toMatchObject({ code: "RECONCILIATION_FAILED" });
    expect(subscriptions).not.toHaveBeenCalled();
    const valid = signed(binding.accountId);
    subscriptions.mockResolvedValueOnce({
      ...sub,
      livemode: true,
    } as unknown as Stripe.Response<Stripe.Subscription>);
    await expect(
      handler.execute(valid.raw, valid.signature),
    ).rejects.toMatchObject({ code: "RECONCILIATION_FAILED" });
    expect(
      await db.userSubscriptionHistory.findMany({ where: { userId: user.id } }),
    ).toEqual(periodBefore);
    expect(await db.commercialAudit.count()).toBe(auditsBefore);
    expect(
      await db.userPaymentHistory.count({
        where: { providerEventId: eventId },
      }),
    ).toBe(0);
    expect(await db.payment.count({ where: { userId: user.id } })).toBe(0);
    await handler.execute(valid.raw, valid.signature);
    expect(await handler.execute(valid.raw, valid.signature)).toEqual({
      received: true,
      duplicate: true,
    });
    expect(
      await db.userSubscriptionHistory.findMany({ where: { userId: user.id } }),
    ).toEqual(periodBefore);
    expect(
      await db.userPaymentHistory.count({
        where: { providerEventId: eventId },
      }),
    ).toBe(1);
    expect(await db.payment.count({ where: { userId: user.id } })).toBe(1);
  } finally {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  }
});
