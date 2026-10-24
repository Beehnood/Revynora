import type { AdminStatistics } from "@revynora/types";
import { DomainError } from "../../shared/domain/errors";
export type StatisticsPeriod = { from: Date; to: Date };
export function checkedPeriod(period: StatisticsPeriod) {
  const days = (+period.to - +period.from) / 86400000;
  if (
    !Number.isInteger(days) ||
    days < 1 ||
    days > 366 ||
    !Number.isFinite(days) ||
    period.from.toISOString().slice(11) !== "00:00:00.000Z" ||
    period.to.toISOString().slice(11) !== "00:00:00.000Z"
  )
    throw new DomainError(400, "VALIDATION", "Période UTC invalide.");
  return period;
}
export function count(value: bigint): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0)
    throw new Error("Invalid aggregate count");
  return n;
}
export function registrationSeries(
  period: StatisticsPeriod,
  rows: { date: string; count: bigint }[],
) {
  checkedPeriod(period);
  const counts = new Map(rows.map((row) => [row.date, count(row.count)]));
  return Array.from(
    { length: (+period.to - +period.from) / 86400000 },
    (_, i) => {
      const date = new Date(+period.from + i * 86400000)
        .toISOString()
        .slice(0, 10);
      return { date, count: counts.get(date) ?? 0 };
    },
  );
}
// No persisted livemode field exists. Do not infer a historical Stripe payment's
// environment from the process configuration, current credentials or its ID.
export function paymentEnvironment(
  provider: string,
): AdminStatistics["payments"][number]["environment"] {
  return provider === "mock" ? "SIMULATION" : "UNVERIFIED";
}
