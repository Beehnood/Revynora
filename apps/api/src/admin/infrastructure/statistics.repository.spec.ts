import { it, expect, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { readStatistics } from "./statistics.repository";
import { AdminUseCases } from "../application/admin.use-cases";
import type { AdminRepository } from "../domain/admin";
const period = { from: new Date("2026-01-01"), to: new Date("2026-01-02") };
it("refuse STUDENT avant toute lecture statistique", () => {
  const statistics = vi.fn();
  const use = new AdminUseCases({ statistics } as unknown as AdminRepository);
  expect(() => use.statistics(period, "STUDENT")).toThrow();
  expect(statistics).not.toHaveBeenCalled();
});
it("borne la transaction, refuse un excès de groupes et ne renvoie pas de résultat tronqué", async () => {
  const query = vi
    .fn()
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce(Array.from({ length: 201 }, () => ({})))
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([]);
  const transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({ $queryRaw: query }),
  );
  const db = { $transaction: transaction } as unknown as PrismaClient;
  await expect(readStatistics(db, period)).rejects.toMatchObject({
    code: "STATISTICS_LIMIT",
  });
  expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
    isolationLevel: "RepeatableRead",
    maxWait: 3000,
    timeout: 12000,
  });
  expect(query.mock.calls[0]?.[0].join("")).toContain("statement_timeout");
  expect(query.mock.calls[0]?.[0].join("")).toContain(
    "set_config('TimeZone', 'UTC', true)",
  );
});
it("propage un timeout SQL comme une erreur, jamais comme zéro activité", async () => {
  const transaction = vi.fn().mockRejectedValue(new Error("statement timeout"));
  await expect(
    readStatistics(
      { $transaction: transaction } as unknown as PrismaClient,
      period,
    ),
  ).rejects.toThrow("statement timeout");
});
