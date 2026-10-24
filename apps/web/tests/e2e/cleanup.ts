import { PrismaClient } from "@prisma/client";
export default async function cleanup() {
  const url =
    process.env.TEST_DATABASE_URL ??
    "postgresql://revynora:local_dev_only@localhost:5433/revynora_test?schema=public";
  if (new URL(url).pathname !== "/revynora_test")
    throw new Error("Refus de nettoyage hors revynora_test");
  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    const where = {
      OR: [
        { email: { startsWith: "e2e-phase1-", endsWith: "@example.test" } },
        { email: { startsWith: "e2e-phase2-", endsWith: "@example.test" } },
        { email: { startsWith: "e2e-phase3-", endsWith: "@example.test" } },
      ],
    };
    const users = await db.user.findMany({ where, select: { id: true } });
    const ids = users.map((u) => u.id);
    const items = await db.studyPlanItem.findMany({
      where: { plan: { userId: { in: ids } } },
      select: { id: true },
    });
    await db.reminderDelivery.deleteMany({
      where: { itemId: { in: items.map((i) => i.id) } },
    });
    for (const id of ids)
      await db.mockBillingRecord.deleteMany({
        where: { snapshot: { path: ["userId"], equals: id } },
      });
    await db.quiz.deleteMany({
      where: { ownerId: { in: users.map((u) => u.id) } },
    });
    await db.user.deleteMany({ where });
  } finally {
    await db.$disconnect();
  }
}
