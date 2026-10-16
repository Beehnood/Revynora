require("dotenv").config({ quiet: true });
const { PrismaClient } = require("@prisma/client");
const { spawnSync } = require("node:child_process");
(async () => {
  const raw = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL ou TEST_DATABASE_URL requise");
  const testUrl = new URL(raw);
  testUrl.pathname = "/revynora_test";
  if (
    process.env.TEST_DATABASE_URL &&
    new URL(process.env.TEST_DATABASE_URL).pathname !== "/revynora_test"
  )
    throw new Error("Base dédiée revynora_test obligatoire");
  const adminUrl = new URL(testUrl);
  adminUrl.pathname = "/postgres";
  const db = new PrismaClient({
    datasources: { db: { url: adminUrl.toString() } },
  });
  try {
    const rows =
      await db.$queryRaw`SELECT 1 FROM pg_database WHERE datname = 'revynora_test'`;
    if (!rows.length)
      await db.$executeRawUnsafe('CREATE DATABASE "revynora_test"');
  } finally {
    await db.$disconnect();
  }
  const run = spawnSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: testUrl.toString() },
    stdio: "inherit",
  });
  if (run.status !== 0) throw new Error("Migration de test impossible");
  console.log("Base revynora_test prête ; données applicatives préservées.");
})().catch(() => {
  console.error(
    "Préparation de la base de test impossible. Vérifiez PostgreSQL et les droits CREATE DATABASE.",
  );
  process.exitCode = 1;
});
