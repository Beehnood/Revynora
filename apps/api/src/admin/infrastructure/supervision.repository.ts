import { Prisma, type PrismaClient } from "@prisma/client";
import type { AdminSupervision } from "@revynora/types";
import {
  checkedPeriod,
  count,
  type StatisticsPeriod,
} from "../domain/statistics";
export async function readSupervision(
  db: PrismaClient,
  input: StatisticsPeriod,
): Promise<AdminSupervision> {
  const { from, to } = checkedPeriod(input);
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT set_config('TimeZone','UTC',true),set_config('statement_timeout','5000',true)`;
      const rows = await tx.$queryRaw<
        {
          category: AdminSupervision["rows"][number]["category"];
          status: string;
          count: bigint;
        }[]
      >`
      SELECT 'REVIEWS' AS category, 'RECORDED' AS status, COUNT(*) AS count FROM "Revision"
      WHERE "createdAt">=${from} AND "createdAt"<${to}
      UNION ALL
      SELECT 'PLANS', 'CREATED', COUNT(*) FROM "StudyPlan"
      WHERE "createdAt">=${from} AND "createdAt"<${to}
      UNION ALL
      SELECT 'ITEMS', status::text, COUNT(*) FROM "StudyPlanItem"
      WHERE "createdAt">=${from} AND "createdAt"<${to} GROUP BY status
      UNION ALL
      SELECT 'REMINDERS', CASE WHEN r.status IN ('PENDING','SENT','CANCELLED') THEN r.status ELSE 'OTHER' END, COUNT(*)
      FROM "ReminderDelivery" r JOIN "StudyPlanItem" i ON i.id=r."itemId"
      WHERE r."dueAt">=${from} AND r."dueAt"<${to}
      GROUP BY 2
      ORDER BY category,status`;
      return {
        from: from.toISOString(),
        to: to.toISOString(),
        timeZone: "UTC",
        rows: rows.map((r) => ({ ...r, count: count(r.count) })),
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      maxWait: 3000,
      timeout: 12000,
    },
  );
}
