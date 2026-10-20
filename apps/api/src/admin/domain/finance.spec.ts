import { it, expect, vi } from "vitest";
import { paymentQuery, subscriptionQuery, providerKind } from "./finance";
import { requireAdminPermission } from "./permissions";
import { AdminUseCases } from "../application/admin.use-cases";
import type { AdminRepository } from "./admin";
it("valide chaque statut, fournisseur et limites sans accepter de champs privés", () => {
  for (const status of ["ALL", "PENDING", "PAID", "FAILED", "REFUNDED"])
    expect(paymentQuery.safeParse({ status }).success).toBe(true);
  for (const status of ["ALL", "ACTIVE", "PAST_DUE", "CANCELLED", "INCOMPLETE"])
    expect(subscriptionQuery.safeParse({ status }).success).toBe(true);
  for (const provider of ["ALL", "mock", "stripe", "internal", "other"])
    expect(paymentQuery.safeParse({ provider }).success).toBe(true);
  for (const page of [0, -1, 1.5, 10001, "NaN", Infinity])
    expect(paymentQuery.safeParse({ page }).success).toBe(false);
  expect(paymentQuery.parse({ page: "10000" }).page).toBe(10000);
  for (const q of [
    { userId: "private" },
    { status: "SUCCESS" },
    { provider: "live" },
  ])
    expect(paymentQuery.safeParse(q).success).toBe(false);
  expect(subscriptionQuery.safeParse({ plan: "VIP" }).success).toBe(false);
  expect(providerKind("provider-secret-reference")).toBe("other");
});
it("autorise uniquement la lecture ADMIN et refuse avant tout accès aux données", () => {
  const payments = vi.fn(),
    subscriptions = vi.fn();
  const use = new AdminUseCases({
    payments,
    subscriptions,
  } as unknown as AdminRepository);
  for (const resource of ["payments", "subscriptions"] as const) {
    expect(() =>
      requireAdminPermission("ADMIN", resource, "read"),
    ).not.toThrow();
    for (const action of ["refund", "update", "delete", "create"])
      expect(() => requireAdminPermission("ADMIN", resource, action)).toThrow();
    expect(() => requireAdminPermission("STUDENT", resource, "read")).toThrow();
  }
  expect(() => use.payments(paymentQuery.parse({}), "STUDENT")).toThrow();
  expect(payments).not.toHaveBeenCalled();
  expect(() =>
    use.subscriptions(subscriptionQuery.parse({}), "STUDENT"),
  ).toThrow();
  expect(subscriptions).not.toHaveBeenCalled();
  use.payments(paymentQuery.parse({}), "ADMIN");
  expect(payments).toHaveBeenCalledOnce();
});

it("applique un délai SQL local et propage les erreurs sans faux résultat vide", async () => {
  const { readPayments, readSubscriptions } = await import(
    "../infrastructure/finance.repository"
  );
  const query = vi.fn().mockResolvedValue([]);
  const rows = {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
  };
  const transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({ $queryRaw: query, payment: rows, userSubscriptionHistory: rows }),
  );
  const db = {
    $transaction: transaction,
  } as unknown as import("@prisma/client").PrismaClient;
  await readPayments(db, paymentQuery.parse({}));
  await readSubscriptions(db, subscriptionQuery.parse({}));
  expect(query).toHaveBeenCalledTimes(2);
  expect(query.mock.calls[0]?.[0].join("")).toContain("statement_timeout");
  expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
    isolationLevel: "RepeatableRead",
    maxWait: 3000,
    timeout: 12000,
  });
  transaction.mockRejectedValueOnce(new Error("statement timeout"));
  await expect(readPayments(db, paymentQuery.parse({}))).rejects.toThrow(
    "statement timeout",
  );
});
