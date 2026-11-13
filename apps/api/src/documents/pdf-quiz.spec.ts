import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { DocumentAi } from "./document-ai";
import { validatePdfQuiz } from "./pdf-quiz.schema";
import { diagnosticFixture, quizPages, quizAnalysis } from "./pdf-quiz.fixture";
import { PdfExtractor } from "./pdf-extractor";
import { textPdf } from "./pdf.fixture";
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubEnv(
    "DATABASE_URL",
    "postgresql://test:test@127.0.0.1:55447/revynora_test",
  );
  vi.stubEnv("AI_PROVIDER", "gemini");
  vi.stubEnv("GEMINI_API_KEY", "synthetic-unit-key");
  vi.stubEnv("GEMINI_MODEL", "gemini-3.5-flash-lite");
  vi.stubEnv("OPENAI_API_KEY", "synthetic-unit-key");
  fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
const response = (value: unknown) =>
  Response.json({
    candidates: [
      {
        finishReason: "STOP",
        content: { parts: [{ text: JSON.stringify(value) }] },
      },
    ],
  });
describe("PDF diagnostic validation (no real AI)", () => {
  it("validates 5 to 10 single-choice questions grounded in known concepts and pages", () => {
    expect(
      validatePdfQuiz(diagnosticFixture(), quizPages, quizAnalysis).questions,
    ).toHaveLength(5);
    const ten = diagnosticFixture();
    ten.questions = [
      ...ten.questions,
      ...ten.questions.map((q) => ({
        ...q,
        text: q.text + " Explique ce second cas.",
      })),
    ];
    expect(
      validatePdfQuiz(ten, quizPages, quizAnalysis).questions,
    ).toHaveLength(10);
  });
  it.each([
    "citation",
    "concept",
    "chapter",
    "coverage",
    "duplicate",
    "options",
    "correct",
    "count",
  ])("rejects invalid %s", (kind) => {
    const value = diagnosticFixture();
    const q = value.questions[0];
    if (kind === "citation")
      q.reference.quote = "Cette phrase ne figure jamais dans le document.";
    if (kind === "concept") q.concept = "Notion inventee";
    if (kind === "chapter") q.chapterIndex = 9;
    if (kind === "coverage")
      value.questions = value.questions.map((p, i) => ({
        ...q,
        text: p.text + String(i),
      }));
    if (kind === "duplicate") value.questions[1].text = q.text.toUpperCase();
    if (kind === "options") q.options[1].text = q.options[0].text;
    if (kind === "correct") q.options[1].correct = true;
    if (kind === "count") value.questions.pop();
    expect(() => validatePdfQuiz(value, quizPages, quizAnalysis)).toThrow();
  });
  it("sends only source pages/analysis through Gemini's structured boundary once", async () => {
    fetcher.mockResolvedValue(response(diagnosticFixture()));
    expect(await new DocumentAi().diagnostic(quizPages, quizAnalysis)).toEqual(
      diagnosticFixture(),
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toContain(":generateContent");
    expect(url).not.toContain("synthetic");
    const body = JSON.parse(options.body);
    expect(body.tools).toBeUndefined();
    expect(JSON.parse(body.contents[0].parts[0].text)).toEqual({
      untrustedDocumentPages: quizPages,
      untrustedAnalysis: quizAnalysis,
    });
    expect(
      JSON.stringify(body.generationConfig.responseJsonSchema),
    ).not.toContain('"maxItems"');
  });
  it("preserves OpenAI Responses structured output and store=false", async () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    fetcher.mockResolvedValue(
      Response.json({
        status: "completed",
        output: [
          {
            content: [
              {
                type: "output_text",
                text: JSON.stringify(diagnosticFixture()),
              },
            ],
          },
        ],
      }),
    );
    await new DocumentAi().diagnostic(quizPages, quizAnalysis);
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/responses");
    const body = JSON.parse(options.body);
    expect(body.store).toBe(false);
    expect(body.text.format.strict).toBe(true);
    expect(body.text.format.schema.properties.questions.maxItems).toBe(10);
  });
  it("does not fabricate a quiz in Mock or retry a rejected provider", async () => {
    vi.stubEnv("AI_PROVIDER", "mock");
    await expect(
      new DocumentAi().diagnostic(quizPages, quizAnalysis),
    ).rejects.toMatchObject({ status: 503 });
    expect(fetcher).not.toHaveBeenCalled();
    vi.stubEnv("AI_PROVIDER", "gemini");
    fetcher.mockResolvedValue(
      new Response("synthetic-unit-key provider private body", { status: 400 }),
    );
    await expect(
      new DocumentAi().diagnostic(quizPages, quizAnalysis),
    ).rejects.not.toThrow("synthetic-unit-key");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("uses real two-page extraction before validating generated citations", async () => {
    const pages = await new PdfExtractor().extract(
      textPdf(
        quizPages.map((p) => p.text),
        2,
      ),
    );
    const analysis = {
      ...quizAnalysis,
      chapters: quizAnalysis.chapters.map((c, i) => ({
        ...c,
        references: [{ page: i + 1, quote: quizPages[i].text }],
      })),
    };
    fetcher.mockResolvedValue(response(diagnosticFixture()));
    expect(
      (await new DocumentAi().diagnostic(pages, analysis)).questions,
    ).toHaveLength(5);
  }, 15000);
});
