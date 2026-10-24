import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  AdminCatalogCourse,
  AdminCatalogCourseDetail,
  AdminPage,
} from "@revynora/types";
import { missing } from "../../shared/domain/errors";
import {
  checkedCatalogQuery,
  checkedCatalogText,
  literalSearch,
  type CatalogQuery,
} from "../domain/catalog";
import { count } from "../domain/statistics";
type Row = {
  id: string;
  title: string;
  domain: string;
  createdAt: Date;
  content?: string;
};
function summary(row: Row): AdminCatalogCourse {
  checkedCatalogText(row);
  return {
    id: row.id,
    title: row.title,
    domain: row.domain,
    source: "ADMIN",
    createdAt: row.createdAt.toISOString(),
  };
}
const options = {
  isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
  maxWait: 3000,
  timeout: 12000,
};
export async function readCatalog(
  db: PrismaClient,
  input: CatalogQuery,
): Promise<AdminPage<AdminCatalogCourse>> {
  const { page, search } = checkedCatalogQuery(input);
  const pattern = literalSearch(search);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('TimeZone','UTC',true),set_config('statement_timeout','5000',true)`;
    const items = await tx.$queryRaw<Row[]>`
   SELECT id,LEFT(title,161) AS title,LEFT(domain,81) AS domain,"createdAt"
   FROM "Course" WHERE source='ADMIN' AND "ownerId" IS NULL
    AND (title ILIKE ${pattern} ESCAPE '\\' OR domain ILIKE ${pattern} ESCAPE '\\')
   ORDER BY "createdAt" DESC,id DESC LIMIT 20 OFFSET ${(page - 1) * 20}`;
    const totals = await tx.$queryRaw<{ total: bigint }[]>`
   SELECT COUNT(*) AS total FROM "Course" WHERE source='ADMIN' AND "ownerId" IS NULL
    AND (title ILIKE ${pattern} ESCAPE '\\' OR domain ILIKE ${pattern} ESCAPE '\\')`;
    return {
      items: items.map(summary),
      total: count(totals[0]!.total),
      page,
      pageSize: 20,
    };
  }, options);
}
export async function readCatalogCourse(
  db: PrismaClient,
  id: string,
): Promise<AdminCatalogCourseDetail> {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('TimeZone','UTC',true),set_config('statement_timeout','5000',true)`;
    const rows = await tx.$queryRaw<(Row & { content: string })[]>`
   SELECT id,LEFT(title,161) AS title,LEFT(domain,81) AS domain,LEFT(content,10001) AS content,"createdAt"
   FROM "Course" WHERE id=${id} AND source='ADMIN' AND "ownerId" IS NULL LIMIT 1`;
    const row = rows[0];
    if (!row) throw missing();
    return { ...summary(row), content: row.content };
  }, options);
}
