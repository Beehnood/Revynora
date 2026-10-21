-- Prepared for review. Apply only to an explicitly authorized database.
CREATE TABLE "InternalLearningGrant" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "level" "Plan" NOT NULL DEFAULT 'PRO',
  "startsAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "provenance" TEXT NOT NULL,
  "justification" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "issuedById" TEXT NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "revokedById" TEXT,
  "revocationReason" TEXT,
  CONSTRAINT "InternalLearningGrant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InternalLearningGrant_level" CHECK ("level" = 'PRO'),
  CONSTRAINT "InternalLearningGrant_dates" CHECK ("expiresAt" IS NULL OR "expiresAt" > "startsAt"),
  CONSTRAINT "InternalLearningGrant_reason" CHECK (length(btrim("justification")) BETWEEN 10 AND 500 AND length(btrim("provenance")) BETWEEN 3 AND 100),
  CONSTRAINT "InternalLearningGrant_revocation" CHECK (("revokedAt" IS NULL AND "revokedById" IS NULL AND "revocationReason" IS NULL) OR ("revokedAt" IS NOT NULL AND "revokedById" IS NOT NULL AND length(btrim("revocationReason")) BETWEEN 10 AND 500))
);
CREATE INDEX "InternalLearningGrant_userId_revokedAt_startsAt_idx" ON "InternalLearningGrant"("userId", "revokedAt", "startsAt");
ALTER TABLE "InternalLearningGrant" ADD CONSTRAINT "InternalLearningGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InternalLearningGrant" ADD CONSTRAINT "InternalLearningGrant_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InternalLearningGrant" ADD CONSTRAINT "InternalLearningGrant_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
