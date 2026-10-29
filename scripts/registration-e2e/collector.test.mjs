import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { collectRegistration } from "./collector.mjs";

function fixture() {
  return {
    status: 201,
    contentType: "application/json; charset=utf-8",
    readJson: async () => ({ role: "STUDENT", plan: "FREE" }),
    cookies: async () => [
      {
        name: "revynora_session",
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
        path: "/",
      },
    ],
    profile: async () => ({
      status: 200,
      belongsToFixture: true,
      role: "STUDENT",
      plan: "FREE",
    }),
    studentPage: async () => true,
    https: true,
  };
}
test("JSON failure does not skip cookies, session, role, plan or page", async () => {
  const input = fixture();
  input.readJson = async () => {
    throw new Error("simulated body failure");
  };
  const result = await collectRegistration(input);
  assert.equal(result.jsonBody, "error");
  assert.equal(Object.keys(result).length, 11);
  assert.ok(
    Object.entries(result)
      .filter(([name]) => name !== "jsonBody")
      .every(([, value]) => value === "passed"),
  );
});
test("HTTP localhost is never accepted as proof of HTTPS Secure", async () => {
  const result = await collectRegistration({ ...fixture(), https: false });
  assert.equal(result.secureOverHttps, "failed");
});
test("failed profile and cookies do not skip later checks or leak values", async () => {
  const input = fixture();
  input.cookies = async () => {
    throw new Error("private cookie details must not escape");
  };
  input.profile = async () => {
    throw new Error("private profile details must not escape");
  };
  const result = await collectRegistration(input);
  assert.equal(result.httpOnly, "error");
  assert.equal(result.authenticatedSession, "error");
  assert.equal(result.studentPage, "passed");
  assert.ok(
    Object.values(result).every((v) =>
      ["passed", "failed", "error"].includes(v),
    ),
  );
});
test("bad status, media type, sensitive JSON and expired profile are rejected", async () => {
  const input = fixture();
  input.status = 503;
  input.contentType = "text/plain";
  input.readJson = async () => ({ password: "synthetic forbidden field" });
  input.profile = async () => ({ status: 401 });
  const result = await collectRegistration(input);
  for (const key of [
    "http201",
    "jsonContentType",
    "jsonBody",
    "authenticatedSession",
    "studentRole",
    "freePlan",
  ])
    assert.equal(result[key], "failed");
});
test("missing session cookie fails each attribute independently", async () => {
  const result = await collectRegistration({
    ...fixture(),
    cookies: async () => [],
  });
  for (const name of [
    "httpOnly",
    "secureOverHttps",
    "sameSiteLax",
    "cookiePath",
  ])
    assert.equal(result[name], "failed");
  assert.equal(result.studentPage, "passed");
});
test("runner rejects unconfirmed, remote, application and malformed database URLs before any IO", () => {
  for (const [flag, url] of [
    ["false", "postgresql://synthetic:synthetic@127.0.0.1:55439/revynora_test"],
    [
      "true",
      "postgresql://synthetic:synthetic@production.invalid/revynora_test",
    ],
    ["true", "postgresql://synthetic:synthetic@127.0.0.1:55439/revynora"],
    ["true", "invalid-synthetic-secret"],
  ]) {
    const result = spawnSync(
      process.execPath,
      [fileURLToPath(new URL("./run.mjs", import.meta.url))],
      {
        env: {
          ...process.env,
          TEST_DATABASE_URL: url,
          REGISTRATION_E2E_ISOLATED: flag,
        },
        encoding: "utf8",
      },
    );
    assert.notEqual(result.status, 0);
    assert.ok(
      result.stderr.includes(
        "Explicit isolated loopback revynora_test database required",
      ),
    );
    assert.ok(!result.stderr.includes("synthetic"));
  }
});
