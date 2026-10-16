import { describe, it, expect, vi, afterEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { StripeBillingProvider } from "./billing.provider";
const db = {
  user: { findUnique: vi.fn().mockResolvedValue({ id: "user" }) },
} as unknown as PrismaClient;
function setup() {
  vi.mocked(db.user.findUnique).mockResolvedValue(asReturn({ id: "user" }));
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_fake");
  vi.stubEnv("STRIPE_PRICE_PLUS", "price_plus");
  vi.stubEnv("STRIPE_PRICE_PRO", "price_pro");
  return new StripeBillingProvider(db);
}
const sub = {
  id: "sub_1",
  customer: "cus_1",
  livemode: false,
  status: "active",
  cancel_at_period_end: false,
  latest_invoice: "in_1",
  schedule: null,
  items: {
    data: [
      {
        price: { id: "price_plus", unit_amount: 250, currency: "eur" },
        current_period_start: 100,
        current_period_end: 200,
      },
    ],
  },
};
// SDK calls are stubbed; signature verification uses the real Stripe SDK.
const asReturn = <T>(value: unknown) => value as T;
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
describe("Adaptateur Stripe test", () => {
  it("refuse une clé live ou une configuration incomplète", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_fake");
    expect(() => new StripeBillingProvider(db)).toThrow();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    expect(() => new StripeBillingProvider(db)).toThrow();
  });
  it("checkout test, client stable, prix vérifié et clé idempotente", async () => {
    const p = setup();
    vi.spyOn(p.stripe.subscriptions, "list").mockResolvedValue(
      asReturn({ data: [] }),
    );
    vi.spyOn(p.stripe.prices, "retrieve").mockResolvedValue(
      asReturn({
        livemode: false,
        unit_amount: 250,
        currency: "eur",
        recurring: { interval: "month" },
      }),
    );
    vi.spyOn(p.stripe.customers, "create").mockResolvedValue(
      asReturn({ id: "cus_1" }),
    );
    const create = vi
      .spyOn(p.stripe.checkout.sessions, "create")
      .mockResolvedValue(
        asReturn({ id: "cs_1", url: "https://checkout.stripe.com/test" }),
      );
    const input = {
      intentId: "intent",
      userId: "user",
      customerId: null,
      email: "a@example.test",
      plan: "PLUS" as const,
      priceCents: 250,
      currency: "eur",
    };
    expect((await p.checkout(input)).customerId).toBe("cus_1");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "subscription" }),
      { idempotencyKey: "intent" },
    );
    await p.checkout({ ...input, customerId: "cus_1" });
    vi.mocked(p.stripe.prices.retrieve).mockResolvedValue(
      asReturn({ livemode: true }),
    );
    await expect(p.checkout(input)).rejects.toThrow("Invalid test price");
    vi.stubEnv("STRIPE_PRICE_PLUS", "");
    await expect(p.checkout(input)).rejects.toThrow("Missing test price");
  });
  it("portail limité au paiement, factures et résiliation à échéance", async () => {
    const p = setup();
    const config = vi
      .spyOn(p.stripe.billingPortal.configurations, "create")
      .mockResolvedValue(asReturn({ id: "bpc_1" }));
    vi.spyOn(p.stripe.billingPortal.sessions, "create").mockResolvedValue(
      asReturn({ url: "https://billing.stripe.com/test" }),
    );
    expect(await p.portal("cus_1")).toContain("billing.stripe.com");
    expect(config).toHaveBeenCalledWith(
      expect.objectContaining({
        features: expect.objectContaining({
          subscription_update: { enabled: false },
          subscription_cancel: { enabled: true, mode: "at_period_end" },
        }),
      }),
    );
  });
  it("signature brute réelle, payload modifié et mode live rejetés", () => {
    const p = setup();
    const payload = JSON.stringify({
      id: "evt_1",
      type: "customer.subscription.updated",
      created: 123,
      livemode: false,
      data: {
        object: { id: "sub_1", object: "subscription", customer: "cus_1" },
      },
    });
    const signature = p.stripe.webhooks.generateTestHeaderString({
      payload,
      secret: "whsec_fake",
    });
    expect(p.verify(Buffer.from(payload), signature).subscriptionId).toBe(
      "sub_1",
    );
    expect(() => p.verify(Buffer.from(payload + " "), signature)).toThrow();
    const live = payload.replace("false", "true");
    expect(() =>
      p.verify(
        Buffer.from(live),
        p.stripe.webhooks.generateTestHeaderString({
          payload: live,
          secret: "whsec_fake",
        }),
      ),
    ).toThrow();
  });
  it("relit le prestataire et exige une facture payée pour activer", async () => {
    const p = setup();
    vi.spyOn(p.stripe.subscriptions, "retrieve").mockResolvedValue(
      asReturn(sub),
    );
    const invoice = vi.spyOn(p.stripe.invoices, "retrieve").mockResolvedValue(
      asReturn({
        id: "in_1",
        status: "open",
        amount_due: 250,
        currency: "eur",
        hosted_invoice_url: null,
      }),
    );
    const event = {
      id: "evt",
      type: "invoice.paid",
      created: 1,
      subscriptionId: "sub_1",
      invoiceId: "in_1",
    };
    expect((await p.reconcile(event))?.status).toBe("INCOMPLETE");
    invoice.mockResolvedValue(
      asReturn({
        id: "in_1",
        status: "paid",
        amount_due: 250,
        currency: "eur",
        hosted_invoice_url: null,
      }),
    );
    expect(await p.reconcile(event)).toMatchObject({
      status: "ACTIVE",
      plan: "PLUS",
      payment: { status: "PAID" },
    });
    vi.mocked(p.stripe.subscriptions.retrieve).mockResolvedValue(
      asReturn({ ...sub, status: "past_due" }),
    );
    expect((await p.reconcile(event))?.status).toBe("PAST_DUE");
    expect(
      await p.reconcile({ id: "unknown", type: "unknown", created: 1 }),
    ).toBe(null);
    vi.mocked(p.stripe.subscriptions.retrieve).mockResolvedValue(
      asReturn({ ...sub, livemode: true }),
    );
    await expect(p.reconcile(event)).rejects.toThrow("Live");
  });
  it("changement différé sans prorata et suppression du client de test", async () => {
    const p = setup();
    vi.spyOn(p.stripe.subscriptions, "retrieve").mockResolvedValue(
      asReturn(sub),
    );
    vi.spyOn(p.stripe.prices, "retrieve").mockResolvedValue(
      asReturn({
        livemode: false,
        unit_amount: 500,
        currency: "eur",
        recurring: { interval: "month" },
      }),
    );
    vi.spyOn(p.stripe.subscriptionSchedules, "create").mockResolvedValue(
      asReturn({ id: "sched_1" }),
    );
    const update = vi
      .spyOn(p.stripe.subscriptionSchedules, "update")
      .mockResolvedValue(asReturn({}));
    expect((await p.changePlan("sub_1", "PRO")).effectiveAt).toEqual(
      new Date(200000),
    );
    expect(update).toHaveBeenCalledWith(
      "sched_1",
      expect.objectContaining({
        proration_behavior: "none",
        phases: expect.arrayContaining([
          expect.objectContaining({ end_date: 200 }),
          expect.objectContaining({
            items: [{ price: "price_pro", quantity: 1 }],
          }),
        ]),
      }),
    );
    vi.spyOn(p.stripe.subscriptions, "list").mockResolvedValue(
      asReturn({
        data: [
          { id: "sub_1", status: "active" },
          { id: "sub_old", status: "canceled" },
        ],
      }),
    );
    const cancel = vi
      .spyOn(p.stripe.subscriptions, "cancel")
      .mockResolvedValue(asReturn({}));
    vi.spyOn(p.stripe.customers, "del").mockResolvedValue(asReturn({}));
    await p.removeCustomer("cus_1");
    expect(cancel).toHaveBeenCalledOnce();
  });
});
