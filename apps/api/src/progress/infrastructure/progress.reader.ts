import type { PrismaClient } from "@prisma/client";
import { summarizeProgress, type ProgressReader } from "../domain/progress";
export class PrismaProgressReader implements ProgressReader {
  constructor(private readonly db: PrismaClient) {}
  async read(userId: string) {
    const [reviews, quizzes, boxes] = await this.db.$transaction([
      this.db.revision.findMany({
        where: { userId },
        select: {
          id: true,
          createdAt: true,
          remembered: true,
          durationSeconds: true,
          course: { select: { domain: true } },
        },
      }),
      this.db.quizAttempt.findMany({
        where: { userId, submittedAt: { not: null }, score: { not: null } },
        select: {
          id: true,
          submittedAt: true,
          score: true,
          quiz: { select: { domain: true, topic: true } },
        },
      }),
      this.db.$queryRaw<
        { box: number; count: number }[]
      >`SELECT box, count(*)::int AS count FROM "LeitnerCard" WHERE "userId"=${userId} AND "archivedAt" IS NULL GROUP BY box ORDER BY box`,
    ]);
    return summarizeProgress(
      reviews.map((r) => ({ ...r, subject: r.course?.domain ?? null })),
      quizzes.map((q) => ({
        id: q.id,
        submittedAt: q.submittedAt!,
        score: q.score!,
        subject: q.quiz.domain,
        title: q.quiz.topic,
      })),
      boxes,
      new Date(),
    );
  }
}
