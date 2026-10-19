import { it, expect, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { readSupervision } from "./supervision.repository";
import { AdminUseCases } from "../application/admin.use-cases";
import type { AdminRepository } from "../domain/admin";
import { requireAdminPermission } from "../domain/permissions";
const period = { from: new Date("2057-01-01"), to: new Date("2057-01-03") };
it("autorise uniquement la supervision agrégée ADMIN sans ouvrir les ressources privées", () => {
  const supervision = vi.fn();
  const use = new AdminUseCases({ supervision } as unknown as AdminRepository);
  expect(() => use.supervision(period, "STUDENT")).toThrow();
  expect(supervision).not.toHaveBeenCalled();
  use.supervision(period, "ADMIN");
  expect(supervision).toHaveBeenCalledWith(period);
  for (const r of ["ai", "leitner", "planning"] as const)
    expect(() => requireAdminPermission("ADMIN", r, "read")).toThrow();
  expect(() =>
    requireAdminPermission("ADMIN", "supervision", "update"),
  ).toThrow();
});
it("borne la transaction UTC et refuse dates ou comptages invalides", async () => {
  const query = vi
    .fn()
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      { category: "REVIEWS", status: "RECORDED", count: 2n },
    ]);
  const transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({ $queryRaw: query }),
  );
  const db = { $transaction: transaction } as unknown as PrismaClient;
  expect((await readSupervision(db, period)).rows[0]?.count).toBe(2);
  expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
    isolationLevel: "RepeatableRead",
    maxWait: 3000,
    timeout: 12000,
  });
  expect(query.mock.calls[0]?.[0].join("")).toContain("statement_timeout");
  await expect(
    readSupervision(db, { from: period.to, to: period.from }),
  ).rejects.toThrow();
  query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: -1n }]);
  await expect(readSupervision(db, period)).rejects.toThrow();
  transaction.mockRejectedValueOnce(new Error("statement timeout"));
  await expect(readSupervision(db, period)).rejects.toThrow(
    "statement timeout",
  );
});
