import { describe, it, expect, vi, afterEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { BillingRepository, CommercialQuote } from "../domain/billing";
import {
  BillingUseCases,
  GetEntitlements,
  ProcessBillingWebhook,
} from "../application/billing.use-cases";
import { StripeBillingProvider } from "./billing.provider";

const cast = <T>(value: unknown) => value as T;
const quote = (plan: "PLUS" | "PRO" = "PLUS"): CommercialQuote => ({
  commercialVersionId: `version_${plan}`,
  providerPriceId: `price_${plan.toLowerCase()}`,
  priceCents: plan === "PLUS" ? 250 : 500,
  currency: "eur",
  interval: "month",
});
const price = (plan: "PLUS" | "PRO" = "PLUS") => ({
  id: quote(plan).providerPriceId!,
  active: true,
  livemode: false,
  type: "recurring",
  unit_amount: quote(plan).priceCents,
  currency: "eur",
  billing_scheme: "per_unit",
  recurring: { interval: "month", interval_count: 1, usage_type: "licensed" },
  transform_quantity: null,
  custom_unit_amount: null,
});
const binding = (plan: "PLUS" | "PRO" = "PLUS") => ({
  versionId: quote(plan).commercialVersionId!,
  priceId: quote(plan).providerPriceId!,
  provider: "stripe",
  environment: "test",
  accountId: "acct_test",
  version: {
    ...quote(plan),
    id: quote(plan).commercialVersionId!,
    state: "PUBLISHED",
    features: ["leitner"],
    subscription: { code: plan },
  },
});
const sub = () => ({
  id: "sub_1",
  customer: "cus_1",
  livemode: false,
  status: "active",
  cancel_at_period_end: false,
  latest_invoice: "in_1",
  schedule: null,
  metadata: { commercialVersionId: "version_PLUS" },
  items: {
    data: [
      {
        quantity: 1,
        price: { ...price(), active: false },
        current_period_start: 100,
        current_period_end: 200,
      },
    ],
  },
});
const invoice = () => ({
  id: "in_1",
  status: "paid",
  livemode: false,
  customer: "cus_1",
  currency: "eur",
  amount_due: 250,
  parent: { subscription_details: { subscription: "sub_1" } },
  hosted_invoice_url: null,
});
const event = () => ({
  id: "evt_1",
  type: "invoice.paid",
  created: 1,
  accountId: "acct_test",
  livemode: false,
  customerId: "cus_1",
  subscriptionId: "sub_1",
  invoiceId: "in_1",
});
const input = () => ({
  ...quote(),
  intentId: "intent",
  userId: "user",
  customerId: null,
  email: "a@example.test",
  plan: "PLUS" as const,
});
function setup() {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_fake");
  vi.stubEnv("STRIPE_PRICE_PLUS", "price_plus");
  const db = {
    commercialProviderPrice: {
      findFirst: vi
        .fn()
        .mockImplementation(
          async ({
            where,
          }: {
            where: { versionId?: string; priceId: string };
          }) => binding(where.priceId === "price_pro" ? "PRO" : "PLUS"),
        ),
    },
    userSubscriptionHistory: {
      findFirst: vi.fn().mockResolvedValue({
        userId: "user",
        commercialVersionId: "version_PLUS",
        priceCents: 250,
        currency: "eur",
        providerPriceId: "price_plus",
        contractEvidence: "VERSIONED",
        features: ["leitner"],
        subscription: { code: "PLUS" },
      }),
    },
    user: { findUnique: vi.fn().mockResolvedValue({ id: "user" }) },
  };
  const p = new StripeBillingProvider(db as unknown as PrismaClient);
  // Every SDK method exercised here is replaced. No Stripe HTTP call is used.
  vi.spyOn(p.stripe.accounts, "retrieve").mockResolvedValue(
    cast({ id: "acct_test" }),
  );
  vi.spyOn(p.stripe.prices, "retrieve").mockImplementation(async (id) =>
    cast(price(id === "price_pro" ? "PRO" : "PLUS")),
  );
  vi.spyOn(p.stripe.subscriptions, "retrieve").mockResolvedValue(cast(sub()));
  vi.spyOn(p.stripe.subscriptions, "list").mockResolvedValue(
    cast({ data: [] }),
  );
  vi.spyOn(p.stripe.subscriptions, "cancel").mockResolvedValue(cast({}));
  vi.spyOn(p.stripe.customers, "create").mockResolvedValue(
    cast({ id: "cus_1" }),
  );
  vi.spyOn(p.stripe.customers, "del").mockResolvedValue(cast({}));
  vi.spyOn(p.stripe.checkout.sessions, "create").mockResolvedValue(
    cast({ id: "cs_1", url: "https://checkout.stripe.com/test" }),
  );
  vi.spyOn(p.stripe.checkout.sessions, "retrieve").mockResolvedValue(
    cast({
      id: "cs_1",
      customer: "cus_1",
      livemode: false,
      subscription: "sub_1",
    }),
  );
  vi.spyOn(p.stripe.invoices, "retrieve").mockResolvedValue(cast(invoice()));
  vi.spyOn(p.stripe.subscriptionSchedules, "create").mockResolvedValue(
    cast({ id: "sched_1" }),
  );
  vi.spyOn(p.stripe.subscriptionSchedules, "update").mockResolvedValue(
    cast({}),
  );
  vi.spyOn(p.stripe.subscriptionSchedules, "retrieve").mockResolvedValue(
    cast({
      id: "sched_1",
      livemode: false,
      status: "active",
      subscription: "sub_1",
      current_phase: { start_date: 100, end_date: 200 },
      phases: [
        {
          start_date: 200,
          metadata: { commercialVersionId: "version_PRO" },
          items: [{ price: "price_pro", quantity: 1 }],
        },
      ],
    }),
  );
  vi.spyOn(p.stripe.billingPortal.configurations, "create").mockResolvedValue(
    cast({ id: "bpc_1" }),
  );
  vi.spyOn(p.stripe.billingPortal.sessions, "create").mockResolvedValue(
    cast({ url: "https://billing.stripe.com/test" }),
  );
  return { p, db };
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("Adaptateur Stripe test", () => {
  it("refuse une clé live ou une configuration incomplète", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_fake");
    expect(() => new StripeBillingProvider({} as PrismaClient)).toThrow();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    expect(() => new StripeBillingProvider({} as PrismaClient)).toThrow();
  });
  it("checkout test, client stable, version et clé idempotente", async () => {
    const { p } = setup();
    expect((await p.checkout(input())).customerId).toBe("cus_1");
    expect(p.stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        subscription_data: {
          metadata: {
            userId: "user",
            plan: "PLUS",
            commercialVersionId: "version_PLUS",
          },
        },
      }),
      { idempotencyKey: "intent" },
    );
    await p.checkout({ ...input(), customerId: "cus_1" });
    expect(p.stripe.customers.create).toHaveBeenCalledOnce();
    vi.mocked(p.stripe.subscriptions.list).mockResolvedValue(
      cast({ data: [{ status: "active" }] }),
    );
    await expect(
      p.checkout({ ...input(), customerId: "cus_1" }),
    ).rejects.toMatchObject({ code: "SUBSCRIPTION_EXISTS" });
  });
  it.each([
    {
      recurring: {
        interval: "month",
        interval_count: 12,
        usage_type: "licensed",
      },
    },
    {
      recurring: {
        interval: "year",
        interval_count: 1,
        usage_type: "licensed",
      },
    },
    {
      recurring: {
        interval: "month",
        interval_count: 1,
        usage_type: "metered",
      },
    },
    { active: false },
    { livemode: true },
    { type: "one_time", recurring: null },
    { unit_amount: 999 },
    { currency: "usd" },
    { billing_scheme: "tiered" },
    { transform_quantity: { divide_by: 10, round: "up" } },
    { custom_unit_amount: { enabled: true } },
  ])(
    "refuse le prix incompatible avant intention locale et session : %j",
    async (override) => {
      const { p } = setup();
      vi.mocked(p.stripe.prices.retrieve).mockResolvedValue(
        cast({ ...price(), ...override }),
      );
      const repo = {
        catalog: vi
          .fn()
          .mockResolvedValue([{ ...quote(), code: "PLUS", active: true }]),
        periods: vi.fn().mockResolvedValue([]),
        createCheckout: vi.fn(),
        account: vi.fn(),
      };
      const r = repo as unknown as BillingRepository;
      await expect(
        new BillingUseCases(r, p, new GetEntitlements(r)).checkout(
          "user",
          "PLUS",
        ),
      ).rejects.toMatchObject({ code: "BILLING_UNAVAILABLE" });
      expect(repo.createCheckout).not.toHaveBeenCalled();
      expect(p.stripe.customers.create).not.toHaveBeenCalled();
      expect(p.stripe.checkout.sessions.create).not.toHaveBeenCalled();
      await expect(p.checkout(input())).rejects.toThrow("Invalid test price");
      expect(p.stripe.checkout.sessions.create).not.toHaveBeenCalled();
    },
  );
  it("refuse une récurrence d'offre différente et une version non publiée/non associée", async () => {
    const { p, db } = setup();
    await expect(
      p.validateQuote({ ...quote(), interval: "year" }, "PLUS"),
    ).rejects.toThrow();
    await expect(
      p.validateQuote({ ...quote(), commercialVersionId: null }, "PLUS"),
    ).rejects.toThrow();
    db.commercialProviderPrice.findFirst.mockResolvedValueOnce(null as never);
    await expect(p.validateQuote(quote(), "PLUS")).rejects.toThrow();
    db.commercialProviderPrice.findFirst.mockResolvedValueOnce(
      cast({ ...binding(), version: { ...binding().version, state: "DRAFT" } }),
    );
    await expect(p.validateQuote(quote(), "PLUS")).rejects.toThrow();
    db.commercialProviderPrice.findFirst.mockResolvedValueOnce(
      cast({ ...binding(), accountId: "acct_other" }),
    );
    await expect(p.validateQuote(quote(), "PLUS")).rejects.toThrow();
  });
  it("recontrôle le prix après acceptation locale avant toute mutation Stripe", async () => {
    const { p } = setup();
    await p.validateQuote(quote(), "PLUS");
    vi.mocked(p.stripe.prices.retrieve).mockResolvedValue(
      cast({ ...price(), active: false }),
    );
    await expect(p.checkout(input())).rejects.toThrow();
    expect(p.stripe.customers.create).not.toHaveBeenCalled();
    expect(p.stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });
  it("portail limité et suppression du client de test", async () => {
    const { p } = setup();
    expect(await p.portal("cus_1")).toContain("billing.stripe.com");
    expect(p.stripe.billingPortal.configurations.create).toHaveBeenCalledWith(
      expect.objectContaining({
        features: expect.objectContaining({
          subscription_update: { enabled: false },
          subscription_cancel: { enabled: true, mode: "at_period_end" },
        }),
      }),
    );
    vi.mocked(p.stripe.subscriptions.list).mockResolvedValue(
      cast({
        data: [
          { id: "sub_1", status: "active" },
          { id: "sub_old", status: "canceled" },
        ],
      }),
    );
    await p.removeCustomer("cus_1");
    expect(p.stripe.subscriptions.cancel).toHaveBeenCalledOnce();
    expect(p.stripe.customers.del).toHaveBeenCalledWith("cus_1");
  });
  it("signature brute réelle, compte conservé, payload et mode live rejetés", () => {
    const { p } = setup();
    const payload = JSON.stringify({
      id: "evt_1",
      account: "acct_test",
      type: "customer.subscription.updated",
      created: 123,
      livemode: false,
      data: {
        object: { id: "sub_1", object: "subscription", customer: "cus_1" },
      },
    });
    const sign = (s: string) =>
      p.stripe.webhooks.generateTestHeaderString({
        payload: s,
        secret: "whsec_fake",
      });
    expect(p.verify(Buffer.from(payload), sign(payload))).toMatchObject({
      subscriptionId: "sub_1",
      accountId: "acct_test",
      livemode: false,
    });
    expect(() => p.verify(Buffer.from(payload + " "), sign(payload))).toThrow();
    const live = payload.replace("false", "true");
    expect(() => p.verify(Buffer.from(live), sign(live))).toThrow();
  });
  it("relit le compte et la facture, conserve le prix historique inactif", async () => {
    const { p, db } = setup();
    expect(await p.reconcile(event())).toMatchObject({
      status: "ACTIVE",
      plan: "PLUS",
      priceCents: 250,
      commercialVersionId: "version_PLUS",
      payment: { status: "PAID" },
    });
    expect(db.commercialProviderPrice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          accountId: "acct_test",
          environment: "test",
        }),
      }),
    );
    vi.mocked(p.stripe.invoices.retrieve).mockResolvedValue(
      cast({ ...invoice(), status: "open" }),
    );
    expect((await p.reconcile(event()))?.status).toBe("INCOMPLETE");
    vi.mocked(p.stripe.subscriptions.retrieve).mockResolvedValue(
      cast({ ...sub(), status: "past_due" }),
    );
    expect((await p.reconcile(event()))?.status).toBe("PAST_DUE");
    expect(
      await p.reconcile({ id: "unknown", type: "unknown", created: 1 }),
    ).toBe(null);
  });
  it("refuse le nouveau prix inactif sans toucher au planning ni au contrat existant", async () => {
    const { p } = setup();
    vi.mocked(p.stripe.prices.retrieve).mockResolvedValue(
      cast({ ...price("PRO"), active: false }),
    );
    await expect(p.changePlan("sub_1", "PRO", quote("PRO"))).rejects.toThrow();
    expect(p.stripe.subscriptionSchedules.create).not.toHaveBeenCalled();
    expect(p.stripe.subscriptionSchedules.update).not.toHaveBeenCalled();
    expect((await p.reconcile(event()))?.priceCents).toBe(250);
  });
  it("programme les deux versions contractuelles sans prorata", async () => {
    const { p } = setup();
    expect(
      (await p.changePlan("sub_1", "PRO", quote("PRO"))).effectiveAt,
    ).toEqual(new Date(200000));
    expect(p.stripe.subscriptionSchedules.update).toHaveBeenCalledWith(
      "sched_1",
      expect.objectContaining({
        proration_behavior: "none",
        phases: [
          expect.objectContaining({
            end_date: 200,
            items: [{ price: "price_plus", quantity: 1 }],
            metadata: { commercialVersionId: "version_PLUS" },
          }),
          expect.objectContaining({
            items: [{ price: "price_pro", quantity: 1 }],
            metadata: { commercialVersionId: "version_PRO" },
          }),
        ],
      }),
    );
  });
  it("reconnaît le même changement déjà programmé sans le réécrire", async () => {
    const { p } = setup();
    vi.mocked(p.stripe.subscriptions.retrieve).mockResolvedValue(
      cast({ ...sub(), schedule: "sched_1" }),
    );
    await p.changePlan("sub_1", "PRO", quote("PRO"));
    expect(p.stripe.subscriptionSchedules.create).not.toHaveBeenCalled();
    expect(p.stripe.subscriptionSchedules.update).not.toHaveBeenCalled();
  });
  it.each([
    { livemode: true },
    { subscription: "sub_other" },
    { status: "released" },
    {
      phases: [
        {
          start_date: 200,
          metadata: { commercialVersionId: "version_other" },
          items: [{ price: "price_pro", quantity: 1 }],
        },
      ],
    },
  ])("refuse un planning incohérent sans l'écraser : %j", async (override) => {
    const { p } = setup();
    vi.mocked(p.stripe.subscriptions.retrieve).mockResolvedValue(
      cast({ ...sub(), schedule: "sched_1" }),
    );
    const schedule = await p.stripe.subscriptionSchedules.retrieve("sched_1");
    vi.mocked(p.stripe.subscriptionSchedules.retrieve).mockResolvedValue(
      cast({ ...schedule, ...override }),
    );
    await expect(p.changePlan("sub_1", "PRO", quote("PRO"))).rejects.toThrow();
    expect(p.stripe.subscriptionSchedules.update).not.toHaveBeenCalled();
  });
  it("reconnaît la version programmée seulement à son activation fournisseur", async () => {
    const { p } = setup();
    expect((await p.reconcile(event()))?.commercialVersionId).toBe(
      "version_PLUS",
    );
    const switched = {
      ...sub(),
      metadata: { commercialVersionId: "version_PRO" },
      items: {
        data: [
          {
            ...sub().items.data[0]!,
            price: price("PRO"),
            current_period_start: 200,
            current_period_end: 300,
          },
        ],
      },
    };
    vi.mocked(p.stripe.subscriptions.retrieve).mockResolvedValue(
      cast(switched),
    );
    vi.mocked(p.stripe.invoices.retrieve).mockResolvedValue(
      cast({ ...invoice(), amount_due: 500 }),
    );
    expect(await p.reconcile(event())).toMatchObject({
      commercialVersionId: "version_PRO",
      priceCents: 500,
    });
    vi.mocked(p.stripe.subscriptions.retrieve).mockResolvedValue(
      cast({ ...switched, metadata: {} }),
    );
    await expect(p.reconcile(event())).rejects.toThrow(
      "Unproven commercial version",
    );
  });
  it.each([{ accountId: "acct_other" }, { livemode: true }])(
    "refuse le compte/environnement d'événement avant rapprochement : %j",
    async (override) => {
      const { p } = setup();
      await expect(p.reconcile({ ...event(), ...override })).rejects.toThrow();
      expect(p.stripe.subscriptions.retrieve).not.toHaveBeenCalled();
    },
  );
  it.each([
    { accountId: "acct_other" },
    { environment: "live" },
    { provider: "mock" },
  ])(
    "refuse une association incohérente même si elle est retournée : %j",
    async (override) => {
      const { p, db } = setup();
      db.commercialProviderPrice.findFirst.mockResolvedValue(
        cast({ ...binding(), ...override }),
      );
      await expect(p.reconcile(event())).rejects.toThrow(
        "binding account or environment",
      );
    },
  );
  it.each([
    { livemode: true },
    { customer: "cus_other" },
    { currency: "usd" },
    { parent: { subscription_details: { subscription: "sub_other" } } },
  ])("refuse une facture incohérente : %j", async (override) => {
    const { p } = setup();
    vi.mocked(p.stripe.invoices.retrieve).mockResolvedValue(
      cast({ ...invoice(), ...override }),
    );
    await expect(p.reconcile(event())).rejects.toThrow("Invoice account");
  });
  it("refuse un abonnement live, une quantité ou un propriétaire inattendus", async () => {
    const { p, db } = setup();
    vi.mocked(p.stripe.subscriptions.retrieve).mockResolvedValueOnce(
      cast({ ...sub(), livemode: true }),
    );
    await expect(p.reconcile(event())).rejects.toThrow("Live");
    vi.mocked(p.stripe.subscriptions.retrieve).mockResolvedValueOnce(
      cast({
        ...sub(),
        items: { data: [{ ...sub().items.data[0]!, quantity: 2 }] },
      }),
    );
    await expect(p.reconcile(event())).rejects.toThrow("Unsupported");
    db.user.findUnique.mockResolvedValueOnce({ id: "another_user" });
    await expect(p.reconcile(event())).rejects.toThrow("mismatched customer");
  });
  it("conserve le contrat legacy sans lui attribuer une nouvelle version au même prix", async () => {
    const { p, db } = setup();
    db.userSubscriptionHistory.findFirst.mockResolvedValue(
      cast({
        userId: "user",
        priceCents: 250,
        currency: "eur",
        providerPriceId: "price_plus",
        commercialVersionId: null,
        contractEvidence: "LEGACY_UNVERIFIED",
        subscription: { code: "PLUS" },
      }),
    );
    vi.mocked(p.stripe.subscriptions.retrieve).mockResolvedValue(
      cast({ ...sub(), metadata: {} }),
    );
    vi.stubEnv("STRIPE_PRICE_PLUS", "price_new");
    const snapshot = await p.reconcile(event());
    expect(snapshot?.commercialVersionId).toBeUndefined();
    expect(snapshot?.features).toBeUndefined();
    expect(snapshot?.priceCents).toBe(250);
  });
  it("ne marque pas un webhook rejeté comme traité et déduplique sa reprise valide", async () => {
    const { p } = setup();
    let processed = false;
    const repo = {
      hasEvent: vi.fn(async () => processed),
      withSubscriptionLock: vi.fn(
        async (_id: string, work: () => Promise<unknown>) => work(),
      ),
      apply: vi.fn(async () => {
        processed = true;
        return { duplicate: false };
      }),
    };
    vi.spyOn(p, "verify").mockReturnValue(event());
    const handler = new ProcessBillingWebhook(
      repo as unknown as BillingRepository,
      p,
    );
    vi.mocked(p.stripe.accounts.retrieve).mockResolvedValueOnce(
      cast({ id: "acct_other" }),
    );
    await expect(
      handler.execute(Buffer.from("stubbed"), "stubbed"),
    ).rejects.toMatchObject({ code: "RECONCILIATION_FAILED" });
    expect(repo.apply).not.toHaveBeenCalled();
    await handler.execute(Buffer.from("stubbed"), "stubbed");
    expect(await handler.execute(Buffer.from("stubbed"), "stubbed")).toEqual({
      received: true,
      duplicate: true,
    });
    expect(repo.apply).toHaveBeenCalledOnce();
  });
});
