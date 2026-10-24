import type { PrismaClient, Prisma, StudyPlanItem } from "@prisma/client";
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
  private async snapshot(tx: Prisma.TransactionClient, item: StudyPlanItem) {
    const {
      id,
      version,
      title,
      startsAt,
      endsAt,
      status,
      reminderMinutes,
      courseId,
      kind,
      priority,
    } = item;
    await tx.studyPlanItemVersion.create({
      data: {
        itemId: id,
        version,
        title,
        startsAt,
        endsAt,
        status,
        reminderMinutes,
        courseId,
        kind,
        priority,
      },
    });
  }
  async history(userId: string, id: string, page: number) {
    const item = await this.db.studyPlanItem.findFirst({
      where: { id, plan: { userId } },
    });
    if (!item) throw missing();
    const where = { itemId: id };
    const [items, total] = await this.db.$transaction([
      this.db.studyPlanItemVersion.findMany({
        where,
        orderBy: { version: "desc" },
        skip: (page - 1) * 20,
        take: 20,
      }),
      this.db.studyPlanItemVersion.count({ where }),
    ]);
    return { items, total, page, pageSize: 20 };
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
  private async validateCourse(
    tx: Prisma.TransactionClient,
    userId: string,
    courseId?: string | null,
  ) {
    if (!courseId) return;
    const course = await tx.course.findFirst({
      where: {
        id: courseId,
        OR: [{ ownerId: userId }, { ownerId: null, source: "ADMIN" }],
      },
    });
    if (!course) throw missing();
  }
  generate(
    userId: string,
    input: GenerateInput,
    options?: { requestId: string; hash: string },
  ) {
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, userId);
      if (options) {
        const existing = await tx.studyPlan.findUnique({
          where: { generationKey: options.requestId },
          include: { items: true },
        });
        if (existing) {
          if (
            existing.userId !== userId ||
            existing.generationHash !== options.hash
          )
            throw new DomainError(
              409,
              "REQUEST_CONFLICT",
              "Identifiant de proposition déjà utilisé.",
            );
          return existing;
        }
      }
      const availability = options
        ? await tx.studyAvailability.findMany({ where: { userId } })
        : [];
      const busy = await tx.studyPlanItem.findMany({
        where: {
          plan: { userId },
          status: "PLANNED",
          endsAt: { gt: new Date() },
        },
        select: { startsAt: true, endsAt: true },
      });
      const plan = await tx.studyPlan.create({
        data: {
          userId,
          title: input.title,
          timeZone: input.timeZone,
          generationKey: options?.requestId,
          generationHash: options?.hash,
        },
      });
      for (const task of input.tasks) {
        await this.validateCourse(tx, userId, task.courseId);
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
        if (options) {
          if (
            !availability.some(
              (a) => slot.startsAt >= a.startsAt && slot.endsAt <= a.endsAt,
            )
          )
            throw new DomainError(
              409,
              "OUTSIDE_AVAILABILITY",
              "Le créneau n’est plus disponible. Regénérez la proposition.",
            );
          const exam = task.courseId
            ? await tx.studyPlanItem.findFirst({
                where: {
                  plan: { userId },
                  courseId: task.courseId,
                  kind: "EXAM",
                  status: "PLANNED",
                  endsAt: { gt: new Date() },
                },
                orderBy: { startsAt: "asc" },
              })
            : null;
          if (exam && slot.endsAt > exam.startsAt)
            throw new DomainError(
              409,
              "AFTER_EXAM",
              "Une révision doit précéder l’examen.",
            );
        }
        busy.push(slot);
        const item = await tx.studyPlanItem.create({
          data: {
            planId: plan.id,
            title: task.title,
            reminderMinutes: task.reminderMinutes,
            courseId: task.courseId,
            kind: task.kind,
            priority: task.priority,
            ...slot,
          },
        });
        await this.snapshot(tx, item);
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
      await this.validateCourse(tx, userId, input.courseId);
      const start = input.localStart
        ? localInstant(input.localStart, item.plan.timeZone)
        : item.startsAt;
      const minutes =
        input.durationMinutes ?? (+item.endsAt - +item.startsAt) / 60000;
      const status = input.status ?? item.status;
      if (status === "PLANNED" && start < new Date())
        throw new DomainError(400, "PAST_TASK", "Choisissez une date future.");
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
          courseId: input.courseId,
          kind: input.kind,
          priority: input.priority,
          reminderMinutes: input.reminderMinutes,
          version: { increment: 1 },
        },
      });
      await this.snapshot(tx, changed);
      await this.delivery(tx, changed);
      return changed;
    });
  }
  async rename(userId: string, id: string, title: string) {
    const result = await this.db.studyPlan.updateMany({
      where: { id, userId },
      data: { title },
    });
    if (!result.count) throw missing();
    return { ok: true };
  }
  availability(userId: string) {
    return this.db.studyAvailability.findMany({
      where: { userId, endsAt: { gt: new Date() } },
      orderBy: { startsAt: "asc" },
    });
  }
  saveAvailability(userId: string, slots: { startsAt: Date; endsAt: Date }[]) {
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, userId);
      const sorted = [...slots].sort((a, b) => +a.startsAt - +b.startsAt);
      for (let i = 0; i < sorted.length; i++) {
        if (
          sorted[i]!.startsAt < new Date() ||
          (i && sorted[i]!.startsAt < sorted[i - 1]!.endsAt)
        )
          throw new DomainError(
            400,
            "INVALID_AVAILABILITY",
            "Créneaux futurs sans chevauchement requis.",
          );
      }
      await tx.studyAvailability.deleteMany({ where: { userId } });
      if (slots.length)
        await tx.studyAvailability.createMany({
          data: slots.map((s) => ({ userId, ...s })),
        });
      return tx.studyAvailability.findMany({
        where: { userId },
        orderBy: { startsAt: "asc" },
      });
    });
  }
}
