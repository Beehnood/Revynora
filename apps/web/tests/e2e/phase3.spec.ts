import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { PrismaClient } from "@prisma/client";
for (const width of [320, 768, 1280])
  test(`Phase 3 : révision, examen, proposition IA et progression à ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const signup = await page.request.post("/api/v1/auth/register", {
      headers: { "X-Revynora-Client": "web" },
      data: {
        name: "Emma Phase Trois",
        email: "e2e-phase3-" + crypto.randomUUID() + "@example.test",
        password: "Phase3-E2E!2026",
        termsAccepted: true,
      },
    });
    expect(signup.status()).toBe(201);
    const user = await signup.json();
    const db = new PrismaClient({
      datasources: { db: { url: process.env.TEST_DATABASE_URL } },
    });
    try {
      const sub = await db.subscription.upsert({
        where: { code: "PRO" },
        create: { code: "PRO", name: "Pro", priceCents: 500 },
        update: {},
      });
      await db.userSubscriptionHistory.create({
        data: {
          userId: user.id,
          subscriptionId: sub.id,
          provider: "e2e-fixture",
          providerSubscriptionId: "fixture-" + crypto.randomUUID(),
          priceCents: 500,
          currency: "eur",
          status: "ACTIVE",
          startsAt: new Date(Date.now() - 1000),
          endsAt: new Date(Date.now() + 86400000),
        },
      });
    } finally {
      await db.$disconnect();
    }
    const courseResponse = await page.request.post("/api/v1/courses", {
      headers: { "X-Revynora-Client": "web" },
      data: {
        title: "Révisions des fractions",
        domain: "Mathématiques",
        content:
          "Addition et multiplication des fractions. Trouver le dénominateur commun.",
      },
    });
    expect(courseResponse.status()).toBe(201);
    const course = await courseResponse.json();
    // Persist a diagnostic through the real API to exercise a populated score chart.
    const headers = { "X-Revynora-Client": "web" };
    const generated = await page.request.post("/api/v1/quizzes/diagnostic", {
      headers,
      data: {
        domain: "Mathématiques",
        topic: "Les fractions",
        level: "Débutant",
      },
    });
    expect(generated.status()).toBe(201);
    const quiz = await generated.json();
    const attempt = await (
      await page.request.post("/api/v1/quizzes/" + quiz.id + "/attempts", {
        headers,
      })
    ).json();
    for (const question of quiz.questions)
      expect(
        (
          await page.request.put(
            "/api/v1/attempts/" + attempt.id + "/answers/" + question.id,
            { headers, data: { selectedOptionIds: [question.options[0].id] } },
          )
        ).ok(),
      ).toBe(true);
    const submitted = await page.request.post(
      "/api/v1/attempts/" + attempt.id + "/submit",
      { headers },
    );
    expect(submitted.ok()).toBe(true);
    await page.goto("/app/revisions");
    await page
      .getByLabel("Question", { exact: true })
      .fill("Combien font un demi et un demi ?");
    await page.getByLabel("Réponse", { exact: true }).fill("Une unité.");
    await page.getByLabel("Matière de la carte").selectOption(course.id);
    await page.getByRole("button", { name: "Créer la carte" }).click();
    await expect(page.getByText("Ma collection · 1 cartes")).toBeVisible();
    await page.getByRole("button", { name: "Commencer la révision" }).click();
    await page.getByRole("button", { name: "Afficher la réponse" }).click();
    await expect(page.getByRole("progressbar")).toBeVisible();
    await page.getByRole("button", { name: "Retenu (2)" }).click();
    await expect(page.getByText("Séance terminée !")).toBeVisible();
    await page.goto("/app/planning");
    const day = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    await page.getByLabel("À partir du").fill(day);
    await page.getByLabel("Matière ou objectif").fill("Examen de fractions");
    await page.getByLabel("Cours associé").selectOption(course.id);
    await page.getByLabel("Type de tâche").selectOption("EXAM");
    await page.getByLabel("Priorité", { exact: true }).selectOption("3");
    await page.getByLabel("Date et heure locale").fill(day + "T18:00");
    await page.getByRole("button", { name: "Ajouter au planning" }).click();
    await expect(
      page.getByRole("heading", { name: "Examen de fractions" }),
    ).toBeVisible();
    await page.getByLabel("Vue", { exact: true }).selectOption("list");
    await page.getByLabel("Filtrer par cours").selectOption(course.id);
    await page.getByRole("button", { name: "Modifier", exact: true }).click();
    await page.getByLabel("Matière ou objectif").fill("Examen final fractions");
    await page.getByRole("button", { name: "Enregistrer la séance" }).click();
    await expect(
      page.getByRole("heading", { name: "Examen final fractions" }),
    ).toBeVisible();
    await page.getByLabel("Début de disponibilité").fill(day + "T10:00");
    await page
      .getByRole("button", { name: "Ajouter une disponibilité" })
      .click();
    await expect(page.getByText("Disponibilités enregistrées.")).toBeVisible();
    await page.getByRole("button", { name: "Proposer un planning IA" }).click();
    await expect(
      page.getByRole("button", { name: "Confirmer ce planning" }),
    ).toBeVisible();
    await expect(page.getByText(/Simulation locale ·/)).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: `../../docs/phase3/planning-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Confirmer ce planning" }).click();
    await expect(
      page.getByText("Planning confirmé et enregistré."),
    ).toBeVisible();
    await page.goto("/app/progression");
    await expect(
      page.getByRole("heading", { name: "Ma progression", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Révisions Leitner réalisées")).toBeVisible();
    await page.getByLabel("Période d’activité").selectOption("monthly");
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `../../docs/phase3/progression-${width}.png`,
      fullPage: true,
    });
  });
