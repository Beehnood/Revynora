import type { PrismaClient, Prisma } from "@prisma/client";
import { Temporal } from "@js-temporal/polyfill";
import { DomainError, missing } from "../../shared/domain/errors";
import {
  placeSlot,
  type GenerateInput,
  type PatchInput,
  type PlanRepository,
} from "../domain/planning";
export function localInstant(local: string, zone: string) {
  try {
    return new Date(
      Temporal.PlainDateTime.from(local).toZonedDateTime(zone, {
        disambiguation: "reject",
      }).epochMilliseconds,
    );
  } catch {
    throw new DomainError(
      400,
      "INVALID_LOCAL_TIME",
      "Date inexistante ou ambiguë dans ce fuseau horaire. Choisissez un autre horaire.",
    );
  }
}
export class PrismaPlanRepository implements PlanRepository {
  constructor(private readonly db: PrismaClient) {}
  async list(userId: string, from: Date, to: Date) {
    const where = {
      plan: { userId },
      startsAt: { lt: to },
      endsAt: { gt: from },
    };
    const [items, total] = await this.db.$transaction([
      this.db.studyPlanItem.findMany({
        where,
        include: { plan: { select: { title: true, timeZone: true } } },
        orderBy: { startsAt: "asc" },
        take: 500,
      }),
      this.db.studyPlanItem.count({ where }),
    ]);
    return { items, total, limit: 500 };
  }
  private async lock(tx: Prisma.TransactionClient, user: string) {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user} FOR UPDATE`;
  }
  private async delivery(
    tx: Prisma.TransactionClient,
    item: {
      id: string;
      version: number;
      startsAt: Date;
      reminderMinutes: number | null;
      status: string;
    },
  ) {
    await tx.reminderDelivery.updateMany({
      where: { itemId: item.id, status: "PENDING" },
      data: { status: "CANCELLED" },
    });
    if (item.status === "PLANNED" && item.reminderMinutes !== null)
      await tx.reminderDelivery.create({
        data: {
          itemId: item.id,
          version: item.version,
          dueAt: new Date(+item.startsAt - item.reminderMinutes * 60000),
        },
      });
  }
  generate(userId: string, input: GenerateInput) {
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, userId);
      const busy = await tx.studyPlanItem.findMany({
        where: {
          plan: { userId },
          status: "PLANNED",
          endsAt: { gt: new Date() },
        },
        select: { startsAt: true, endsAt: true },
      });
      const plan = await tx.studyPlan.create({
        data: { userId, title: input.title, timeZone: input.timeZone },
      });
      for (const task of input.tasks) {
        const start = localInstant(task.localStart, input.timeZone);
        if (start < new Date())
          throw new DomainError(
            400,
            "PAST_TASK",
            "Choisissez une date future.",
          );
        const slot = placeSlot(
          start,
          task.durationMinutes,
          busy,
          input.resolveConflicts,
        );
        busy.push(slot);
        const item = await tx.studyPlanItem.create({
          data: {
            planId: plan.id,
            title: task.title,
            reminderMinutes: task.reminderMinutes,
            ...slot,
          },
        });
        await this.delivery(tx, item);
      }
      return tx.studyPlan.findUniqueOrThrow({
        where: { id: plan.id },
        include: { items: true },
      });
    });
  }
  edit(userId: string, id: string, input: PatchInput) {
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, userId);
      const item = await tx.studyPlanItem.findFirst({
        where: { id, plan: { userId } },
        include: { plan: true },
      });
      if (!item) throw missing();
      if (item.version !== input.version)
        throw new DomainError(
          409,
          "STALE_TASK",
          "Cette séance a changé. Rechargez le planning.",
        );
      const start = input.localStart
        ? localInstant(input.localStart, item.plan.timeZone)
        : item.startsAt;
      const minutes =
        input.durationMinutes ?? (+item.endsAt - +item.startsAt) / 60000;
      const status = input.status ?? item.status;
      const busy = await tx.studyPlanItem.findMany({
        where: { id: { not: id }, plan: { userId }, status: "PLANNED" },
        select: { startsAt: true, endsAt: true },
      });
      const slot =
        status === "PLANNED"
          ? placeSlot(start, minutes, busy, input.resolveConflicts)
          : { startsAt: start, endsAt: new Date(+start + minutes * 60000) };
      const changed = await tx.studyPlanItem.update({
        where: { id },
        data: {
          ...slot,
          status,
          title: input.title,
          reminderMinutes: input.reminderMinutes,
          version: { increment: 1 },
        },
      });
      await this.delivery(tx, changed);
      return changed;
    });
  }
}
