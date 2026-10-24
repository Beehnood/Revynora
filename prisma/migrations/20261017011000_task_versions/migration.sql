-- CreateTable
CREATE TABLE "StudyPlanItemVersion" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "TaskStatus" NOT NULL,
    "reminderMinutes" INTEGER,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyPlanItemVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudyPlanItemVersion_itemId_version_key" ON "StudyPlanItemVersion"("itemId", "version");

-- AddForeignKey
ALTER TABLE "StudyPlanItemVersion" ADD CONSTRAINT "StudyPlanItemVersion_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "StudyPlanItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing tasks get their actual current version; do not invent lost past states.
INSERT INTO "StudyPlanItemVersion" (id,"itemId",version,title,"startsAt","endsAt",status,"reminderMinutes","recordedAt")
SELECT 'snapshot-'||id,id,version,title,"startsAt","endsAt",status,"reminderMinutes",CURRENT_TIMESTAMP FROM "StudyPlanItem";
CREATE FUNCTION protect_task_version() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'Task version snapshots are immutable'; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER task_version_immutable BEFORE UPDATE ON "StudyPlanItemVersion" FOR EACH ROW EXECUTE FUNCTION protect_task_version();
