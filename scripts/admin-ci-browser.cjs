// Runs only against an explicitly isolated PostgreSQL database; never loads .env.
const { PrismaClient } = require("@prisma/client");
const { randomUUID, randomBytes } = require("node:crypto");
const { spawn } = require("node:child_process");
const { resolve } = require("node:path");
const { hashPassword } = require("../apps/api/dist/auth/password.js");

async function main() {
  const raw = process.env.TEST_DATABASE_URL;
  if (!raw || process.env.G8_ISOLATED_TEST_DB !== "true")
    throw Error("Explicit isolated test database required");
  const url = new URL(raw);
  if (url.hostname !== "127.0.0.1" || url.pathname !== "/revynora_test")
    throw Error("Loopback revynora_test required");
  const db = new PrismaClient({ datasources: { db: { url: raw } } });
  const id = randomUUID();
  const email = `ci-g7-${id}@example.test`;
  const password = randomBytes(24).toString("base64url") + "!aA1";
  const env = {
    ...process.env,
    DATABASE_URL: raw,
    TEST_ADMIN_EMAIL: email,
    TEST_ADMIN_PASSWORD: password,
    TEST_API_ORIGIN: "http://127.0.0.1:3411",
    ADMIN_ORIGIN: "http://127.0.0.1:3412",
    NEXT_PUBLIC_WEB_ORIGIN: "http://127.0.0.1:3410",
    UX_ARTIFACT_DIR:
      process.env.UX_ARTIFACT_DIR ?? resolve("apps/web/test-results/admin"),
  };
  try {
    await db.user.create({
      data: {
        id,
        email,
        name: "Admin CI fixture",
        role: "ADMIN",
        passwordHash: await hashPassword(password),
        termsAcceptedAt: new Date(),
      },
    });
    // Separate invocations restart API servers and preserve the existing rate limits.
    for (const files of [
      [
        "admin-g2.spec.ts",
        "statistics-g3.spec.ts",
        "catalog-g4.spec.ts",
        "billing-g6.spec.ts",
      ],
      ["ux-g7.spec.ts"],
      ["polyvalent-g8.spec.ts"],
      ["commercial-g9.spec.ts"],
    ]) {
      const code = await new Promise((accept, reject) => {
        const child = spawn(
          process.execPath,
          [
            resolve("scripts/ci-playwright.cjs"),
            "--report-dir",
            resolve(
              "ci-reports/admin-legacy",
              files[0].replace(".spec.ts", ""),
            ),
            "--",
            "--config=playwright.polyvalent.config.ts",
            ...files,
          ],
          {
            env: {
              ...env,
              UX_ARTIFACT_DIR: resolve(
                env.UX_ARTIFACT_DIR,
                files[0].replace(".spec.ts", ""),
              ),
            },
            stdio: "inherit",
          },
        );
        child.on("error", reject);
        child.on("exit", accept);
      });
      if (code !== 0) throw Error("Admin browser test batch failed");
    }
  } finally {
    await db.user.deleteMany({ where: { id } });
    await db.$disconnect();
  }
}
main().catch(() => {
  console.error(
    "Historical Admin browser validation failed; inspect filtered CI reports.",
  );
  process.exitCode = 1;
});
