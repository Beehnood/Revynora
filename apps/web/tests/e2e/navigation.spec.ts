import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const password = "E2E-Revynora!2026";
async function capture(page: Page, name: string) {
  const width = page.viewportSize()?.width;
  if (width === 375 || width === 1280)
    await page.screenshot({
      path: `../../docs/phase1/${name}-${width}.png`,
      fullPage: true,
    });
}
async function signup(page: Page) {
  const email = `e2e-phase1-${crypto.randomUUID()}@example.test`;
  await page.goto("/inscription");
  await capture(page, "inscription");
  await page.getByLabel("Prénom").fill("Emma");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Créer mon compte gratuit", exact: true })
    .click();
  await expect(page).toHaveURL("/app");
  await expect(
    page.getByRole("heading", { name: "Bonjour Emma 👋" }),
  ).toBeVisible();
  return email;
}
async function audit(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(result.violations).toEqual([]);
}
for (const width of [320, 375, 768, 1280]) {
  test(`Pages publiques et auth à ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "/",
      "/connexion",
      "/inscription",
      "/admin",
      "/design-system",
    ]) {
      await page.goto(route);
      await expect(page.locator("h1")).toBeVisible();
      await audit(page);
    }
    await page.goto("/app");
    await expect(page).toHaveURL("/connexion");
  });
  test(`Parcours étudiant complet et accessible à ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const email = await signup(page);
    await audit(page);
    await capture(page, "dashboard-vide");
    await page
      .getByRole("link", { name: "Nouveau diagnostic", exact: true })
      .last()
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Un sujet. Cinq questions. Un déclic.",
      }),
    ).toBeVisible();
    await expect(
      page.getByText("Mode démonstration", { exact: true }),
    ).toBeVisible();
    await audit(page);
    await capture(page, "assistant");
    await page.getByRole("button", { name: "Lancer mon diagnostic" }).click();
    await expect(page).toHaveURL(/\/app\/tentatives\//);
    await expect(page.getByRole("group")).toHaveCount(5);
    await audit(page);
    await capture(page, "quiz");
    await page.getByRole("group").nth(0).getByRole("radio").first().check();
    await page.getByRole("group").nth(1).getByRole("radio").first().check();
    await page
      .getByRole("button", { name: "Enregistrer mes réponses" })
      .click();
    await expect(
      page.getByText("Tes réponses sont sauvegardées.", { exact: false }),
    ).toBeVisible();
    const draftUrl = page.url();
    await page.reload();
    await expect(page.getByRole("radio").first()).toBeChecked();
    for (const index of [2, 3, 4]) {
      const group = page.getByRole("group").nth(index);
      await group
        .getByRole(index === 3 ? "checkbox" : "radio")
        .first()
        .check();
    }
    await page
      .getByRole("button", { name: "Enregistrer mes réponses" })
      .click();
    await expect(
      page.getByText("5 / 5 sauvegardées", { exact: false }),
    ).toBeVisible();
    await page
      .getByRole("checkbox", {
        name: "J’ai vérifié mes cinq réponses",
        exact: false,
      })
      .check();
    await page
      .getByRole("button", { name: "Soumettre et voir ma correction" })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Chaque réponse t’apprend quelque chose.",
      }),
    ).toBeVisible();
    await expect(page.locator(".score-ring")).toContainText("80");
    await expect(
      page.getByRole("heading", { name: "Le mini-cours pour consolider" }),
    ).toBeVisible();
    await audit(page);
    if (width === 1280 || width === 375)
      await page.screenshot({
        path: `../../docs/phase1/resultat-${width}.png`,
        fullPage: true,
      });
    await page.goto("/app/historique");
    await expect(
      page.getByRole("link", { name: /Les cellules/ }),
    ).toBeVisible();
    await audit(page);
    await capture(page, "historique");
    await page.goto("/app/cours");
    await expect(
      page.getByRole("heading", { name: "Comprendre : Les cellules" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Mes cours", exact: true }).count();
    await audit(page);
    await page
      .getByRole("button", { name: "Créer un cours personnel" })
      .click();
    await page.getByLabel("Titre").fill("Mes notes de biologie");
    await page
      .getByLabel("Contenu du cours")
      .fill("Une cellule est délimitée par une membrane plasmique.");
    await page.getByRole("button", { name: "Enregistrer mon cours" }).click();
    await expect(
      page.getByRole("heading", { name: "Mes notes de biologie" }),
    ).toBeVisible();
    await capture(page, "cours");
    await page.goto("/app/profil");
    await expect(page.getByText(email, { exact: true })).toBeVisible();
    await audit(page);
    if (width < 1024)
      await page.getByRole("button", { name: "Ouvrir la navigation" }).click();
    await page.getByRole("button", { name: "Me déconnecter" }).click();
    await expect(page).toHaveURL("/connexion");
    await capture(page, "connexion");
    await page.getByLabel("Adresse e-mail").fill(email);
    await page.getByLabel("Mot de passe", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "Me connecter", exact: true })
      .click();
    await expect(page).toHaveURL("/app");
    await expect(page.getByText("80 %").first()).toBeVisible();
    await capture(page, "dashboard");
    await page.goto(draftUrl);
    await expect(page.locator(".score-ring")).toContainText("80");
  });
}
test("Validation, mots de passe masquables et navigation clavier", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Aller au contenu" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  await page.getByRole("link", { name: "La méthode", exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Ouvrir le menu" }),
  ).toBeFocused();
  await page.goto("/inscription");
  await page
    .getByRole("button", { name: "Créer mon compte gratuit", exact: true })
    .click();
  await expect(page.getByLabel("Prénom")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Afficher le mot de passe" }).click();
  await expect(
    page.getByLabel("Mot de passe", { exact: true }),
  ).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Masquer le mot de passe" }).click();
  await expect(
    page.getByLabel("Mot de passe", { exact: true }),
  ).toHaveAttribute("type", "password");
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill("missing@example.test");
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Me connecter", exact: true }).click();
  await expect(page.locator(".alert[role=alert]")).toHaveText(
    "E-mail ou mot de passe incorrect.",
  );
});
test("Erreur IA visible puis reprise et dashboard en panne sans faux chiffre", async ({
  page,
}) => {
  await signup(page);
  await page.goto("/app/diagnostic");
  await page.route("**/api/v1/quizzes/diagnostic", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        code: "AI_UNAVAILABLE",
        message: "La génération a échoué. Réessayez.",
      }),
    }),
  );
  await page.getByRole("button", { name: "Lancer mon diagnostic" }).click();
  await expect(page.locator(".alert[role=alert]")).toContainText(
    "La génération a échoué",
  );
  await expect(
    page.getByRole("button", { name: "Lancer mon diagnostic" }),
  ).toBeEnabled();
  await page.unroute("**/api/v1/quizzes/diagnostic");
  await page.getByRole("button", { name: "Lancer mon diagnostic" }).click();
  await expect(page).toHaveURL(/\/app\/tentatives\//);
  await page.route("**/api/v1/learning/summary", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        code: "UNAVAILABLE",
        message: "Service temporairement indisponible.",
      }),
    }),
  );
  await page.goto("/app");
  await expect(page.locator(".alert[role=alert]")).toContainText(
    "Service temporairement indisponible",
  );
  await expect(page.locator(".stat-card")).toHaveCount(0);
  await page.unroute("**/api/v1/learning/summary");
  await page.getByRole("button", { name: "Réessayer" }).click();
  await expect(page.getByText("Tests terminés", { exact: true })).toBeVisible();
});
test("Historique paginé et quiz sans solution sur le réseau", async ({
  page,
}) => {
  await signup(page);
  const headers = { "X-Revynora-Client": "web" };
  const q = await page.request.post("/api/v1/quizzes/diagnostic", {
    headers,
    data: {
      domain: "Mathématiques",
      topic: "Les fractions",
      level: "Débutant",
    },
  });
  const quiz = await q.json();
  expect(quiz.questions).toHaveLength(5);
  expect(JSON.stringify(quiz)).not.toMatch(/correct|explanation|miniCourse/);
  for (let i = 0; i < 6; i++) {
    const a = await page.request.post(`/api/v1/quizzes/${quiz.id}/attempts`, {
      headers,
    });
    const { id } = await a.json();
    if (i === 5) break;
    for (const question of quiz.questions)
      await page.request.put(`/api/v1/attempts/${id}/answers/${question.id}`, {
        headers,
        data: { selectedOptionIds: [question.options[0].id] },
      });
    expect(
      (
        await page.request.post(`/api/v1/attempts/${id}/submit`, { headers })
      ).status(),
    ).toBe(201);
  }
  await page.goto("/app/historique");
  await expect(page.getByText("Page 1 sur 2", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Suivant", exact: true }).click();
  await expect(page.getByText("Page 2 sur 2", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: /Les fractions/ })).toHaveCount(
    1,
  );
});
