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
const password = "G2-Browser-Fixture!42";
const run = crypto.randomUUID();
let adminEmail: string, studentEmail: string, studentId: string;
test.beforeAll(async ({ request }) => {
  for (const role of ["ADMIN", "STUDENT"] as const) {
    const email = `g2-browser-${run}-${role.toLowerCase()}@example.test`;
    const r = await request.post("http://127.0.0.1:3411/api/v1/auth/register", {
      headers: { Origin: "http://127.0.0.1:3412", "X-Revynora-Client": "web" },
      data: {
        name: "Recette G2 " + role,
        email,
        password,
        termsAccepted: true,
      },
    });
    expect(r.status()).toBe(201);
    const user = await r.json();
    ids.push(user.id);
    if (role === "ADMIN") {
      await db.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
      adminEmail = email;
    } else {
      studentEmail = email;
      studentId = user.id;
    }
  }
});
test.afterAll(async () => {
  await db.auditLog.deleteMany({
    where: { OR: [{ actorId: { in: ids } }, { targetUserId: { in: ids } }] },
  });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});
for (const width of [320, 768, 1280])
  test(`Admin trois routes, clavier et confirmation à ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/connexion");
    await page.getByLabel("Adresse e-mail").fill(adminEmail);
    await page.getByLabel("Mot de passe").fill(password);
    await page
      .getByRole("button", { name: "Me connecter", exact: true })
      .click();
    await expect(page).toHaveURL("http://127.0.0.1:3412/");
    await expect(
      page.getByRole("heading", { name: "Administration", exact: true }),
    ).toBeVisible();
    if (width < 768) {
      const toggle = page.locator(".admin-menu-toggle");
      await toggle.focus();
      await page.keyboard.press("Enter");
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Escape");
      await expect(toggle).toBeFocused();
      await toggle.click();
    }
    await page.getByRole("link", { name: "Utilisateurs", exact: true }).click();
    await expect(page).toHaveURL(/\/utilisateurs$/);
    await page.getByLabel("Rechercher par nom ou e-mail").fill(studentEmail);
    await page
      .getByRole("link", { name: "Recette G2 STUDENT", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(studentId + "$"));
    await expect(
      page.getByRole("heading", { name: "Fiche utilisateur" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Suspendre", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Confirmer la suspension" }),
    ).toBeDisabled();
    await page.getByLabel("Motif obligatoire").selectOption("SECURITY_REVIEW");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Confirmer la suspension" }).click();
    await expect(
      page.getByRole("button", { name: "Réactiver", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Réactiver", exact: true }).click();
    await page.getByLabel("Motif obligatoire").selectOption("REVIEW_COMPLETED");
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "Confirmer la réactivation" })
      .click();
    await expect(
      page.getByRole("button", { name: "Suspendre", exact: true }),
    ).toBeVisible();
    for (const path of ["/", "/utilisateurs", "/utilisateurs/" + studentId]) {
      await page.goto(path);
      await expect(page.locator("main h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const a = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(a.violations).toEqual([]);
      await page.screenshot({
        path: info.outputPath(
          path === "/"
            ? "overview.png"
            : path === "/utilisateurs"
              ? "users.png"
              : "detail.png",
        ),
        fullPage: true,
      });
    }
  });
test("routes refusées aux anonymes et étudiants, backend protégé", async ({
  page,
  request,
}) => {
  for (const path of ["/", "/utilisateurs", "/utilisateurs/" + studentId]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/connexion$/);
  }
  await page.getByLabel("Adresse e-mail").fill(studentEmail);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Me connecter", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "droits administrateur" }),
  ).toContainText("droits administrateur");
  for (const path of ["/", "/utilisateurs", "/utilisateurs/" + studentId]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Accès administrateur requis" }),
    ).toBeVisible();
  }
  expect(
    (await page.request.get("/api/v1/admin/users/" + studentId)).status(),
  ).toBe(403);
  expect(
    (
      await request.get("http://127.0.0.1:3411/api/v1/admin/users/" + studentId)
    ).status(),
  ).toBe(401);
});
