// Initial catalogue only: never modifies existing offers, periods, users or payments.
require("dotenv").config({ quiet: true });
const { PrismaClient } = require("@prisma/client");
(async () => {
  const db = new PrismaClient();
  try {
    await db.$transaction(
      ["FREE", "PLUS", "PRO"].map((code, i) =>
        db.subscription.upsert({
          where: { code },
          create: {
            code,
            name: code === "FREE" ? "Free" : code === "PLUS" ? "Plus" : "Pro",
            priceCents: [0, 250, 500][i],
            currency: "eur",
            interval: code === "FREE" ? "none" : "month",
          },
          update: {},
        }),
      ),
    );
    await require("./initialize-commercial-catalog.cjs").initializeCommercialCatalogue(
      db,
    );
    console.log(
      "Catalogue initialized; existing offers preserved. No user, paid period or payment created.",
    );
  } finally {
    await db.$disconnect();
  }
})().catch(() => {
  console.error(
    "Catalogue initialization failed. Verify the reviewed database configuration.",
  );
  process.exitCode = 1;
});
