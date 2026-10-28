import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomBytes, randomUUID, scryptSync } from "node:crypto";
const db = new PrismaClient({
  datasources: { db: { url: process.env.TEST_DATABASE_URL } },
});
const ids: string[] = [];
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
    await expect(nav.getByRole("link")).toHaveCount(1);
    await expect(
      nav.getByRole("link", { name: "Vue générale" }),
    ).toHaveAttribute("href", "/admin");
    await expect(nav.locator('[aria-disabled="true"]')).toHaveCount(5);
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
    for (const path of [
      "utilisateurs",
      "cours",
      "offres",
      "abonnements",
      "paiements",
    ]) {
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
