import type { Prisma, PrismaClient } from "@prisma/client";
import { DomainError, missing } from "../../shared/domain/errors";
import type { GrantInput, InternalGrantRepository } from "../domain/access";
export class PrismaInternalGrantRepository implements InternalGrantRepository {
  constructor(private readonly db: PrismaClient) {}
  list(userId: string, page: number) {
    return this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT set_config('statement_timeout','5000',true)`;
        return tx.internalLearningGrant.findMany({
          where: { userId },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 20,
          skip: (page - 1) * 20,
        });
      },
      { maxWait: 3000, timeout: 12000 },
    );
  }
  private async actors(
    tx: Prisma.TransactionClient,
    actorId: string,
    targetId: string,
    issuing = true,
  ) {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id IN (${actorId},${targetId}) ORDER BY id FOR UPDATE`;
    const actor = await tx.user.findUnique({
      where: { id: actorId },
      select: { role: true, disabledAt: true },
    });
    const target = await tx.user.findUnique({
      where: { id: targetId },
      select: { role: true, disabledAt: true },
    });
    if (!actor || actor.role !== "ADMIN" || actor.disabledAt)
      throw new DomainError(
        403,
        "ADMIN_REQUIRED",
        "Administrateur actif requis.",
      );
    if (!target) throw missing();
    if (issuing && (target.role !== "ADMIN" || target.disabledAt))
      throw new DomainError(
        422,
        "INVALID_BENEFICIARY",
        "Le bénéficiaire doit être un administrateur actif explicitement désigné.",
      );
  }
  async issue(actorId: string, userId: string, input: GrantInput) {
    const startsAt = new Date(input.startsAt),
      expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    if (
      !Number.isFinite(+startsAt) ||
      (expiresAt &&
        (!Number.isFinite(+expiresAt) ||
          expiresAt <= startsAt ||
          expiresAt <= new Date()))
    )
      throw new DomainError(
        400,
        "VALIDATION",
        "Dates d’attribution invalides.",
      );
    return this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT set_config('statement_timeout','5000',true)`;
        await this.actors(tx, actorId, userId);
        if (
          await tx.internalLearningGrant.findFirst({
            where: {
              userId,
              revokedAt: null,
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            },
          })
        )
          throw new DomainError(
            409,
            "GRANT_EXISTS",
            "Révoquez l’attribution existante avant d’en créer une autre.",
          );
        const grant = await tx.internalLearningGrant.create({
          data: {
            userId,
            level: "PRO",
            startsAt,
            expiresAt,
            provenance: input.provenance,
            justification: input.justification,
            issuedById: actorId,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId,
            targetUserId: userId,
            entityType: "InternalLearningGrant",
            entityId: grant.id,
            action: "INTERNAL_LEARNING_GRANTED",
          },
        });
        return grant;
      },
      { maxWait: 3000, timeout: 12000 },
    );
  }
  async revoke(actorId: string, id: string, reason: string) {
    return this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT set_config('statement_timeout','5000',true)`;
        const existing = await tx.internalLearningGrant.findUnique({
          where: { id },
        });
        if (!existing) throw missing();
        await this.actors(tx, actorId, existing.userId, false);
        const grant = await tx.internalLearningGrant.findUniqueOrThrow({
          where: { id },
        });
        if (grant.revokedAt) return grant;
        const revoked = await tx.internalLearningGrant.update({
          where: { id },
          data: {
            revokedAt: new Date(),
            revokedById: actorId,
            revocationReason: reason,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId,
            targetUserId: grant.userId,
            entityType: "InternalLearningGrant",
            entityId: id,
            action: "INTERNAL_LEARNING_REVOKED",
          },
        });
        return revoked;
      },
      { maxWait: 3000, timeout: 12000 },
    );
  }
}
