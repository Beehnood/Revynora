import type { ProgressSummary } from "@revynora/types";
export interface ProgressReader {
  read(userId: string): Promise<ProgressSummary>;
}
export type ReviewFact = {
  id: string;
  createdAt: Date;
  remembered: boolean;
  durationSeconds: number | null;
  subject: string | null;
};
export type QuizFact = {
  id: string;
  submittedAt: Date;
  score: number;
  subject: string;
  title: string;
};
export function summarizeProgress(
  reviews: ReviewFact[],
  quizzes: QuizFact[],
  boxes: { box: number; count: number }[],
  now: Date,
): ProgressSummary {
  const average = (values: number[]) =>
    values.length
      ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
      : null;
  const completed = [...quizzes].sort(
    (a, b) => +a.submittedAt - +b.submittedAt,
  );
  const remembered = reviews.filter((r) => r.remembered).length;
  const periods = (days: number) =>
    Array.from({ length: days }, (_, i) => {
      const date = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() - days + 1 + i,
        ),
      )
        .toISOString()
        .slice(0, 10);
      return {
        date,
        reviews: reviews.filter(
          (r) => r.createdAt.toISOString().slice(0, 10) === date,
        ).length,
        quizzes: quizzes.filter(
          (q) => q.submittedAt.toISOString().slice(0, 10) === date,
        ).length,
      };
    });
  return {
    totalReviews: reviews.length,
    remembered,
    successRate: reviews.length
      ? Math.round((remembered * 100) / reviews.length)
      : null,
    revisionSeconds: reviews.reduce((n, r) => n + (r.durationSeconds ?? 0), 0),
    timedReviews: reviews.filter((r) => r.durationSeconds !== null).length,
    completedQuizzes: quizzes.length,
    averageScore: average(quizzes.map((q) => q.score)),
    boxes: Array.from({ length: 5 }, (_, i) => ({
      box: i + 1,
      count: boxes.find((b) => b.box === i + 1)?.count ?? 0,
    })),
    scores: completed.slice(-100).map((q) => ({
      date: q.submittedAt.toISOString(),
      score: q.score,
      subject: q.subject,
    })),
    subjects: [
      ...new Set([
        ...quizzes.map((q) => q.subject),
        ...reviews.flatMap((r) => (r.subject ? [r.subject] : [])),
      ]),
    ]
      .sort()
      .map((subject) => {
        const qs = completed.filter((q) => q.subject === subject);
        return {
          subject,
          quizzes: qs.length,
          averageScore: average(qs.map((q) => q.score)),
          latestScore: qs.at(-1)?.score ?? null,
          reviews: reviews.filter((r) => r.subject === subject).length,
        };
      }),
    weekly: periods(7),
    monthly: periods(30),
    activity: [
      ...reviews.map((r) => ({
        id: r.id,
        date: r.createdAt.toISOString(),
        title: r.remembered ? "Carte retenue" : "Carte à revoir",
        kind: "LEITNER" as const,
      })),
      ...quizzes.map((q) => ({
        id: q.id,
        date: q.submittedAt.toISOString(),
        title: q.title + " · " + q.score + " %",
        kind: "QUIZ" as const,
      })),
    ]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 50),
  };
}
