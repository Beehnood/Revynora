import type Stripe from "stripe";
import type { CommercialQuote } from "../domain/billing";

/** Historical prices can be archived; new sales always require an active price. */
export function compatibleStripePrice(
  price: Stripe.Price,
  quote: Pick<CommercialQuote, "priceCents" | "currency" | "interval">,
  historical = false,
) {
  return (
    quote.interval === "month" &&
    quote.currency === "eur" &&
    Number.isSafeInteger(quote.priceCents) &&
    quote.priceCents > 0 &&
    price.livemode === false &&
    (historical || price.active === true) &&
    price.type === "recurring" &&
    price.unit_amount === quote.priceCents &&
    price.currency === quote.currency &&
    price.recurring?.interval === quote.interval &&
    price.recurring.interval_count === 1 &&
    price.recurring.usage_type === "licensed" &&
    price.billing_scheme === "per_unit" &&
    !price.transform_quantity &&
    !price.custom_unit_amount
  );
}
