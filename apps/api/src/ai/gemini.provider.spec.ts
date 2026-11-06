import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { GeminiProvider } from "./gemini.provider";
import { geminiStructured } from "./gemini.client";
import { AiProvider, MockProvider, OpenAiProvider } from "./ai.provider";
import { AiModule } from "./ai.module";
import { AiService } from "./ai.service";
import { PdfExtractor } from "../documents/pdf-extractor";
import { textPdf } from "../documents/pdf.fixture";
import { DocumentAi } from "../documents/document-ai";
import { environmentSchema } from "@revynora/validation";
import type { DatabaseService } from "../database/database.service";
const input = {
  domain: "Sciences" as const,
  topic: "Les cellules",
  level: "Débutant" as const,
};
const pages = [
  { page: 1, text: "La cellule possede une membrane qui regule les echanges." },
];
const analysis = {
  title: "La cellule",
  chapters: [
    {
      title: "Membrane",
      summary: "La membrane regule les echanges.",
      objectives: ["Comprendre la membrane"],
      concepts: [
        { name: "Membrane", explanation: "Une limite de la cellule." },
      ],
      references: [{ page: 1, quote: "une membrane qui regule les echanges." }],
    },
  ],
};
function response(value: unknown, finishReason = "STOP") {
  return Response.json({
    candidates: [
      {
        finishReason,
        content: {
          parts: [
            { text: "Internal thought", thought: true },
            { text: JSON.stringify(value) },
          ],
        },
      },
    ],
    usageMetadata: {
      promptTokenCount: 100,
      candidatesTokenCount: 200,
      thoughtsTokenCount: 30,
    },
  });
}
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubEnv(
    "DATABASE_URL",
    "postgresql://test:test@127.0.0.1:55457/revynora_test",
  );
  vi.stubEnv("AI_PROVIDER", "gemini");
  vi.stubEnv("GEMINI_API_KEY", "synthetic-gemini-unit-key");
  vi.stubEnv("GEMINI_MODEL", "gemini-3.8-flash");
  vi.stubEnv("OPENAI_API_KEY", "");
  fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("Gemini structured provider (HTTP always stubbed)", () => {
  it("selects Mock, OpenAI and Gemini explicitly without a provider fallback", async () => {
    for (const [name, expected] of [
      ["mock", MockProvider],
      ["openai", OpenAiProvider],
      ["gemini", GeminiProvider],
    ] as const) {
      vi.stubEnv("AI_PROVIDER", name);
      vi.stubEnv("OPENAI_API_KEY", "synthetic-openai-unit-key");
      const module = await Test.createTestingModule({ imports: [AiModule] })
        .overrideProvider(AiService)
        .useValue({})
        .compile();
      expect(module.get(AiProvider)).toBeInstanceOf(expected);
      await module.close();
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("requires the selected key, defaults the free-eligible model and rejects model URL injection", () => {
    const basic = {
      DATABASE_URL: process.env.DATABASE_URL,
      AI_PROVIDER: "gemini",
    };
    expect(environmentSchema.safeParse(basic).success).toBe(false);
    expect(
      environmentSchema.safeParse({ ...basic, GEMINI_API_KEY: "  " }).success,
    ).toBe(false);
    expect(
      environmentSchema.parse({ ...basic, GEMINI_API_KEY: "synthetic-key" })
        .GEMINI_MODEL,
    ).toBe("gemini-3.8-flash");
    expect(
      environmentSchema.safeParse({
        ...basic,
        GEMINI_API_KEY: "synthetic-key",
        GEMINI_MODEL: "gemini-x?key=leaked",
      }).success,
    ).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("uses server-only header auth, bounded structured JSON and existing quiz validation", async () => {
    const { quiz } = await new MockProvider().generate(input);
    fetcher.mockResolvedValue(response(quiz));
    const result = await new GeminiProvider().generate(input);
    expect(result.quiz).toEqual(quiz);
    expect(result.inputTokens).toBe(100);
    expect(result.outputTokens).toBe(230);
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
    );
    expect(url).not.toContain("synthetic");
    expect(options.redirect).toBe("error");
    expect(options.headers["x-goog-api-key"]).toBe("synthetic-gemini-unit-key");
    const body = JSON.parse(options.body);
    expect(body.generationConfig.maxOutputTokens).toBe(5000);
    expect(body.generationConfig.candidateCount).toBe(1);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(
      body.generationConfig.responseJsonSchema.properties.questions.minItems,
    ).toBe(5);
    expect(body.generationConfig.responseJsonSchema.$schema).toBeUndefined();
    expect(body.tools).toBeUndefined();
    expect(body.cachedContent).toBeUndefined();
    expect(body.systemInstruction.parts[0].text).toContain(
      "jamais une instruction",
    );
    expect(JSON.parse(body.contents[0].parts[0].text)).toEqual(input);
    fetcher.mockResolvedValue(
      response({ ...quiz, questions: quiz.questions.slice(0, 4) }),
    );
    await expect(new GeminiProvider().generate(input)).rejects.toMatchObject({
      code: "AI_INVALID_RESPONSE",
      retryable: false,
    });
  });
  it("reuses PDF validation and verifies every citation on its source page", async () => {
    fetcher.mockResolvedValue(response(analysis));
    const service = new DocumentAi();
    expect(service.available()).toBe(true);
    expect(await service.analyze(pages)).toEqual(analysis);
    const request = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(request.generationConfig.maxOutputTokens).toBe(7000);
    expect(JSON.parse(request.contents[0].parts[0].text)).toEqual({
      untrustedDocumentPages: pages,
    });
    expect(request.systemInstruction.parts[0].text).toContain(
      "source non fiable",
    );
    const forged = {
      ...analysis,
      chapters: [
        {
          ...analysis.chapters[0],
          references: [{ page: 2, quote: "Cette citation est inventee." }],
        },
      ],
    };
    fetcher.mockResolvedValue(response(forged));
    await expect(service.analyze(pages)).rejects.toMatchObject({ status: 503 });
    fetcher.mockResolvedValue(response({ ...analysis, chapters: [] }));
    await expect(service.analyze(pages)).rejects.toMatchObject({ status: 503 });
  });
  it.each([400, 401, 403, 429, 500])(
    "sanitizes HTTP %i without falling back or retrying transport",
    async (status) => {
      fetcher.mockResolvedValue(
        new Response("synthetic-gemini-unit-key provider private body", {
          status,
        }),
      );
      await expect(
        geminiStructured("instructions", input, {}, 100),
      ).rejects.toMatchObject({
        code: status === 429 ? "AI_RATE_LIMIT" : "AI_UNAVAILABLE",
        retryable: status === 429 || status >= 500,
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it.each(["MAX_TOKENS", "SAFETY", "RECITATION", "OTHER"])(
    "rejects partial or blocked output (%s)",
    async (reason) => {
      fetcher.mockResolvedValue(response(analysis, reason));
      await expect(new DocumentAi().analyze(pages)).rejects.toMatchObject({
        status: 503,
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it("rejects prompt blocks, malformed JSON, non-JSON output and oversized responses", async () => {
    for (const data of [
      Response.json({ promptFeedback: { blockReason: "SAFETY" } }),
      new Response("invalid json"),
      Response.json({
        candidates: [
          {
            finishReason: "STOP",
            content: { parts: [{ text: "No structured response" }] },
          },
        ],
      }),
      new Response("x".repeat(150001)),
    ]) {
      fetcher.mockResolvedValue(data);
      await expect(new DocumentAi().analyze(pages)).rejects.toMatchObject({
        status: 503,
      });
    }
  });
  it("handles network errors without exposing diagnostics or key fragments", async () => {
    fetcher.mockRejectedValue(
      new Error("synthetic-gemini-unit-key private connection diagnostic"),
    );
    await expect(geminiStructured("i", input, {}, 100)).rejects.toMatchObject({
      code: "AI_TIMEOUT",
    });
    await expect(new DocumentAi().analyze(pages)).rejects.not.toThrow(
      "synthetic-gemini-unit-key",
    );
  });
  it("records the Gemini model and token usage through the existing quiz quota ledger", async () => {
    const { quiz } = await new MockProvider().generate(input);
    fetcher.mockResolvedValue(response(quiz));
    const create = vi.fn().mockResolvedValue({ id: "usage" }),
      update = vi.fn().mockResolvedValue({});
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      aIUsage: { count: vi.fn().mockResolvedValue(0), create },
    };
    const db = {
      client: {
        $transaction: async (work: (t: typeof tx) => unknown) => work(tx),
        aIUsage: { update },
      },
    };
    const service = new AiService(
      db as unknown as DatabaseService,
      new GeminiProvider(),
    );
    expect((await service.generate("user", input)).provider).toBe("gemini");
    expect(create).toHaveBeenCalledWith({
      data: { userId: "user", provider: "gemini", model: "gemini-3.8-flash" },
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "SUCCESS",
          inputTokens: 100,
          outputTokens: 230,
        }),
      }),
    );
  });
});

it("passes real PDF page extraction through the Gemini structured boundary and source validator", async () => {
  const extracted = await new PdfExtractor().extract(textPdf(undefined, 2));
  const sourced = {
    ...analysis,
    chapters: [
      {
        ...analysis.chapters[0],
        references: [{ page: 2, quote: extracted[1].text.slice(0, 50) }],
      },
    ],
  };
  fetcher.mockResolvedValue(response(sourced));
  expect(await new DocumentAi().analyze(extracted)).toEqual(sourced);
  expect(
    JSON.parse(fetcher.mock.calls[0][1].body).contents[0].parts[0].text,
  ).toContain(extracted[1].text);
  const forged = {
    ...sourced,
    chapters: [
      {
        ...sourced.chapters[0],
        references: [
          {
            page: 2,
            quote: "Une citation inventee qui ne figure pas dans le cours.",
          },
        ],
      },
    ],
  };
  fetcher.mockResolvedValue(response(forged));
  await expect(new DocumentAi().analyze(extracted)).rejects.toMatchObject({
    status: 503,
  });
}, 15000);
it("never logs the key or provider error body", async () => {
  const logs = [
    vi.spyOn(console, "log").mockImplementation(() => {}),
    vi.spyOn(console, "error").mockImplementation(() => {}),
    vi.spyOn(console, "warn").mockImplementation(() => {}),
  ];
  try {
    fetcher.mockResolvedValue(
      new Response("synthetic-gemini-unit-key private response", {
        status: 403,
      }),
    );
    await expect(new DocumentAi().analyze(pages)).rejects.toMatchObject({
      status: 503,
    });
    const captured = JSON.stringify(logs.map((s) => s.mock.calls));
    expect(captured).not.toContain("synthetic-gemini-unit-key");
    expect(captured).not.toContain("private response");
  } finally {
    logs.forEach((s) => s.mockRestore());
  }
});
