import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const baseline = JSON.parse(
  readFileSync(
    new URL("../docs/phase2.5/prisma-baseline.json", import.meta.url),
    "utf8",
  ),
);
for (const [file, hash] of Object.entries(baseline)) {
  if (file == "prisma/schema.prisma") continue;
  const actual = createHash("sha256").update(readFileSync(file)).digest("hex");
  if (actual !== hash)
    throw new Error("Prisma altered during structural phase: " + file);
}
console.log(
  "Historical migrations and seed preserved; additive schema evolution allowed after Phase 2.5.",
);
