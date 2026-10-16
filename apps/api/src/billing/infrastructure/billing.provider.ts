import Stripe from "stripe";
import { randomBytes, randomUUID } from "node:crypto";
import type { PrismaClient, Prisma } from "@prisma/client";
import type {
  BillingProvider,
  BillingEvent,
  BillingSnapshot,
  PlanCode,
} from "../domain/billing";
import { DomainError } from "../../shared/domain/errors";
type CheckoutInput = Parameters<BillingProvider["checkout"]>[0];
export class StripeBillingProvider implements BillingProvider {
  readonly name = "stripe" as const;
  readonly stripe: Stripe;
  constructor(private readonly db: PrismaClient) {
    const key = process.env.STRIPE_SECRET_KEY ?? "";
    if (!key.startsWith("sk_test_") || !process.env.STRIPE_WEBHOOK_SECRET)
      throw new Error("Stripe test credentials required");
    this.stripe = new Stripe(key);
  }
  async checkout(input: CheckoutInput) {
    if (input.customerId) {
      const subscriptions = await this.stripe.subscriptions.list({
        customer: input.customerId,
        status: "all",
        limit: 100,
      });
      if (
        subscriptions.data.some(
          (s) => !["canceled", "incomplete_expired"].includes(s.status),
        )
      )
        throw new DomainError(
          409,
          "SUBSCRIPTION_EXISTS",
          "Un abonnement existe déjà chez Stripe. Utilisez le portail pour le gérer.",
        );
    }
    const priceId = process.env["STRIPE_PRICE_" + input.plan];
    if (!priceId) throw new Error("Missing test price");
    const price = await this.stripe.prices.retrieve(priceId);
    if (
      price.livemode ||
      price.unit_amount !== input.priceCents ||
      price.currency !== input.currency ||
      price.recurring?.interval !== "month"
    )
      throw new Error("Invalid test price");
    const customerId =
      input.customerId ??
      (
        await this.stripe.customers.create(
          { email: input.email, metadata: { userId: input.userId } },
          { idempotencyKey: "customer_" + input.userId },
        )
      ).id;
    const origin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
    const session = await this.stripe.checkout.sessions.create(
      {
        customer: customerId,
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        client_reference_id: input.intentId,
        subscription_data: {
          metadata: { userId: input.userId, plan: input.plan },
        },
        success_url: origin + "/app/abonnement?retour=paiement",
        cancel_url: origin + "/app/abonnement?retour=annule",
      },
      { idempotencyKey: input.intentId },
    );
    if (!session.url) throw new Error("Missing checkout URL");
    return { id: session.id, url: session.url, customerId };
  }
  async changePlan(id: string, plan: "PLUS" | "PRO") {
    const sub = await this.stripe.subscriptions.retrieve(id);
    if (sub.livemode || sub.status !== "active")
      throw new Error("Inactive subscription");
    const item = sub.items.data[0]!;
    const priceId = process.env["STRIPE_PRICE_" + plan];
    if (!priceId) throw new Error("Missing price");
    const price = await this.stripe.prices.retrieve(priceId);
    if (
      price.livemode ||
      price.unit_amount !== (plan === "PLUS" ? 250 : 500) ||
      price.currency !== "eur" ||
      price.recurring?.interval !== "month"
    )
      throw new Error("Invalid price");
    const scheduleId =
      typeof sub.schedule === "string" ? sub.schedule : sub.schedule?.id;
    const schedule = scheduleId
      ? await this.stripe.subscriptionSchedules.retrieve(scheduleId)
      : await this.stripe.subscriptionSchedules.create({
          from_subscription: id,
        });
    await this.stripe.subscriptionSchedules.update(schedule.id, {
      end_behavior: "release",
      proration_behavior: "none",
      phases: [
        {
          start_date: item.current_period_start,
          end_date: item.current_period_end,
          items: [{ price: item.price.id, quantity: 1 }],
          proration_behavior: "none",
        },
        {
          items: [{ price: priceId, quantity: 1 }],
          duration: { interval: "month", interval_count: 1 },
          proration_behavior: "none",
        },
      ],
    });
    return { effectiveAt: new Date(item.current_period_end * 1000) };
  }
  async portal(customerId: string) {
    const configuration = await this.stripe.billingPortal.configurations.create(
      {
        business_profile: { headline: "Abonnement Revynora · test" },
        features: {
          payment_method_update: { enabled: true },
          invoice_history: { enabled: true },
          subscription_cancel: { enabled: true, mode: "at_period_end" },
          subscription_update: { enabled: false },
        },
      },
    );
    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      configuration: configuration.id,
      return_url:
        (process.env.WEB_ORIGIN ?? "http://localhost:3000") + "/app/abonnement",
    });
    return session.url;
  }
  verify(raw: Buffer, signature: string) {
    const event = this.stripe.webhooks.constructEvent(
      raw,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
    if (event.livemode) throw new Error("Live events refused");
    const obj = event.data.object as unknown as {
      id: string;
      object: string;
      customer?: string;
      subscription?: string;
      parent?: { subscription_details?: { subscription?: string } };
    };
    return {
      id: event.id,
      type: event.type,
      created: event.created,
      customerId: typeof obj.customer === "string" ? obj.customer : undefined,
      subscriptionId:
        obj.object === "subscription"
          ? obj.id
          : (obj.subscription ??
            obj.parent?.subscription_details?.subscription),
      invoiceId: obj.object === "invoice" ? obj.id : undefined,
      checkoutId: obj.object === "checkout.session" ? obj.id : undefined,
    };
  }
  async reconcile(event: BillingEvent): Promise<BillingSnapshot | null> {
    let subId = event.subscriptionId;
    if (!subId && event.checkoutId) {
      const c = await this.stripe.checkout.sessions.retrieve(event.checkoutId);
      subId = typeof c.subscription === "string" ? c.subscription : undefined;
    }
    if (!subId) return null;
    const sub = await this.stripe.subscriptions.retrieve(subId);
    if (sub.livemode) throw new Error("Live subscription refused");
    const item = sub.items.data[0];
    if (!item || sub.items.data.length !== 1)
      throw new Error("Unsupported subscription");
    const plan: PlanCode =
      item.price.id === process.env.STRIPE_PRICE_PLUS
        ? "PLUS"
        : item.price.id === process.env.STRIPE_PRICE_PRO
          ? "PRO"
          : "FREE";
    if (
      plan === "FREE" ||
      item.price.unit_amount !== (plan === "PLUS" ? 250 : 500) ||
      item.price.currency !== "eur"
    )
      throw new Error("Unexpected price");
    const customerId =
      typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const user = await this.db.user.findUnique({
      where: { stripeCustomerId: customerId },
    });
    if (!user) throw new Error("Unknown customer");
    const latestId =
      typeof sub.latest_invoice === "string"
        ? sub.latest_invoice
        : sub.latest_invoice?.id;
    const latest = latestId
      ? await this.stripe.invoices.retrieve(latestId)
      : null;
    let payment: BillingSnapshot["payment"];
    if (event.invoiceId) {
      const inv = await this.stripe.invoices.retrieve(event.invoiceId);
      payment = {
        reference: inv.id!,
        amountCents: inv.amount_due,
        currency: inv.currency,
        status:
          inv.status === "paid"
            ? "PAID"
            : inv.status === "void"
              ? "FAILED"
              : "PENDING",
        receiptUrl: inv.hosted_invoice_url ?? null,
      };
    }
    return {
      userId: user.id,
      customerId,
      subscriptionId: sub.id,
      plan,
      status:
        sub.status === "active" && latest?.status === "paid"
          ? "ACTIVE"
          : sub.status === "past_due"
            ? "PAST_DUE"
            : sub.status === "canceled"
              ? "CANCELLED"
              : "INCOMPLETE",
      startsAt: new Date(item.current_period_start * 1000),
      endsAt: new Date(item.current_period_end * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      payment,
    };
  }
  async removeCustomer(id: string) {
    await this.stripe.subscriptions
      .list({ customer: id, status: "all", limit: 100 })
      .then(async (list) => {
        for (const s of list.data)
          if (s.status !== "canceled")
            await this.stripe.subscriptions.cancel(s.id);
      });
    await this.stripe.customers.del(id);
  }
}
export class MockBillingProvider implements BillingProvider {
  readonly name = "mock" as const;
  private readonly secret =
    process.env.MOCK_WEBHOOK_SECRET ?? randomBytes(32).toString("hex");
  private readonly stripe = new Stripe("sk_test_local_simulation");
  constructor(private readonly db: PrismaClient) {}
  async checkout(input: CheckoutInput) {
    const id = "mock_" + input.intentId;
    return {
      id,
      url: "/app/abonnement?simulation=" + input.intentId,
      customerId: input.customerId ?? "mock_customer_" + input.userId,
    };
  }
  async changePlan(id: string, plan: "PLUS" | "PRO") {
    const record = await this.db.mockBillingRecord.findUniqueOrThrow({
      where: { id },
    });
    const snapshot = record.snapshot as unknown as BillingSnapshot;
    await this.db.mockBillingRecord.update({
      where: { id },
      data: {
        snapshot: { ...JSON.parse(JSON.stringify(snapshot)), nextPlan: plan },
      },
    });
    return { effectiveAt: new Date(snapshot.endsAt) };
  }
  async portal() {
    return "/app/abonnement?gestion=simulation";
  }
  verify(raw: Buffer, signature: string): BillingEvent {
    const e = this.stripe.webhooks.constructEvent(raw, signature, this.secret);
    if (e.livemode) throw new Error("Live refused");
    const obj = e.data.object as unknown as { id: string; customer: string };
    return {
      id: e.id,
      type: e.type,
      created: e.created,
      subscriptionId: obj.id,
      customerId: obj.customer,
    };
  }
  async reconcile(e: BillingEvent) {
    if (!e.subscriptionId) return null;
    const row = await this.db.mockBillingRecord.findUnique({
      where: { id: e.subscriptionId },
    });
    if (!row) return null;
    const s = row.snapshot as unknown as BillingSnapshot;
    return { ...s, startsAt: new Date(s.startsAt), endsAt: new Date(s.endsAt) };
  }
  async complete(userId: string, intentId: string, success: boolean) {
    const intent = await this.db.checkoutIntent.findFirst({
      where: { id: intentId, userId, provider: "mock" },
    });
    if (!intent || intent.status !== "PENDING" || intent.expiresAt < new Date())
      throw new DomainError(
        409,
        "CHECKOUT_EXPIRED",
        "Cette simulation est terminée ou expirée.",
      );
    const startsAt = new Date();
    const endsAt = new Date(startsAt);
    endsAt.setUTCMonth(endsAt.getUTCMonth() + 1);
    const snapshot: BillingSnapshot = {
      userId,
      customerId: "mock_customer_" + userId,
      subscriptionId: "mock_sub_" + intentId,
      plan: intent.plan,
      status: success ? "ACTIVE" : "INCOMPLETE",
      startsAt,
      endsAt,
      cancelAtPeriodEnd: false,
      payment: {
        reference: "mock_invoice_" + intentId,
        amountCents: intent.plan === "PLUS" ? 250 : 500,
        currency: "eur",
        status: success ? "PAID" : "FAILED",
        receiptUrl: null,
      },
    };
    await this.db.mockBillingRecord.upsert({
      where: { id: snapshot.subscriptionId },
      create: {
        id: snapshot.subscriptionId,
        snapshot: JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue,
      },
      update: {},
    });
    return this.signed(snapshot);
  }
  async cancel(userId: string) {
    const period = await this.db.userSubscriptionHistory.findFirst({
      where: { userId, provider: "mock", status: "ACTIVE" },
      orderBy: { startsAt: "desc" },
    });
    if (!period)
      throw new DomainError(409, "NO_SUBSCRIPTION", "Aucun abonnement actif.");
    const row = await this.db.mockBillingRecord.findUniqueOrThrow({
      where: { id: period.providerSubscriptionId },
    });
    const snapshot = row.snapshot as unknown as BillingSnapshot;
    snapshot.cancelAtPeriodEnd = true;
    await this.db.mockBillingRecord.update({
      where: { id: row.id },
      data: { snapshot: JSON.parse(JSON.stringify(snapshot)) },
    });
    return this.signed(snapshot);
  }
  private signed(s: BillingSnapshot) {
    const raw = Buffer.from(
      JSON.stringify({
        id: "evt_mock_" + randomUUID(),
        object: "event",
        type: "customer.subscription.updated",
        created: Math.floor(Date.now() / 1000),
        livemode: false,
        data: { object: { id: s.subscriptionId, customer: s.customerId } },
      }),
    );
    return {
      raw,
      signature: this.stripe.webhooks.generateTestHeaderString({
        payload: raw.toString(),
        secret: this.secret,
      }),
    };
  }
  async removeCustomer(id: string) {
    await this.db.mockBillingRecord.deleteMany({
      where: { snapshot: { path: ["customerId"], equals: id } },
    });
  }
}
