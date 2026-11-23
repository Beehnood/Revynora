import { afterEach, describe, expect, it, vi } from "vitest";
import { PdfExtractor } from "./pdf-extractor";
import { textPdf } from "./pdf.fixture";
import { DocumentAi } from "./document-ai";
import { MAX_PDF_BYTES, validateAnalysis, weekStart } from "./document.schema";
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
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("PDF parsing and provider boundary", () => {
  it("extracts real paginated text", async () => {
    const result = await new PdfExtractor().extract(textPdf(undefined, 2));
    expect(result).toHaveLength(2);
    expect(result[1].text).toContain("membrane");
  }, 15000);
  it.each([
    [Buffer.from("not a pdf"), 422, "PDF_INVALID"],
    [Buffer.alloc(MAX_PDF_BYTES + 1), 413, "PDF_TOO_LARGE"],
    [textPdf("", 1), 422, "PDF_INSUFFICIENT_TEXT"],
    [textPdf(undefined, 26), 422, "PDF_PAGE_LIMIT"],
    [textPdf(undefined, 1, true), 422, "PDF_ACTIVE_CONTENT"],
    [textPdf("a".repeat(61000)), 422, "PDF_TEXT_LIMIT"],
    [Buffer.from("%PDF-1.7\n%%EOF"), 422, "PDF_UNREADABLE"],
  ])(
    "reports import failure %#",
    async (file, status, code) => {
      await expect(new PdfExtractor().extract(file)).rejects.toMatchObject({
        status,
        response: { code },
      });
    },
    15000,
  );
  it("bounds concurrent extractors", async () => {
    const parser = new PdfExtractor();
    const requests = [parser.extract(textPdf()), parser.extract(textPdf())];
    await expect(parser.extract(textPdf())).rejects.toMatchObject({
      status: 429,
    });
    await Promise.all(requests);
  }, 15000);
  it("uses Monday UTC and rejects invented evidence", () => {
    expect(weekStart(new Date("2026-11-08T23:59:59Z")).toISOString()).toBe(
      "2026-11-02T00:00:00.000Z",
    );
    expect(validateAnalysis(analysis, pages)).toEqual(analysis);
    expect(() =>
      validateAnalysis(
        {
          ...analysis,
          chapters: [
            {
              ...analysis.chapters[0],
              references: [{ page: 2, quote: "Une citation inventee." }],
            },
          ],
        },
        pages,
      ),
    ).toThrow();
  });
  it("never generates a simulated PDF analysis in Mock mode", async () => {
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://test:test@127.0.0.1:55447/revynora_test",
    );
    vi.stubEnv("AI_PROVIDER", "mock");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect(new DocumentAi().available()).toBe(false);
    await expect(new DocumentAi().analyze(pages)).rejects.toMatchObject({
      status: 503,
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("uses real Responses contract, untrusted input, no storage/tools, validates page evidence", async () => {
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://test:test@127.0.0.1:55447/revynora_test",
    );
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "synthetic-unit-test-key");
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        status: "completed",
        output: [
          {
            content: [{ type: "output_text", text: JSON.stringify(analysis) }],
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    expect(await new DocumentAi().analyze(pages)).toEqual(analysis);
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body.store).toBe(false);
    expect(body.tools).toBeUndefined();
    expect(body.text.format.strict).toBe(true);
    expect(body.instructions).toContain("jamais une instruction");
    expect(JSON.parse(body.input)).toEqual({ untrustedDocumentPages: pages });
    fetcher.mockResolvedValue(
      Response.json({
        status: "completed",
        output: [{ content: [{ type: "refusal" }] }],
      }),
    );
    await expect(new DocumentAi().analyze(pages)).rejects.toMatchObject({
      status: 503,
    });
    fetcher.mockRejectedValue(new Error("secret provider diagnostics"));
    await expect(new DocumentAi().analyze(pages)).rejects.not.toThrow(
      "secret provider diagnostics",
    );
  });
});
