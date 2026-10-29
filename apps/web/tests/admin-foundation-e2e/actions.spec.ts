import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes, randomUUID, scryptSync } from "node:crypto";
const db = new PrismaClient({
  datasources: { db: { url: process.env.TEST_DATABASE_URL } },
});
const ids: string[] = [];
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
async function confirmAccess(page: Page, disabled: boolean) {
  await page
    .getByRole("button", {
      name: disabled ? "Suspendre" : "Réactiver",
      exact: true,
    })
    .click();
  const submit = page.getByRole("button", {
    name: disabled ? "Confirmer la suspension" : "Confirmer la réactivation",
  });
  await expect(submit).toBeDisabled();
  await page
    .getByRole("combobox", { name: /Motif obligatoire/ })
    .selectOption(disabled ? "USER_REQUEST" : "REVIEW_COMPLETED");
  await expect(submit).toBeDisabled();
  await page
    .getByRole("checkbox", { name: "Je confirme cette action sur ce compte" })
    .check();
  return submit;
}
test.afterAll(async () => {
  try {
    await db.auditLog.deleteMany({
      where: { OR: [{ actorId: { in: ids } }, { targetUserId: { in: ids } }] },
    });
    await db.internalLearningGrant.deleteMany({
      where: { userId: { in: ids } },
    });
    await db.user.deleteMany({ where: { id: { in: ids } } });
  } finally {
    await db.$disconnect();
  }
});
for (const width of [375, 768, 1280])
  test(`suspension, réactivation, audit et G8 réels, Axe ${width}px`, async ({
    page,
  }) => {
    const actor = await account("ADMIN"),
      student = await account("STUDENT"),
      beneficiary = await account("ADMIN");
    await identify(page, actor);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/admin/utilisateurs/" + student.id);
    await expect(page.getByText(student.email, { exact: true })).toBeVisible();
    const suspend = await confirmAccess(page, true);
    await inspect(page);
    const request = page.waitForRequest(
      (r) =>
        r.method() === "PATCH" &&
        r.url().endsWith("/admin/users/" + student.id),
    );
    await suspend.click();
    const mutation = await request;
    const headers = await mutation.allHeaders();
    expect(headers["x-revynora-client"]).toBe("web");
    expect(headers.origin).toBe("http://127.0.0.1:3450");
    await expect(
      page.getByRole("button", { name: "Réactiver", exact: true }),
    ).toBeVisible();
    expect(await db.session.count({ where: { userId: student.id } })).toBe(0);
    expect(
      (
        await page.request.get("/api/v1/users/me", {
          headers: { Cookie: "revynora_session=" + student.token },
        })
      ).status(),
    ).toBe(401);
    await expect(page.getByText(/Compte suspendu/)).toBeVisible();
    const reactivate = await confirmAccess(page, false);
    await reactivate.click();
    await expect(
      page.getByRole("button", { name: "Suspendre", exact: true }),
    ).toBeVisible();
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: student.id } }))
        .disabledAt,
    ).toBeNull();
    expect(await db.session.count({ where: { userId: student.id } })).toBe(0);
    const audits = await db.auditLog.findMany({
      where: { actorId: actor.id, targetUserId: student.id },
    });
    const payloads = audits.map((r) =>
      JSON.parse(r.action.slice("ADMIN_ACCESS_V1:".length)),
    );
    expect(payloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "USER_DISABLED",
          reason: "USER_REQUEST",
          result: "SUCCESS",
        }),
        expect.objectContaining({
          action: "USER_ENABLED",
          reason: "REVIEW_COMPLETED",
          result: "SUCCESS",
        }),
      ]),
    );
    await page.goto("/admin/utilisateurs/" + beneficiary.id);
    await expect(
      page.getByRole("button", { name: "Confirmer l’attribution pédagogique" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Suspendre", exact: true }),
    ).toHaveCount(0);
    await page.getByLabel("Provenance", { exact: true }).fill("RECETTE_2D");
    await page
      .getByLabel("Justification", { exact: true })
      .fill("Attribution pédagogique de recette isolée");
    await page
      .getByLabel("Expiration facultative (UTC)")
      .fill(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
    await page
      .getByRole("checkbox", {
        name: "Je confirme l’attribution pédagogique à ce bénéficiaire",
      })
      .check();
    await inspect(page);
    await page
      .getByRole("button", { name: "Confirmer l’attribution pédagogique" })
      .click();
    await expect(
      page.getByRole("button", { name: "Révoquer cette attribution" }),
    ).toBeVisible();
    const grant = await db.internalLearningGrant.findFirstOrThrow({
      where: { userId: beneficiary.id },
    });
    expect(grant.issuedById).toBe(actor.id);
    expect(grant.provenance).toBe("RECETTE_2D");
    expect(
      await db.auditLog.count({
        where: { entityId: grant.id, action: "INTERNAL_LEARNING_GRANTED" },
      }),
    ).toBe(1);
    const access = await page.request.get("/api/v1/learning/access", {
      headers: { Cookie: "revynora_session=" + beneficiary.token },
    });
    expect(await access.json()).toMatchObject({
      allowed: true,
      source: "INTERNAL",
      effectivePlan: "PRO",
      commercialPlan: "FREE",
    });
    expect(await db.payment.count({ where: { userId: beneficiary.id } })).toBe(
      0,
    );
    expect(
      await db.userSubscriptionHistory.count({
        where: { userId: beneficiary.id },
      }),
    ).toBe(0);
    expect(
      await db.commercialPermission.count({
        where: { userId: beneficiary.id },
      }),
    ).toBe(0);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: beneficiary.id } })).role,
    ).toBe("ADMIN");
    await page
      .getByRole("button", { name: "Révoquer cette attribution" })
      .click();
    await expect(
      page.getByRole("button", { name: "Confirmer la révocation" }),
    ).toBeDisabled();
    await page
      .getByLabel("Motif de révocation")
      .fill("Révocation de recette pédagogique isolée");
    await page
      .getByRole("checkbox", {
        name: "Je confirme cette révocation pédagogique",
      })
      .check();
    await inspect(page);
    await page.getByRole("button", { name: "Confirmer la révocation" }).click();
    await expect(
      page.getByText(/Révocation de recette pédagogique isolée/),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Révoquer cette attribution" }),
    ).toHaveCount(0);
    expect(
      await db.auditLog.count({
        where: { entityId: grant.id, action: "INTERNAL_LEARNING_REVOKED" },
      }),
    ).toBe(1);
    const revokedAccess = await page.request.get("/api/v1/learning/access", {
      headers: { Cookie: "revynora_session=" + beneficiary.token },
    });
    expect(await revokedAccess.json()).toMatchObject({
      allowed: false,
      source: "NONE",
      commercialPlan: "FREE",
    });
    expect(await db.payment.count({ where: { userId: beneficiary.id } })).toBe(
      0,
    );
    expect(
      await db.userSubscriptionHistory.count({
        where: { userId: beneficiary.id },
      }),
    ).toBe(0);
    await inspect(page);
  });

test("permissions, CSRF, origine et comptes protégés refusent les mutations", async ({
  page,
}) => {
  const actor = await account("ADMIN"),
    target = await account("STUDENT");
  await identify(page, actor);
  const command = {
    disabled: true,
    confirmed: true,
    reason: "SECURITY_REVIEW",
  };
  expect(
    (
      await page.request.patch("/api/v1/admin/users/" + target.id, {
        headers: { Origin: webHeaders.Origin },
        data: command,
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.patch("/api/v1/admin/users/" + target.id, {
        headers: { ...webHeaders, Origin: "https://foreign.example.test" },
        data: command,
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.patch("/api/v1/admin/users/" + actor.id, {
        headers: webHeaders,
        data: command,
      })
    ).status(),
  ).toBe(409);
  const grant = {
    startsAt: new Date().toISOString(),
    provenance: "RECETTE",
    justification: "Justification de recette isolée",
  };
  expect(
    (
      await page.request.post(
        `/api/v1/admin/users/${target.id}/learning-grants`,
        { headers: webHeaders, data: grant },
      )
    ).status(),
  ).toBe(422);
  for (const mode of ["student", "expired", "suspended"] as const) {
    const denied = await account(mode === "student" ? "STUDENT" : "ADMIN");
    await identify(page, denied);
    if (mode === "expired")
      await db.session.updateMany({
        where: { userId: denied.id },
        data: { expiresAt: new Date(0) },
      });
    if (mode === "suspended")
      await db.user.update({
        where: { id: denied.id },
        data: { disabledAt: new Date() },
      });
    expect(
      (
        await page.request.patch(`/api/v1/admin/users/${target.id}`, {
          headers: webHeaders,
          data: command,
        })
      ).status(),
    ).toBe(mode === "student" ? 403 : 401);
    expect(
      (
        await page.request.post(
          `/api/v1/admin/users/${actor.id}/learning-grants`,
          { headers: webHeaders, data: grant },
        )
      ).status(),
    ).toBe(mode === "student" ? 403 : 401);
    expect(
      (
        await page.request.patch(
          `/api/v1/admin/learning-grants/${randomUUID()}/revoke`,
          {
            headers: webHeaders,
            data: { reason: "Révocation de recette refusée" },
          },
        )
      ).status(),
    ).toBe(mode === "student" ? 403 : 401);
  }
  expect(
    (await db.user.findUniqueOrThrow({ where: { id: target.id } })).disabledAt,
  ).toBeNull();
  expect(
    await db.internalLearningGrant.count({ where: { userId: actor.id } }),
  ).toBe(0);
});

test("conflit G8 réel et indisponibilité d’une suspension ne déclenchent pas de nouvelle mutation", async ({
  page,
}) => {
  const actor = await account("ADMIN"),
    beneficiary = await account("ADMIN"),
    student = await account("STUDENT");
  await identify(page, actor);
  const response = await page.request.post(
    `/api/v1/admin/users/${beneficiary.id}/learning-grants`,
    {
      headers: webHeaders,
      data: {
        startsAt: new Date().toISOString(),
        provenance: "RECETTE",
        justification: "Attribution préalable de recette",
      },
    },
  );
  expect(response.status()).toBe(201);
  await page.goto("/admin/utilisateurs/" + beneficiary.id);
  await page.getByLabel("Provenance", { exact: true }).fill("CONFLICT_TEST");
  await page
    .getByLabel("Justification", { exact: true })
    .fill("Nouvelle attribution en conflit");
  await page
    .getByRole("checkbox", {
      name: "Je confirme l’attribution pédagogique à ce bénéficiaire",
    })
    .check();
  await page
    .getByRole("button", { name: "Confirmer l’attribution pédagogique" })
    .click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: /Révoquez l’attribution existante/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", {
      name: "Je confirme l’attribution pédagogique à ce bénéficiaire",
    }),
  ).not.toBeChecked();
  expect(
    await db.internalLearningGrant.count({ where: { userId: beneficiary.id } }),
  ).toBe(1);
  await page.route("**/api/v1/admin/users/" + student.id, (route) =>
    route.request().method() === "PATCH"
      ? route.fulfill({
          status: 503,
          json: {
            code: "UNAVAILABLE",
            message: "Mutation momentanément indisponible",
          },
        })
      : route.continue(),
  );
  await page.goto("/admin/utilisateurs/" + student.id);
  await (await confirmAccess(page, true)).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Mutation momentanément indisponible" }),
  ).toBeVisible();
  expect(
    (await db.user.findUniqueOrThrow({ where: { id: student.id } })).disabledAt,
  ).toBeNull();
  expect(
    await db.auditLog.count({
      where: { actorId: actor.id, targetUserId: student.id },
    }),
  ).toBe(0);
});
