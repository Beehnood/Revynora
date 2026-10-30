// A CI-only reporter boundary: raw browser reports stay in memory, never stdout.
const { spawn } = require("node:child_process");
const { createRequire } = require("node:module");
const { mkdirSync, writeFileSync } = require("node:fs");
const { resolve, relative, isAbsolute } = require("node:path");

function sanitize(report, cwd = process.cwd()) {
  const tests = [];
  const statuses = new Set([
    "passed",
    "failed",
    "timedOut",
    "skipped",
    "interrupted",
  ]);
  function visit(suite) {
    for (const spec of suite.specs ?? []) {
      const name = relative(cwd, resolve(cwd, spec.file ?? ""));
      const file =
        name.startsWith("..") || isAbsolute(name) ? "outside-workspace" : name;
      for (const test of spec.tests ?? [])
        tests.push({
          file,
          line: Number(spec.line) || 0,
          expectedStatus: statuses.has(test.expectedStatus)
            ? test.expectedStatus
            : "unknown",
          results: (test.results ?? []).map((result) => ({
            status: statuses.has(result.status) ? result.status : "unknown",
            duration: Number(result.duration) || 0,
            retry: Number(result.retry) || 0,
            errorCategory: result.error
              ? ["Error", "TimeoutError", "AssertionError"].includes(
                  result.error.name,
                )
                ? result.error.name
                : "Error"
              : null,
          })),
        });
    }
    for (const nested of suite.suites ?? []) visit(nested);
  }
  for (const suite of report.suites ?? []) visit(suite);
  return { tests, globalErrors: (report.errors ?? []).length };
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] !== "--report-dir" || !args[1] || args[2] !== "--")
    throw Error("Expected --report-dir DIRECTORY -- PLAYWRIGHT_ARGUMENTS");
  const directory = resolve(args[1]);
  const env = { ...process.env };
  for (const key of Object.keys(env))
    if (
      ["DEBUG", "PWDEBUG", "NODE_DEBUG"].includes(key) ||
      key.startsWith("PLAYWRIGHT_JSON_OUTPUT")
    )
      delete env[key];
  const web = resolve("apps/web");
  const cli = createRequire(resolve(web, "package.json")).resolve(
    "@playwright/test/cli",
  );
  const child = spawn(
    process.execPath,
    [cli, "test", ...args.slice(3), "--reporter=json", "--trace=off"],
    { cwd: web, env, stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "",
    size = 0;
  child.stdout.on("data", (chunk) => {
    size += chunk.length;
    if (size > 64 * 1024 * 1024) child.kill();
    else output += chunk.toString();
  });
  // Service errors and Playwright call logs can contain headers or form values.
  child.stderr.resume();
  const code = await new Promise((done, fail) => {
    child.once("error", fail);
    child.once("close", done);
  });
  let report;
  try {
    report = sanitize(JSON.parse(output));
  } catch {
    report = { tests: [], globalErrors: 1 };
  }
  const counts = {
    passed: 0,
    failed: 0,
    timedOut: 0,
    skipped: 0,
    interrupted: 0,
  };
  for (const test of report.tests) {
    const status = test.results.at(-1)?.status;
    if (Object.hasOwn(counts, status)) counts[status]++;
  }
  const success =
    code === 0 &&
    report.globalErrors === 0 &&
    report.tests.length > 0 &&
    counts.passed > 0;
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    resolve(directory, "summary.json"),
    JSON.stringify({ success, counts, ...report }, null, 2),
    { mode: 0o600 },
  );
  console.log(
    JSON.stringify({
      success,
      counts,
      report: relative(process.cwd(), resolve(directory, "summary.json")),
    }),
  );
  process.exitCode = success ? 0 : 1;
}
module.exports = { sanitize };
if (require.main === module)
  main().catch(() => {
    console.error(
      "Browser validation failed; inspect the filtered CI summary.",
    );
    process.exitCode = 1;
  });
