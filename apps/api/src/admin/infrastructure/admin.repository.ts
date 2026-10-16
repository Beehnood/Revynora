import type { PrismaClient } from "@prisma/client";
import { DomainError, missing } from "../../shared/domain/errors";
import type { AdminRepository, AdminFilter } from "../domain/admin";
export class PrismaAdminRepository implements AdminRepository {
  constructor(private readonly db: PrismaClient) {}
  async metrics(f: AdminFilter) {
    const createdAt = { gte: f.from, lt: f.to };
    const [users, newUsers, payments, ai, statuses] =
      await this.db.$transaction([
        this.db.user.count(),
        this.db.user.count({ where: { createdAt } }),
        this.db.payment.groupBy({
          by: ["provider", "status"],
          orderBy: { provider: "asc" },
          where: { createdAt },
          _sum: { amountCents: true },
          _count: true,
        }),
        this.db.aIUsage.aggregate({
          where: { createdAt },
          _count: true,
          _sum: {
            estimatedCostUsd: true,
            inputTokens: true,
            outputTokens: true,
          },
        }),
        this.db.userSubscriptionHistory.groupBy({
          by: ["status"],
          orderBy: { status: "asc" },
          where: { startsAt: { lte: new Date() }, endsAt: { gt: new Date() } },
          _count: true,
        }),
      ]);
    return {
      users,
      newUsers,
      payments,
      ai,
      subscriptions: statuses,
      from: f.from,
      to: f.to,
      billingMode: process.env.BILLING_PROVIDER ?? "mock",
      workerEnabled: process.env.WORKER_ENABLED !== "false",
    };
  }
  async users(f: AdminFilter) {
    const where = {
      OR: [
        { email: { contains: f.search, mode: "insensitive" as const } },
        { name: { contains: f.search, mode: "insensitive" as const } },
      ],
    };
    const [items, total] = await this.db.$transaction([
      this.db.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          disabledAt: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (f.page - 1) * 20,
        take: 20,
      }),
      this.db.user.count({ where }),
    ]);
    return { items, total, page: f.page, pageSize: 20 };
  }
  async events(f: AdminFilter) {
    const where = { createdAt: { gte: f.from, lt: f.to } };
    const [items, total, audit] = await this.db.$transaction([
      this.db.userPaymentHistory.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (f.page - 1) * 20,
        take: 20,
      }),
      this.db.userPaymentHistory.count({ where }),
      this.db.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);
    return { items, total, page: f.page, pageSize: 20, audit };
  }
  offers() {
    return this.db.subscription.findMany({
      orderBy: { priceCents: "asc" },
      select: {
        code: true,
        name: true,
        priceCents: true,
        currency: true,
        active: true,
      },
    });
  }
  disable(actor: string, user: string, disabled: boolean) {
    if (actor === user)
      throw new DomainError(
        409,
        "SELF_MODIFICATION",
        "Vous ne pouvez pas suspendre votre propre compte.",
      );
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE role='ADMIN' FOR UPDATE`;
      const target = await tx.user.findUnique({ where: { id: user } });
      if (!target) throw missing();
      if (target.role === "ADMIN")
        throw new DomainError(
          409,
          "ADMIN_PROTECTED",
          "La suspension des administrateurs se gère hors de cette interface.",
        );
      await tx.user.update({
        where: { id: user },
        data: { disabledAt: disabled ? new Date() : null },
      });
      if (disabled) await tx.session.deleteMany({ where: { userId: user } });
      await tx.auditLog.create({
        data: {
          actorId: actor,
          targetUserId: user,
          action: disabled ? "USER_DISABLED" : "USER_ENABLED",
          entityType: "User",
          entityId: user,
        },
      });
      return { ok: true };
    });
  }
}
