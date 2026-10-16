import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { DatabaseService } from "../database/database.service";
import { AiService } from "../ai/ai.service";
import type { DiagnosticInput } from "../ai/ai.schema";
import { ApiError } from "../shared/http/errors";
import { grade } from "./scoring";
const publicQuestions = {
  orderBy: { position: "asc" as const },
  select: {
    id: true,
    position: true,
    text: true,
    type: true,
    options: {
      orderBy: { position: "asc" as const },
      select: { id: true, text: true },
    },
  },
};
const fullQuiz = {
  questions: { include: { options: true } },
  course: true,
} satisfies Prisma.QuizInclude;
const notFound = () => new ApiError(404, "NOT_FOUND", "Ressource introuvable.");
@Injectable()
export class LearningService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(AiService) private readonly ai: AiService,
  ) {}
  async diagnostic(userId: string, input: DiagnosticInput) {
    const generated = await this.ai.generate(userId, input);
    const quiz = await this.db.client.quiz.create({
      data: {
        owner: { connect: { id: userId } },
        domain: input.domain,
        topic: input.topic,
        level: input.level,
        provider: generated.provider,
        course: {
          create: {
            ownerId: userId,
            title: `Comprendre : ${input.topic}`,
            domain: input.domain,
            content: generated.quiz.miniCourse,
            source: "AI",
          },
        },
        questions: {
          create: generated.quiz.questions.map((q, position) => ({
            position,
            text: q.text,
            concept: q.concept,
            explanation: q.explanation,
            type: q.type,
            options: {
              create: q.options.map((o, position) => ({ position, ...o })),
            },
          })),
        },
      },
      select: { id: true },
    });
    return this.quiz(userId, quiz.id);
  }
  async quiz(userId: string, id: string) {
    const quiz = await this.db.client.quiz.findFirst({
      where: { id, ownerId: userId },
      select: {
        id: true,
        domain: true,
        topic: true,
        level: true,
        provider: true,
        createdAt: true,
        questions: publicQuestions,
      },
    });
    if (!quiz) throw notFound();
    return quiz;
  }
  async createAttempt(userId: string, quizId: string) {
    await this.quiz(userId, quizId);
    return this.db.client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Quiz" WHERE id = ${quizId} FOR UPDATE`;
      const pending = await tx.quizAttempt.findFirst({
        where: { quizId, userId, submittedAt: null },
        select: { id: true },
      });
      return (
        pending ??
        tx.quizAttempt.create({
          data: { quizId, userId },
          select: { id: true },
        })
      );
    });
  }
  async saveAnswer(
    userId: string,
    attemptId: string,
    questionId: string,
    selectedOptionIds: string[],
  ) {
    return this.db.client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "QuizAttempt" WHERE id = ${attemptId} FOR UPDATE`;
      const attempt = await tx.quizAttempt.findFirst({
        where: { id: attemptId, userId },
      });
      if (!attempt) throw notFound();
      if (attempt.submittedAt)
        throw new ApiError(
          409,
          "ATTEMPT_SUBMITTED",
          "Ce test est déjà corrigé.",
        );
      const question = await tx.question.findFirst({
        where: { id: questionId, quizId: attempt.quizId },
        include: { options: { select: { id: true } } },
      });
      if (!question) throw notFound();
      if (
        selectedOptionIds.some(
          (id) => !question.options.some((o) => o.id === id),
        ) ||
        (question.type === "SINGLE" && selectedOptionIds.length > 1)
      )
        throw new ApiError(
          400,
          "INVALID_OPTIONS",
          "Choisissez uniquement les options proposées pour cette question.",
        );
      if (selectedOptionIds.length === 0) {
        await tx.answer.deleteMany({ where: { attemptId, questionId } });
        return { saved: false };
      }
      await tx.answer.upsert({
        where: { attemptId_questionId: { attemptId, questionId } },
        create: { attemptId, questionId, selectedOptionIds },
        update: { selectedOptionIds },
      });
      return { saved: true };
    });
  }
  async submit(userId: string, id: string) {
    await this.db.client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "QuizAttempt" WHERE id = ${id} FOR UPDATE`;
      const attempt = await tx.quizAttempt.findFirst({
        where: { id, userId },
        include: { quiz: { include: fullQuiz }, answers: true },
      });
      if (!attempt) throw notFound();
      if (attempt.submittedAt) return;
      if (attempt.answers.length !== 5 || attempt.quiz.questions.length !== 5)
        throw new ApiError(
          409,
          "ANSWERS_INCOMPLETE",
          "Répondez aux cinq questions avant de soumettre le test.",
        );
      const result = grade(attempt.quiz.questions, attempt.answers);
      await tx.quizAttempt.update({
        where: { id },
        data: { submittedAt: new Date(), score: result.score },
      });
    });
    return this.attempt(userId, id);
  }
  async attempt(userId: string, id: string) {
    const attempt = await this.db.client.quizAttempt.findFirst({
      where: { id, userId },
      include: { quiz: { include: fullQuiz }, answers: true },
    });
    if (!attempt) throw notFound();
    const quiz = await this.quiz(userId, attempt.quizId);
    return {
      id: attempt.id,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      score: attempt.score,
      quiz,
      answers: attempt.answers.map((a) => ({
        questionId: a.questionId,
        selectedOptionIds: a.selectedOptionIds,
      })),
      result: attempt.submittedAt
        ? {
            ...grade(attempt.quiz.questions, attempt.answers),
            miniCourse: attempt.quiz.course.content,
            questions: attempt.quiz.questions
              .sort((a, b) => a.position - b.position)
              .map((q) => ({
                id: q.id,
                text: q.text,
                concept: q.concept,
                explanation: q.explanation,
                correctOptionIds: q.options
                  .filter((o) => o.correct)
                  .map((o) => o.id),
              })),
          }
        : null,
    };
  }
  async history(userId: string, page: number, pageSize: number) {
    const where = { userId };
    const [items, total] = await this.db.client.$transaction([
      this.db.client.quizAttempt.findMany({
        where,
        orderBy: [{ startedAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          startedAt: true,
          submittedAt: true,
          score: true,
          quiz: {
            select: { topic: true, domain: true, level: true, provider: true },
          },
        },
      }),
      this.db.client.quizAttempt.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }
  async summary(userId: string) {
    const completed = await this.db.client.quizAttempt.findMany({
      where: { userId, submittedAt: { not: null } },
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
      take: 10,
      include: {
        quiz: { include: { questions: { include: { options: true } } } },
        answers: true,
      },
    });
    const count = await this.db.client.quizAttempt.count({
      where: { userId, submittedAt: { not: null } },
    });
    return {
      completed: count,
      lastScore: completed[0]?.score ?? null,
      average: completed.length
        ? Math.round(
            completed.reduce((sum, a) => sum + (a.score ?? 0), 0) /
              completed.length,
          )
        : null,
      weak: completed[0]
        ? grade(completed[0].quiz.questions, completed[0].answers).weak
        : [],
      recent: (await this.history(userId, 1, 3)).items,
    };
  }
  async courses(userId: string, page: number, pageSize: number) {
    const where: Prisma.CourseWhereInput = {
      OR: [
        { ownerId: userId, source: "USER" },
        { ownerId: null, source: "ADMIN" },
        {
          ownerId: userId,
          source: "AI",
          quizzes: {
            some: {
              attempts: { some: { userId, submittedAt: { not: null } } },
            },
          },
        },
      ],
    };
    const [items, total] = await this.db.client.$transaction([
      this.db.client.course.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          title: true,
          domain: true,
          content: true,
          source: true,
          createdAt: true,
        },
      }),
      this.db.client.course.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }
  createCourse(
    userId: string,
    data: { title: string; domain: string; content: string },
  ) {
    return this.db.client.course.create({
      data: { ...data, ownerId: userId, source: "USER" },
      select: {
        id: true,
        title: true,
        domain: true,
        content: true,
        source: true,
        createdAt: true,
      },
    });
  }
}
