import { DomainError } from "../../shared/domain/errors";
import {
  resolveEntitlement,
  type BillingRepository,
  type BillingProvider,
  type PlanCode,
  type EntitlementRepository,
} from "../domain/billing";
export class GetEntitlements {
  constructor(private readonly repo: EntitlementRepository) {}
  async execute(userId: string) {
    return resolveEntitlement(await this.repo.periods(userId), new Date());
  }
  async require(userId: string, plan: "PLUS" | "PRO") {
    const rights = await this.execute(userId);
    if (plan === "PLUS" ? !rights.leitner : !rights.planning)
      throw new DomainError(
        403,
        "PLAN_REQUIRED",
        plan === "PLUS"
          ? "Les révisions Leitner sont disponibles avec Plus ou Pro."
          : "Le planning et les rappels sont disponibles avec Pro.",
      );
    return rights;
  }
}
export class BillingUseCases {
  constructor(
    private readonly repo: BillingRepository,
    private readonly provider: BillingProvider,
    private readonly access: GetEntitlements,
  ) {}
  catalog() {
    return this.repo.catalog();
  }
  async current(userId: string) {
    return {
      ...(await this.access.execute(userId)),
      canManage:
        this.provider.name === "stripe" &&
        !!(await this.repo.account(userId)).customerId,
      pending: await this.repo.pending(userId),
      provider: this.provider.name,
      mode: this.provider.name === "mock" ? "simulation" : "stripe_test",
    };
  }
  history(userId: string, page: number, pageSize: number) {
    return this.repo.history(userId, page, pageSize);
  }
  payments(userId: string, page: number, pageSize: number) {
    return this.repo.payments(userId, page, pageSize);
  }
  async checkout(userId: string, plan: PlanCode) {
    if (plan === "FREE")
      throw new DomainError(
        400,
        "INVALID_PLAN",
        "Le compte Free ne nécessite pas de paiement.",
      );
    const current = await this.access.execute(userId);
    if (current.plan !== "FREE")
      throw new DomainError(
        409,
        "SUBSCRIPTION_EXISTS",
        "Gérez votre offre depuis le portail. Les changements prennent effet à la prochaine période, sans prorata.",
      );
    const offer = (await this.repo.catalog()).find(
      (p) => p.code === plan && p.active,
    );
    if (!offer)
      throw new DomainError(404, "PLAN_NOT_FOUND", "Offre indisponible.");
    const account = await this.repo.account(userId);
    const intent = await this.repo.createCheckout(
      userId,
      plan,
      this.provider.name,
    );
    try {
      const result = await this.provider.checkout({
        intentId: intent.id,
        userId,
        customerId: account.customerId,
        email: account.email,
        plan,
        priceCents: offer.priceCents,
        currency: offer.currency,
      });
      await this.repo.finishCheckout(intent.id, result);
      return { url: result.url, intentId: intent.id, mode: this.provider.name };
    } catch (error) {
      await this.repo.failCheckout(intent.id);
      if (error instanceof DomainError) throw error;
      throw new DomainError(
        503,
        "BILLING_UNAVAILABLE",
        "Le service de facturation est indisponible. Aucun droit n’a été activé.",
      );
    }
  }
  async change(userId: string, plan: "PLUS" | "PRO") {
    const current = await this.access.execute(userId);
    if (!current.period || current.plan === plan)
      throw new DomainError(
        409,
        "INVALID_CHANGE",
        "Choisissez une autre offre pour un abonnement actif.",
      );
    try {
      return await this.provider.changePlan(
        current.period.providerSubscriptionId,
        plan,
      );
    } catch {
      throw new DomainError(
        503,
        "BILLING_UNAVAILABLE",
        "Changement temporairement indisponible.",
      );
    }
  }
  async portal(userId: string) {
    const user = await this.repo.account(userId);
    if (!user.customerId)
      throw new DomainError(
        409,
        "NO_CUSTOMER",
        "Aucun abonnement à gérer pour le moment.",
      );
    try {
      return {
        url: await this.provider.portal(user.customerId),
        mode: this.provider.name,
      };
    } catch {
      throw new DomainError(
        503,
        "BILLING_UNAVAILABLE",
        "Le portail de facturation est temporairement indisponible.",
      );
    }
  }
  async checkoutStatus(userId: string, id: string) {
    return this.repo.checkout(id, userId);
  }
}
export class ProcessBillingWebhook {
  constructor(
    private readonly repo: BillingRepository,
    private readonly provider: BillingProvider,
  ) {}
  async execute(raw: Buffer, signature: string) {
    let event;
    try {
      event = this.provider.verify(raw, signature);
    } catch {
      throw new DomainError(
        400,
        "INVALID_SIGNATURE",
        "Signature de webhook invalide.",
      );
    }
    if (await this.repo.hasEvent(event.id))
      return { received: true, duplicate: true };
    const key = event.subscriptionId ?? event.customerId ?? event.id;
    return this.repo.withSubscriptionLock(key, async () => {
      if (await this.repo.hasEvent(event.id))
        return { received: true, duplicate: true };
      let snapshot;
      try {
        snapshot = await this.provider.reconcile(event);
      } catch {
        throw new DomainError(
          503,
          "RECONCILIATION_FAILED",
          "État prestataire indisponible. Le webhook doit être réessayé.",
        );
      }
      return {
        received: true,
        ...(await this.repo.apply(event, snapshot, this.provider.name)),
      };
    });
  }
}
