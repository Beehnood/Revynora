import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  AdminPage,
  AdminPayment,
  AdminSubscriptionPeriod,
} from "@revynora/types";
import {
  paymentQuery,
  subscriptionQuery,
  providerKind,
  type PaymentQuery,
  type SubscriptionQuery,
} from "../domain/finance";
const options = {
  isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
  maxWait: 3000,
  timeout: 12000,
};
function providerWhere(provider: string) {
  return provider === "ALL"
    ? {}
    : {
        provider:
          provider === "other"
            ? { notIn: ["mock", "stripe", "internal"] }
            : provider,
      };
}
export async function readPayments(
  db: PrismaClient,
  input: PaymentQuery,
): Promise<AdminPage<AdminPayment>> {
  const q = paymentQuery.parse(input);
  const where: Prisma.PaymentWhereInput = {
    ...providerWhere(q.provider),
    ...(q.status === "ALL" ? {} : { status: q.status }),
  };
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('statement_timeout','5000',true)`;
    const rows = await tx.payment.findMany({
      where,
      select: {
        id: true,
        provider: true,
        amountCents: true,
        currency: true,
        status: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
      skip: (q.page - 1) * 20,
    });
    return {
      items: rows.map((row) => ({
        ...row,
        provider: providerKind(row.provider),
        verification:
          row.provider === "mock"
            ? ("SIMULATION" as const)
            : ("UNVERIFIED" as const),
        createdAt: row.createdAt.toISOString(),
      })),
      total: await tx.payment.count({ where }),
      page: q.page,
      pageSize: 20,
    };
  }, options);
}
export async function readSubscriptions(
  db: PrismaClient,
  input: SubscriptionQuery,
): Promise<AdminPage<AdminSubscriptionPeriod>> {
  const q = subscriptionQuery.parse(input);
  const where: Prisma.UserSubscriptionHistoryWhereInput = {
    ...providerWhere(q.provider),
    ...(q.status === "ALL" ? {} : { status: q.status }),
    ...(q.plan === "ALL" ? {} : { subscription: { code: q.plan } }),
  };
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('statement_timeout','5000',true)`;
    const rows = await tx.userSubscriptionHistory.findMany({
      where,
      select: {
        id: true,
        provider: true,
        status: true,
        priceCents: true,
        currency: true,
        startsAt: true,
        endsAt: true,
        cancelAtPeriodEnd: true,
        subscription: { select: { code: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
      skip: (q.page - 1) * 20,
    });
    return {
      items: rows.map(({ subscription, ...row }) => ({
        ...row,
        plan: subscription.code,
        provider: providerKind(row.provider),
        startsAt: row.startsAt.toISOString(),
        endsAt: row.endsAt.toISOString(),
      })),
      total: await tx.userSubscriptionHistory.count({ where }),
      page: q.page,
      pageSize: 20,
    };
  }, options);
}
