const { test } = require("node:test");
const assert = require("node:assert/strict");
const { sanitize } = require("./ci-playwright.cjs");
test("CI report discards bodies, headers, attachments, inputs and error messages", () => {
  const secret = "synthetic-value-never-export";
  const report = {
    errors: [{ message: secret }],
    suites: [
      {
        suites: [
          {
            specs: [
              {
                file: "test.spec.ts",
                line: 12,
                title: secret,
                tests: [
                  {
                    expectedStatus: "passed",
                    results: [
                      {
                        status: "failed",
                        duration: 10,
                        retry: 0,
                        error: {
                          name: "Error",
                          message: secret,
                          stack: secret,
                        },
                        stdout: [secret],
                        stderr: [secret],
                        attachments: [{ body: secret }],
                        headers: { cookie: secret },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
  const safe = sanitize(report);
  assert.ok(!JSON.stringify(safe).includes(secret));
  assert.equal(safe.tests[0].results[0].status, "failed");
  assert.equal(safe.globalErrors, 1);
});
test("CI report handles skipped tests and unknown values without trusting error labels", () => {
  const safe = sanitize({
    suites: [
      {
        specs: [
          {
            file: "/outside/spec.ts",
            tests: [
              {
                expectedStatus: "injected",
                results: [
                  { status: "skipped", error: { name: "private-value" } },
                ],
              },
            ],
          },
        ],
      },
    ],
  });
  assert.equal(safe.tests[0].file, "outside-workspace");
  assert.equal(safe.tests[0].expectedStatus, "unknown");
  assert.equal(safe.tests[0].results[0].errorCategory, "Error");
  assert.equal(safe.tests[0].results[0].status, "skipped");
});
