// The FREE entitlement is an enum/default, never a client-controlled field.
// No default account or known password is seeded. Optional editorial course only.
require(
  require("node:module")
    .createRequire(require("node:path").resolve("apps/api/package.json"))
    .resolve("dotenv"),
).config({ quiet: true });
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
(async () => {
  for (const [code, priceCents] of [
    ["FREE", 0],
    ["PLUS", 250],
    ["PRO", 500],
  ])
    await db.subscription.upsert({
      where: { code },
      create: {
        code,
        name: code,
        priceCents,
        interval: code === "FREE" ? "none" : "month",
      },
      update: {
        name: code,
        priceCents,
        interval: code === "FREE" ? "none" : "month",
      },
    });
  await db.course.upsert({
    where: { id: "00000000-0000-4000-8000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-4000-8000-000000000001",
      ownerId: null,
      source: "ADMIN",
      title: "Mieux apprendre : le rappel actif",
      domain: "Sciences",
      content:
        "Après avoir étudié une notion, fermez votre cours et essayez de l’expliquer avec vos propres mots. Vérifiez ensuite les points oubliés. Répétez cette étape à distance de la première lecture. Ce rappel actif vous aide à repérer les notions qui nécessitent encore du travail.",
    },
  });
  console.log("Socle FREE et cours éditorial initialisés, aucun compte créé.");
})()
  .catch(() => {
    console.error("Seed impossible");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
