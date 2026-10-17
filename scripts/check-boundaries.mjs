import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    [
      "node_modules",
      ".next",
      "dist",
      "coverage",
      ".expo",
      "test-results",
      "playwright-report",
    ].includes(e.name)
      ? []
      : e.isDirectory()
        ? walk(join(dir, e.name))
        : [join(dir, e.name)],
  );
}
const errors = [];
for (const file of [...walk("apps"), ...walk("packages")].filter((f) =>
  /\.[cm]?[jt]sx?$/.test(f),
)) {
  const code = readFileSync(file, "utf8");
  for (const match of code.matchAll(
    /(?:from\s*|import\s*\(|require\s*\()\s*['"]([^'"]+)['"]/g,
  )) {
    const target = match[1];
    if (
      /(?:\.\.\/)+(?:apps\/)?(?:web|admin|api|mobile)\//.test(target) ||
      /apps\/(web|api|admin|mobile)\//.test(target)
    )
      errors.push(file + " imports another application: " + target);
    if (
      file.startsWith("packages/api-client/") &&
      /^(next|react|react-native|@nestjs|@prisma)/.test(target)
    )
      errors.push(file + " couples transport to a framework: " + target);
  }
}
for (const app of ["web", "api", "admin", "mobile"]) {
  const p = JSON.parse(readFileSync(`apps/${app}/package.json`));
  for (const dep of Object.keys({ ...p.dependencies, ...p.devDependencies }))
    if (/^@revynora\/(web|api|admin|mobile)$/.test(dep))
      errors.push(app + " depends on another application: " + dep);
}
if (errors.length) throw new Error(errors.join("\n"));
console.log(
  "Four independent application workspaces; API client has no UI/backend framework dependency.",
);
