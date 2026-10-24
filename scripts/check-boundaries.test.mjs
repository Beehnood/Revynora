import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const script = fileURLToPath(
  new URL("./check-boundaries.mjs", import.meta.url),
);
function check(file, source) {
  const root = mkdtempSync(join(tmpdir(), "revynora-boundaries-"));
  try {
    for (const app of ["web", "api", "admin", "mobile"]) {
      mkdirSync(join(root, "apps", app), { recursive: true });
      writeFileSync(join(root, "apps", app, "package.json"), "{}");
    }
    mkdirSync(join(root, "packages", "api-client", "src"), { recursive: true });
    const destination = join(root, file);
    mkdirSync(join(destination, ".."), { recursive: true });
    writeFileSync(destination, source);
    return spawnSync(process.execPath, [script], {
      cwd: root,
      encoding: "utf8",
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
test("permet le module admin interne à l’API et les contrats partagés", () => {
  assert.equal(
    check(
      "apps/api/src/saas/example.ts",
      'import { A } from "../admin/domain/admin"; import type { B } from "@revynora/types";',
    ).status,
    0,
  );
});
test("refuse un import relatif traversant réellement deux applications", () => {
  const r = check(
    "apps/api/src/example.ts",
    'import { A } from "../../admin/components/admin-view";',
  );
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /imports another application/);
});
test("refuse une application importée depuis un package partagé", () => {
  assert.notEqual(
    check(
      "packages/api-client/src/example.ts",
      'import { A } from "../../../apps/api/src/admin/domain/admin";',
    ).status,
    0,
  );
});
test("refuse aussi les alias d’applications sans confondre api-client avec api", () => {
  assert.notEqual(
    check("apps/api/src/example.ts", 'import { A } from "@revynora/admin";')
      .status,
    0,
  );
  assert.equal(
    check("apps/admin/example.ts", 'import { A } from "@revynora/api-client";')
      .status,
    0,
  );
});
test("conserve l’interdiction des dépendances backend dans le client portable", () => {
  const r = check(
    "packages/api-client/src/example.ts",
    'import { A } from "@nestjs/common";',
  );
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /couples transport to a framework/);
});
