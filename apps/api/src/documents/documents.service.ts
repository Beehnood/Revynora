import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { DatabaseService } from "../database/database.service";
import { GetLearningAccess } from "../learning-access/application/learning-access";
import { ApiError } from "../shared/http/errors";
import { PdfExtractor } from "./pdf-extractor";
import { DocumentAi } from "./document-ai";
import { pagesSchema, weekStart } from "./document.schema";
const publicFields = {
  quiz: { select: { id: true } },
  id: true,
  filename: true,
  pageCount: true,
  status: true,
  errorCode: true,
  analysis: true,
  attempts: true,
  createdAt: true,
  startedAt: true,
} as const;
function publicDocument<T extends { status: string; startedAt: Date | null }>(
  document: T,
) {
  return {
    ...document,
    canResume:
      document.status === "PROCESSING" &&
      !!document.startedAt &&
      document.startedAt.getTime() <= Date.now() - 300000,
  };
}
@Injectable()
export class DocumentsService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(GetLearningAccess) private readonly access: GetLearningAccess,
    @Inject(PdfExtractor) private readonly extractor: PdfExtractor,
    @Inject(DocumentAi) private readonly ai: DocumentAi,
  ) {}
  async configuration(userId: string) {
    const rights = await this.access.execute(userId);
    const start = weekStart();
    const used = await this.db.client.pdfDocument.count({
      where: { userId, chargedAt: { gte: start } },
    });
    return {
      available: this.ai.available(),
      weeklyLimit: rights.effectivePlan === "FREE" ? 3 : null,
      used,
      resetAt: new Date(start.getTime() + 7 * 86400000).toISOString(),
      maxBytes: 3 * 1024 * 1024,
      maxPages: 25,
    };
  }
  async list(userId: string, page: number) {
    const where = { userId, status: { not: "DELETED" } };
    const [items, total] = await this.db.client.$transaction([
      this.db.client.pdfDocument.findMany({
        where,
        select: publicFields,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * 10,
        take: 10,
      }),
      this.db.client.pdfDocument.count({ where }),
    ]);
    return { items: items.map(publicDocument), total, page, pageSize: 10 };
  }
  async get(userId: string, id: string) {
    const item = await this.db.client.pdfDocument.findFirst({
      where: { id, userId, status: { not: "DELETED" } },
      select: publicFields,
    });
    if (!item) throw new ApiError(404, "NOT_FOUND", "Document introuvable.");
    return publicDocument(item);
  }
  async upload(
    userId: string,
    file?: { buffer: Buffer; originalname: string; mimetype: string },
  ) {
    if (
      !file ||
      file.mimetype !== "application/pdf" ||
      !/\.pdf$/i.test(file.originalname)
    )
      throw new ApiError(422, "PDF_FORMAT", "Sélectionnez un fichier PDF.");
    const hash = createHash("sha256").update(file.buffer).digest("hex");
    const existing = await this.db.client.pdfDocument.findUnique({
      where: { userId_contentHash: { userId, contentHash: hash } },
      select: publicFields,
    });
    if (existing) return publicDocument(existing);
    const pages = await this.extractor.extract(file.buffer);
    const filename =
      file.originalname
        .split(/[\\/]/)
        .pop()!
        .replace(/[\x00-\x1f\x7f]/g, "")
        .slice(0, 160) || "Cours.pdf";
    return this.db.client
      .$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
        const duplicate = await tx.pdfDocument.findUnique({
          where: { userId_contentHash: { userId, contentHash: hash } },
          select: publicFields,
        });
        if (duplicate) return duplicate;
        if (
          (await tx.pdfDocument.count({
            where: { userId, status: { not: "DELETED" } },
          })) >= 50
        )
          throw new ApiError(
            429,
            "PDF_STORAGE_LIMIT",
            "Vous conservez déjà 50 documents. Supprimez-en un avant un nouvel import.",
          );
        return tx.pdfDocument.create({
          data: {
            userId,
            filename,
            contentHash: hash,
            pageCount: pages.length,
            pages,
          },
          select: publicFields,
        });
      })
      .then(publicDocument);
  }
  async analyze(userId: string, id: string) {
    await this.get(userId, id);
    const completed = await this.db.client.pdfDocument.findFirst({
      where: { id, userId, status: "COMPLETED" },
      select: publicFields,
    });
    if (completed) return publicDocument(completed);
    if (!this.ai.available())
      throw new ApiError(
        503,
        "PDF_AI_UNAVAILABLE",
        "Le fournisseur IA réel n’est pas configuré. Vos documents restent consultables.",
      );
    const rights = await this.access.execute(userId);
    if (!rights.allowed)
      throw new ApiError(
        403,
        "LEARNING_ACCESS_REQUIRED",
        "Accès pédagogique requis.",
      );
    const now = new Date();
    const token = randomUUID();
    const reserved = await this.db.client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
      const doc = await tx.pdfDocument.findFirst({
        where: { id, userId, status: { not: "DELETED" } },
      });
      if (!doc) throw new ApiError(404, "NOT_FOUND", "Document introuvable.");
      if (doc.status === "COMPLETED") return doc;
      if (
        await tx.pdfDocument.count({
          where: {
            userId,
            status: "PROCESSING",
            startedAt: { gt: new Date(now.getTime() - 300000) },
          },
        })
      )
        throw new ApiError(
          409,
          "PDF_PROCESSING",
          "Une analyse est déjà en cours.",
        );
      if (doc.attempts >= 3)
        throw new ApiError(
          429,
          "PDF_RETRY_LIMIT",
          "Trois tentatives ont été effectuées. Contactez le support.",
        );
      if (
        rights.effectivePlan === "FREE" &&
        (await tx.pdfDocument.count({
          where: {
            userId,
            id: { not: id },
            chargedAt: { gte: weekStart(now) },
          },
        })) >= 3
      )
        throw new ApiError(
          429,
          "PDF_WEEKLY_QUOTA",
          "Vos trois nouvelles analyses de la semaine sont utilisées. Vos analyses existantes restent consultables.",
        );
      const day = new Date(now);
      day.setUTCHours(0, 0, 0, 0);
      if (
        (await tx.pdfAnalysisRequest.count({
          where: { document: { userId }, createdAt: { gte: day } },
        })) >= 20
      )
        throw new ApiError(
          429,
          "PDF_FAIR_USE",
          "Limite de sécurité de 20 tentatives par jour atteinte.",
        );
      await tx.pdfAnalysisRequest.create({ data: { documentId: id } });
      return tx.pdfDocument.update({
        where: { id },
        data: {
          status: "PROCESSING",
          startedAt: now,
          leaseToken: token,
          chargedAt: now,
          attempts: { increment: 1 },
          errorCode: null,
        },
      });
    });
    if (reserved.status === "COMPLETED") return this.get(userId, id);
    try {
      const analysis = await this.ai.analyze(pagesSchema.parse(reserved.pages));
      const saved = await this.db.client.pdfDocument.updateMany({
        where: { id, userId, status: "PROCESSING", leaseToken: token },
        data: { analysis, status: "COMPLETED", leaseToken: null },
      });
      if (saved.count !== 1)
        throw new ApiError(
          409,
          "PDF_CANCELLED",
          "Le document a été supprimé ou la tentative remplacée.",
        );
      return await this.get(userId, id);
    } catch (error) {
      await this.db.client.pdfDocument.updateMany({
        where: { id, userId, status: "PROCESSING", leaseToken: token },
        data: {
          status: "FAILED",
          errorCode: "PDF_AI_FAILED",
          leaseToken: null,
          chargedAt: null,
        },
      });
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        503,
        "PDF_AI_FAILED",
        "L’analyse a échoué. Réessayez plus tard.",
      );
    }
  }
  async remove(userId: string, id: string) {
    return this.db.client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
      const linked = await tx.quiz.findMany({
        where: { documentId: id, ownerId: userId },
        select: { courseId: true },
      });
      await tx.quiz.deleteMany({ where: { documentId: id, ownerId: userId } });
      await tx.leitnerCard.deleteMany({
        where: { courseId: { in: linked.map((q) => q.courseId) }, userId },
      });
      await tx.course.deleteMany({
        where: { id: { in: linked.map((q) => q.courseId) }, ownerId: userId },
      });
      // Content-free quota history stays counted after source deletion.
      await tx.aIUsage.updateMany({
        where: { documentId: id, userId },
        data: { documentId: null },
      });
      const changed = await tx.pdfDocument.updateMany({
        where: { id, userId, status: { not: "DELETED" } },
        data: {
          status: "DELETED",
          filename: "Document supprimé",
          contentHash: null,
          pages: Prisma.DbNull,
          analysis: Prisma.DbNull,
          errorCode: null,
          leaseToken: null,
        },
      });
      if (!changed.count)
        throw new ApiError(404, "NOT_FOUND", "Document introuvable.");
      // Retain chargedAt so deletion never refunds successful/reserved weekly quota.
      return { ok: true };
    });
  }
}
