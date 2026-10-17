import { beforeEach, afterEach, it, expect, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { OpenAiPlanningGenerator } from "./infrastructure/planning.generator";
import type { PlanningContext } from "./domain/intelligent-planning";
const context: PlanningContext = {
  now: "2027-01-01T00:00:00Z",
  timeZone: "UTC",
  courses: [],
  slots: [],
};
const proposal = {
  title: "Programme",
  rationale: "Test",
  tasks: [
    {
      title: "Fractions",
      courseId: "12345678-1234-4234-8234-123456789012",
      localStart: "2027-01-02T10:00",
      durationMinutes: 45,
      priority: 3,
    },
  ],
};
const update = vi.fn(),
  count = vi.fn(),
  create = vi.fn();
const tx = { $queryRaw: vi.fn(), aIUsage: { count, create } };
const db = {
  $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  aIUsage: { update },
} as unknown as PrismaClient;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost/test");
  vi.stubEnv("OPENAI_API_KEY", "test-placeholder");
  vi.stubEnv("AI_MAX_ATTEMPTS", "2");
  vi.stubEnv("AI_DAILY_LIMIT", "10");
  count.mockResolvedValue(0);
  create.mockResolvedValue({ id: "usage" });
  update.mockResolvedValue({});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("sortie structurée OpenAI, sans outils, avec timeout et trace d’usage", async () => {
  const fetch = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        status: "completed",
        usage: { input_tokens: 40, output_tokens: 60 },
        output: [
          {
            content: [{ type: "output_text", text: JSON.stringify(proposal) }],
          },
        ],
      }),
      { status: 200 },
    ),
  );
  vi.stubGlobal("fetch", fetch);
  expect(
    await new OpenAiPlanningGenerator(db).generate("user", context),
  ).toEqual(proposal);
  const body = JSON.parse(fetch.mock.calls[0]![1].body);
  expect(body.store).toBe(false);
  expect(body.tools).toBeUndefined();
  expect(body.text.format.strict).toBe(true);
  expect(update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        status: "SUCCESS",
        inputTokens: 40,
        outputTokens: 60,
      }),
    }),
  );
});
it("refus, JSON invalide, HTTP 500 et timeout ne produisent pas de faux succès", async () => {
  for (const kind of ["refusal", "invalid", "http", "timeout"]) {
    const fetch = vi.fn().mockImplementation(async () => {
      if (kind === "timeout") throw new Error("timeout");
      if (kind === "http") return new Response("", { status: 500 });
      return new Response(
        JSON.stringify({
          status: "completed",
          output: [
            {
              content:
                kind === "refusal"
                  ? [{ type: "refusal" }]
                  : [{ type: "output_text", text: "{}" }],
            },
          ],
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetch);
    await expect(
      new OpenAiPlanningGenerator(db).generate("user", context),
    ).rejects.toMatchObject({ code: "AI_PLANNING_UNAVAILABLE" });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "ERROR", attempts: 2 }),
      }),
    );
  }
});
it("quota épuisé : aucun appel fournisseur", async () => {
  count.mockResolvedValue(10);
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(
    new OpenAiPlanningGenerator(db).generate("user", context),
  ).rejects.toMatchObject({ code: "AI_QUOTA" });
  expect(fetch).not.toHaveBeenCalled();
});
