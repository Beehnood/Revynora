
ALTER TABLE "StudyPlan" ADD COLUMN "generationKey" TEXT, ADD COLUMN "generationHash" TEXT;
CREATE UNIQUE INDEX "StudyPlan_generationKey_key" ON "StudyPlan" ("generationKey");
