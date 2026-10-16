import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { PrismaClient } from "@prisma/client";
const password = "E2E-Phase2!2026";
test.beforeAll(async () => {
  const db = new PrismaClient({
    datasources: { db: { url: process.env.TEST_DATABASE_URL } },
  });
  try {
    for (const [code, priceCents] of [
      ["FREE", 0],
      ["PLUS", 250],
      ["PRO", 500],
    ] as const)
      await db.subscription.upsert({
        where: { code },
        create: { code, name: code, priceCents },
        update: {},
      });
  } finally {
    await db.$disconnect();
  }
});
for (const width of [375, 1280])
  test(`Abonnement Pro, Leitner, planning et consentement à ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const email = "e2e-phase2-" + crypto.randomUUID() + "@example.test";
    const signup = await page.request.post("/api/v1/auth/register", {
      headers: { "X-Revynora-Client": "web" },
      data: { name: "Emma", email, password, termsAccepted: true },
    });
    expect(signup.status()).toBe(201);
    await page.goto("/app/revisions");
    await expect(
      page.getByRole("alert").filter({ hasText: "Plus" }),
    ).toContainText("Plus");
    await page.goto("/admin");
    await expect(page).toHaveURL("/app");
    await page.goto("/app/abonnement");
    await page.getByRole("button", { name: "Choisir Pro" }).click();
    await expect(
      page.getByRole("heading", { name: "Confirmer la simulation" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Simuler un paiement accepté" })
      .click();
    await expect(page.getByText("Ton offre actuelle")).toBeVisible();
    await expect(page.getByRole("button", { name: /Résilier/ })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `../../docs/phase2/abonnement-${width}.png`,
      fullPage: true,
    });
    await page.goto("/app/revisions");
    await page
      .getByLabel("Question", { exact: true })
      .fill("Quelle est la capitale de la France ?");
    await page.getByLabel("Réponse", { exact: true }).fill("Paris.");
    await page.getByRole("button", { name: "Créer la carte" }).click();
    await expect(page.getByText("Ma collection · 1 cartes")).toBeVisible();
    await page.getByRole("button", { name: "Commencer la révision" }).click();
    await page.getByRole("button", { name: "Afficher la réponse" }).click();
    await expect(page.getByText("Paris.", { exact: true })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `../../docs/phase2/leitner-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Retenu (2)" }).click();
    await expect(page.getByText("Séance terminée !")).toBeVisible();
    await page.goto("/app/planning");
    const day = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    await page.getByLabel("Matière ou objectif").fill("Réviser les dérivées");
    await page.getByLabel("Date et heure locale").fill(day + "T10:00");
    await page.getByLabel(/Prévoir un rappel/).check();
    await page.getByRole("button", { name: "Ajouter au planning" }).click();
    await expect(page.getByText(/Séance ajoutée/)).toBeVisible();
    await page.getByLabel("À partir du").fill(day);
    await expect(
      page.getByRole("heading", { name: "Réviser les dérivées" }),
    ).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `../../docs/phase2/planning-${width}.png`,
      fullPage: true,
    });
    await page.goto("/app/notifications");
    await expect(page.getByRole("checkbox")).not.toBeChecked();
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "Enregistrer mes préférences" })
      .click();
    await expect(page.getByText(/Préférences enregistrées/)).toBeVisible();
    for (const route of [
      "/app/abonnement",
      "/app/revisions",
      "/app/planning",
      "/app/notifications",
      "/app/profil",
    ]) {
      await page.goto(route);
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator(".skeleton")).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
    }
    const exp = await page.request.get("/api/v1/privacy/export");
    expect(exp.ok()).toBe(true);
    expect(JSON.stringify(await exp.json())).not.toContain("passwordHash");
  });
test("Refus de paiement, Free et administration protégée", async ({ page }) => {
  const email = "e2e-phase2-" + crypto.randomUUID() + "@example.test";
  const signup = await page.request.post("/api/v1/auth/register", {
    headers: { "X-Revynora-Client": "web" },
    data: { name: "Alex", email, password, termsAccepted: true },
  });
  const user = await signup.json();
  await page.goto("/app/abonnement");
  await page.getByRole("button", { name: "Choisir Plus" }).click();
  await page.getByRole("button", { name: "Simuler un refus" }).click();
  await expect(
    page.getByRole("button", { name: "Choisir Plus" }),
  ).toBeEnabled();
  expect((await page.request.get("/api/v1/leitner/cards")).status()).toBe(403);
  expect((await page.request.get("/api/v1/admin/metrics")).status()).toBe(403);
  const db = new PrismaClient({
    datasources: { db: { url: process.env.TEST_DATABASE_URL } },
  });
  try {
    await db.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Administration", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Catalogue des offres" }),
    ).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: "../../docs/phase2/admin-1280.png",
      fullPage: true,
    });
    expect(
      (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
        .violations,
    ).toEqual([]);
  } finally {
    await db.$disconnect();
  }
});
