import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { PrismaClient } from "@prisma/client";
const raw = process.env.TEST_DATABASE_URL;
if (
  !raw ||
  new URL(raw).hostname !== "127.0.0.1" ||
  new URL(raw).pathname !== "/revynora_test" ||
  process.env.G8_ISOLATED_TEST_DB !== "true"
)
  throw Error("G9 isolated browser database required");
const db = new PrismaClient({ datasources: { db: { url: raw } } });
const email = process.env.TEST_ADMIN_EMAIL!,
  password = process.env.TEST_ADMIN_PASSWORD!;
if (!email?.startsWith("ci-g7-") || !email.endsWith("@example.test"))
  throw Error("Synthetic runner account required");
let actorId: string;
test.beforeAll(async () => {
  const actor = await db.user.findUniqueOrThrow({ where: { email } });
  actorId = actor.id;
  await db.commercialPermission.create({
    data: { userId: actorId, provenance: "G9 isolated browser fixture only" },
  });
});
test.afterAll(async () => {
  if (actorId)
    await db.commercialPermission.deleteMany({ where: { userId: actorId } });
  await db.$disconnect();
});
for (const width of [375, 1280])
  test(`G9 brouillon, comparaison, publication et Axe ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const login = await page.request.post(
      process.env.TEST_API_ORIGIN + "/api/v1/auth/login",
      {
        headers: {
          Origin: process.env.ADMIN_ORIGIN!,
          "X-Revynora-Client": "web",
        },
        data: { email, password },
      },
    );
    expect(login.status()).toBe(201);
    await page.goto("/offres");
    await expect(
      page.getByRole("heading", { name: "Gestion commerciale", exact: true }),
    ).toBeVisible();
    const offer = await db.subscription.findUniqueOrThrow({
      where: { code: "PLUS" },
    });
    await page
      .getByRole("button", { name: "Préparer une nouvelle version PLUS" })
      .click();
    await page.getByLabel("Nom de l’offre").fill("Plus recette G9");
    await page
      .getByLabel("Prix en centimes d’euro")
      .fill(String(offer.priceCents));
    await page
      .getByLabel("Motif administratif")
      .fill("Recette navigateur commerciale isolée");
    await page
      .getByRole("button", { name: "Créer le brouillon", exact: true })
      .click();
    const draft = await expect
      .poll(
        async () =>
          await db.commercialOfferVersion.findFirst({
            where: {
              subscriptionId: offer.id,
              state: "DRAFT",
              createdById: actorId,
            },
            orderBy: { number: "desc" },
          }),
      )
      .not.toBeNull();
    void draft;
    const version = await db.commercialOfferVersion.findFirstOrThrow({
      where: { subscriptionId: offer.id, state: "DRAFT", createdById: actorId },
      orderBy: { number: "desc" },
    });
    await page
      .getByText(`Version ${version.number} · Brouillon`, { exact: true })
      .click();
    const publish = page.getByRole("button", {
      name: `Publier la version ${version.number}`,
      exact: true,
    });
    await expect(publish).toBeDisabled();
    await page
      .getByRole("checkbox", {
        name: `Je confirme la publication de la version ${version.number} pour les nouvelles souscriptions.`,
        exact: true,
      })
      .check();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await publish.click();
    await expect(
      page.getByText(
        `Version ${version.number} · Publiée, immuable · actuelle`,
        { exact: true },
      ),
    ).toBeVisible();
    expect(
      await db.commercialAudit.findFirst({
        where: { versionId: version.id, action: "VERSION_PUBLISHED", actorId },
      }),
    ).not.toBeNull();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
