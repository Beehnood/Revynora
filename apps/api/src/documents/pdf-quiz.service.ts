import { Inject, Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { GetLearningAccess } from "../learning-access/application/learning-access";
import { loadEnvironment } from "../shared/config/environment";
import { ApiError } from "../shared/http/errors";
import { DocumentAi } from "./document-ai";
import { pagesSchema, validateAnalysis } from "./document.schema";

@Injectable()
export class PdfQuizService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(DocumentAi) private readonly ai: DocumentAi,
    @Inject(GetLearningAccess) private readonly access: GetLearningAccess,
  ) {}
  async history(userId: string, documentId: string) {
    const doc = await this.db.client.pdfDocument.findFirst({
      where: { id: documentId, userId, status: { not: "DELETED" } },
      select: { id: true },
    });
    if (!doc) throw new ApiError(404, "NOT_FOUND", "Document introuvable.");
    const items = await this.db.client.quizAttempt.findMany({
      where: { userId, quiz: { documentId } },
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      take: 20,
      select: {
        id: true,
        startedAt: true,
        submittedAt: true,
        score: true,
        mode: true,
      },
    });
    return { items };
  }
  async generate(userId: string, documentId: string) {
    if (!(await this.access.execute(userId)).allowed)
      throw new ApiError(
        403,
        "LEARNING_ACCESS_REQUIRED",
        "Accès pédagogique requis.",
      );
    const env = loadEnvironment();
    const now = new Date();
    const day = new Date(now);
    day.setUTCHours(0, 0, 0, 0);
    const reservation = await this.db.client.$transaction(async (tx) => {
      // Same lock order as PDF deletion and the existing AI quota ledger.
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
      const doc = await tx.pdfDocument.findFirst({
        where: { id: documentId, userId, status: { not: "DELETED" } },
      });
      if (!doc) throw new ApiError(404, "NOT_FOUND", "Document introuvable.");
      if (doc.status !== "COMPLETED" || !doc.analysis || !doc.pages)
        throw new ApiError(
          409,
          "PDF_ANALYSIS_REQUIRED",
          "Analyse d’abord ce document.",
        );
      const cached = await tx.quiz.findUnique({
        where: { documentId },
        select: { id: true },
      });
      if (cached) return { kind: "cached" as const, id: cached.id };
      if (!this.ai.available())
        throw new ApiError(
          503,
          "PDF_AI_UNAVAILABLE",
          "Aucun fournisseur IA réel n’est disponible.",
        );
      const activeAfter = new Date(now.getTime() - 300000);
      if (
        await tx.aIUsage.count({
          where: {
            userId,
            status: "PENDING",
            documentId: { not: null },
            createdAt: { gt: activeAfter },
          },
        })
      )
        throw new ApiError(
          409,
          "PDF_QUIZ_PROCESSING",
          "Un quiz PDF est déjà en cours de génération.",
        );
      if ((await tx.aIUsage.count({ where: { documentId } })) >= 3)
        throw new ApiError(
          429,
          "PDF_QUIZ_RETRY_LIMIT",
          "Trois générations ont été tentées pour ce document.",
        );
      if (
        (await tx.aIUsage.count({
          where: { userId, createdAt: { gte: day } },
        })) >= env.AI_DAILY_LIMIT
      )
        throw new ApiError(
          429,
          "AI_QUOTA",
          "La limite quotidienne de génération est atteinte.",
        );
      await tx.aIUsage.updateMany({
        where: {
          userId,
          documentId: { not: null },
          status: "PENDING",
          createdAt: { lte: activeAfter },
        },
        data: { status: "ERROR", errorCode: "PDF_QUIZ_EXPIRED" },
      });
      const usage = await tx.aIUsage.create({
        data: {
          userId,
          documentId,
          provider: env.AI_PROVIDER,
          model:
            env.AI_PROVIDER === "gemini" ? env.GEMINI_MODEL : env.OPENAI_MODEL,
          attempts: 1,
        },
      });
      return { kind: "reserved" as const, doc, usage };
    });
    if (reservation.kind === "cached") return { id: reservation.id };
    const { doc, usage } = reservation;
    try {
      const pages = pagesSchema.parse(doc.pages);
      const analysis = validateAnalysis(doc.analysis, pages);
      const generated = await this.ai.diagnostic(pages, analysis);
      return await this.db.client.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
        const current = await tx.pdfDocument.findFirst({
          where: { id: documentId, userId, status: "COMPLETED" },
        });
        const lease = await tx.aIUsage.findFirst({
          where: { id: usage.id, status: "PENDING", documentId },
        });
        if (!current || !lease)
          throw new ApiError(
            409,
            "PDF_QUIZ_CANCELLED",
            "Document supprimé ou génération expirée.",
          );
        const quiz = await tx.quiz.create({
          data: {
            owner: { connect: { id: userId } },
            document: { connect: { id: documentId } },
            domain: "Document PDF",
            topic: analysis.title,
            level: "Diagnostic PDF",
            provider: usage.provider,
            course: {
              create: {
                ownerId: userId,
                title: analysis.title,
                domain: "Document PDF",
                source: "AI" as const,
                content: analysis.chapters.map((c) => c.summary).join("\n\n"),
              },
            },
            questions: {
              create: generated.questions.map((q, position) => ({
                position,
                text: q.text,
                concept: q.concept,
                explanation: q.explanation,
                type: q.type,
                chapter: analysis.chapters[q.chapterIndex].title,
                sourcePage: q.reference.page,
                sourceQuote: q.reference.quote,
                options: {
                  create: q.options.map((o, position) => ({ ...o, position })),
                },
              })),
            },
          },
          select: { id: true },
        });
        await tx.aIUsage.update({
          where: { id: usage.id },
          data: { status: "SUCCESS" },
        });
        return quiz;
      });
    } catch (error) {
      await this.db.client.aIUsage.updateMany({
        where: { id: usage.id, status: "PENDING" },
        data: { status: "ERROR", errorCode: "PDF_QUIZ_FAILED" },
      });
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        503,
        "PDF_QUIZ_FAILED",
        "Le quiz n’a pas abouti. Aucun contenu simulé n’est proposé.",
      );
    }
  }
}
