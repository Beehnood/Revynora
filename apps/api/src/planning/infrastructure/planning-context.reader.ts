import type { PrismaClient } from "@prisma/client";
import { Temporal } from "@js-temporal/polyfill";
import { grade } from "../../learning/scoring";
import type {
  PlanningContextReader,
  PlanningContext,
} from "../domain/intelligent-planning";
export function localString(date: Date, zone: string) {
  return Temporal.Instant.from(date.toISOString())
    .toZonedDateTimeISO(zone)
    .toPlainDateTime()
    .toString({ smallestUnit: "minute" });
}
export class PrismaPlanningContext implements PlanningContextReader {
  constructor(private readonly db: PrismaClient) {}
  async read(userId: string, timeZone: string): Promise<PlanningContext> {
    const now = new Date(),
      horizon = new Date(+now + 30 * 86400000);
    const [courses, attempts, cards, tasks, availability] =
      await this.db.$transaction([
        this.db.course.findMany({
          where: {
            OR: [{ ownerId: userId }, { ownerId: null, source: "ADMIN" }],
          },
          orderBy: { createdAt: "desc" },
          take: 100,
          select: { id: true, title: true, domain: true },
        }),
        this.db.quizAttempt.findMany({
          where: { userId, submittedAt: { not: null } },
          orderBy: { submittedAt: "desc" },
          take: 200,
          include: {
            answers: true,
            quiz: { include: { questions: { include: { options: true } } } },
          },
        }),
        this.db.leitnerCard.findMany({
          where: { userId, archivedAt: null, dueAt: { lt: horizon } },
          select: { courseId: true, dueAt: true },
          take: 1000,
        }),
        this.db.studyPlanItem.findMany({
          where: { plan: { userId }, status: "PLANNED", endsAt: { gt: now } },
          select: { startsAt: true, endsAt: true, courseId: true, kind: true },
        }),
        this.db.studyAvailability.findMany({
          where: { userId, startsAt: { gte: now, lt: horizon } },
          orderBy: { startsAt: "asc" },
          take: 60,
        }),
      ]);
    // Subtract occupied slots, including exams; no model can authorize overwriting a task.
    const slots = availability.flatMap((a) => {
      let free = [{ startsAt: a.startsAt, endsAt: a.endsAt }];
      for (const t of tasks)
        free = free.flatMap((s) => {
          if (t.startsAt >= s.endsAt || t.endsAt <= s.startsAt) return [s];
          return [
            { startsAt: s.startsAt, endsAt: t.startsAt },
            { startsAt: t.endsAt, endsAt: s.endsAt },
          ].filter(
            (p) =>
              p.startsAt >= s.startsAt &&
              p.endsAt <= s.endsAt &&
              +p.endsAt - +p.startsAt >= 15 * 60000,
          );
        });
      return free.map((s) => ({
        startsAt: s.startsAt.toISOString(),
        endsAt: s.endsAt.toISOString(),
        localStart: localString(s.startsAt, timeZone),
      }));
    });
    return {
      now: now.toISOString(),
      timeZone,
      slots,
      courses: courses.map((c) => {
        const own = attempts.filter((a) => a.quiz.courseId === c.id),
          scores = own.map((a) => a.score!).filter((x) => x !== null);
        return {
          id: c.id,
          title: c.title,
          subject: c.domain,
          averageScore: scores.length
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : null,
          weak: [
            ...new Set(
              own
                .slice(0, 3)
                .flatMap((a) => grade(a.quiz.questions, a.answers).weak),
            ),
          ],
          due: cards
            .filter((x) => x.courseId === c.id)
            .map((x) => x.dueAt.toISOString()),
          exam:
            tasks
              .filter((t) => t.kind === "EXAM" && t.courseId === c.id)
              .sort((a, b) => +a.startsAt - +b.startsAt)[0]
              ?.startsAt.toISOString() ?? null,
        };
      }),
    };
  }
}
