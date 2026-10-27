// Catalogue snapshots only. Never proves historical contracts or grants a permission.
async function initializeCommercialCatalogue(db) {
  for (const code of ["FREE", "PLUS", "PRO"])
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Subscription" WHERE code=${code}::"Plan" FOR UPDATE`;
      const offer = await tx.subscription.findUniqueOrThrow({
        where: { code },
      });
      if (offer.currentVersionId) return;
      const last = await tx.commercialOfferVersion.findFirst({
        where: { subscriptionId: offer.id },
        orderBy: { number: "desc" },
      });
      const version = await tx.commercialOfferVersion.create({
        data: {
          subscriptionId: offer.id,
          number: (last?.number ?? 0) + 1,
          basedOnRevision: offer.revision,
          name: offer.name,
          priceCents: offer.priceCents,
          currency: offer.currency,
          interval: offer.interval,
          active: offer.active,
          features:
            code === "PRO"
              ? ["leitner", "planning", "reminders"]
              : code === "PLUS"
                ? ["leitner"]
                : [],
          state: "PUBLISHED",
          reason:
            "Initialisation du catalogue, sans preuve contractuelle historique",
        },
      });
      await tx.subscription.update({
        where: { id: offer.id },
        data: { currentVersionId: version.id },
      });
    });
}
module.exports = { initializeCommercialCatalogue };
