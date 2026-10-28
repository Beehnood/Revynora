import { z } from "zod";
import { DomainError } from "../shared/domain/errors";
export const commercialFeatures = ["leitner", "planning", "reminders"] as const;
export const legacyFeatures = (
  plan: string,
): (typeof commercialFeatures)[number][] =>
  plan === "PRO" ? [...commercialFeatures] : plan === "PLUS" ? ["leitner"] : [];
export const draftSchema = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
    name: z.string().trim().min(1).max(80),
    priceCents: z.number().int().min(0).max(1000000),
    currency: z.literal("eur"),
    interval: z.enum(["none", "month"]),
    active: z.boolean(),
    features: z.array(z.enum(commercialFeatures)).max(3),
    reason: z.string().trim().min(10).max(500),
  })
  .strict();
export type CommercialDraft = z.infer<typeof draftSchema>;
export const publishSchema = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
    confirmVersionId: z.string().uuid(),
  })
  .strict();
export function validateOffer(
  code: string,
  d: {
    priceCents: number;
    currency: string;
    interval: string;
    active: boolean;
    features: readonly string[];
  },
) {
  if (
    !Number.isSafeInteger(d.priceCents) ||
    d.priceCents < 0 ||
    d.priceCents > 1000000 ||
    d.currency !== "eur" ||
    d.features.some((f) => !commercialFeatures.some((known) => known === f)) ||
    new Set(d.features).size !== d.features.length ||
    (d.features.includes("reminders") && !d.features.includes("planning")) ||
    (d.features.includes("planning") && !d.features.includes("leitner")) ||
    (code === "FREE"
      ? d.priceCents !== 0 || d.interval !== "none" || !d.active
      : d.priceCents <= 0 || d.interval !== "month")
  )
    throw new DomainError(
      422,
      "INVALID_COMMERCIAL_OFFER",
      "Configuration commerciale incohérente.",
    );
}
