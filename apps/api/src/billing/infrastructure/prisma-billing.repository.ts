import type { PrismaClient } from "@prisma/client";
import { DomainError, missing } from "../../shared/domain/errors";
import type {
  BillingEvent,
  BillingRepository,
  BillingSnapshot,
  Period,
  PlanCode,
} from "../domain/billing";
export class PrismaBillingRepository implements BillingRepository {
  constructor(readonly db: PrismaClient) {}
  pending(userId: string) {
    return this.db.checkoutIntent.findFirst({
      where: { userId, status: "PENDING", expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
  }
  async failCheckout(id: string) {
    await this.db.checkoutIntent.updateMany({
      where: { id, status: "PENDING" },
      data: { status: "FAILED" },
    });
  }
  async catalog() {
    return this.db.subscription.findMany({
      where: { active: true },
      orderBy: { priceCents: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        priceCents: true,
        currency: true,
        interval: true,
        active: true,
      },
    });
  }
  async account(id: string) {
    const user = await this.db.user.findUnique({
      where: { id },
      select: { id: true, email: true, stripeCustomerId: true },
    });
    if (!user) throw missing();
    return {
      id: user.id,
      email: user.email,
      customerId: user.stripeCustomerId,
    };
  }
  async periods(userId: string): Promise<Period[]> {
    return (
      await this.db.userSubscriptionHistory.findMany({
        where: { userId },
        include: { subscription: { select: { code: true } } },
        orderBy: { startsAt: "desc" },
      })
    ).map((p) => ({
      id: p.id,
      plan: p.subscription.code,
      priceCents: p.priceCents,
      currency: p.currency,
      startsAt: p.startsAt,
      endsAt: p.endsAt,
      status: p.status,
      cancelAtPeriodEnd: p.cancelAtPeriodEnd,
      provider: p.provider,
      providerSubscriptionId: p.providerSubscriptionId,
    }));
  }
  async createCheckout(userId: string, plan: PlanCode, provider: string) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
      const pending = await tx.checkoutIntent.findFirst({
        where: { userId, status: "PENDING", expiresAt: { gt: new Date() } },
      });
      if (pending)
        throw new DomainError(
          409,
          "CHECKOUT_PENDING",
          "Une session de paiement est déjà en cours. Retrouvez-la dans votre facturation ou attendez son expiration.",
        );
      return tx.checkoutIntent.create({
        data: {
          userId,
          plan,
          provider,
          expiresAt: new Date(Date.now() + 30 * 60000),
        },
      });
    });
  }
  async finishCheckout(
    id: string,
    session: { id: string; customerId: string; url: string },
  ) {
    await this.db.$transaction(async (tx) => {
      const intent = await tx.checkoutIntent.update({
        where: { id },
        data: { providerSessionId: session.id, url: session.url },
      });
      await tx.user.update({
        where: { id: intent.userId },
        data: { stripeCustomerId: session.customerId },
      });
    });
  }
  async checkout(id: string, userId: string) {
    const intent = await this.db.checkoutIntent.findFirst({
      where: { id, userId },
    });
    if (!intent) throw missing();
    return intent;
  }
  async history(userId: string, page: number, pageSize: number) {
    const [items, total] = await this.db.$transaction([
      this.db.userSubscriptionHistory.findMany({
        where: { userId },
        include: { subscription: { select: { code: true, name: true } } },
        orderBy: [{ startsAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.db.userSubscriptionHistory.count({ where: { userId } }),
    ]);
    return { items, total, page, pageSize };
  }
  async payments(userId: string, page: number, pageSize: number) {
    const [items, total] = await this.db.$transaction([
      this.db.payment.findMany({
        where: { userId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          events: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              eventType: true,
              status: true,
              createdAt: true,
            },
          },
        },
      }),
      this.db.payment.count({ where: { userId } }),
    ]);
    return { items, total, page, pageSize };
  }
  async hasEvent(id: string) {
    return !!(await this.db.userPaymentHistory.findUnique({
      where: { providerEventId: id },
      select: { id: true },
    }));
  }
  async withSubscriptionLock<T>(
    key: string,
    work: () => Promise<T>,
  ): Promise<T> {
    // Serialize provider re-reads across processes; transaction client stays alive during work.
    return this.db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key})::bigint)`;
        return work();
      },
      { timeout: 30000, maxWait: 10000 },
    );
  }
  async apply(
    event: BillingEvent,
    snapshot: BillingSnapshot | null,
    provider: string,
  ) {
    return this.db.$transaction(
      async (tx) => {
        const duplicate = await tx.userPaymentHistory.findUnique({
          where: { providerEventId: event.id },
        });
        if (duplicate) return { duplicate: true };
        let paymentId: string | undefined;
        if (snapshot) {
          const user = await tx.user.findUnique({
            where: { id: snapshot.userId },
          });
          if (!user || user.stripeCustomerId !== snapshot.customerId)
            throw new DomainError(
              409,
              "BILLING_OWNER_MISMATCH",
              "Le compte de facturation ne correspond pas à cet utilisateur.",
            );
          await tx.$queryRaw`SELECT id FROM "User" WHERE id=${snapshot.userId} FOR UPDATE`;
          const offer = await tx.subscription.findUniqueOrThrow({
            where: { code: snapshot.plan },
          });
          if (snapshot.plan === "FREE" || snapshot.endsAt <= snapshot.startsAt)
            throw new DomainError(
              400,
              "INVALID_PERIOD",
              "Période de facturation invalide.",
            );
          if (snapshot.status === "ACTIVE")
            await tx.userSubscriptionHistory.updateMany({
              where: {
                userId: snapshot.userId,
                provider: "internal",
                subscription: { code: "FREE" },
                startsAt: { lt: snapshot.startsAt },
                endsAt: { gt: snapshot.startsAt },
              },
              data: { endsAt: snapshot.startsAt },
            });
          const current = await tx.userSubscriptionHistory.findFirst({
            where: {
              userId: snapshot.userId,
              providerSubscriptionId: snapshot.subscriptionId,
            },
            orderBy: { startsAt: "desc" },
          });
          if (current && current.startsAt > snapshot.startsAt) {
            // A stale snapshot must never reopen an older access period.
          } else {
            await tx.userSubscriptionHistory.updateMany({
              where: {
                userId: snapshot.userId,
                providerSubscriptionId: snapshot.subscriptionId,
                endsAt: { gt: snapshot.startsAt },
                startsAt: { lt: snapshot.startsAt },
              },
              data: { endsAt: snapshot.startsAt },
            });
            await tx.userSubscriptionHistory.upsert({
              where: {
                providerSubscriptionId_startsAt_subscriptionId: {
                  providerSubscriptionId: snapshot.subscriptionId,
                  startsAt: snapshot.startsAt,
                  subscriptionId: offer.id,
                },
              },
              create: {
                userId: snapshot.userId,
                subscriptionId: offer.id,
                provider,
                providerSubscriptionId: snapshot.subscriptionId,
                priceCents: offer.priceCents,
                currency: offer.currency,
                status: snapshot.status,
                startsAt: snapshot.startsAt,
                endsAt: snapshot.endsAt,
                cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd,
              },
              update: {
                status: snapshot.status,
                endsAt: snapshot.endsAt,
                cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd,
              },
            });
          }
          if (snapshot.payment) {
            const p = snapshot.payment;
            const existing = await tx.payment.findUnique({
              where: { providerReference: p.reference },
            });
            const status =
              existing?.status === "REFUNDED"
                ? "REFUNDED"
                : existing?.status === "PAID" && p.status === "FAILED"
                  ? "PAID"
                  : p.status;
            const receiptUrl =
              p.receiptUrl &&
              /^https:\/\/(invoice|pay|billing|checkout)\.stripe\.com\//.test(
                p.receiptUrl,
              )
                ? p.receiptUrl
                : null;
            const payment = await tx.payment.upsert({
              where: { providerReference: p.reference },
              create: {
                userId: snapshot.userId,
                providerReference: p.reference,
                provider,
                amountCents: p.amountCents,
                currency: p.currency,
                status,
                receiptUrl,
              },
              update: { status, receiptUrl },
            });
            paymentId = payment.id;
          }
          await tx.checkoutIntent.updateMany({
            where: {
              userId: snapshot.userId,
              provider,
              status: "PENDING",
              ...(event.checkoutId
                ? { providerSessionId: event.checkoutId }
                : {}),
            },
            data: {
              status:
                snapshot.status === "ACTIVE"
                  ? "COMPLETED"
                  : snapshot.status === "INCOMPLETE"
                    ? "FAILED"
                    : "COMPLETED",
            },
          });
          await tx.billingState.upsert({
            where: { providerSubscriptionId: snapshot.subscriptionId },
            create: {
              providerSubscriptionId: snapshot.subscriptionId,
              customerId: snapshot.customerId,
              lastEventCreated: BigInt(event.created),
            },
            update: {
              customerId: snapshot.customerId,
              lastEventCreated: BigInt(event.created),
            },
          });
          await tx.auditLog.create({
            data: {
              targetUserId: snapshot.userId,
              action: "BILLING_RECONCILED",
              entityType: "Subscription",
              entityId: snapshot.subscriptionId,
            },
          });
          await tx.emailMessage.upsert({
            where: { idempotencyKey: "billing_" + event.id },
            create: {
              userId: snapshot.userId,
              kind: "BILLING",
              subject:
                snapshot.status === "ACTIVE"
                  ? "Votre abonnement Revynora est confirmé"
                  : "Votre abonnement Revynora nécessite votre attention",
              body: `État : ${snapshot.status}. Offre : ${snapshot.plan}. Consultez votre espace de facturation. ${provider === "mock" ? "Simulation locale : aucun paiement réel." : ""}`,
              idempotencyKey: "billing_" + event.id,
            },
            update: {},
          });
        }
        await tx.userPaymentHistory.create({
          data: {
            providerEventId: event.id,
            eventType: event.type,
            userId: snapshot?.userId,
            paymentId,
            amountCents: snapshot?.payment?.amountCents,
            status: snapshot?.status ?? "IGNORED",
          },
        });
        return { duplicate: false };
      },
      { timeout: 15000 },
    );
  }
}
