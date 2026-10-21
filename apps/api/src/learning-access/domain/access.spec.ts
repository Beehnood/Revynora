import { it, expect, vi } from "vitest";
import { resolveLearningAccess, type LearningAccount } from "./access";
import { resolveEntitlement } from "../../billing/domain/billing";
import { GetLearningAccess } from "../application/learning-access";
import { GetEntitlements } from "../../billing/application/billing.use-cases";
const now = new Date("2026-10-21T12:00:00Z");
const free = resolveEntitlement([], now);
const grant = {
  id: "g",
  startsAt: new Date(+now - 1),
  expiresAt: null,
  revokedAt: null,
};
const admin: LearningAccount = {
  role: "ADMIN",
  disabledAt: null,
  grants: [grant],
};
it("sépare ADMIN interne Pro, commercial Free et rôles étudiants", () => {
  expect(resolveLearningAccess(admin, free, now)).toMatchObject({
    allowed: true,
    effectivePlan: "PRO",
    commercialPlan: "FREE",
    source: "INTERNAL",
    leitner: true,
    planning: true,
  });
  expect(
    resolveLearningAccess(
      { ...admin, grants: [] },
      { ...free, plan: "PRO", planning: true },
      now,
    ).allowed,
  ).toBe(false);
  expect(
    resolveLearningAccess(
      { role: "STUDENT", disabledAt: null, grants: [grant] },
      free,
      now,
    ),
  ).toMatchObject({
    allowed: true,
    effectivePlan: "FREE",
    source: "COMMERCIAL",
    planning: false,
  });
  expect(
    resolveLearningAccess(
      { role: "STUDENT", disabledAt: null, grants: [] },
      { ...free, plan: "PRO", leitner: true, planning: true },
      now,
    ).planning,
  ).toBe(true);
});
it("respecte début inclus, fin exclue, révocation et suspension", () => {
  for (const g of [
    { ...grant, startsAt: new Date(+now + 1) },
    { ...grant, expiresAt: now },
    { ...grant, revokedAt: now },
  ])
    expect(
      resolveLearningAccess({ ...admin, grants: [g] }, free, now).allowed,
    ).toBe(false);
  expect(
    resolveLearningAccess(
      { ...admin, grants: [{ ...grant, startsAt: now }] },
      free,
      now,
    ).allowed,
  ).toBe(true);
  expect(
    resolveLearningAccess({ ...admin, disabledAt: now }, free, now).allowed,
  ).toBe(false);
  expect(resolveLearningAccess(null, free, now).allowed).toBe(false);
});
it("réévalue les droits à chaque appel et refuse les fonctions payantes après révocation", async () => {
  const account = vi
    .fn()
    .mockResolvedValueOnce(admin)
    .mockResolvedValue({ ...admin, grants: [] });
  const access = new GetLearningAccess(
    new GetEntitlements({ periods: async () => [] }),
    { account },
  );
  await expect(access.require("u", "PRO")).resolves.toMatchObject({
    source: "INTERNAL",
  });
  await expect(access.require("u", "PRO")).rejects.toThrow();
  expect(account).toHaveBeenCalledTimes(2);
});

it("refuse les permissions administratives aux droits commerciaux Pro", async () => {
  const { ManageLearningGrants } = await import("../application/manage-grants");
  const repo = { issue: vi.fn(), revoke: vi.fn(), list: vi.fn() };
  const use = new ManageLearningGrants(repo);
  expect(() =>
    use.issue("student", "STUDENT", "target", {
      startsAt: now.toISOString(),
      provenance: "TEST",
      justification: "Justification explicite",
    }),
  ).toThrow();
  expect(() =>
    use.revoke("student", "STUDENT", "g", "Révocation explicite"),
  ).toThrow();
  expect(repo.issue).not.toHaveBeenCalled();
  expect(repo.revoke).not.toHaveBeenCalled();
});
