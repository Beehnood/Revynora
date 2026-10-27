import { describe, it, expect } from "vitest";
import { draftSchema, validateOffer, legacyFeatures } from "./domain";
import { resolveEntitlement, type Period } from "../billing/domain/billing";
const draft = {
  expectedRevision: 0,
  name: "Plus",
  priceCents: 300,
  currency: "eur" as const,
  interval: "month" as const,
  active: true,
  features: ["leitner"],
  reason: "Nouvelle grille tarifaire",
};
describe("Versions commerciales", () => {
  it("valide un registre fermé et les dépendances", () => {
    expect(draftSchema.parse(draft)).toEqual(draft);
    expect(() =>
      draftSchema.parse({ ...draft, features: ["arbitrary"] }),
    ).toThrow();
    for (const features of [
      ["reminders"],
      ["planning"],
      ["leitner", "leitner"],
    ])
      expect(() => validateOffer("PLUS", { ...draft, features })).toThrow();
    expect(() =>
      validateOffer("PRO", { ...draft, features: legacyFeatures("PRO") }),
    ).not.toThrow();
  });
  it("préserve le socle gratuit et refuse les prix incohérents", () => {
    for (const change of [
      { priceCents: 1 },
      { active: false },
      { interval: "month" as const },
    ])
      expect(() =>
        validateOffer("FREE", {
          ...draft,
          priceCents: 0,
          interval: "none",
          features: [],
          ...change,
        }),
      ).toThrow();
    expect(() =>
      validateOffer("FREE", {
        ...draft,
        priceCents: 0,
        interval: "none",
        features: [],
      }),
    ).not.toThrow();
    expect(() => validateOffer("PLUS", { ...draft, priceCents: 0 })).toThrow();
    expect(() => draftSchema.parse({ ...draft, priceCents: 1.2 })).toThrow();
  });
  it("les capacités suivent le contrat, pas le nom du forfait", () => {
    const now = new Date(),
      p: Period = {
        id: "p",
        plan: "PRO",
        priceCents: 500,
        currency: "eur",
        startsAt: new Date(+now - 1),
        endsAt: new Date(+now + 1000),
        status: "ACTIVE",
        provider: "mock",
        providerSubscriptionId: "s",
        cancelAtPeriodEnd: false,
        features: ["leitner"],
      };
    expect(resolveEntitlement([p], now)).toMatchObject({
      plan: "PRO",
      leitner: true,
      planning: false,
      reminders: false,
    });
    expect(
      resolveEntitlement([{ ...p, features: undefined }], now).planning,
    ).toBe(true);
    expect(resolveEntitlement([{ ...p, endsAt: now }], now).plan).toBe("FREE");
  });
});
