-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELLED', 'INCOMPLETE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PLANNED', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MailStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Plan" ADD VALUE 'PLUS';
ALTER TYPE "Plan" ADD VALUE 'PRO';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "disabledAt" TIMESTAMP(3),
ADD COLUMN     "reminderConsentAt" TIMESTAMP(3),
ADD COLUMN     "remindersEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "timeZone" TEXT NOT NULL DEFAULT 'Europe/Paris';

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "code" "Plan" NOT NULL,
    "name" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'eur',
    "interval" TEXT NOT NULL DEFAULT 'month',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "providerPriceId" TEXT,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSubscriptionHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerSubscriptionId" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSubscriptionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckoutIntent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "Plan" NOT NULL,
    "provider" TEXT NOT NULL,
    "providerSessionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckoutIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingState" (
    "providerSubscriptionId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "lastEventCreated" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingState_pkey" PRIMARY KEY ("providerSubscriptionId")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "providerReference" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "receiptUrl" TEXT,
    "periodId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPaymentHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "paymentId" TEXT,
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "amountCents" INTEGER,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPaymentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeitnerCard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT,
    "front" TEXT NOT NULL,
    "back" TEXT NOT NULL,
    "box" INTEGER NOT NULL DEFAULT 1,
    "dueAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeitnerCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Revision" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "courseId" TEXT,
    "requestId" TEXT NOT NULL,
    "remembered" BOOLEAN NOT NULL,
    "fromBox" INTEGER NOT NULL,
    "toBox" INTEGER NOT NULL,
    "nextDueAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyPlanItem" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PLANNED',
    "reminderMinutes" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'local',
    "status" "MailStatus" NOT NULL DEFAULT 'QUEUED',
    "idempotencyKey" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "targetUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockBillingRecord" (
    "id" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MockBillingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderDelivery" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "ReminderDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_code_key" ON "Subscription"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_providerPriceId_key" ON "Subscription"("providerPriceId");

-- CreateIndex
CREATE INDEX "UserSubscriptionHistory_userId_startsAt_endsAt_idx" ON "UserSubscriptionHistory"("userId", "startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserSubscriptionHistory_providerSubscriptionId_startsAt_sub_key" ON "UserSubscriptionHistory"("providerSubscriptionId", "startsAt", "subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutIntent_providerSessionId_key" ON "CheckoutIntent"("providerSessionId");

-- CreateIndex
CREATE INDEX "CheckoutIntent_userId_createdAt_idx" ON "CheckoutIntent"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerReference_key" ON "Payment"("providerReference");

-- CreateIndex
CREATE INDEX "Payment_userId_createdAt_idx" ON "Payment"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserPaymentHistory_providerEventId_key" ON "UserPaymentHistory"("providerEventId");

-- CreateIndex
CREATE INDEX "UserPaymentHistory_userId_createdAt_idx" ON "UserPaymentHistory"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LeitnerCard_userId_dueAt_idx" ON "LeitnerCard"("userId", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "Revision_requestId_key" ON "Revision"("requestId");

-- CreateIndex
CREATE INDEX "Revision_userId_createdAt_idx" ON "Revision"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "StudyPlan_userId_createdAt_idx" ON "StudyPlan"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "StudyPlanItem_startsAt_idx" ON "StudyPlanItem"("startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailMessage_idempotencyKey_key" ON "EmailMessage"("idempotencyKey");

-- CreateIndex
CREATE INDEX "EmailMessage_userId_createdAt_idx" ON "EmailMessage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderDelivery_itemId_version_key" ON "ReminderDelivery"("itemId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- AddForeignKey
ALTER TABLE "UserSubscriptionHistory" ADD CONSTRAINT "UserSubscriptionHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSubscriptionHistory" ADD CONSTRAINT "UserSubscriptionHistory_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutIntent" ADD CONSTRAINT "CheckoutIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPaymentHistory" ADD CONSTRAINT "UserPaymentHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPaymentHistory" ADD CONSTRAINT "UserPaymentHistory_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeitnerCard" ADD CONSTRAINT "LeitnerCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeitnerCard" ADD CONSTRAINT "LeitnerCard_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Revision" ADD CONSTRAINT "Revision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Revision" ADD CONSTRAINT "Revision_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "LeitnerCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Revision" ADD CONSTRAINT "Revision_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyPlan" ADD CONSTRAINT "StudyPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyPlanItem" ADD CONSTRAINT "StudyPlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "StudyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Domain invariants also apply to concurrent writes and operational tooling.
ALTER TABLE "Subscription" ADD CONSTRAINT "catalog_nonnegative" CHECK ("priceCents" >= 0);
ALTER TABLE "UserSubscriptionHistory" ADD CONSTRAINT "period_valid" CHECK ("endsAt" > "startsAt" AND "priceCents" >= 0);
ALTER TABLE "LeitnerCard" ADD CONSTRAINT "leitner_box" CHECK (box BETWEEN 1 AND 5);
ALTER TABLE "StudyPlanItem" ADD CONSTRAINT "slot_valid" CHECK ("endsAt" > "startsAt");
ALTER TABLE "Payment" ADD CONSTRAINT "payment_nonnegative" CHECK ("amountCents" >= 0);
-- Financial event facts cannot be rewritten. Nulling ownership is allowed for erasure.
CREATE FUNCTION protect_payment_history() RETURNS trigger AS $$
BEGIN
 IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Financial events are append-only'; END IF;
 IF NEW."providerEventId" IS DISTINCT FROM OLD."providerEventId" OR NEW."eventType" IS DISTINCT FROM OLD."eventType" OR NEW."amountCents" IS DISTINCT FROM OLD."amountCents" OR NEW.status IS DISTINCT FROM OLD.status OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" OR NEW.id IS DISTINCT FROM OLD.id OR (NEW."userId" IS DISTINCT FROM OLD."userId" AND NEW."userId" IS NOT NULL) OR (NEW."paymentId" IS DISTINCT FROM OLD."paymentId" AND NEW."paymentId" IS NOT NULL) THEN RAISE EXCEPTION 'Financial events are append-only'; END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER payment_history_append_only BEFORE UPDATE OR DELETE ON "UserPaymentHistory" FOR EACH ROW EXECUTE FUNCTION protect_payment_history();
