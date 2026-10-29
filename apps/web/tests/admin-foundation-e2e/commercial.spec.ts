import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes, randomUUID, scryptSync } from "node:crypto";
const db = new PrismaClient({
  datasources: { db: { url: process.env.TEST_DATABASE_URL } },
});
const ids: string[] = [];
const raw = process.env.TEST_DATABASE_URL;
if (
  !raw ||
  new URL(raw).hostname !== "127.0.0.1" ||
  new URL(raw).pathname !== "/revynora_test" ||
  process.env.G8_ISOLATED_TEST_DB !== "true"
)
  throw Error("Isolated commercial browser database required");
async function plus() {
  return db.subscription.findUniqueOrThrow({ where: { code: "PLUS" } });
}
async function restore(original: Awaited<ReturnType<typeof plus>>) {
  await db.subscription.update({
    where: { id: original.id },
    data: {
      name: original.name,
      priceCents: original.priceCents,
      currency: original.currency,
      interval: original.interval,
      active: original.active,
      revision: original.revision,
      currentVersionId: original.currentVersionId,
    },
  });
  // Published versions and commercial audits remain immutable in this isolated database.
}
async function permit(actorId: string) {
  await db.commercialPermission.create({
    data: { userId: actorId, provenance: "Phase 2E isolated fixture only" },
  });
}

async function account(role: "ADMIN" | "STUDENT") {
  const id = randomUUID(),
    salt = randomBytes(16).toString("hex"),
    token = randomBytes(32).toString("base64url");
  const passwordHash =
    "scrypt-v1:" +
    salt +
    ":" +
    scryptSync(randomBytes(24), salt, 64, {
      N: 32768,
      r: 8,
      p: 3,
      maxmem: 64 * 1024 * 1024,
    }).toString("hex");
  const user = await db.user.create({
    data: {
      id,
      email: `actions-${id}@example.test`,
      name: "Recette actions " + id.slice(0, 8),
      role,
      passwordHash,
      termsAcceptedAt: new Date(),
    },
  });
  await db.session.create({
    data: {
      userId: id,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  ids.push(id);
  return { ...user, token };
}
async function identify(page: Page, user: Awaited<ReturnType<typeof account>>) {
  await page.context().addCookies([
    {
      name: "revynora_session",
      value: user.token,
      url: "http://127.0.0.1:3450",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
const webHeaders = {
  "X-Revynora-Client": "web",
  Origin: "http://127.0.0.1:3450",
};
async function inspect(page: Page) {
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
test.afterAll(async () => {
  try {
    await db.auditLog.deleteMany({
      where: { OR: [{ actorId: { in: ids } }, { targetUserId: { in: ids } }] },
    });
    await db.commercialPermission.deleteMany({
      where: { userId: { in: ids } },
    });
    await db.user.deleteMany({ where: { id: { in: ids } } });
  } finally {
    await db.$disconnect();
  }
});
async function draft(
  page: Page,
  offer: Awaited<ReturnType<typeof plus>>,
  active: boolean,
  name: string,
) {
  await page
    .getByRole("button", {
      name: "Préparer une nouvelle version PLUS",
      exact: true,
    })
    .click();
  await page.getByLabel("Nom de l’offre", { exact: true }).fill(name);
  await page
    .getByLabel("Prix en centimes d’euro", { exact: true })
    .fill(String(offer.priceCents + 1));
  await page
    .getByLabel("Motif administratif", { exact: true })
    .fill("Recette commerciale Phase 2E isolée");
  await page
    .getByRole("checkbox", {
      name: "Disponible pour les nouvelles souscriptions",
    })
    .setChecked(active);
  await page
    .getByRole("button", { name: "Créer le brouillon", exact: true })
    .click();
}
async function latest(actorId: string) {
  await expect
    .poll(() =>
      db.commercialOfferVersion.count({
        where: { createdById: actorId, state: "DRAFT" },
      }),
    )
    .toBeGreaterThan(0);
  return db.commercialOfferVersion.findFirstOrThrow({
    where: { createdById: actorId, state: "DRAFT" },
    orderBy: { number: "desc" },
  });
}
async function openVersion(page: Page, number: number) {
  const summary = page.getByText(`Version ${number} · Brouillon`, {
    exact: true,
  });
  await expect(summary).toBeVisible();
  await summary.click();
  const review = page.locator("details").filter({ has: summary });
  return review;
}
for (const width of [375, 768, 1280])
  test(`G9 intégré : retrait, réactivation, immutabilité, audit et Axe ${width}`, async ({
    page,
  }) => {
    const actor = await account("ADMIN"),
      student = await account("STUDENT"),
      original = await plus();
    await permit(actor.id);
    await db.userSubscriptionHistory.create({
      data: {
        userId: student.id,
        subscriptionId: original.id,
        commercialVersionId: original.currentVersionId,
        contractEvidence: original.currentVersionId
          ? "VERSIONED"
          : "LEGACY_UNVERIFIED",
        provider: "mock",
        providerSubscriptionId: "phase2e-" + randomUUID(),
        priceCents: original.priceCents,
        currency: original.currency,
        status: "ACTIVE",
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 86400000),
      },
    });
    try {
      await identify(page, actor);
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/admin/offres");
      await expect(
        page.getByRole("heading", { name: "Gestion commerciale", exact: true }),
      ).toBeVisible();
      for (const code of ["FREE", "PLUS", "PRO"])
        await expect(
          page.getByRole("button", {
            name: "Préparer une nouvelle version " + code,
            exact: true,
          }),
        ).toBeVisible();
      await draft(page, original, false, "Plus retirée recette");
      const version = await latest(actor.id),
        review = await openVersion(page, version.number);
      expect((await plus()).currentVersionId).toBe(original.currentVersionId);
      const publish = review.getByRole("button", {
        name: `Publier la version ${version.number}`,
        exact: true,
      });
      await expect(publish).toBeDisabled();
      await review
        .getByLabel("Identifiant d’un prix Stripe test existant")
        .fill("price_isolated");
      await review
        .getByRole("button", { name: "Vérifier le prix existant" })
        .click();
      await expect(review.getByRole("alert")).toContainText(
        "uniquement avec Stripe test",
      );
      expect(
        await db.commercialProviderPrice.count({
          where: { versionId: version.id },
        }),
      ).toBe(0);
      await review
        .getByRole("checkbox", { name: /Je confirme la publication/ })
        .check();
      await inspect(page);
      await publish.click();
      await expect(
        page.getByText(
          `Version ${version.number} · Publiée, immuable · actuelle`,
          { exact: true },
        ),
      ).toBeVisible();
      expect((await plus()).active).toBe(false);
      const immutable = await db.commercialOfferVersion.findUniqueOrThrow({
        where: { id: version.id },
      });
      await draft(page, await plus(), true, "Plus réactivée recette");
      const next = await latest(actor.id),
        nextReview = await openVersion(page, next.number);
      await nextReview
        .getByRole("checkbox", { name: /Je confirme la publication/ })
        .check();
      await nextReview
        .getByRole("button", {
          name: `Publier la version ${next.number}`,
          exact: true,
        })
        .click();
      await expect(
        page.getByText(
          `Version ${next.number} · Publiée, immuable · actuelle`,
          { exact: true },
        ),
      ).toBeVisible();
      expect((await plus()).active).toBe(true);
      expect(
        await db.commercialOfferVersion.findUniqueOrThrow({
          where: { id: version.id },
        }),
      ).toEqual(immutable);
      const contract = await db.userSubscriptionHistory.findFirstOrThrow({
        where: { userId: student.id },
      });
      expect(contract.priceCents).toBe(original.priceCents);
      expect(contract.commercialVersionId).toBe(original.currentVersionId);
      expect(
        await db.commercialAudit.count({
          where: { actorId: actor.id, action: "VERSION_PUBLISHED" },
        }),
      ).toBe(2);
      expect(
        await db.payment.count({
          where: { userId: { in: [actor.id, student.id] } },
        }),
      ).toBe(0);
      expect(
        await db.internalLearningGrant.count({
          where: { userId: { in: [actor.id, student.id] } },
        }),
      ).toBe(0);
      await inspect(page);
    } finally {
      await restore(original);
    }
  });
test("permission commerciale explicite, session active et CSRF sont requis", async ({
  page,
}) => {
  const target = randomUUID();
  for (const mode of [
    "student",
    "no-commercial",
    "expired",
    "suspended",
  ] as const) {
    const actor = await account(mode === "student" ? "STUDENT" : "ADMIN");
    if (mode === "expired")
      await db.session.updateMany({
        where: { userId: actor.id },
        data: { expiresAt: new Date(0) },
      });
    if (mode === "suspended")
      await db.user.update({
        where: { id: actor.id },
        data: { disabledAt: new Date() },
      });
    await identify(page, actor);
    const expected = ["expired", "suspended"].includes(mode) ? 401 : 403;
    expect(
      (await page.request.get("/api/v1/admin/commercial/offers")).status(),
    ).toBe(expected);
    for (const [path, data] of [
      [
        `offers/${target}/drafts`,
        {
          expectedRevision: 0,
          name: "Refus",
          priceCents: 100,
          currency: "eur",
          interval: "month",
          active: true,
          features: [],
          reason: "Motif de refus isolé",
        },
      ],
      [
        `versions/${target}/publish`,
        { expectedRevision: 0, confirmVersionId: target },
      ],
      [`versions/${target}/verify-price`, { priceId: "price_isolated" }],
    ] as const)
      expect(
        (
          await page.request.post("/api/v1/admin/commercial/" + path, {
            headers: webHeaders,
            data,
          })
        ).status(),
      ).toBe(expected);
    expect(
      await db.commercialPermission.count({ where: { userId: actor.id } }),
    ).toBe(0);
    if (mode === "no-commercial") {
      await page.goto("/admin/offres");
      await expect(
        page.getByRole("alert").filter({ hasText: /Permission explicite/ }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Préparer une nouvelle version/ }),
      ).toHaveCount(0);
    }
  }
  const actor = await account("ADMIN");
  await permit(actor.id);
  await identify(page, actor);
  for (const headers of [
    { Origin: webHeaders.Origin },
    { ...webHeaders, Origin: "https://foreign.example.test" },
  ]) {
    expect(
      (
        await page.request.post(
          `/api/v1/admin/commercial/versions/${target}/publish`,
          { headers, data: { expectedRevision: 0, confirmVersionId: target } },
        )
      ).status(),
    ).toBe(403);
  }
});
test("un catalogue modifié concurremment refuse la publication obsolète avec 409", async ({
  page,
}) => {
  const actor = await account("ADMIN"),
    original = await plus();
  await permit(actor.id);
  await identify(page, actor);
  try {
    await page.goto("/admin/offres");
    await draft(page, original, original.active, "Conflit navigateur");
    const first = await latest(actor.id),
      review = await openVersion(page, first.number);
    const other = await page.request.post(
      `/api/v1/admin/commercial/offers/${original.id}/drafts`,
      {
        headers: webHeaders,
        data: {
          expectedRevision: original.revision,
          name: "Version concurrente",
          priceCents: original.priceCents,
          currency: "eur",
          interval: "month",
          active: original.active,
          features: ["leitner"],
          reason: "Publication concurrente de recette",
        },
      },
    );
    expect(other.status()).toBe(201);
    const second = await other.json();
    expect(
      (
        await page.request.post(
          `/api/v1/admin/commercial/versions/${second.id}/publish`,
          {
            headers: webHeaders,
            data: {
              expectedRevision: original.revision,
              confirmVersionId: second.id,
            },
          },
        )
      ).status(),
    ).toBe(201);
    await review
      .getByRole("checkbox", { name: /Je confirme la publication/ })
      .check();
    const response = page.waitForResponse((r) =>
      r.url().endsWith(`/versions/${first.id}/publish`),
    );
    await review
      .getByRole("button", {
        name: `Publier la version ${first.number}`,
        exact: true,
      })
      .click();
    expect((await response).status()).toBe(409);
    await expect(review.getByRole("alert")).toBeVisible();
    await expect(
      review.getByRole("checkbox", { name: /Je confirme la publication/ }),
    ).not.toBeChecked();
    expect(
      (
        await db.commercialOfferVersion.findUniqueOrThrow({
          where: { id: first.id },
        })
      ).state,
    ).toBe("DRAFT");
    await review
      .getByRole("button", { name: "Actualiser le catalogue" })
      .click();
    await expect(
      page.getByText(
        `Version ${second.number} · Publiée, immuable · actuelle`,
        { exact: true },
      ),
    ).toBeVisible();
  } finally {
    await restore(original);
  }
});
test("une erreur de relecture masque les anciennes offres et permet la reprise", async ({
  page,
}) => {
  const actor = await account("ADMIN");
  await permit(actor.id);
  await identify(page, actor);
  await page.goto("/admin/offres");
  await expect(
    page.getByRole("button", {
      name: "Préparer une nouvelle version PLUS",
      exact: true,
    }),
  ).toBeVisible();
  await page.route("**/api/v1/admin/commercial/offers", (route) =>
    route.fulfill({
      status: 503,
      json: {
        code: "UNAVAILABLE",
        message: "Catalogue momentanément indisponible",
      },
    }),
  );
  // Full navigation mounts a new resource and must not retain previous data.
  await page.reload();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Catalogue momentanément indisponible" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Préparer une nouvelle version/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Historique commercial" }),
  ).toHaveCount(0);
  await page.unroute("**/api/v1/admin/commercial/offers");
  await page.getByRole("button", { name: "Réessayer", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Préparer une nouvelle version PLUS",
      exact: true,
    }),
  ).toBeVisible();
});
