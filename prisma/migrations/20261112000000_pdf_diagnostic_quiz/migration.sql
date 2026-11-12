-- Additive PDF quiz metadata; historical quizzes and attempts stay unchanged.
BEGIN;
ALTER TABLE "Quiz" ADD COLUMN "documentId" TEXT;
CREATE UNIQUE INDEX "Quiz_documentId_key" ON "Quiz"("documentId");
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "PdfDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Question" ADD COLUMN "chapter" TEXT, ADD COLUMN "sourcePage" INTEGER, ADD COLUMN "sourceQuote" TEXT;
ALTER TABLE "Question" ADD CONSTRAINT "Question_pdf_reference_check" CHECK (("chapter" IS NULL AND "sourcePage" IS NULL AND "sourceQuote" IS NULL) OR ("chapter" IS NOT NULL AND "sourcePage" IS NOT NULL AND "sourcePage" BETWEEN 1 AND 25 AND "sourceQuote" IS NOT NULL));
ALTER TABLE "QuizAttempt" ADD COLUMN "mode" TEXT;
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_mode_check" CHECK ("mode" IS NULL OR "mode" IN ('DISCOVER','TEST'));
ALTER TABLE "AIUsage" ADD COLUMN "documentId" TEXT;
ALTER TABLE "AIUsage" ADD CONSTRAINT "AIUsage_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "PdfDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "AIUsage_documentId_createdAt_idx" ON "AIUsage"("documentId","createdAt");

COMMIT;
