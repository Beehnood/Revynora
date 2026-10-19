import { Prisma, type PrismaClient } from "@prisma/client";
import type { AdminStatistics } from "@revynora/types";
import {
  checkedPeriod,
  count,
  paymentEnvironment,
  registrationSeries,
  type StatisticsPeriod,
} from "../domain/statistics";
import { DomainError } from "../../shared/domain/errors";
export async function readStatistics(
  db: PrismaClient,
  input: StatisticsPeriod,
): Promise<AdminStatistics> {
  const { from, to } = checkedPeriod(input);
  return db.$transaction(
    async (tx) => {
      // Date parameters may be sent as timestamptz while the persisted columns
      // are timestamp(3) without time zone with UTC wall-clock values. Pin the
      // transaction timezone so both comparisons and calendar buckets use UTC.
      await tx.$queryRaw`SELECT set_config('TimeZone', 'UTC', true), set_config('statement_timeout', '5000', true)`;
      const registrations = await tx.$queryRaw<
        { date: string; count: bigint }[]
      >`
   SELECT to_char("createdAt", 'YYYY-MM-DD') AS date, COUNT(*) AS count
   FROM "User" WHERE "createdAt">=${from} AND "createdAt"<${to}
   GROUP BY date ORDER BY date`;
      const subscriptions = await tx.$queryRaw<
        { offer: "FREE" | "PLUS" | "PRO"; status: string; periods: bigint }[]
      >`
   SELECT s.code::text AS offer, h.status::text AS status, COUNT(*) AS periods
   FROM "UserSubscriptionHistory" h JOIN "Subscription" s ON s.id=h."subscriptionId"
   WHERE h."startsAt">=${from} AND h."startsAt"<${to}
   GROUP BY s.code,h.status ORDER BY s.code,h.status LIMIT 201`;
      const ai = await tx.$queryRaw<
        {
          provider: string;
          status: string;
          requests: bigint;
          inputTokens: string;
          outputTokens: string;
          estimatedCostUsd: string | null;
          estimatedRequests: bigint;
        }[]
      >`
   SELECT provider,status::text,COUNT(*) AS requests,COALESCE(SUM("inputTokens"),0)::text AS "inputTokens",
   COALESCE(SUM("outputTokens"),0)::text AS "outputTokens",SUM("estimatedCostUsd")::text AS "estimatedCostUsd",
   COUNT("estimatedCostUsd") AS "estimatedRequests"
   FROM "AIUsage" WHERE "createdAt">=${from} AND "createdAt"<${to}
   GROUP BY provider,status ORDER BY provider,status LIMIT 201`;
      const payments = await tx.$queryRaw<
        {
          provider: string;
          status: string;
          currency: string;
          count: bigint;
          amountCents: string;
        }[]
      >`
   SELECT provider,status::text,currency,COUNT(*) AS count,SUM("amountCents")::text AS "amountCents"
   FROM "Payment" WHERE "createdAt">=${from} AND "createdAt"<${to}
   GROUP BY provider,status,currency ORDER BY provider,status,currency LIMIT 201`;
      if ([subscriptions, ai, payments].some((rows) => rows.length > 200))
        throw new DomainError(
          422,
          "STATISTICS_LIMIT",
          "Trop de groupes pour cette période. Réduisez la période.",
        );
      return {
        from: from.toISOString(),
        to: to.toISOString(),
        timeZone: "UTC",
        registrations: registrationSeries({ from, to }, registrations),
        subscriptions: subscriptions.map((r) => ({
          ...r,
          periods: count(r.periods),
        })),
        ai: ai.map((r) => ({
          ...r,
          requests: count(r.requests),
          estimatedRequests: count(r.estimatedRequests),
        })),
        payments: payments.map((r) => ({
          ...r,
          count: count(r.count),
          environment: paymentEnvironment(r.provider),
        })),
        billedAiCostUsd: null,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      maxWait: 3000,
      timeout: 12000,
    },
  );
}
