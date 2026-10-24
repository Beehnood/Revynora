import type { PrismaClient, Prisma } from "@prisma/client";
import { DomainError, missing } from "../../shared/domain/errors";
import {
  DEFAULT_LEITNER_INTERVALS,
  scheduleReview,
  type CardRepository,
  type CardInput,
} from "../domain/leitner";
export class PrismaCardRepository implements CardRepository {
  constructor(
    private readonly db: PrismaClient,
    private readonly intervals: readonly number[] = DEFAULT_LEITNER_INTERVALS,
  ) {}
  async list(userId: string, due: boolean, page: number, pageSize: number) {
    const where = {
      userId,
      archivedAt: null,
      ...(due ? { dueAt: { lte: new Date() } } : {}),
    };
    const [items, total] = await this.db.$transaction([
      this.db.leitnerCard.findMany({
        where,
        orderBy: [{ dueAt: "asc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.db.leitnerCard.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }
  private async course(
    tx: Prisma.TransactionClient,
    userId: string,
    id?: string | null,
  ) {
    if (!id) return;
    const c = await tx.course.findFirst({
      where: {
        id,
        OR: [{ ownerId: userId }, { ownerId: null, source: "ADMIN" }],
      },
    });
    if (!c) throw missing();
  }
  create(userId: string, input: CardInput) {
    return this.db.$transaction(async (tx) => {
      await this.course(tx, userId, input.courseId);
      return tx.leitnerCard.create({ data: { userId, ...input } });
    });
  }
  edit(userId: string, id: string, version: number, input: CardInput) {
    return this.db.$transaction(async (tx) => {
      await this.course(tx, userId, input.courseId);
      const found = await tx.leitnerCard.findFirst({
        where: { id, userId, archivedAt: null },
      });
      if (!found) throw missing();
      const result = await tx.leitnerCard.updateMany({
        where: { id, userId, version },
        data: { ...input, version: { increment: 1 } },
      });
      if (!result.count)
        throw new DomainError(
          409,
          "STALE_CARD",
          "Cette carte a changé. Rechargez-la.",
        );
      return tx.leitnerCard.findUniqueOrThrow({ where: { id } });
    });
  }
  async archive(userId: string, id: string) {
    const r = await this.db.leitnerCard.updateMany({
      where: { id, userId },
      data: { archivedAt: new Date(), version: { increment: 1 } },
    });
    if (!r.count) throw missing();
    return { ok: true };
  }
  review(
    userId: string,
    id: string,
    input: {
      requestId: string;
      version: number;
      remembered: boolean;
      durationSeconds?: number;
    },
  ) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "LeitnerCard" WHERE id=${id} AND "userId"=${userId} FOR UPDATE`;
      const card = await tx.leitnerCard.findFirst({
        where: { id, userId, archivedAt: null },
      });
      if (!card) throw missing();
      const previous = await tx.revision.findUnique({
        where: { requestId: input.requestId },
      });
      if (previous) {
        if (
          previous.userId !== userId ||
          previous.cardId !== id ||
          previous.remembered !== input.remembered
        )
          throw new DomainError(
            409,
            "REQUEST_CONFLICT",
            "Identifiant de révision déjà utilisé.",
          );
        return previous;
      }
      if (card.version !== input.version)
        throw new DomainError(
          409,
          "STALE_CARD",
          "Cette carte a déjà été révisée. Rechargez votre session.",
        );
      if (card.dueAt > new Date())
        throw new DomainError(
          409,
          "NOT_DUE",
          "Cette carte n’est pas encore à revoir.",
        );
      const next = scheduleReview(
        card.box,
        input.remembered,
        new Date(),
        this.intervals,
      );
      await tx.leitnerCard.update({
        where: { id },
        data: {
          box: next.toBox,
          dueAt: next.nextDueAt,
          version: { increment: 1 },
        },
      });
      return tx.revision.create({
        data: {
          userId,
          cardId: id,
          courseId: card.courseId,
          requestId: input.requestId,
          remembered: input.remembered,
          durationSeconds: input.durationSeconds,
          fromBox: card.box,
          ...next,
        },
      });
    });
  }
  async stats(userId: string) {
    const [boxes, due, total, recent] = await this.db.$transaction([
      this.db.leitnerCard.groupBy({
        by: ["box"],
        orderBy: { box: "asc" },
        where: { userId, archivedAt: null },
        _count: true,
      }),
      this.db.leitnerCard.count({
        where: { userId, archivedAt: null, dueAt: { lte: new Date() } },
      }),
      this.db.revision.count({ where: { userId } }),
      this.db.revision.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);
    return {
      boxes,
      due,
      totalReviews: total,
      recent,
      intervals: this.intervals,
    };
  }
}
