import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { LearningService } from "./learning.service";
import { MIXED_DIAGNOSTIC_LEVEL } from "../shared/domain/diagnostic-design";
import type { DatabaseService } from "../database/database.service";
import type { AiService } from "../ai/ai.service";
function fixture() {
  const questions = Array.from({ length: 5 }, (_, i) => ({
    id: `q${i}`,
    position: i,
    concept: `Notion ${i}`,
    text: `Question ${i}`,
    type: "SINGLE" as const,
    explanation: "Correction fiable côté serveur.",
    chapter: null,
    sourcePage: null,
    sourceQuote: null,
    options: [
      { id: `ok${i}`, text: "Bonne", correct: true },
      { id: `no${i}`, text: "Fausse", correct: false },
    ],
  }));
  const quiz = {
    id: "quiz",
    ownerId: "owner",
    level: MIXED_DIAGNOSTIC_LEVEL,
    provider: "openai",
    questions,
    course: { content: "Cours" },
    documentId: null,
  };
  const attempt = {
    id: "attempt",
    userId: "owner",
    quizId: quiz.id,
    quiz,
    submittedAt: null as Date | null,
    score: null as number | null,
    mode: null,
    answers: questions.map((q) => ({
      questionId: q.id,
      selectedOptionIds: [q.options[1].id],
    })),
  };
  const find = vi.fn(
    async ({ where }: { where: { id: string; userId: string } }) =>
      where.id === attempt.id && where.userId === attempt.userId
        ? attempt
        : null,
  );
  const update = vi.fn(
    async ({ data }: { data: { submittedAt: Date; score: number } }) =>
      Object.assign(attempt, data),
  );
  const tx = {
    $queryRaw: vi.fn(async () => []),
    quizAttempt: { findFirst: find, update },
  };
  const client = {
    ...tx,
    $transaction: (fn: (tx: unknown) => unknown) => fn(tx),
    quiz: {
      findFirst: vi.fn(async () => ({
        ...quiz,
        questions: questions.map(({ id, position, text, type, options }) => ({
          id,
          position,
          text,
          type,
          options: options.map(({ id, text }) => ({ id, text })),
        })),
      })),
    },
  };
  const service = new LearningService(
    { client } as unknown as DatabaseService,
    {} as AiService,
  );
  return { service, attempt, update };
}
describe("Bilan servi uniquement après correction serveur", () => {
  it("ne révèle ni estimation, ni correction avant soumission", async () => {
    const { service } = fixture();
    const draft = await service.attempt("owner", "attempt");
    expect(draft.result).toBeNull();
    expect(JSON.stringify(draft.quiz)).not.toMatch(
      /correct|explanation|assessment/,
    );
  });
  it("calcule zéro à partir des mauvaises réponses et conserve la soumission lors d’un doublon", async () => {
    const { service, update } = fixture();
    const result = await service.submit("owner", "attempt");
    expect(result.score).toBe(0);
    expect(result.result?.assessment?.level).toBe("Débutant");
    expect(result.result?.assessment?.revisionPlan).toHaveLength(5);
    const again = await service.submit("owner", "attempt");
    expect(again.submittedAt).toEqual(result.submittedAt);
    expect(update).toHaveBeenCalledTimes(1);
  });
  it("refuse une autre identité et une soumission incomplète sans calculer un faux profil", async () => {
    const { service, attempt, update } = fixture();
    await expect(service.submit("other", "attempt")).rejects.toMatchObject({
      status: 404,
    });
    attempt.answers.pop();
    await expect(service.submit("owner", "attempt")).rejects.toMatchObject({
      status: 409,
    });
    expect(update).not.toHaveBeenCalled();
  });
});
