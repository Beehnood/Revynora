import { z } from "zod";
export const providerFilter = z.enum([
  "ALL",
  "mock",
  "stripe",
  "internal",
  "other",
]);
const base = {
  page: z.coerce.number().int().min(1).max(10000).default(1),
  provider: providerFilter.default("ALL"),
};
export const paymentQuery = z
  .object({
    ...base,
    status: z
      .enum(["ALL", "PENDING", "PAID", "FAILED", "REFUNDED"])
      .default("ALL"),
  })
  .strict();
export const subscriptionQuery = z
  .object({
    ...base,
    status: z
      .enum(["ALL", "ACTIVE", "PAST_DUE", "CANCELLED", "INCOMPLETE"])
      .default("ALL"),
    plan: z.enum(["ALL", "FREE", "PLUS", "PRO"]).default("ALL"),
  })
  .strict();
export type PaymentQuery = z.infer<typeof paymentQuery>;
export type SubscriptionQuery = z.infer<typeof subscriptionQuery>;
export function providerKind(
  value: string,
): "mock" | "stripe" | "internal" | "other" {
  return value === "mock" || value === "stripe" || value === "internal"
    ? value
    : "other";
}
