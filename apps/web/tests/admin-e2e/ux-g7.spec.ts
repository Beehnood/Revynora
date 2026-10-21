import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const email = process.env.TEST_ADMIN_EMAIL;
const password = process.env.TEST_ADMIN_PASSWORD;
if (!email || !password)
  throw Error(
    "Compte ADMIN local existant requis via TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD, jamais commité.",
  );
const paths = ["/", "/utilisateurs", "/cours", "/abonnements", "/paiements"];
for (const width of [320, 375, 768, 1280, 1440]) {
  test(`G7 lecture seule, états et accessibilité à ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    const anonymous = await page.goto("/");
    expect(anonymous?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/connexion$/);
    const login = await page
      .context()
      .request.post("http://127.0.0.1:3001/api/v1/auth/login", {
        headers: {
          Origin: "http://127.0.0.1:3002",
          "X-Revynora-Client": "web",
        },
        data: { email, password },
      });
    expect(login.status()).toBe(201);
    // Actual local data, captured before any browser-only responses are installed.
    for (const path of paths) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await page.screenshot({
        path: info.outputPath(
          `live-${path === "/" ? "dashboard" : path.slice(1)}.png`,
        ),
        fullPage: true,
      });
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
    }
    const fixturesOnly =
      "Valeurs simulées dans le navigateur de recette uniquement";
    await page.route("**/api/v1/admin/**", async (route) => {
      expect(route.request().method()).toBe("GET"); // No business mutations allowed in G7.
      const url = new URL(route.request().url());
      const path = url.pathname.replace("/api/v1/admin", "");
      const from = url.searchParams.get("from") ?? "2026-01-01",
        to = url.searchParams.get("to") ?? "2026-02-01";
      const registrations = Array.from(
        {
          length: Math.min(
            366,
            Math.max(1, (Date.parse(to) - Date.parse(from)) / 86400000),
          ),
        },
        (_, i) => ({
          date: new Date(Date.parse(from) + i * 86400000)
            .toISOString()
            .slice(0, 10),
          count: i === 0 ? 2 : i === 2 ? 3 : 0,
        }),
      );
      const pageNumber = Number(url.searchParams.get("page") ?? 1);
      const payment = {
        id: "ui-payment-reference-long",
        provider: "stripe",
        amountCents: 250,
        currency: "eur",
        status: "PAID",
        verification: "UNVERIFIED",
        createdAt: "2026-01-01T23:00:00Z",
      };
      const user = {
        id: "ui-user",
        name: "Compte de recette UI",
        email: "ux@example.test",
        role: "STUDENT",
        createdAt: "2026-01-01",
        disabledAt: null,
      };
      const offer = {
        code: "PLUS",
        name: "Plus",
        priceCents: 250,
        currency: "eur",
        active: true,
      };
      const payload: Record<string, unknown> = {
        "/metrics": {
          users: 42,
          newUsers: 5,
          ai: { _count: 5, _sum: { estimatedCostUsd: "0.00012345" } },
          billingMode: "mock",
          workerEnabled: false,
          payments: [],
          statuses: [],
        },
        "/statistics": {
          from,
          to,
          timeZone: "UTC",
          registrations,
          subscriptions: [
            { offer: "PLUS", status: "ACTIVE", periods: 2 },
            { offer: "PRO", status: "PAST_DUE", periods: 1 },
          ],
          ai: [
            {
              provider: "openai",
              status: "ERROR",
              requests: 5,
              inputTokens: "100",
              outputTokens: "5",
              estimatedCostUsd: "0.00012345",
              estimatedRequests: 2,
            },
          ],
          payments: [
            {
              provider: "stripe",
              currency: "eur",
              status: "PAID",
              environment: "UNVERIFIED",
              count: 1,
              amountCents: "250",
            },
          ],
          billedAiCostUsd: null,
        },
        "/supervision": {
          from,
          to,
          timeZone: "UTC",
          rows: [{ category: "REVIEWS", status: "RECORDED", count: 4 }],
        },
        "/events": {
          items: [],
          total: 0,
          page: pageNumber,
          pageSize: 20,
          audit: [],
        },
        "/offers": [offer],
        "/users": {
          items: url.searchParams.get("search") ? [] : [user],
          total: url.searchParams.get("search") ? 0 : 21,
          page: pageNumber,
          pageSize: 20,
        },
        "/catalog/courses": {
          items: [],
          total: 0,
          page: pageNumber,
          pageSize: 20,
        },
        "/payments": {
          items: url.searchParams.get("status") === "FAILED" ? [] : [payment],
          total: url.searchParams.get("status") === "FAILED" ? 0 : 21,
          page: pageNumber,
          pageSize: 20,
        },
        "/subscriptions": {
          items: [
            {
              id: "ui-period",
              plan: "PLUS",
              provider: "internal",
              priceCents: 250,
              currency: "eur",
              status: "ACTIVE",
              startsAt: "2026-01-01",
              endsAt: "2026-02-01",
              cancelAtPeriodEnd: false,
            },
          ],
          total: 1,
          page: pageNumber,
          pageSize: 20,
        },
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(payload[path] ?? {}),
      });
    });
    for (const path of paths) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      // Screenshots named fixture-* are explicitly synthetic, not application data.
      await page.screenshot({
        path: info.outputPath(
          `fixture-${path === "/" ? "dashboard" : path.slice(1)}.png`,
        ),
        fullPage: true,
      });
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
    }
    await page.goto("/");
    await expect(page.getByText("Maximum : 3 / jour")).toBeVisible();
    await expect(page.getByText("2,50 €").first()).toBeVisible();
    const table = page.getByText("Tableau des inscriptions quotidiennes", {
      exact: true,
    });
    await table.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("table", { name: "Inscriptions par date UTC" }),
    ).toBeVisible();
    await page.getByLabel("Du", { exact: true }).fill("2026-01-01");
    await page.getByLabel("Au (exclu)", { exact: true }).fill("2026-01-05");
    const applied = page.waitForRequest((r) =>
      r.url().includes("/admin/statistics?from=2026-01-01&to=2026-01-05"),
    );
    await page.getByRole("button", { name: "Appliquer la période" }).click();
    await applied;
    if (width < 768) {
      await page.getByRole("button", { name: "Ouvrir le menu" }).click();
      await expect(
        page.getByRole("navigation", { name: "Administration", exact: true }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("button", { name: "Ouvrir le menu" }),
      ).toBeFocused();
    }
    await page.goto("/utilisateurs");
    await page.getByRole("button", { name: "Suspendre", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Confirmer la suspension" }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Annuler", exact: true }).click();
    await page.goto("/paiements");
    await expect(
      page.getByRole("cell", { name: "Marqué payé", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Paiement non vérifié", { exact: false }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Suivant", exact: true }).click();
    await expect(page.getByText(/Page 2/)).toBeVisible();
    await page
      .getByRole("combobox", { name: "Statut enregistré", exact: true })
      .selectOption("FAILED");
    await expect(
      page.getByText("Aucun résultat pour ces filtres."),
    ).toBeVisible();
    await expect(page.getByText(/Page 1/)).toBeVisible();
    await page.route("**/api/v1/admin/payments?**", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "Indisponibilité simulée G7" }),
      }),
    );
    await page.reload();
    await expect(
      page.getByRole("alert").filter({ hasText: "Indisponibilité simulée G7" }),
    ).toBeVisible();
    await page.unroute("**/api/v1/admin/payments?**");
    await page.getByRole("button", { name: "Réessayer", exact: true }).click();
    await expect(
      page.getByText("Paiement non vérifié", { exact: false }),
    ).toBeVisible();
    await info.attach("fixture-policy", {
      body: fixturesOnly,
      contentType: "text/plain",
    });
  });
}
