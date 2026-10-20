import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import AxeBuilder from "@axe-core/playwright";
const url = process.env.TEST_DATABASE_URL!;
if (
  !url ||
  new URL(url).pathname !== "/revynora_test" ||
  !["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname)
)
  throw Error("Base locale obligatoire");
const db = new PrismaClient({ datasources: { db: { url } } });
const users: string[] = [],
  payments: string[] = [];
const email = "g6-" + crypto.randomUUID() + "@example.test",
  password = "G6-Browser-Only!42";
test.beforeAll(async ({ request }) => {
  const r = await request.post("http://127.0.0.1:3411/api/v1/auth/register", {
    headers: { Origin: "http://127.0.0.1:3412", "X-Revynora-Client": "web" },
    data: { name: "G6 Browser", email, password, termsAccepted: true },
  });
  expect(r.status()).toBe(201);
  const u = await r.json();
  users.push(u.id);
  await db.user.update({ where: { id: u.id }, data: { role: "ADMIN" } });
  for (let i = 0; i < 21; i++) {
    const p = await db.payment.create({
      data: {
        userId: u.id,
        provider: "mock",
        providerReference: "g6-private-" + crypto.randomUUID(),
        receiptUrl: "https://private.invalid/receipt",
        amountCents: 250,
        currency: "eur",
        status: "PAID",
        createdAt: new Date(Date.UTC(2099, 0, 1, 0, 0, i)),
      },
    });
    payments.push(p.id);
  }
});
test.afterAll(async () => {
  await db.payment.deleteMany({ where: { id: { in: payments } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});
for (const width of [320, 768, 1280])
  test(`Consultation financière sans mutation à ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/paiements");
    await expect(page).toHaveURL(/connexion/);
    await page.getByLabel("Adresse e-mail").fill(email);
    await page.getByLabel("Mot de passe").fill(password);
    await page
      .getByRole("button", { name: "Me connecter", exact: true })
      .click();
    await expect(page).toHaveURL("http://127.0.0.1:3412/");
    await page.goto("/paiements");
    await expect(
      page.getByRole("heading", { name: "Paiements", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("combobox", { name: "Fournisseur", exact: true })
      .selectOption("mock");
    await page
      .getByRole("combobox", { name: "Statut enregistré", exact: true })
      .selectOption("PAID");
    await expect(page.getByRole("table")).toBeVisible();
    await expect(
      page
        .getByText("Simulation — aucun paiement réel", { exact: false })
        .first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Suivant", exact: true }).click();
    await expect(page.getByText(/Page 2/)).toBeVisible();
    await expect(page.getByText(/g6-private-|private.invalid/)).toHaveCount(0);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.goto("/abonnements");
    await expect(
      page.getByRole("heading", { name: "Abonnements", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Offres et droits" }),
    ).toBeVisible();
    await page
      .getByRole("combobox", { name: "Statut enregistré", exact: true })
      .selectOption("INCOMPLETE");
    await expect(
      page.getByText("Aucun résultat sur cette page."),
    ).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
