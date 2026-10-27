// Safe replacement for test initialization. The historical seed stays byte-identical.
const { PrismaClient } = require("@prisma/client");
const { spawnSync } = require("node:child_process");
(async () => {
  const raw = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!raw || process.env.G8_ISOLATED_TEST_DB !== "true")
    throw Error("Explicit isolated test database required");
  const u = new URL(raw);
  if (
    !["127.0.0.1", "localhost"].includes(u.hostname) ||
    u.pathname !== "/revynora_test"
  )
    throw Error("Dedicated test database required");
  const run = spawnSync(process.execPath, ["scripts/initialize-catalog.cjs"], {
    env: { ...process.env, DATABASE_URL: raw },
    stdio: "inherit",
  });
  if (run.status !== 0) throw Error("Test catalogue initialization failed");
  const db = new PrismaClient({ datasources: { db: { url: raw } } });
  try {
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
    console.log(
      "Test catalogue and editorial fixture ready; existing commercial versions and contracts preserved.",
    );
  } finally {
    await db.$disconnect();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
