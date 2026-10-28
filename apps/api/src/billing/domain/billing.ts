import { legacyFeatures } from "../../commercial-catalog/domain";
export type PlanCode = "FREE" | "PLUS" | "PRO";
export type CommercialQuote = {
  commercialVersionId?: string | null;
  priceCents: number;
  currency: string;
  interval: string;
  features?: string[];
  providerPriceId?: string | null;
};
export type PlanOffer = CommercialQuote & {
  id: string;
  code: PlanCode;
  name: string;
  priceCents: number;
  currency: string;
  interval: string;
  active: boolean;
};
export type SubscriptionState =
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELLED"
  | "INCOMPLETE";
export type Period = {
  id: string;
  plan: PlanCode;
  priceCents: number;
  currency: string;
  startsAt: Date;
  endsAt: Date;
  status: SubscriptionState;
  cancelAtPeriodEnd: boolean;
  provider: string;
  providerSubscriptionId: string;
  features?: string[];
};
export type Entitlement = {
  plan: PlanCode;
  reminders?: boolean;
  leitner: boolean;
  planning: boolean;
  period: Period | null;
};
export function resolveEntitlement(periods: Period[], now: Date): Entitlement {
  const rank: Record<PlanCode, number> = { FREE: 0, PLUS: 1, PRO: 2 };
  const period =
    periods
      .filter(
        (p) =>
          p.plan !== "FREE" &&
          p.status === "ACTIVE" &&
          p.startsAt <= now &&
          p.endsAt > now,
      )
      .sort(
        (a, b) =>
          rank[b.plan] - rank[a.plan] ||
          b.startsAt.getTime() - a.startsAt.getTime(),
      )[0] ?? null;
  const plan = period?.plan ?? "FREE";
  const freeContract = periods
    .filter((p) => p.plan === "FREE" && p.startsAt <= now)
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())[0];
  const features =
    period?.features ??
    (period ? legacyFeatures(plan) : (freeContract?.features ?? []));
  return {
    plan,
    leitner: features.includes("leitner"),
    planning: features.includes("planning"),
    reminders: features.includes("reminders"),
    period,
  };
}
export interface EntitlementRepository {
  periods(userId: string): Promise<Period[]>;
}
export type BillingEvent = {
  id: string;
  type: string;
  created: number;
  subscriptionId?: string;
  invoiceId?: string;
  customerId?: string;
  checkoutId?: string;
  accountId?: string;
  livemode?: boolean;
};
export type BillingSnapshot = {
  commercialVersionId?: string | null;
  providerPriceId?: string;
  priceCents?: number;
  currency?: string;
  features?: string[];
  userId: string;
  customerId: string;
  subscriptionId: string;
  plan: PlanCode;
  status: SubscriptionState;
  startsAt: Date;
  endsAt: Date;
  cancelAtPeriodEnd: boolean;
  payment?: {
    reference: string;
    amountCents: number;
    currency: string;
    status: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
    receiptUrl: string | null;
  };
};
export type Checkout = {
  commercialVersionId?: string | null;
  acceptedPriceCents?: number | null;
  acceptedCurrency?: string | null;
  acceptedInterval?: string | null;
  acceptedFeatures?: string[];
  acceptedProviderPriceId?: string | null;
  id: string;
  userId: string;
  plan: PlanCode;
  provider: string;
  status: string;
  expiresAt: Date;
  providerSessionId: string | null;
};
export interface BillingProvider {
  readonly name: "mock" | "stripe";
  validateQuote(quote: CommercialQuote, plan: PlanCode): Promise<void>;
  checkout(input: {
    commercialVersionId?: string | null;
    providerPriceId?: string | null;
    intentId: string;
    userId: string;
    customerId: string | null;
    email: string;
    plan: PlanCode;
    priceCents: number;
    currency: string;
    interval: string;
  }): Promise<{ id: string; url: string; customerId: string }>;
  portal(customerId: string): Promise<string>;
  changePlan(
    subscriptionId: string,
    plan: "PLUS" | "PRO",
    quote: CommercialQuote,
  ): Promise<{ effectiveAt: Date }>;
  verify(raw: Buffer, signature: string): BillingEvent;
  reconcile(event: BillingEvent): Promise<BillingSnapshot | null>;
  removeCustomer(customerId: string): Promise<void>;
}
export interface BillingRepository extends EntitlementRepository {
  catalog(): Promise<PlanOffer[]>;
  pending(userId: string): Promise<(Checkout & { url: string | null }) | null>;
  failCheckout(id: string): Promise<void>;
  account(
    userId: string,
  ): Promise<{ id: string; email: string; customerId: string | null }>;
  createCheckout(
    userId: string,
    plan: PlanCode,
    provider: string,
    expectedQuote: CommercialQuote,
  ): Promise<Checkout>;
  finishCheckout(
    id: string,
    session: { id: string; customerId: string; url: string },
  ): Promise<void>;
  checkout(id: string, userId: string): Promise<Checkout>;
  history(userId: string, page: number, pageSize: number): Promise<unknown>;
  payments(userId: string, page: number, pageSize: number): Promise<unknown>;
  hasEvent(id: string): Promise<boolean>;
  withSubscriptionLock<T>(
    subscriptionId: string,
    work: () => Promise<T>,
  ): Promise<T>;
  apply(
    event: BillingEvent,
    snapshot: BillingSnapshot | null,
    provider: string,
  ): Promise<{ duplicate: boolean }>;
}
export const BILLING_REPOSITORY = Symbol("BillingRepository");
export const BILLING_PROVIDER = Symbol("BillingProvider");
export const ENTITLEMENT_REPOSITORY = Symbol("EntitlementRepository");
