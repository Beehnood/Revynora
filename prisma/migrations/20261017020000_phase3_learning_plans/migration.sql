-- AlterTable
ALTER TABLE "Revision" ADD COLUMN     "durationSeconds" INTEGER;

-- AlterTable
ALTER TABLE "StudyPlanItem" ADD COLUMN     "courseId" TEXT,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'REVISION',
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 2;

-- AlterTable
ALTER TABLE "StudyPlanItemVersion" ADD COLUMN     "courseId" TEXT,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'REVISION',
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 2;

-- CreateTable
CREATE TABLE "StudyAvailability" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudyAvailability_userId_startsAt_idx" ON "StudyAvailability"("userId", "startsAt");

-- AddForeignKey
ALTER TABLE "StudyPlanItem" ADD CONSTRAINT "StudyPlanItem_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyAvailability" ADD CONSTRAINT "StudyAvailability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "StudyPlanItem" ADD CONSTRAINT "task_kind_check" CHECK (kind IN ('REVISION','EXAM'));
ALTER TABLE "StudyPlanItem" ADD CONSTRAINT "task_priority_check" CHECK (priority BETWEEN 1 AND 3);
ALTER TABLE "StudyAvailability" ADD CONSTRAINT "availability_range_check" CHECK ("endsAt" > "startsAt");
ALTER TABLE "Revision" ADD CONSTRAINT "revision_duration_check" CHECK ("durationSeconds" BETWEEN 0 AND 3600);
CREATE INDEX "StudyPlanItem_planId_startsAt_idx" ON "StudyPlanItem" ("planId", "startsAt");
