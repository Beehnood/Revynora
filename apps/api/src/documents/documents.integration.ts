import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { AppModule } from "../app.module";
import { configureApp } from "../shared/http/configure";
import { DocumentAi } from "./document-ai";
import type { DocumentPages } from "./document.schema";
import { textPdf } from "./pdf.fixture";
import { ApiError } from "../shared/http/errors";
const raw = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (
  !raw ||
  new URL(raw).pathname !== "/revynora_test" ||
  !["127.0.0.1", "localhost"].includes(new URL(raw).hostname)
)
  throw Error("Dedicated local test database required");
process.env.DATABASE_URL = raw;
process.env.WORKER_ENABLED = "false";
process.env.AI_PROVIDER = "mock";
process.env.BILLING_PROVIDER = "mock";
process.env.COOKIE_SECURE = "false";
const db = new PrismaClient();
let app: INestApplication,
  base: string,
  fail = false,
  available = true,
  calls = 0;
const users: string[] = [];
const fakeAi = {
  available: () => available,
  async analyze(pages: DocumentPages) {
    calls++;
    if (fail)
      throw new ApiError(503, "PDF_AI_FAILED", "Synthetic provider failure");
    return {
      title: "Cours de test",
      chapters: [
        {
          title: "Chapitre",
          summary: "Synthese de test",
          objectives: ["Comprendre"],
          concepts: [{ name: "Cellule", explanation: "Notion de test" }],
          references: [{ page: 1, quote: pages[0].text.slice(0, 40) }],
        },
      ],
    };
  },
};
async function req(
  path: string,
  cookie = "",
  method = "GET",
  body?: BodyInit,
  csrf = true,
) {
  return fetch(base + path, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(csrf ? { "X-Revynora-Client": "web" } : {}),
    },
    body,
  });
}
async function account() {
  const r = await fetch(base + "/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Revynora-Client": "web" },
    body: JSON.stringify({
      name: "PDF fixture",
      email: `pdf-${crypto.randomUUID()}@example.test`,
      password: "Synthetic-pdf-test!42",
      termsAccepted: true,
    }),
  });
  expect(r.status).toBe(201);
  const user = await r.json();
  users.push(user.id);
  return { id: user.id, cookie: r.headers.get("set-cookie")!.split(";")[0] };
}
async function upload(
  cookie: string,
  label: string = crypto.randomUUID(),
  csrf = true,
) {
  const form = new FormData();
  form.append(
    "file",
    new Blob(
      [
        new Uint8Array(
          textPdf(
            "Les cellules utilisent de l energie et la membrane regule les echanges. " +
              label,
          ),
        ),
      ],
      { type: "application/pdf" },
    ),
    "cours.pdf",
  );
  return req("/documents", cookie, "POST", form, csrf);
}
async function document(cookie: string) {
  const r = await upload(cookie);
  expect(r.status).toBe(201);
  return (await r.json()).id as string;
}
beforeAll(async () => {
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DocumentAi)
    .useValue(fakeAi)
    .compile();
  app = configureApp(module.createNestApplication({ logger: false }));
  await app.listen(0, "127.0.0.1");
  base = (await app.getUrl()) + "/api/v1";
});
afterAll(async () => {
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
  if (app) await app.close();
});
describe("Private PDF HTTP workflow and real PostgreSQL quotas", () => {
  it("auth, CSRF and G8 guards run before extraction; no rights assigned", async () => {
    expect((await upload("")).status).toBe(401);
    const a = await account();
    expect((await upload(a.cookie, "x", false)).status).toBe(403);
    await db.user.update({ where: { id: a.id }, data: { role: "ADMIN" } });
    expect((await upload(a.cookie)).status).toBe(403);
    expect(
      await db.internalLearningGrant.count({ where: { userId: a.id } }),
    ).toBe(0);
    expect(
      await db.commercialPermission.count({ where: { userId: a.id } }),
    ).toBe(0);
  });
  it("extracts a real PDF without a subject, isolates access and deletes text/result", async () => {
    const a = await account(),
      b = await account();
    const id = await document(a.cookie);
    expect((await req("/documents/" + id, b.cookie)).status).toBe(404);
    expect(
      (await req("/documents/" + id + "/analyze", b.cookie, "POST")).status,
    ).toBe(404);
    expect((await req("/documents/" + id, b.cookie, "DELETE")).status).toBe(
      404,
    );
    expect(
      (await req("/documents/" + id + "/analyze", a.cookie, "POST")).status,
    ).toBe(201);
    const item = await (await req("/documents/" + id, a.cookie)).json();
    expect(item.status).toBe("COMPLETED");
    expect(item.pages).toBeUndefined();
    expect(item.analysis.chapters[0].references[0].page).toBe(1);
    const n = calls;
    await req("/documents/" + id + "/analyze", a.cookie, "POST");
    expect(calls).toBe(n);
    await req("/documents/" + id, a.cookie, "DELETE");
    const erased = await db.pdfDocument.findUniqueOrThrow({ where: { id } });
    expect(erased.pages).toBeNull();
    expect(erased.analysis).toBeNull();
    expect(erased.chargedAt).not.toBeNull();
    expect((await req("/documents/" + id, a.cookie)).status).toBe(404);
  });
  it("atomically permits exactly three new FREE analyses with concurrent requests and no deletion refund", async () => {
    const a = await account();
    const ids = [];
    for (let i = 0; i < 6; i++) ids.push(await document(a.cookie));
    const statuses = [];
    for (let round = 0; round < 3; round++)
      statuses.push(
        ...(await Promise.all(
          ids.map((id) =>
            req("/documents/" + id + "/analyze", a.cookie, "POST").then(
              (r) => r.status,
            ),
          ),
        )),
      );
    const completed = await db.pdfDocument.findMany({
      where: { userId: a.id, status: "COMPLETED" },
    });
    expect(completed).toHaveLength(3);
    expect(statuses).toContain(429);
    await req("/documents/" + completed[0].id, a.cookie, "DELETE");
    const next = await document(a.cookie);
    expect(
      (await req("/documents/" + next + "/analyze", a.cookie, "POST")).status,
    ).toBe(429);
    expect(
      await db.pdfDocument.count({
        where: { userId: a.id, chargedAt: { not: null } },
      }),
    ).toBe(3);
  }, 30000);
  it("does not charge unavailable/failed AI and retries same document once without duplicate reservation", async () => {
    const a = await account();
    const id = await document(a.cookie);
    available = false;
    expect(
      (await req("/documents/" + id + "/analyze", a.cookie, "POST")).status,
    ).toBe(503);
    available = true;
    expect(
      (await db.pdfDocument.findUniqueOrThrow({ where: { id } })).attempts,
    ).toBe(0);
    fail = true;
    expect(
      (await req("/documents/" + id + "/analyze", a.cookie, "POST")).status,
    ).toBe(503);
    fail = false;
    expect(
      (await db.pdfDocument.findUniqueOrThrow({ where: { id } })).chargedAt,
    ).toBeNull();
    expect(
      (await req("/documents/" + id + "/analyze", a.cookie, "POST")).status,
    ).toBe(201);
    const doc = await db.pdfDocument.findUniqueOrThrow({ where: { id } });
    expect(doc.attempts).toBe(2);
    expect(doc.chargedAt).not.toBeNull();
    expect(
      await db.pdfAnalysisRequest.count({ where: { documentId: id } }),
    ).toBe(2);
  });
  it("preserves quota tombstones until account deletion and deduplicates identical imports", async () => {
    const a = await account();
    const [x, y] = await Promise.all([
      upload(a.cookie, "same"),
      upload(a.cookie, "same"),
    ]);
    expect([x.status, y.status].sort()).toEqual([201, 429]);
    const first = await (x.status === 201 ? x : y).json();
    const repeat = await upload(a.cookie, "same");
    expect(repeat.status).toBe(201);
    expect((await repeat.json()).id).toBe(first.id);
    const doc = await db.pdfDocument.findFirstOrThrow({
      where: { userId: a.id },
    });
    await req("/documents/" + doc.id + "/analyze", a.cookie, "POST");
    await db.user.delete({ where: { id: a.id } });
    expect(await db.pdfDocument.count({ where: { userId: a.id } })).toBe(0);
    expect(
      await db.pdfAnalysisRequest.count({ where: { documentId: doc.id } }),
    ).toBe(0);
  });
});

it("PLUS and PRO have no fixed weekly PDF quota, without changing prices or rights", async () => {
  for (const code of ["PLUS", "PRO"] as const) {
    const a = await account();
    const offer = await db.subscription.findUniqueOrThrow({ where: { code } });
    await db.userSubscriptionHistory.create({
      data: {
        userId: a.id,
        subscriptionId: offer.id,
        provider: "mock",
        providerSubscriptionId: "pdf-fixture-" + crypto.randomUUID(),
        priceCents: offer.priceCents,
        currency: offer.currency,
        status: "ACTIVE",
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 86400000),
      },
    });
    expect(
      (await (await req("/documents/config", a.cookie)).json()).weeklyLimit,
    ).toBeNull();
    for (let i = 0; i < 4; i++) {
      const id = await document(a.cookie);
      expect(
        (await req("/documents/" + id + "/analyze", a.cookie, "POST")).status,
      ).toBe(201);
    }
    expect(
      await db.pdfDocument.count({
        where: { userId: a.id, status: "COMPLETED" },
      }),
    ).toBe(4);
    expect(
      await db.internalLearningGrant.count({ where: { userId: a.id } }),
    ).toBe(0);
    expect(
      await db.commercialPermission.count({ where: { userId: a.id } }),
    ).toBe(0);
  }
}, 30000);
it("bounds failed retries and total daily requests independently of weekly charges", async () => {
  const a = await account();
  const id = await document(a.cookie);
  fail = true;
  try {
    for (let i = 0; i < 3; i++)
      expect(
        (await req("/documents/" + id + "/analyze", a.cookie, "POST")).status,
      ).toBe(503);
  } finally {
    fail = false;
  }
  expect(
    (await req("/documents/" + id + "/analyze", a.cookie, "POST")).status,
  ).toBe(429);
  const fresh = await document(a.cookie);
  await db.pdfAnalysisRequest.createMany({
    data: Array.from({ length: 17 }, () => ({ documentId: id })),
  });
  expect(
    (await req("/documents/" + fresh + "/analyze", a.cookie, "POST")).status,
  ).toBe(429);
  expect(
    await db.pdfDocument.count({
      where: { userId: a.id, chargedAt: { not: null } },
    }),
  ).toBe(0);
});
it("rejects MIME spoofing, oversize and extra files before reserving quota", async () => {
  const a = await account();
  for (const [body, type, name] of [
    ["not a PDF", "application/pdf", "x.pdf"],
    ["bad", "text/plain", "x.pdf"],
    ["bad", "application/pdf", "x.exe"],
  ] as const) {
    const f = new FormData();
    f.append("file", new Blob([body], { type }), name);
    expect((await req("/documents", a.cookie, "POST", f)).status).toBe(422);
  }
  const tooBig = new FormData();
  tooBig.append(
    "file",
    new Blob([new Uint8Array(3 * 1024 * 1024 + 1)], {
      type: "application/pdf",
    }),
    "large.pdf",
  );
  expect((await req("/documents", a.cookie, "POST", tooBig)).status).toBe(413);
  const two = new FormData();
  two.append(
    "file",
    new Blob([textPdf()], { type: "application/pdf" }),
    "a.pdf",
  );
  two.append(
    "file",
    new Blob([textPdf()], { type: "application/pdf" }),
    "b.pdf",
  );
  expect((await req("/documents", a.cookie, "POST", two)).status).toBe(400);
  expect(await db.pdfDocument.count({ where: { userId: a.id } })).toBe(0);
});

it("reprend un bail expiré sur le même document sans double décompte", async () => {
  const a = await account();
  const id = await document(a.cookie);
  await db.pdfDocument.update({
    where: { id },
    data: {
      status: "PROCESSING",
      attempts: 1,
      chargedAt: new Date(),
      startedAt: new Date(Date.now() - 360000),
      leaseToken: "interrupted-fixture",
    },
  });
  expect(
    (await (await req("/documents/" + id, a.cookie)).json()).canResume,
  ).toBe(true);
  expect(
    (await req("/documents/" + id + "/analyze", a.cookie, "POST")).status,
  ).toBe(201);
  const item = await db.pdfDocument.findUniqueOrThrow({ where: { id } });
  expect(item.status).toBe("COMPLETED");
  expect(item.attempts).toBe(2);
  expect(item.leaseToken).toBeNull();
  expect(
    await db.pdfDocument.count({
      where: { userId: a.id, chargedAt: { not: null } },
    }),
  ).toBe(1);
});
