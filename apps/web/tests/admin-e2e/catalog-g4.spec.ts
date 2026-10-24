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
const courses = Array.from({ length: 22 }, () => crypto.randomUUID());
const run = crypto.randomUUID();
const password = "G4-Browser-Fixture!42";
const adminEmail = "g4-browser-admin-" + run + "@example.test",
  studentEmail = "g4-browser-student-" + run + "@example.test";
const title = "G4 Catalogue " + run;
test.beforeAll(async ({ request }) => {
  for (const [email, role] of [
    [adminEmail, "ADMIN"],
    [studentEmail, "STUDENT"],
  ] as const) {
    const r = await request.post("http://127.0.0.1:3411/api/v1/auth/register", {
      headers: { Origin: "http://127.0.0.1:3412", "X-Revynora-Client": "web" },
      data: { name: "Recette G4", email, password, termsAccepted: true },
    });
    expect(r.status()).toBe(201);
    const user = await r.json();
    ids.push(user.id);
    if (role === "ADMIN")
      await db.user.update({ where: { id: user.id }, data: { role } });
  }
  await db.course.createMany({
    data: [
      ...courses.slice(0, 21).map((id, i) => ({
        id,
        title: title + " " + i.toString().padStart(2, "0"),
        domain: "Sciences",
        source: "ADMIN" as const,
        ownerId: null,
        content:
          "<script>window.g4Injected=true</script>\nContenu éditorial partagé.",
      })),
      {
        id: courses[21]!,
        title: title + " Privé",
        domain: "Sciences",
        source: "USER",
        ownerId: ids[1]!,
        content: "NE PAS EXPOSER CE CONTENU PRIVÉ",
      },
    ],
  });
});
test.afterAll(async () => {
  await db.course.deleteMany({ where: { id: { in: courses } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});
for (const width of [320, 768, 1280])
  test(`Catalogue sécurisé à ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/connexion");
    await page.getByLabel("Adresse e-mail").fill(adminEmail);
    await page.getByLabel("Mot de passe").fill(password);
    await page
      .getByRole("button", { name: "Me connecter", exact: true })
      .click();
    await expect(page).toHaveURL("http://127.0.0.1:3412/");
    if (width < 768)
      await page.getByRole("button", { name: "Ouvrir le menu" }).click();
    await page.getByRole("link", { name: "Cours", exact: true }).click();
    await expect(page).toHaveURL(/\/cours$/);
    if (width >= 768)
      await expect(
        page.getByRole("link", { name: "Cours", exact: true }),
      ).toHaveAttribute("aria-current", "page");
    await page.getByLabel("Rechercher par titre ou matière").fill(title);
    await page.getByRole("button", { name: "Rechercher les cours" }).click();
    await expect(page.getByRole("status")).toContainText("21 cours");
    await page.getByRole("button", { name: "Cours suivants" }).click();
    await expect(
      page.getByText("Page 2 · 20 cours maximum", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Cours suivants" }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Cours précédents" }).click();
    await expect(page.getByText(title + " Privé", { exact: true })).toHaveCount(
      0,
    );
    const link = page.getByRole("link", { name: title + " 00", exact: true }); // locate a deterministic fixture via a narrower search
    await page
      .getByLabel("Rechercher par titre ou matière")
      .fill(title + " 00");
    await page.getByRole("button", { name: "Rechercher les cours" }).click();
    await link.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { name: "Fiche du cours" }),
    ).toBeVisible();
    await expect(page.getByText(/window.g4Injected=true/)).toBeVisible();
    expect(await page.evaluate(() => "g4Injected" in window)).toBe(false);
    await expect(
      page.getByRole("button", { name: /publier|supprimer|modifier/i }),
    ).toHaveCount(0);
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
      path: info.outputPath("catalog-detail.png"),
      fullPage: true,
    });
    await page.getByRole("link", { name: "Retour aux cours" }).click();
    await expect(
      page.getByLabel("Rechercher par titre ou matière"),
    ).toBeVisible();
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
      path: info.outputPath("catalog-list.png"),
      fullPage: true,
    });
    await page
      .getByLabel("Rechercher par titre ou matière")
      .fill("missing-" + run);
    await page.getByRole("button", { name: "Rechercher les cours" }).click();
    await expect(
      page.getByText("Aucun cours du catalogue trouvé."),
    ).toBeVisible();
    await page.route("**/api/v1/admin/catalog/courses?**", (r) =>
      r.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "Catalogue indisponible" }),
      }),
    );
    await page.reload();
    await expect(
      page.getByRole("alert").filter({ hasText: "Catalogue indisponible" }),
    ).toBeVisible();
    await page.unroute("**/api/v1/admin/catalog/courses?**");
    await page.getByRole("button", { name: "Réessayer le catalogue" }).click();
    await expect(
      page.getByRole("button", { name: "Réessayer le catalogue" }),
    ).toHaveCount(0);
    await page.goto("/cours/" + courses[21]);
    await expect(
      page.getByRole("alert").filter({ hasText: "Ressource introuvable" }),
    ).toBeVisible();
    await expect(page.getByText("NE PAS EXPOSER CE CONTENU PRIVÉ")).toHaveCount(
      0,
    );
  });
test("SSR et API catalogue refusent anonyme/STUDENT", async ({
  page,
  request,
}) => {
  for (const path of ["/cours", "/cours/" + courses[0]]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/connexion$/);
  }
  expect(
    (
      await request.get("http://127.0.0.1:3411/api/v1/admin/catalog/courses")
    ).status(),
  ).toBe(401);
  await page.getByLabel("Adresse e-mail").fill(studentEmail);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Me connecter", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "droits administrateur" }),
  ).toBeVisible();
  for (const path of ["/cours", "/cours/" + courses[0]]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Accès administrateur requis" }),
    ).toBeVisible();
  }
  expect(
    (await page.request.get("/api/v1/admin/catalog/courses")).status(),
  ).toBe(403);
  expect(
    (
      await page.request.get("/api/v1/admin/catalog/courses/" + courses[0])
    ).status(),
  ).toBe(403);
});
