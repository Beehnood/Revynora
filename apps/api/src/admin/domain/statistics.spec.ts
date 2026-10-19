import { it, expect } from "vitest";
import { adminStatisticsPeriodSchema } from "@revynora/validation";
import {
  checkedPeriod,
  registrationSeries,
  count,
  paymentEnvironment,
} from "./statistics";
it("borne les dates UTC, rejette les dates impossibles et paramètres arbitraires", () => {
  expect(
    adminStatisticsPeriodSchema.safeParse({
      from: "2028-02-28",
      to: "2028-03-01",
    }).success,
  ).toBe(true);
  for (const value of [
    { from: "2027-02-29", to: "2027-03-01" },
    { from: "2026-01-01", to: "2026-01-01" },
    { from: "2026-01-01", to: "2028-01-01" },
    { from: "2026-01-01", to: "2026-01-02", userId: "x" },
  ])
    expect(adminStatisticsPeriodSchema.safeParse(value).success).toBe(false);
  expect(() =>
    checkedPeriod({ from: new Date("invalid"), to: new Date() }),
  ).toThrow();
  expect(() =>
    checkedPeriod({
      from: new Date("2026-01-01T01:00Z"),
      to: new Date("2026-01-02T01:00Z"),
    }),
  ).toThrow();
});
it("complète les jours UTC manquants sans inventer d'inscriptions", () => {
  expect(
    registrationSeries(
      { from: new Date("2028-02-28"), to: new Date("2028-03-02") },
      [{ date: "2028-02-29", count: 2n }],
    ),
  ).toEqual([
    { date: "2028-02-28", count: 0 },
    { date: "2028-02-29", count: 2 },
    { date: "2028-03-01", count: 0 },
  ]);
  expect(() => count(9007199254740992n)).toThrow();
  expect(() => count(-1n)).toThrow();
});
it("ne déduit jamais le mode test/live du fournisseur ou de la configuration", () => {
  expect(paymentEnvironment("mock")).toBe("SIMULATION");
  for (const p of ["stripe", "stripe_live", "unknown"])
    expect(paymentEnvironment(p)).toBe("UNVERIFIED");
});
