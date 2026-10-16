// Run while the local Web server is running; uses the installed Playwright browser.
const { createRequire } = require("node:module");
const { resolve } = require("node:path");
const req = createRequire(resolve("apps/web/package.json"));
const { chromium, expect } = req("@playwright/test");
(async () => {
  const browser = await chromium.launch();
  try {
    for (const [name, route] of [
      ["landing", "/"],
      ["inscription", "/inscription"],
      ["admin", "/admin"],
    ]) {
      for (const [size, width] of [
        ["desktop", 1280],
        ["mobile", 375],
      ]) {
        const page = await browser.newPage({
          viewport: { width, height: 900 },
        });
        await page.goto(`http://127.0.0.1:3000${route}`);
        await page.screenshot({
          path: `docs/ui/${name}-${size}.png`,
          fullPage: true,
        });
        await page.close();
      }
    }
    const page = await browser.newPage({
      viewport: { width: 375, height: 812 },
    });
    await page.goto("http://127.0.0.1:3000");
    await page.getByRole("button", { name: "Ouvrir le menu" }).click();
    await expect(
      page.getByRole("button", { name: "Fermer le menu" }),
    ).toHaveAttribute("aria-expanded", "true");
    await page.goto("http://127.0.0.1:3000/design-system");
    await page.getByRole("button", { name: "Tester le formulaire" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "2 caractères" }),
    ).toBeVisible();
    console.log("Captures et interactions de développement : OK");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
