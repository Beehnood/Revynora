// Must run inside a dedicated Linux laboratory. No .env is loaded.
const { PrismaClient } = require("@prisma/client");
const {
  mkdtempSync,
  mkdirSync,
  copyFileSync,
  cpSync,
  readdirSync,
} = require("node:fs");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");
const assert = require("node:assert/strict");
(async () => {
  const raw = process.env.G9_UPGRADE_DB_URL;
  if (!raw || process.env.G8_ISOLATED_TEST_DB !== "true")
    throw Error("Isolated upgrade database required");
  const u = new URL(raw);
  if (
    u.hostname !== "127.0.0.1" ||
    !/^\/revynora_g9_upgrade(?:_final)?$/.test(u.pathname)
  )
    throw Error("Dedicated loopback upgrade database required");
  const root = mkdtempSync("/tmp/g9-upgrade-"),
    schema = join(root, "schema.prisma"),
    migrations = join(root, "migrations");
  mkdirSync(migrations);
  copyFileSync("prisma/schema.prisma", schema);
  copyFileSync(
    "prisma/migrations/migration_lock.toml",
    join(migrations, "migration_lock.toml"),
  );
  const names = readdirSync("prisma/migrations")
      .filter((n) => /^\d/.test(n))
      .sort(),
    g9 = names.filter(
      (n) => n.startsWith("20261025") || n.startsWith("20261026"),
    );
  for (const n of names.filter((n) => !g9.includes(n)))
    cpSync(join("prisma/migrations", n), join(migrations, n), {
      recursive: true,
    });
  function migrate() {
    const r = spawnSync(
      "pnpm",
      ["exec", "prisma", "migrate", "deploy", "--schema", schema],
      { env: { ...process.env, DATABASE_URL: raw }, stdio: "inherit" },
    );
    if (r.status !== 0) throw Error("Upgrade migration failed");
  }
  migrate();
  const db = new PrismaClient({ datasources: { db: { url: raw } } });
  try {
    await db.$executeRaw`INSERT INTO "Subscription" (id,code,name,"priceCents",currency,interval,active) VALUES ('g9-upgrade-offer','PLUS','Legacy Plus',321,'eur','month',true)`;
    await db.$executeRaw`INSERT INTO "User" (id,email,name,"passwordHash",role,plan,"createdAt") VALUES ('g9-upgrade-user','g9-upgrade@example.test','Synthetic upgrade fixture','TEST_ONLY','STUDENT','FREE',CURRENT_TIMESTAMP)`;
    await db.$executeRaw`INSERT INTO "UserSubscriptionHistory" (id,"userId","subscriptionId",provider,"providerSubscriptionId","priceCents",currency,status,"startsAt","endsAt","createdAt") VALUES ('g9-upgrade-period','g9-upgrade-user','g9-upgrade-offer','stripe','g9-upgrade-sub',279,'eur','ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP+INTERVAL '30 days',CURRENT_TIMESTAMP)`;
    for (const n of g9)
      cpSync(join("prisma/migrations", n), join(migrations, n), {
        recursive: true,
      });
    migrate();
    migrate();
    const p = await db.userSubscriptionHistory.findUniqueOrThrow({
      where: { id: "g9-upgrade-period" },
    });
    assert.equal(p.priceCents, 279);
    assert.equal(p.contractEvidence, "LEGACY_UNVERIFIED");
    assert.equal(p.commercialVersionId, null);
    const offer = await db.subscription.findUniqueOrThrow({
      where: { id: "g9-upgrade-offer" },
      include: { currentVersion: true },
    });
    assert.equal(offer.currentVersion.priceCents, 321);
    assert.equal(await db.commercialPermission.count(), 0);
    console.log(
      "UPGRADE PASS: legacy price 279 preserved, catalogue 321 separate, no invented contract evidence, no permission granted; second deploy idempotent",
    );
  } finally {
    await db.$disconnect();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
