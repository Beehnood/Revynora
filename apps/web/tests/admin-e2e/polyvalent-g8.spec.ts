import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import AxeBuilder from "@axe-core/playwright";
const url = process.env.TEST_DATABASE_URL;
if (
  !url ||
  process.env.G8_ISOLATED_TEST_DB !== "true" ||
  new URL(url).pathname !== "/revynora_test" ||
  new URL(url).hostname !== "127.0.0.1"
)
  throw new Error("Base G8 isolée requise");
const db = new PrismaClient({ datasources: { db: { url } } });
const email = "g8-browser-" + crypto.randomUUID() + "@example.test";
const password = "G8-Browser-Fixture!42";
let id: string, grantId: string;
test.beforeAll(async ({ request }) => {
  const registered = await request.post(
    "http://127.0.0.1:3411/api/v1/auth/register",
    {
      headers: { Origin: "http://127.0.0.1:3412", "X-Revynora-Client": "web" },
      data: {
        name: "Propriétaire de recette",
        email,
        password,
        termsAccepted: true,
      },
    },
  );
  expect(registered.status()).toBe(201);
  id = (await registered.json()).id;
  await db.user.update({ where: { id }, data: { role: "ADMIN" } });
  const issued = await request.post(
    "http://127.0.0.1:3411/api/v1/admin/users/" + id + "/learning-grants",
    {
      headers: { Origin: "http://127.0.0.1:3412", "X-Revynora-Client": "web" },
      data: {
        startsAt: new Date(Date.now() - 1000).toISOString(),
        provenance: "BROWSER_TEST",
        justification: "Attribution temporaire de recette G8",
      },
    },
  );
  expect(issued.status()).toBe(201);
  grantId = (await issued.json()).id;
});
test.afterAll(async () => {
  if (id) {
    await db.auditLog.deleteMany({ where: { actorId: id } });
    await db.internalLearningGrant.deleteMany({ where: { userId: id } });
    await db.user.deleteMany({ where: { id } });
  }
  await db.$disconnect();
});
for (const width of [375, 768, 1440])
  test(`Identité ADMIN et apprentissage privé à ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/connexion");
    await page.getByLabel("Adresse e-mail").fill(email);
    await page.getByLabel("Mot de passe").fill(password);
    await page
      .getByRole("button", { name: "Me connecter", exact: true })
      .click();
    await expect(page).toHaveURL("http://127.0.0.1:3412/");
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: info.outputPath("admin.png"),
      fullPage: true,
    });
    if (width < 768)
      await page.getByRole("button", { name: "Ouvrir le menu" }).click();
    await page.getByRole("link", { name: "Mon espace pédagogique" }).click();
    await expect(page).toHaveURL("http://127.0.0.1:3410/app");
    const profile = await page.request.get(
      "http://127.0.0.1:3410/api/v1/users/me",
    );
    expect(await profile.json()).toMatchObject({
      id,
      role: "ADMIN",
      plan: "FREE",
    });
    await page.goto("http://127.0.0.1:3410/app/abonnement");
    await expect(
      page.getByRole("heading", { name: "Accès interne · équivalent Pro" }),
    ).toBeVisible();
    await expect(page.getByText(/ne constitue pas un achat/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /acheter|payer|changer d’offre/i }),
    ).toHaveCount(0);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath("acces-interne.png"),
      fullPage: true,
    });
    if (
      await page
        .getByRole("button", { name: "Ouvrir la navigation" })
        .isVisible()
    )
      await page.getByRole("button", { name: "Ouvrir la navigation" }).click();
    await page
      .getByRole("link", { name: "Administration", exact: true })
      .click();
    await expect(page).toHaveURL("http://127.0.0.1:3412/");
  });
test("révocation immédiatement réévaluée sans retrait du rôle ADMIN", async ({
  page,
}) => {
  const login = await page.request.post(
    "http://127.0.0.1:3411/api/v1/auth/login",
    {
      headers: { Origin: "http://127.0.0.1:3412", "X-Revynora-Client": "web" },
      data: { email, password },
    },
  );
  expect(login.status()).toBe(201);
  const revoke = await page.request.patch(
    "http://127.0.0.1:3411/api/v1/admin/learning-grants/" + grantId + "/revoke",
    {
      headers: { Origin: "http://127.0.0.1:3412", "X-Revynora-Client": "web" },
      data: { reason: "Fin de la recette navigateur G8" },
    },
  );
  expect(revoke.status()).toBe(200);
  await page.goto("http://127.0.0.1:3410/app");
  await expect(
    page.getByRole("heading", { name: "Accès pédagogique indisponible" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Revenir à l’administration" }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3412/");
});
