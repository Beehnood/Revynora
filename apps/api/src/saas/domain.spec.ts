import { environmentSchema } from "@revynora/validation";
import { describe, it, expect } from "vitest";
import { resolveEntitlement, type Period } from "../billing/domain/billing";
import { scheduleReview } from "../leitner/domain/leitner";
import { placeSlot } from "../planning/domain/planning";
import { localInstant } from "../planning/infrastructure/prisma-plan.repository";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
const now = new Date("2026-10-16T12:00Z");
const p = (
  plan: "PLUS" | "PRO",
  status: Period["status"] = "ACTIVE",
): Period => ({
  id: "id",
  plan,
  status,
  priceCents: 250,
  currency: "eur",
  startsAt: new Date(+now - 1000),
  endsAt: new Date(+now + 1000),
  provider: "mock",
  providerSubscriptionId: "sub",
  cancelAtPeriodEnd: false,
});
describe("Règles SaaS", () => {
  it("intervalles Leitner configurables, valeurs par défaut et rejet des paramètres invalides", () => {
    expect(scheduleReview(3, true, now).nextDueAt).toEqual(
      new Date(+now + 8 * 86400000),
    );
    expect(scheduleReview(4, true, now).nextDueAt).toEqual(
      new Date(+now + 16 * 86400000),
    );
    expect(scheduleReview(2, true, now, [1, 3, 6, 12, 24]).nextDueAt).toEqual(
      new Date(+now + 6 * 86400000),
    );
    for (const config of [
      [1, 2],
      [1, 1, 4, 8, 16],
      [0, 2, 4, 8, 16],
    ])
      expect(() => scheduleReview(1, true, now, config)).toThrow();
    expect(
      environmentSchema.safeParse({
        DATABASE_URL: "postgresql://test:test@localhost/test",
        LEITNER_INTERVAL_DAYS: "1,2,4,8,16",
      }).success,
    ).toBe(true);
    expect(
      environmentSchema.safeParse({
        DATABASE_URL: "postgresql://test:test@localhost/test",
        LEITNER_INTERVAL_DAYS: "1,1,4,8,16",
      }).success,
    ).toBe(false);
  });
  it("résout Free, périodes expirées, futures, impayées et hiérarchie", () => {
    expect(resolveEntitlement([], now).plan).toBe("FREE");
    expect(resolveEntitlement([p("PLUS", "PAST_DUE")], now).plan).toBe("FREE");
    expect(resolveEntitlement([{ ...p("PRO"), endsAt: now }], now).plan).toBe(
      "FREE",
    );
    expect(
      resolveEntitlement([{ ...p("PRO"), startsAt: new Date(+now + 1) }], now)
        .plan,
    ).toBe("FREE");
    expect(resolveEntitlement([p("PLUS"), p("PRO")], now).plan).toBe("PRO");
    expect(resolveEntitlement([p("PLUS")], now).planning).toBe(false);
  });
  it("calcule les cinq boîtes, échec et plafond", () => {
    for (let box = 1; box <= 5; box++) {
      expect(scheduleReview(box, true, now).toBox).toBe(Math.min(box + 1, 5));
      expect(scheduleReview(box, false, now)).toMatchObject({
        toBox: 1,
        nextDueAt: new Date(+now + 86400000),
      });
    }
    expect(() => scheduleReview(6, true, now)).toThrow();
  });
  it("résout les collisions sans modifier les créneaux existants", () => {
    const busy = [{ startsAt: now, endsAt: new Date(+now + 3600000) }];
    expect(() => placeSlot(now, 45, busy, false)).toThrow();
    expect(placeSlot(now, 45, busy, true).startsAt).toEqual(busy[0]!.endsAt);
    expect(() => placeSlot(now, 1, [], false)).toThrow();
  });
  it("rejette les trous et doublons DST, garde un instant UTC stable", () => {
    expect(() => localInstant("2027-03-28T02:30", "Europe/Paris")).toThrow();
    expect(() => localInstant("2026-10-25T02:30", "Europe/Paris")).toThrow();
    expect(localInstant("2026-10-16T14:00", "Europe/Paris")).toEqual(now);
  });
  it("les nouvelles couches domaine/application ne dépendent pas des adaptateurs", () => {
    for (const module of [
      "billing",
      "leitner",
      "planning",
      "notifications",
      "admin",
      "privacy",
    ])
      for (const layer of ["domain", "application"]) {
        const dir = join(process.cwd(), "src", module, layer);
        for (const file of readdirSync(dir)) {
          const code = readFileSync(join(dir, file), "utf8");
          expect(code).not.toMatch(
            /from ["'](?:@nestjs|@prisma|stripe|bullmq|ioredis|nodemailer)/,
          );
          expect(code).not.toMatch(/from ["'][^"']*infrastructure/);
        }
      }
  });
});
