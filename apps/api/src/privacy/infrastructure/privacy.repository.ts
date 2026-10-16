import type { PrismaClient } from "@prisma/client";
import type { BillingProvider } from "../../billing/domain/billing";
import { verifyPassword } from "../../auth/password";
import { DomainError } from "../../shared/domain/errors";
import type { PrivacyRepository } from "../domain/privacy";
export class PrismaPrivacyRepository implements PrivacyRepository {
  constructor(
    private readonly db: PrismaClient,
    private readonly provider: BillingProvider,
  ) {}
  async export(id: string) {
    const user = await this.db.user.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        timeZone: true,
        remindersEnabled: true,
        reminderConsentAt: true,
        termsAcceptedAt: true,
        courses: {
          where: {
            OR: [
              { source: "USER" },
              {
                source: "AI",
                quizzes: {
                  some: {
                    attempts: {
                      some: { userId: id, submittedAt: { not: null } },
                    },
                  },
                },
              },
            ],
          },
        },
        attempts: { include: { answers: true } },
        quizzes: {
          include: {
            questions: {
              select: {
                id: true,
                position: true,
                text: true,
                type: true,
                options: { select: { id: true, text: true, position: true } },
              },
            },
          },
        },
        subscriptionPeriods: { include: { subscription: true } },
        payments: true,
        paymentEvents: true,
        leitnerCards: true,
        revisions: true,
        studyPlans: { include: { items: true } },
        emails: true,
        aiUsage: true,
      },
    });
    return { exportedAt: new Date(), format: "Revynora export v1", user };
  }
  async remove(id: string, password: string) {
    const user = await this.db.user.findUniqueOrThrow({ where: { id } });
    if (!(await verifyPassword(password, user.passwordHash)))
      throw new DomainError(401, "AUTH_INVALID", "Mot de passe incorrect.");
    if (user.role === "ADMIN")
      throw new DomainError(
        409,
        "ADMIN_PROTECTED",
        "Transférez vos droits administrateur avant la suppression.",
      );
    if (user.stripeCustomerId)
      await this.provider.removeCustomer(user.stripeCustomerId);
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${id} FOR UPDATE`;
      const plans = await tx.studyPlan.findMany({
        where: { userId: id },
        select: { items: { select: { id: true } } },
      });
      const itemIds = plans.flatMap((p) => p.items.map((i) => i.id));
      await tx.reminderDelivery.deleteMany({
        where: { itemId: { in: itemIds } },
      });
      await tx.quiz.deleteMany({ where: { ownerId: id } });
      await tx.auditLog.updateMany({
        where: { targetUserId: id },
        data: { targetUserId: null, entityId: null },
      });
      await tx.user.delete({ where: { id } });
      return { ok: true };
    });
  }
}
