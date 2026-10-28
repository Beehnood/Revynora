import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomBytes, randomUUID, scryptSync } from "node:crypto";
const db = new PrismaClient({
  datasources: { db: { url: process.env.TEST_DATABASE_URL } },
});
const ids: string[] = [];
const courseIds: string[] = [];
// Same persisted password format as AuthService; no application account is reused.
function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return (
    "scrypt-v1:" +
    salt +
    ":" +
    scryptSync(password, salt, 64, {
      N: 32768,
      r: 8,
      p: 3,
      maxmem: 64 * 1024 * 1024,
    }).toString("hex")
  );
}
async function account(role: "ADMIN" | "STUDENT") {
  const id = randomUUID(),
    email = `admin-foundation-${id}@example.test`;
  const password = randomBytes(24).toString("base64url") + "!aA1";
  await db.user.create({
    data: {
      id,
      email,
      name: "Isolated foundation fixture",
      role,
      passwordHash: passwordHash(password),
      termsAcceptedAt: new Date(),
    },
  });
  ids.push(id);
  return { id, email, password };
}
test.afterAll(async () => {
  try {
    await db.course.deleteMany({ where: { id: { in: courseIds } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
  } finally {
    await db.$disconnect();
  }
});
test("sans session : connexion avec retour Admin", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL("/connexion?retour=%2Fadmin");
  await expect(
    page.getByRole("heading", { name: "Me connecter" }),
  ).toBeVisible();
});
test("connexion ADMIN : cookie HttpOnly, accueil intégré et aucun droit G8/G9 automatique", async ({
  page,
  context,
}) => {
  const user = await account("ADMIN");
  await page.goto("/admin");
  await page.getByLabel("Adresse e-mail").fill(user.email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Me connecter" }).click();
  await expect(page).toHaveURL("/admin");
  await expect(
    page.getByRole("heading", { name: "Administration", exact: true }),
  ).toBeVisible();
  const cookie = (await context.cookies()).find(
    (c) => c.name === "revynora_session",
  );
  expect(cookie).toMatchObject({
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    domain: "127.0.0.1",
  });
  expect(await page.evaluate(() => document.cookie)).not.toContain(
    "revynora_session",
  );
  expect(
    await db.internalLearningGrant.count({ where: { userId: user.id } }),
  ).toBe(0);
  expect(
    await db.commercialPermission.count({ where: { userId: user.id } }),
  ).toBe(0);
  expect(
    (await page.request.get("/api/v1/admin/commercial/offers")).status(),
  ).toBe(403);
  await page.getByRole("link", { name: "Mon espace pédagogique" }).click();
  await expect(
    page.getByRole("heading", { name: "Accès pédagogique indisponible" }),
  ).toBeVisible();
});
for (const mode of ["student", "expired", "suspended"] as const)
  test(`refus réel ${mode} avant rendu Admin`, async ({ page }) => {
    const user = await account(mode === "student" ? "STUDENT" : "ADMIN");
    const login = await page.request.post("/api/v1/auth/login", {
      headers: { "X-Revynora-Client": "web", Origin: "http://127.0.0.1:3450" },
      data: { email: user.email, password: user.password },
    });
    expect(login.ok()).toBe(true);
    if (mode === "expired")
      await db.session.updateMany({
        where: { userId: user.id },
        data: { expiresAt: new Date(0) },
      });
    if (mode === "suspended")
      await db.user.update({
        where: { id: user.id },
        data: { disabledAt: new Date() },
      });
    await page.goto("/admin");
    await expect(page).toHaveURL(
      mode === "student" ? "/app" : "/connexion?retour=%2Fadmin",
    );
    await expect(
      page.getByRole("heading", { name: "Administration", exact: true }),
    ).toHaveCount(0);
  });

for (const width of [375, 768, 1280])
  test(`accueil G3/G5, navigation, responsive et Axe à ${width}px`, async ({
    page,
  }) => {
    const user = await account("ADMIN");
    await page.setViewportSize({ width, height: 1000 });
    const login = await page.request.post("/api/v1/auth/login", {
      headers: { "X-Revynora-Client": "web", Origin: "http://127.0.0.1:3450" },
      data: { email: user.email, password: user.password },
    });
    expect(login.ok()).toBe(true);
    // The SSR check and aggregate endpoint permissions use the real isolated API.
    for (const endpoint of ["metrics", "statistics", "supervision"]) {
      const response = await page.request.get(
        `/api/v1/admin/${endpoint}?from=2026-01-01&to=2026-01-03`,
      );
      expect(response.status()).toBe(200);
      expect(response.headers()["cache-control"]).toContain("no-store");
    }
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Statistiques de la période" }),
    ).toBeVisible();
    await expect(
      page.getByRole("table", { name: /Comptages conservés en base/ }),
    ).toBeVisible();
    if (width < 768) {
      const toggle = page.getByRole("button", { name: "Ouvrir le menu" });
      await expect(
        page.getByRole("navigation", { name: "Administration" }),
      ).toBeHidden();
      await toggle.click();
      await expect(
        page.locator('button[aria-controls="integrated-admin-navigation"]'),
      ).toHaveAttribute("aria-expanded", "true");
    }
    const nav = page.getByRole("navigation", { name: "Administration" });
    await expect(nav.getByRole("link")).toHaveCount(3);
    await expect(
      nav.getByRole("link", { name: "Vue générale" }),
    ).toHaveAttribute("href", "/admin");
    await expect(nav.locator('[aria-disabled="true"]')).toHaveCount(3);
    const { default: AxeBuilder } = await import("@axe-core/playwright");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width < 768) {
      await page.keyboard.press("Escape");
      const toggle = page.getByRole("button", { name: "Ouvrir le menu" });
      await expect(toggle).toBeFocused();
      await expect(nav).toBeHidden();
      await toggle.click();
    }
    // Direct URLs must not expose any screen from a later lot.
    for (const path of ["offres", "abonnements", "paiements"]) {
      expect((await page.request.get("/admin/" + path)).status()).toBe(404);
    }
    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(page).toHaveURL("/connexion");
    expect((await page.request.get("/api/v1/admin/metrics")).status()).toBe(
      401,
    );
  });

test("chargement, panne, reprise et absence de données sans indicateurs inventés", async ({
  page,
}) => {
  const user = await account("ADMIN");
  const login = await page.request.post("/api/v1/auth/login", {
    headers: { "X-Revynora-Client": "web", Origin: "http://127.0.0.1:3450" },
    data: { email: user.email, password: user.password },
  });
  expect(login.ok()).toBe(true);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let fail = true;
  await page.route("**/api/v1/admin/metrics?*", async (route) => {
    await pending;
    await route.fulfill({
      status: fail ? 503 : 200,
      json: fail
        ? { code: "UNAVAILABLE", message: "Synthèse indisponible" }
        : null,
    });
  });
  await page.route("**/api/v1/admin/statistics?*", (route) =>
    route.fulfill({
      json: { registrations: [], subscriptions: [], ai: [], payments: [] },
    }),
  );
  await page.route("**/api/v1/admin/supervision?*", (route) =>
    route.fulfill({ json: { rows: [] } }),
  );
  await page.goto("/admin");
  await expect(page.locator('[aria-busy="true"]').first()).toBeVisible();
  release();
  await expect(
    page.getByRole("alert").filter({ hasText: "Synthèse indisponible" }),
  ).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Réessayer la synthèse" }).click();
  await expect(page.getByText("Synthèse non disponible.")).toBeVisible();
  await expect(
    page.getByText("Aucune inscription sur cette période."),
  ).toBeVisible();
  await expect(
    page.getByText("Aucun paiement.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Aucune activité de supervision sur cette période."),
  ).toBeVisible();
});

const consultationPrefix = "consult-" + randomUUID();
let targetUser: Awaited<ReturnType<typeof account>>;
let targetCourse: string;
let privateCourse: string;
test.beforeAll(async () => {
  targetUser = await account("STUDENT");
  await db.user.update({
    where: { id: targetUser.id },
    data: {
      name: consultationPrefix + " 00",
      disabledAt: new Date("2026-01-02T00:00:00Z"),
    },
  });
  const fixtureHash = passwordHash(randomBytes(24).toString("base64url"));
  const users = Array.from({ length: 20 }, (_, i) => ({
    id: randomUUID(),
    email: `${consultationPrefix}-${i}@example.test`,
    name: consultationPrefix + " " + (i + 1),
    role: "STUDENT" as const,
    passwordHash: fixtureHash,
  }));
  await db.user.createMany({ data: users });
  ids.push(...users.map((u) => u.id));
  const courses = Array.from({ length: 21 }, (_, i) => ({
    id: randomUUID(),
    title: `${consultationPrefix} Cours ${i}`,
    domain: consultationPrefix,
    source: "ADMIN" as const,
    content: "Contenu pédagogique <script>window.injected=true</script>",
  }));
  await db.course.createMany({ data: courses });
  courseIds.push(...courses.map((c) => c.id));
  targetCourse = courses[0]!.id;
  privateCourse = randomUUID();
  courseIds.push(privateCourse);
  await db.course.create({
    data: {
      id: privateCourse,
      ownerId: targetUser.id,
      source: "USER",
      title: consultationPrefix + " Privé",
      domain: consultationPrefix,
      content: "PRIVATE-CONTENT-NEVER-EXPOSE",
    },
  });
});
async function loginConsultation(
  page: import("@playwright/test").Page,
  role: "ADMIN" | "STUDENT" = "ADMIN",
) {
  const user = await account(role);
  expect(
    (
      await page.request.post("/api/v1/auth/login", {
        headers: {
          "X-Revynora-Client": "web",
          Origin: "http://127.0.0.1:3450",
        },
        data: { email: user.email, password: user.password },
      })
    ).ok(),
  ).toBe(true);
  return user;
}
for (const width of [375, 768, 1280])
  test(`consultations utilisateurs et cours, Axe et responsive ${width}px`, async ({
    page,
  }) => {
    await loginConsultation(page);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/admin/utilisateurs");
    await page
      .getByLabel("Rechercher par nom ou e-mail")
      .fill(consultationPrefix);
    await expect(page.getByText("21 comptes", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Suivant", exact: true }).click();
    await expect(page.getByText("Page 2 · 20 comptes maximum")).toBeVisible();
    await page.getByRole("button", { name: "Précédent", exact: true }).click();
    const { default: AxeBuilder } = await import("@axe-core/playwright");
    const inspect = async () => {
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        await page
          .getByRole("button", {
            name: /suspendre|réactiver|modifier|supprimer|publier/i,
          })
          .count(),
      ).toBe(0);
    };
    await inspect();
    await page
      .getByLabel("Rechercher par nom ou e-mail")
      .fill(targetUser.email);
    await page
      .getByRole("link", { name: consultationPrefix + " 00", exact: true })
      .click();
    await expect(page).toHaveURL("/admin/utilisateurs/" + targetUser.id);
    await expect(
      page.getByText(targetUser.email, { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Suspendu", { exact: true })).toBeVisible();
    await inspect();
    await page.getByRole("link", { name: "Retour aux utilisateurs" }).click();
    await expect(
      page.getByRole("heading", { name: "Utilisateurs", exact: true }),
    ).toBeVisible();
    await page.goto("/admin/cours");
    await page
      .getByLabel("Rechercher par titre ou matière")
      .fill(consultationPrefix);
    await page.getByRole("button", { name: "Rechercher les cours" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "21 cours" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: consultationPrefix + " Privé" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Cours suivants" }).click();
    await expect(page.getByText("Page 2 · 20 cours maximum")).toBeVisible();
    await page.getByRole("button", { name: "Cours précédents" }).click();
    await inspect();
    await page.goto("/admin/cours/" + targetCourse);
    await expect(
      page.getByText(
        "Contenu pédagogique <script>window.injected=true</script>",
        { exact: true },
      ),
    ).toBeVisible();
    expect(await page.evaluate(() => "injected" in window)).toBe(false);
    await inspect();
    await page.getByRole("link", { name: "Retour aux cours" }).click();
    await expect(
      page.getByRole("heading", { name: "Cours", exact: true }),
    ).toBeVisible();
  });

test("routes imbriquées : refus sans session, étudiant, expiration et suspension", async ({
  page,
}) => {
  const routes = [
    "/admin/utilisateurs",
    "/admin/utilisateurs/" + targetUser.id,
    "/admin/cours",
    "/admin/cours/" + targetCourse,
  ];
  for (const path of routes) {
    await page.goto(path);
    await expect(page).toHaveURL("/connexion?retour=%2Fadmin");
  }
  for (const mode of ["student", "expired", "suspended"] as const) {
    const user = await loginConsultation(
      page,
      mode === "student" ? "STUDENT" : "ADMIN",
    );
    if (mode === "expired")
      await db.session.updateMany({
        where: { userId: user.id },
        data: { expiresAt: new Date(0) },
      });
    if (mode === "suspended")
      await db.user.update({
        where: { id: user.id },
        data: { disabledAt: new Date() },
      });
    for (const path of routes) {
      await page.goto(path);
      await expect(page).toHaveURL(
        mode === "student" ? "/app" : "/connexion?retour=%2Fadmin",
      );
      await expect(
        page.getByText(targetUser.email, { exact: true }),
      ).toHaveCount(0);
    }
    for (const path of [
      "/admin/users",
      "/admin/users/" + targetUser.id,
      "/admin/catalog/courses",
      "/admin/catalog/courses/" + targetCourse,
    ])
      expect((await page.request.get("/api/v1" + path)).status()).toBe(
        mode === "student" ? 403 : 401,
      );
  }
});

test("droits catalogue, pannes API, réponse vide et refus de permission sans anciennes données", async ({
  page,
}) => {
  await loginConsultation(page);
  expect(
    (
      await page.request.get("/api/v1/admin/catalog/courses/" + privateCourse)
    ).status(),
  ).toBe(404);
  for (const endpoint of [
    "/admin/users/" + targetUser.id,
    "/admin/catalog/courses/" + targetCourse,
  ]) {
    const response = await page.request.get("/api/v1" + endpoint);
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
  let status = 200;
  await page.route("**/api/v1/admin/users/*", (route) =>
    route.fulfill({
      status,
      json:
        status === 200
          ? {
              id: targetUser.id,
              name: "Donnée éphémère",
              email: targetUser.email,
              role: "STUDENT",
              createdAt: "2026-01-01",
              disabledAt: null,
            }
          : {
              code: status === 403 ? "ADMIN_REQUIRED" : "UNAVAILABLE",
              message: status === 403 ? "Accès refusé" : "API indisponible",
            },
    }),
  );
  await page.goto("/admin/utilisateurs/" + targetUser.id);
  await expect(page.getByText(targetUser.email, { exact: true })).toBeVisible();
  status = 403;
  await page.reload();
  await expect(
    page.getByRole("alert").filter({ hasText: "Accès refusé" }),
  ).toBeVisible();
  await expect(page.getByText(targetUser.email, { exact: true })).toHaveCount(
    0,
  );
  status = 503;
  await page
    .getByRole("button", { name: "Réessayer la fiche utilisateur" })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "API indisponible" }),
  ).toBeVisible();
  await page.route("**/api/v1/admin/catalog/courses?*", (route) =>
    route.fulfill({ json: { items: [], total: 0, page: 1, pageSize: 20 } }),
  );
  await page.goto("/admin/cours");
  await expect(
    page.getByText("Aucun cours du catalogue trouvé."),
  ).toBeVisible();
  await page.goto("/admin/cours/" + privateCourse);
  await expect(
    page.getByRole("alert").filter({ hasText: /introuvable/i }),
  ).toBeVisible();
  await expect(page.getByText("PRIVATE-CONTENT-NEVER-EXPOSE")).toHaveCount(0);
});
