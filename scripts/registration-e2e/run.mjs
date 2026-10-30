import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { mkdtemp, readFile, readdir, writeFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import https from "node:https";
import http from "node:http";
import { collectRegistration } from "./collector.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const base = "https://127.0.0.1:3460";
const database = process.env.TEST_DATABASE_URL;
let databaseUrl;
try {
  databaseUrl = new URL(database);
} catch {
  /* Do not expose an invalid URL. */
}
// Guard before imports, builds, listeners or any database operation.
if (
  process.env.REGISTRATION_E2E_ISOLATED !== "true" ||
  !databaseUrl ||
  databaseUrl.hostname !== "127.0.0.1" ||
  databaseUrl.pathname !== "/revynora_test" ||
  !["postgres:", "postgresql:"].includes(databaseUrl.protocol)
)
  throw new Error("Explicit isolated loopback revynora_test database required");
const require = createRequire(join(root, "apps/web/package.json"));
delete process.env.DEBUG;
delete process.env.PWDEBUG;
delete process.env.NODE_DEBUG;
const { chromium } = require("@playwright/test");
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient({ datasources: { db: { url: database } } });
const children = [];
const report = { checks: {}, stages: {}, startedAt: new Date().toISOString() };
let browser, context, proxy, directory, fixtureId;
const reference = randomUUID();
const email = `registration-${reference}@example.test`;
const name = "Recette inscription isolée";
let password;
let stage = "migrations";
const safeEnv = Object.fromEntries(
  ["PATH", "HOME", "TMPDIR", "TMP", "TEMP", "SystemRoot"]
    .filter((key) => process.env[key])
    .map((key) => [key, process.env[key]]),
);
const env = {
  ...safeEnv,
  NODE_ENV: "test",
  DATABASE_URL: database,
  HOST: "127.0.0.1",
  PORT: "3462",
  WEB_ORIGIN: base,
  ADMIN_ORIGIN: base,
  API_URL: "http://127.0.0.1:3462",
  COOKIE_SECURE: "true",
  TRUST_PROXY_HOPS: "1",
  AI_PROVIDER: "mock",
  BILLING_PROVIDER: "mock",
  MAIL_PROVIDER: "local",
  WORKER_ENABLED: "false",
  ADMIN_WEB_INTEGRATION_ENABLED: "false",
  NEXT_TELEMETRY_DISABLED: "1",
  TURBO_TELEMETRY_DISABLED: "1",
};
function start(command, args, options = {}) {
  // Deliberately discard raw service/build output, which could contain secrets.
  const child = spawn(command, args, {
    cwd: root,
    env,
    stdio: "ignore",
    detached: true,
    ...options,
  });
  children.push(child);
  child.on("error", () => {});
  return child;
}
async function command(executable, args, options) {
  const child = start(executable, args, options);
  await new Promise((done, fail) => {
    child.once("error", () => fail(new Error("local command start failed")));
    child.once("exit", (code) =>
      code === 0 ? done() : fail(new Error("local command failed")),
    );
  });
}
async function check(key, operation) {
  try {
    report.checks[key] = (await operation()) ? "passed" : "failed";
  } catch {
    report.checks[key] = "error";
  }
}
async function ready(url, child) {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null) throw new Error("service exited");
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return;
    } catch {}
    await new Promise((done) => setTimeout(done, 500));
  }
  throw new Error("service readiness timeout");
}
try {
  const migrations = await db.$queryRawUnsafe(
    'SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations"',
  );
  const names = (
    await readdir(join(root, "prisma/migrations"), { withFileTypes: true })
  )
    .filter((item) => item.isDirectory())
    .map((item) => item.name);
  if (names.length !== migrations.length)
    throw new Error("migration count mismatch");
  for (const name of names) {
    const row = migrations.find((item) => item.migration_name === name);
    const checksum = createHash("sha256")
      .update(
        await readFile(join(root, "prisma/migrations", name, "migration.sql")),
      )
      .digest("hex");
    if (
      !row ||
      row.checksum !== checksum ||
      !row.finished_at ||
      row.rolled_back_at
    )
      throw new Error("migration integrity failure");
  }
  report.migrations = {
    count: names.length,
    checksumsMatch: true,
    appliedByThisRun: false,
  };
  stage = "build";
  await command("pnpm", ["build:api"]);
  await command("pnpm", ["build:web"], {
    env: { ...env, NODE_ENV: "production" },
  });
  report.stages.build = "passed";
  stage = "services";
  const api = start(process.execPath, ["apps/api/dist/main.js"]);
  await ready("http://127.0.0.1:3462/api/v1/health/ready", api);
  const web = start(
    "pnpm",
    ["exec", "next", "start", "--hostname", "127.0.0.1", "--port", "3461"],
    { cwd: join(root, "apps/web"), env: { ...env, NODE_ENV: "production" } },
  );
  await ready("http://127.0.0.1:3461/connexion", web);
  directory = await mkdtemp(join(tmpdir(), "revynora-registration-tls-"));
  await chmod(directory, 0o700);
  await command("openssl", [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    join(directory, "key.pem"),
    "-out",
    join(directory, "cert.pem"),
    "-days",
    "1",
    "-subj",
    "/CN=127.0.0.1",
    "-addext",
    "subjectAltName=IP:127.0.0.1",
  ]);
  await chmod(join(directory, "key.pem"), 0o600);
  proxy = https.createServer(
    {
      key: await readFile(join(directory, "key.pem")),
      cert: await readFile(join(directory, "cert.pem")),
    },
    (req, res) => {
      // All browser requests pass through Next, including its /api/v1 rewrite.
      const upstream = http.request(
        {
          hostname: "127.0.0.1",
          port: 3461,
          path: req.url,
          method: req.method,
          headers: { ...req.headers, "x-forwarded-proto": "https" },
        },
        (response) => {
          res.writeHead(response.statusCode, response.headers);
          response.pipe(res);
        },
      );
      upstream.on("error", () => {
        res.writeHead(502, { "content-type": "application/json" });
        res.end('{"code":"LOCAL_PROXY_UNAVAILABLE"}');
      });
      req.pipe(upstream);
    },
  );
  await new Promise((done, fail) => {
    proxy.once("error", fail);
    proxy.listen(3460, "127.0.0.1", done);
  });
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({
    ignoreHTTPSErrors: true,
    acceptDownloads: false,
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  let captureResolve;
  const captured = new Promise((done) => {
    captureResolve = done;
  });
  let registrations = 0;
  await context.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.origin !== base) return route.abort();
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      if (
        request.method() !== "POST" ||
        url.pathname !== "/api/v1/auth/register" ||
        registrations++
      )
        return route.abort();
      try {
        // Exactly one upstream request; buffer before the frontend can navigate.
        const response = await route.fetch({ maxRetries: 0, maxRedirects: 0 });
        const result = {
          status: response.status(),
          contentType: response.headers()["content-type"],
          body: null,
        };
        try {
          result.body = await response.body();
        } catch {}
        captureResolve(result);
        await route.fulfill({ response });
      } catch {
        captureResolve({ status: 0, body: null });
        await route.abort();
      }
      return;
    }
    return route.continue();
  });
  stage = "registration";
  const health = await context.request.get(base + "/api/v1/health/ready");
  await check(
    "httpsProxyReady",
    async () =>
      health.status() === 200 && (await health.json()).status === "ready",
  );
  const document = await page.goto(base + "/inscription");
  const security = await document.securityDetails();
  const isHttps =
    new URL(page.url()).protocol === "https:" &&
    Boolean(security?.protocol?.startsWith("TLS"));
  await check("actualTls", () => isHttps);
  password = randomBytes(32).toString("base64url") + "!Aa7";
  await page.getByLabel("Prénom", { exact: true }).fill(name);
  await page.getByLabel("Adresse e-mail", { exact: true }).fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Créer mon compte gratuit", exact: true })
    .click();
  let timer;
  const capture = await Promise.race([
    captured,
    new Promise((_, fail) => {
      timer = setTimeout(() => fail(new Error("capture timeout")), 30000);
    }),
  ]).finally(() => clearTimeout(timer));
  report.registrationRequests = registrations;
  const profile = async () => {
    const response = await context.request.get(base + "/api/v1/users/me");
    const data = await response.json();
    return {
      status: response.status(),
      role: data.role,
      plan: data.plan,
      belongsToFixture: data.email === email,
    };
  };
  const studentPage = async () => {
    await page.waitForURL(base + "/app");
    await page
      .getByRole("heading", { name: `Bonjour ${name} 👋`, exact: true })
      .waitFor({ state: "visible" });
    await page
      .getByRole("navigation", { name: "Navigation étudiant" })
      .waitFor({ state: "visible" });
    return true;
  };
  const input = {
    status: capture.status,
    contentType: capture.contentType,
    readJson: async () => JSON.parse(capture.body.toString("utf8")),
    cookies: () => context.cookies(base),
    profile,
    studentPage,
    https: isHttps,
  };
  report.registration = await collectRegistration(input);
  await check("freeLearningRightsFromApi", async () => {
    const response = await context.request.get(
      base + "/api/v1/learning/access",
    );
    const data = await response.json();
    return (
      response.status() === 200 &&
      data.allowed === true &&
      data.commercialPlan === "FREE" &&
      data.effectivePlan === "FREE" &&
      data.source === "COMMERCIAL" &&
      data.internal === null
    );
  });
  await check(
    "studentCannotReadAdminUsers",
    async () =>
      (await context.request.get(base + "/api/v1/admin/users")).status() ===
      403,
  );
  stage = "body failure regression";
  report.bodyFailure = await collectRegistration({
    ...input,
    readJson: async () => {
      throw new Error("controlled body retrieval failure");
    },
  });
  await check(
    "bodyFailureDoesNotSkipIndependentChecks",
    () =>
      report.bodyFailure.jsonBody === "error" &&
      Object.entries(report.bodyFailure)
        .filter(([key]) => key !== "jsonBody")
        .every(([, value]) => value === "passed"),
  );
  stage = "negative cases";
  const headers = { Origin: base, "X-Revynora-Client": "web" };
  await check(
    "duplicate409",
    async () =>
      (
        await context.request.post(base + "/api/v1/auth/register", {
          headers,
          data: { name, email, password, termsAccepted: true },
        })
      ).status() === 409,
  );
  await check(
    "invalid400",
    async () =>
      (
        await context.request.post(base + "/api/v1/auth/register", {
          headers,
          data: {},
        })
      ).status() === 400,
  );
  await check(
    "consentRequired400",
    async () =>
      (
        await context.request.post(base + "/api/v1/auth/register", {
          headers,
          data: { name, email, password, termsAccepted: false },
        })
      ).status() === 400,
  );
  await check(
    "roleOverposting400",
    async () =>
      (
        await context.request.post(base + "/api/v1/auth/register", {
          headers,
          data: { name, email, password, termsAccepted: true, role: "ADMIN" },
        })
      ).status() === 400,
  );
  password = undefined;
  stage = "fixture evidence";
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, role: true, plan: true, disabledAt: true },
  });
  fixtureId = user?.id;
  await check(
    "singleActiveStudentFree",
    async () =>
      (await db.user.count({ where: { email } })) === 1 &&
      user?.role === "STUDENT" &&
      user.plan === "FREE" &&
      user.disabledAt === null,
  );
  if (!fixtureId) throw new Error("fixture absent");
  const where = { userId: fixtureId };
  await check("freePeriodZero", async () =>
    (await db.userSubscriptionHistory.findMany({ where })).some(
      (row) =>
        row.priceCents === 0 &&
        row.status === "ACTIVE" &&
        row.provider === "internal",
    ),
  );
  await check(
    "welcomeQueuedLocally",
    async () =>
      (await db.emailMessage.count({
        where: {
          ...where,
          kind: "WELCOME",
          provider: "local",
          status: "QUEUED",
        },
      })) === 1,
  );
  await check(
    "noPaymentsOrCommercialPermissions",
    async () =>
      (await db.payment.count({ where })) === 0 &&
      (await db.checkoutIntent.count({ where })) === 0 &&
      (await db.commercialPermission.count({ where })) === 0 &&
      (await db.internalLearningGrant.count({ where })) === 0,
  );
  stage = "expired session";
  await db.session.updateMany({ where, data: { expiresAt: new Date(0) } });
  await check(
    "expiredSession401",
    async () =>
      (await context.request.get(base + "/api/v1/users/me")).status() === 401,
  );
  await check("expiredSessionCannotOpenStudentPage", async () => {
    await page.goto(base + "/app");
    return new URL(page.url()).pathname === "/connexion";
  });
} catch (error) {
  // Never output raw exceptions, input values, bodies, headers or service logs.
  report.failure = {
    stage,
    category: error instanceof Error ? error.name : "Unknown",
  };
} finally {
  password = undefined;
  if (context) await context.close().catch(() => {});
  if (browser) await browser.close().catch(() => {});
  if (proxy)
    await new Promise((done) => {
      proxy.close(done);
      proxy.closeAllConnections();
    });
  for (const child of children.reverse())
    if (child.exitCode === null) {
      // This process group was created by this runner; no pre-existing service.
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {}
      await Promise.race([
        new Promise((done) => child.once("exit", done)),
        new Promise((done) => setTimeout(done, 2000)),
      ]);
    }
  // Only this run's random fixture, only in the guarded test database.
  try {
    const owned = await db.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (owned) await db.user.delete({ where: { id: owned.id } });
    report.fixtureCleanup = "passed";
  } catch {
    report.fixtureCleanup = "error";
  }
  await db.$disconnect().catch(() => {});
  report.finishedAt = new Date().toISOString();
  report.success =
    !report.failure &&
    report.fixtureCleanup === "passed" &&
    Object.values(report.checks).every((value) => value === "passed") &&
    report.registration &&
    Object.values(report.registration).every((value) => value === "passed");
  if (!directory)
    directory = await mkdtemp(join(tmpdir(), "revynora-registration-report-"));
  await writeFile(
    join(directory, "report.json"),
    JSON.stringify(report, null, 2),
    { mode: 0o600 },
  );
  console.log(
    JSON.stringify({ report, artifactDirectory: directory }, null, 2),
  );
  process.exitCode = report.success ? 0 : 1;
}
