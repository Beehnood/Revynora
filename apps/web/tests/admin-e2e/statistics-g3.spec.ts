import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import AxeBuilder from "@axe-core/playwright";
const url = process.env.TEST_DATABASE_URL!;
if (
  new URL(url).pathname !== "/revynora_test" ||
  !["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname)
)
  throw new Error("Local test database required");
const db = new PrismaClient({ datasources: { db: { url } } });
const ids: string[] = [];
const password = "G3-Browser-Fixture!42";
const email = "g3-browser-" + crypto.randomUUID() + "@example.test";
test.beforeAll(async ({ request }) => {
  const r = await request.post("http://127.0.0.1:3411/api/v1/auth/register", {
    headers: { Origin: "http://127.0.0.1:3412", "X-Revynora-Client": "web" },
    data: { name: "Recette G3", email, password, termsAccepted: true },
  });
  expect(r.status()).toBe(201);
  const u = await r.json();
  ids.push(u.id);
  await db.user.update({
    where: { id: u.id },
    data: { role: "ADMIN", createdAt: new Date("2053-01-01") },
  });
  await db.aIUsage.create({
    data: {
      userId: u.id,
      provider: "openai",
      status: "SUCCESS",
      estimatedCostUsd: "0.00012345",
      inputTokens: 100,
      outputTokens: 5,
      createdAt: new Date("2053-01-02"),
    },
  });
  await db.payment.create({
    data: {
      userId: u.id,
      provider: "stripe",
      providerReference: crypto.randomUUID(),
      currency: "usd",
      amountCents: 700,
      status: "PAID",
      createdAt: new Date("2053-01-02"),
    },
  });
});
test.afterAll(async () => {
  await db.payment.deleteMany({ where: { userId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});
for (const width of [320, 768, 1280])
  test(`Statistiques et alternative accessible à ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/connexion");
    await page.getByLabel("Adresse e-mail").fill(email);
    await page.getByLabel("Mot de passe").fill(password);
    await page
      .getByRole("button", { name: "Me connecter", exact: true })
      .click();
    await expect(page).toHaveURL("http://127.0.0.1:3412/");
    await page.getByLabel("Du").fill("2053-01-01");
    await page.getByLabel("Au (exclu)").fill("2053-01-04");
    await page.getByRole("button", { name: "Appliquer la période" }).click();
    await expect(
      page.getByRole("img", { name: "Inscriptions quotidiennes", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("0.00012345", { exact: true })).toBeVisible();
    await expect(
      page.getByText("700 unités stockées (échelle non vérifiée) USD", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText("Non vérifiable (test/réel)", { exact: true }),
    ).toBeVisible();
    await page
      .getByText("Tableau des inscriptions quotidiennes", { exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("table", { name: "Inscriptions par date UTC" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: info.outputPath("statistics.png"),
      fullPage: true,
    });
    await page.getByLabel("Du").fill("2054-01-01");
    await page.getByLabel("Au (exclu)").fill("2054-01-02");
    await page.getByRole("button", { name: "Appliquer la période" }).click();
    await expect(
      page.getByText("Aucune inscription sur cette période.", { exact: true }),
    ).toBeVisible();
    await page.route("**/api/v1/admin/statistics?**", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Statistiques temporairement indisponibles",
        }),
      }),
    );
    await page.reload();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Statistiques temporairement indisponibles" }),
    ).toBeVisible();
    await page.unroute("**/api/v1/admin/statistics?**");
    await page
      .getByRole("button", { name: "Réessayer les statistiques" })
      .click();
    await expect(
      page.getByRole("button", { name: "Réessayer les statistiques" }),
    ).toHaveCount(0);
  });
