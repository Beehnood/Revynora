import type { PrismaClient } from "@prisma/client";
import type { LearningAccessRepository } from "../domain/access";
export class PrismaLearningAccessRepository
  implements LearningAccessRepository
{
  constructor(private readonly db: PrismaClient) {}
  account(userId: string, now: Date) {
    return this.db.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        disabledAt: true,
        grants: {
          where: {
            level: "PRO",
            revokedAt: null,
            startsAt: { lte: now },
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            startsAt: true,
            expiresAt: true,
            revokedAt: true,
          },
        },
      },
    });
  }
}
