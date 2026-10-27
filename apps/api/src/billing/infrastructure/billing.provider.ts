import Stripe from "stripe";
import { randomBytes, randomUUID } from "node:crypto";
import type { PrismaClient, Prisma } from "@prisma/client";
import type {
  BillingProvider,
  BillingEvent,
  BillingSnapshot,
  CommercialQuote,
  PlanCode,
} from "../domain/billing";
import { DomainError } from "../../shared/domain/errors";
import { compatibleStripePrice } from "./stripe-price";
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
  private async account(event?: BillingEvent) {
    const account = await this.stripe.accounts.retrieve();
    if (
      !account.id ||
      event?.livemode === true ||
      (event?.accountId && event.accountId !== account.id)
    )
      throw new Error("Stripe account or test environment mismatch");
    return account.id;
  }
  private async newPrice(quote: CommercialQuote, plan: PlanCode) {
    if (!quote.commercialVersionId || !quote.providerPriceId)
      throw new Error("Verified provider price required");
    const accountId = await this.account();
    const binding = await this.db.commercialProviderPrice.findFirst({
      where: {
        versionId: quote.commercialVersionId,
        provider: "stripe",
        environment: "test",
        accountId,
        priceId: quote.providerPriceId,
        version: { state: "PUBLISHED", subscription: { code: plan } },
      },
      include: { version: { include: { subscription: true } } },
    });
    if (
      !binding ||
      binding.accountId !== accountId ||
      binding.environment !== "test" ||
      binding.provider !== "stripe" ||
      binding.versionId !== quote.commercialVersionId ||
      binding.priceId !== quote.providerPriceId ||
      binding.version.state !== "PUBLISHED" ||
      binding.version.subscription.code !== plan ||
      binding.version.priceCents !== quote.priceCents ||
      binding.version.currency !== quote.currency ||
      binding.version.interval !== quote.interval
    )
      throw new Error("Unverified commercial version or Stripe account");
    const price = await this.stripe.prices.retrieve(quote.providerPriceId);
    if (
      price.id !== quote.providerPriceId ||
      !compatibleStripePrice(price, quote)
    )
      throw new Error("Invalid test price");
    return price;
  }
  async validateQuote(quote: CommercialQuote, plan: PlanCode) {
    await this.newPrice(quote, plan);
  }
  async checkout(input: CheckoutInput) {
    // Re-read after local acceptance; no customer/session mutation before this check.
    const price = await this.newPrice(input, input.plan);
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
    const priceId = price.id;
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
          metadata: {
            userId: input.userId,
            plan: input.plan,
            ...(input.commercialVersionId
              ? { commercialVersionId: input.commercialVersionId }
              : {}),
          },
        },
        success_url: origin + "/app/abonnement?retour=paiement",
        cancel_url: origin + "/app/abonnement?retour=annule",
      },
      { idempotencyKey: input.intentId },
    );
    if (!session.url) throw new Error("Missing checkout URL");
    return { id: session.id, url: session.url, customerId };
  }
  async changePlan(id: string, plan: "PLUS" | "PRO", quote: CommercialQuote) {
    // Only the next sale needs an active price. The existing contract may be archived.
    const price = await this.newPrice(quote, plan);
    const accountId = await this.account();
    const sub = await this.stripe.subscriptions.retrieve(id);
    if (sub.livemode !== false || sub.id !== id || sub.status !== "active")
      throw new Error("Inactive or mismatched test subscription");
    const { item, binding } = await this.contract(sub, accountId);
    const scheduleId =
      typeof sub.schedule === "string" ? sub.schedule : sub.schedule?.id;
    if (scheduleId) {
      const schedule =
        await this.stripe.subscriptionSchedules.retrieve(scheduleId);
      const owner =
        typeof schedule.subscription === "string"
          ? schedule.subscription
          : schedule.subscription?.id;
      const future = schedule.phases.filter(
        (p) => p.start_date >= item.current_period_end,
      );
      // Never overwrite an unknown or different change programmed at the provider.
      if (
        schedule.livemode !== false ||
        owner !== id ||
        schedule.status !== "active" ||
        schedule.current_phase?.end_date !== item.current_period_end ||
        future.length !== 1 ||
        future[0]!.start_date !== item.current_period_end ||
        future[0]!.metadata?.commercialVersionId !==
          quote.commercialVersionId ||
        future[0]!.items.length !== 1 ||
        future[0]!.items[0]!.quantity !== 1 ||
        (typeof future[0]!.items[0]!.price === "string"
          ? future[0]!.items[0]!.price
          : future[0]!.items[0]!.price.id) !== price.id
      )
        throw new Error(
          "Existing schedule conflicts with the accepted commercial version",
        );
      return { effectiveAt: new Date(item.current_period_end * 1000) };
    }
    const schedule = await this.stripe.subscriptionSchedules.create({
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
          metadata: { commercialVersionId: binding?.versionId ?? "" },
          proration_behavior: "none",
        },
        {
          items: [{ price: price.id, quantity: 1 }],
          duration: { interval: "month", interval_count: 1 },
          metadata: { commercialVersionId: quote.commercialVersionId! },
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
  verify(raw: Buffer, signature: string): BillingEvent {
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
      accountId: event.account,
      livemode: event.livemode,
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
  private async contract(sub: Stripe.Subscription, accountId: string) {
    const item = sub.items.data[0];
    if (!item || sub.items.data.length !== 1 || item.quantity !== 1)
      throw new Error("Unsupported subscription");
    const candidate = await this.db.commercialProviderPrice.findFirst({
      where: {
        provider: "stripe",
        environment: "test",
        accountId,
        priceId: item.price.id,
        version: { state: "PUBLISHED" },
      },
      include: { version: { include: { subscription: true } } },
    });
    if (
      candidate &&
      (candidate.accountId !== accountId ||
        candidate.environment !== "test" ||
        candidate.provider !== "stripe" ||
        candidate.version.state !== "PUBLISHED")
    )
      throw new Error("Provider binding account or environment mismatch");
    const prior = await this.db.userSubscriptionHistory.findFirst({
      where: { provider: "stripe", providerSubscriptionId: sub.id },
      orderBy: { startsAt: "desc" },
      include: { subscription: true },
    });
    const binding =
      candidate &&
      (!prior ||
        prior.commercialVersionId === candidate.versionId ||
        sub.metadata?.commercialVersionId === candidate.versionId)
        ? candidate
        : null;
    if (
      (prior?.commercialVersionId && !binding) ||
      (sub.metadata?.commercialVersionId &&
        sub.metadata.commercialVersionId !== binding?.versionId)
    )
      throw new Error("Unproven commercial version transition");
    const legacyPriceId =
      prior?.providerPriceId ??
      (prior
        ? process.env["STRIPE_PRICE_" + prior.subscription.code]
        : undefined);
    const legacy =
      !binding && prior && item.price.id === legacyPriceId ? prior : null;
    const plan =
      binding?.version.subscription.code ?? legacy?.subscription.code;
    const priceCents = binding?.version.priceCents ?? legacy?.priceCents;
    const currency = binding?.version.currency ?? legacy?.currency;
    if (
      !plan ||
      plan === "FREE" ||
      priceCents == null ||
      !currency ||
      !compatibleStripePrice(
        item.price,
        {
          priceCents,
          currency,
          interval: binding?.version.interval ?? "month",
        },
        true,
      )
    )
      throw new Error("Unexpected or unproven price");
    return { item, binding, prior, plan };
  }
  async reconcile(event: BillingEvent): Promise<BillingSnapshot | null> {
    const accountId = await this.account(event);
    let subId = event.subscriptionId;
    if (!subId && event.checkoutId) {
      const c = await this.stripe.checkout.sessions.retrieve(event.checkoutId);
      if (
        c.livemode !== false ||
        (event.customerId && c.customer !== event.customerId)
      )
        throw new Error("Checkout account or environment mismatch");
      subId = typeof c.subscription === "string" ? c.subscription : undefined;
    }
    if (!subId) return null;
    const sub = await this.stripe.subscriptions.retrieve(subId);
    if (sub.livemode !== false || sub.id !== subId)
      throw new Error("Live or mismatched subscription refused");
    const { item, binding, prior, plan } = await this.contract(sub, accountId);
    const customerId =
      typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const user = await this.db.user.findUnique({
      where: { stripeCustomerId: customerId },
    });
    if (
      !user ||
      (event.customerId && event.customerId !== customerId) ||
      (prior && prior.userId !== user.id)
    )
      throw new Error("Unknown or mismatched customer");
    const checkInvoice = (invoice: Stripe.Invoice) => {
      const owner =
        typeof invoice.customer === "string"
          ? invoice.customer
          : invoice.customer?.id;
      const subscription = invoice.parent?.subscription_details?.subscription;
      const invoiceSubId =
        typeof subscription === "string" ? subscription : subscription?.id;
      if (
        invoice.livemode !== false ||
        owner !== customerId ||
        invoiceSubId !== sub.id ||
        invoice.currency !== item.price.currency
      )
        throw new Error(
          "Invoice account, subscription or environment mismatch",
        );
    };
    const latestId =
      typeof sub.latest_invoice === "string"
        ? sub.latest_invoice
        : sub.latest_invoice?.id;
    const latest = latestId
      ? await this.stripe.invoices.retrieve(latestId)
      : null;
    if (latest) checkInvoice(latest);
    let payment: BillingSnapshot["payment"];
    if (event.invoiceId) {
      const inv = await this.stripe.invoices.retrieve(event.invoiceId);
      checkInvoice(inv);
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
      commercialVersionId: binding?.versionId,
      providerPriceId: item.price.id,
      priceCents: item.price.unit_amount!,
      currency: item.price.currency,
      features:
        binding?.version.features ??
        (prior?.contractEvidence !== "LEGACY_UNVERIFIED"
          ? prior?.features
          : undefined),
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
  async validateQuote(quote: CommercialQuote, plan: PlanCode) {
    if (
      plan === "FREE" ||
      quote.interval !== "month" ||
      quote.currency !== "eur" ||
      !Number.isSafeInteger(quote.priceCents) ||
      quote.priceCents <= 0
    )
      throw new Error("Invalid monthly mock quote");
  }
  async checkout(input: CheckoutInput) {
    await this.validateQuote(input, input.plan);
    const id = "mock_" + input.intentId;
    return {
      id,
      url: "/app/abonnement?simulation=" + input.intentId,
      customerId: input.customerId ?? "mock_customer_" + input.userId,
    };
  }
  async changePlan(id: string, plan: "PLUS" | "PRO", quote: CommercialQuote) {
    await this.validateQuote(quote, plan);
    const record = await this.db.mockBillingRecord.findUniqueOrThrow({
      where: { id },
    });
    const snapshot = record.snapshot as unknown as BillingSnapshot;
    await this.db.mockBillingRecord.update({
      where: { id },
      data: {
        snapshot: {
          ...JSON.parse(JSON.stringify(snapshot)),
          nextPlan: plan,
          nextQuote: quote,
        },
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
    if (intent.acceptedPriceCents == null || !intent.acceptedCurrency)
      throw new DomainError(
        409,
        "CONTRACT_PRICE_UNPROVEN",
        "Cette ancienne simulation ne possède pas de tarif accepté vérifiable. Recréez une session après expiration.",
      );
    const startsAt = new Date();
    const endsAt = new Date(startsAt);
    endsAt.setUTCMonth(endsAt.getUTCMonth() + 1);
    const snapshot: BillingSnapshot = {
      userId,
      customerId: "mock_customer_" + userId,
      subscriptionId: "mock_sub_" + intentId,
      plan: intent.plan,
      commercialVersionId: intent.commercialVersionId,
      priceCents: intent.acceptedPriceCents ?? undefined,
      currency: intent.acceptedCurrency ?? undefined,
      features: intent.acceptedFeatures,
      status: success ? "ACTIVE" : "INCOMPLETE",
      startsAt,
      endsAt,
      cancelAtPeriodEnd: false,
      payment: {
        reference: "mock_invoice_" + intentId,
        amountCents: intent.acceptedPriceCents,
        currency: intent.acceptedCurrency,
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
