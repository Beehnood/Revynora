-- Additive only: no changes to historical courses, contracts, grants or prices.
CREATE TABLE "PdfDocument" (
 "id" TEXT NOT NULL,
 "userId" TEXT NOT NULL,
 "filename" TEXT NOT NULL,
 "contentHash" TEXT,
 "pageCount" INTEGER NOT NULL,
 "pages" JSONB,
 "analysis" JSONB,
 "status" TEXT NOT NULL DEFAULT 'UPLOADED',
 "errorCode" TEXT,
 "chargedAt" TIMESTAMP(3),
 "attempts" INTEGER NOT NULL DEFAULT 0,
 "leaseToken" TEXT,
 "startedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "PdfDocument_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "PdfDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "PdfDocument_status_check" CHECK ("status" IN ('UPLOADED','PROCESSING','COMPLETED','FAILED','DELETED')),
 CONSTRAINT "PdfDocument_limits_check" CHECK ("pageCount" BETWEEN 1 AND 25 AND "attempts" BETWEEN 0 AND 3)
);
CREATE UNIQUE INDEX "PdfDocument_userId_contentHash_key" ON "PdfDocument"("userId", "contentHash");
CREATE INDEX "PdfDocument_userId_createdAt_idx" ON "PdfDocument"("userId", "createdAt");
CREATE INDEX "PdfDocument_userId_chargedAt_idx" ON "PdfDocument"("userId", "chargedAt");

-- Content-free attempt ledger bounds failed retries without charging FREE quota.
CREATE TABLE "PdfAnalysisRequest" (
 "id" TEXT NOT NULL,
 "documentId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "PdfAnalysisRequest_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "PdfAnalysisRequest_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "PdfDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "PdfAnalysisRequest_documentId_createdAt_idx" ON "PdfAnalysisRequest"("documentId", "createdAt");
