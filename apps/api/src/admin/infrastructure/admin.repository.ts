import type { AdminAccessChange, AdminMetrics } from "@revynora/types";
import { Logger } from "@nestjs/common";
import { encodeAccessAudit, decodeAccessAudit } from "../domain/audit";
import type { PrismaClient } from "@prisma/client";
import { DomainError, missing } from "../../shared/domain/errors";
import type { AdminRepository, AdminFilter } from "../domain/admin";
export class PrismaAdminRepository implements AdminRepository {
  private readonly logger = new Logger("AdminAudit");
  constructor(private readonly db: PrismaClient) {}
  async metrics(f: AdminFilter): Promise<AdminMetrics> {
    const createdAt = { gte: f.from, lt: f.to };
    const [users, newUsers, payments, ai, statuses] =
      await this.db.$transaction([
        this.db.user.count(),
        this.db.user.count({ where: { createdAt } }),
        this.db.payment.groupBy({
          by: ["provider", "status"],
          orderBy: { provider: "asc" },
          where: { createdAt },
          _sum: { amountCents: true as const },
          _count: true as const,
        }),
        this.db.aIUsage.aggregate({
          where: { createdAt },
          _count: true as const,
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
          _count: true as const,
        }),
      ]);
    return {
      users,
      newUsers,
      payments: payments.map((p) => {
        if (!p._sum || p._sum.amountCents === undefined)
          throw new Error("Missing payment aggregate");
        return {
          provider: p.provider,
          status: p.status,
          _sum: { amountCents: p._sum.amountCents },
          _count: aggregateCount(p._count),
        };
      }),
      ai: {
        ...ai,
        _sum: {
          ...ai._sum,
          estimatedCostUsd: ai._sum.estimatedCostUsd?.toString() ?? null,
        },
      },
      subscriptions: statuses.map((s) => ({
        status: s.status,
        _count: aggregateCount(s._count),
      })),
      from: f.from.toISOString(),
      to: f.to.toISOString(),
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
    return {
      items: items.map((u) => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
        disabledAt: u.disabledAt?.toISOString() ?? null,
      })),
      total,
      page: f.page,
      pageSize: 20,
    };
  }
  async user(id: string) {
    const u = await this.db.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        disabledAt: true,
        createdAt: true,
      },
    });
    if (!u) throw missing();
    return {
      ...u,
      createdAt: u.createdAt.toISOString(),
      disabledAt: u.disabledAt?.toISOString() ?? null,
    };
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
    return {
      items: items.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        status: e.status,
        amountCents: e.amountCents,
        createdAt: e.createdAt.toISOString(),
      })),
      total,
      page: f.page,
      pageSize: 20,
      audit: audit.map((e) => ({
        id: e.id,
        actorId: e.actorId,
        targetUserId: e.targetUserId,
        createdAt: e.createdAt.toISOString(),
        ...decodeAccessAudit(e.action),
      })),
    };
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
  async disable(
    actor: string,
    user: string,
    command: AdminAccessChange,
  ): Promise<{ ok: true }> {
    const action = command.disabled ? "USER_DISABLED" : "USER_ENABLED";
    const record = (result: "SUCCESS" | "REJECTED" | "FAILED") => ({
      actorId: actor,
      targetUserId: user,
      entityType: "User",
      entityId: user,
      action: encodeAccessAudit({
        version: 1,
        action,
        reason: command.reason,
        result,
      }),
    });
    try {
      if (actor === user)
        throw new DomainError(
          409,
          "SELF_MODIFICATION",
          "Vous ne pouvez pas suspendre votre propre compte.",
        );
      return await this.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "User" WHERE role='ADMIN' ORDER BY id FOR UPDATE`;
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
          data: { disabledAt: command.disabled ? new Date() : null },
        });
        if (command.disabled)
          await tx.session.deleteMany({ where: { userId: user } });
        await tx.auditLog.create({ data: record("SUCCESS") });
        return { ok: true as const };
      });
    } catch (error) {
      // Failed transactions cannot retain their own audit row. Do not log request bodies or errors.
      try {
        await this.db.auditLog.create({
          data: record(error instanceof DomainError ? "REJECTED" : "FAILED"),
        });
      } catch {
        // Report the lost audit without logging either exception, credentials or request body.
        // The business/transaction error remains the error returned to the caller.
        this.logger.error({
          event: "ADMIN_AUDIT_PERSISTENCE_FAILED",
          actorId: actor,
          targetUserId: user,
          action,
          reason: command.reason,
          originalCode: error instanceof DomainError ? error.code : "INTERNAL",
        });
      }
      throw error;
    }
  }
}

function aggregateCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0)
    throw new Error("Invalid aggregate count");
  return value;
}
