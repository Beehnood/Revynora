const { createRequire } = require("node:module");
const { resolve } = require("node:path");
const { readFileSync, writeFileSync } = require("node:fs");
const req = createRequire(resolve("apps/web/package.json"));
const nextReq = createRequire(req.resolve("next/package.json"));
const sharp = nextReq("sharp");
(async () => {
  const directory = "apps/web/public/brand/";
  const mark = readFileSync(directory + "logo-mark.svg");
  for (const size of [16, 32, 48, 180])
    await sharp(mark)
      .resize(size, size)
      .png()
      .toFile(`${directory}favicon-${size}.png`);
  const app = readFileSync(directory + "app-icon.svg", "utf8");
  writeFileSync(
    directory + "app-icon-dark.svg",
    app
      .replace('fill="#f6f3ff"', 'fill="#3820c7"')
      .replace('stroke="#ded6ff"', 'stroke="#5237e8"')
      .replaceAll("#292d8e", "#ffffff")
      .replaceAll("#16144f", "#e2dcff")
      .replaceAll("#754fff", "#ffffff")
      .replaceAll("#473bff", "#b8a9ff"),
  );
  await sharp(Buffer.from(app))
    .resize(512, 512)
    .png()
    .toFile(directory + "app-icon-512.png");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
