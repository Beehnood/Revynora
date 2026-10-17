import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
const baseline = JSON.parse(
  readFileSync(
    new URL("../docs/phase2.5/prisma-baseline.json", import.meta.url),
    "utf8",
  ),
);
for (const [file, hash] of Object.entries(baseline)) {
  const actual = createHash("sha256").update(readFileSync(file)).digest("hex");
  if (actual !== hash)
    throw new Error("Prisma altered during structural phase: " + file);
}
const directories = readdirSync("prisma/migrations", {
  withFileTypes: true,
}).filter((entry) => entry.isDirectory());
if (
  directories.length !==
  Object.keys(baseline).filter((name) => name.endsWith("/migration.sql")).length
)
  throw new Error("Unexpected migration added");
console.log(
  "Prisma schema and existing migrations are byte-for-byte unchanged from checkpoint.",
);
