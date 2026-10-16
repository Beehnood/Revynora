import type { PrismaClient } from "@prisma/client";
import type { PreferenceRepository } from "../domain/notifications";
export class NotificationRepository implements PreferenceRepository {
  constructor(private readonly db: PrismaClient) {}
  preferences(id: string) {
    return this.db.user.findUniqueOrThrow({
      where: { id },
      select: {
        remindersEnabled: true,
        timeZone: true,
        reminderConsentAt: true,
      },
    });
  }
  update(id: string, enabled: boolean, timeZone: string) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${id} FOR UPDATE`;
      return tx.user.update({
        where: { id },
        data: {
          remindersEnabled: enabled,
          timeZone,
          reminderConsentAt: enabled ? new Date() : null,
        },
        select: {
          remindersEnabled: true,
          timeZone: true,
          reminderConsentAt: true,
        },
      });
    });
  }
  async inbox(userId: string) {
    return {
      mode: process.env.MAIL_PROVIDER ?? "local",
      items: await this.db.emailMessage.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          kind: true,
          subject: true,
          body: true,
          status: true,
          provider: true,
          createdAt: true,
          sentAt: true,
        },
      }),
    };
  }
}
