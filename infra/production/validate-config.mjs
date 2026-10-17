import { readFileSync } from "node:fs";
const file = process.argv[2];
if (!file) throw Error("Pass the private env file path.");
const lines = readFileSync(file, "utf8").split("\n");
const values = Object.fromEntries(
  lines
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).trim()];
    }),
);
for (const key of ["POSTGRES_PASSWORD", "REDIS_PASSWORD"])
  if (!/^[a-f0-9]{64,}$/i.test(values[key] ?? ""))
    throw Error(
      key +
        " must be a unique randomly generated hex secret, at least 32 bytes.",
    );
if (values.POSTGRES_PASSWORD === values.REDIS_PASSWORD)
  throw Error("Use different credentials for PostgreSQL and Redis.");
if (!/^\d+$/.test(values.REVYNORA_API_PORT ?? ""))
  throw Error("Choose a verified free local API port.");
console.log("Configuration shape verified; secret values are not printed.");
