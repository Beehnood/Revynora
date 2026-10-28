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
