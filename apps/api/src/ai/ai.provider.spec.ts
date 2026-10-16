import { describe, it, expect, vi, afterEach } from "vitest";
import { MockProvider, OpenAiProvider, ProviderError } from "./ai.provider";
import { generatedSchema } from "./ai.schema";
import { mockQuiz, mockTopics } from "./mock-bank";
const input = {
  domain: "Sciences" as const,
  topic: "Les cellules",
  level: "Débutant" as const,
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("Port IA et validation", () => {
  it("valide chaque sujet de démonstration sans prétendre générer", async () => {
    for (const topic of mockTopics) {
      const data = await new MockProvider().generate({
        ...topic,
        level: "Débutant",
      });
      expect(data.quiz.questions).toHaveLength(5);
      expect(generatedSchema.safeParse(data.quiz).success).toBe(true);
    }
    expect(mockQuiz({ ...input, topic: "inconnu" })).toBeNull();
    await expect(
      new MockProvider().generate({ ...input, level: "Avancé" }),
    ).rejects.toMatchObject({
      code: "MOCK_TOPIC_UNSUPPORTED",
      retryable: false,
    });
  });
  it("refuse 4 questions, une solution vide ou des distracteurs dupliqués", () => {
    const quiz = mockQuiz(input)!;
    expect(
      generatedSchema.safeParse({
        ...quiz,
        questions: quiz.questions.slice(0, 4),
      }).success,
    ).toBe(false);
    const invalid = structuredClone(quiz);
    invalid.questions[0].options.forEach((o) => (o.correct = false));
    expect(generatedSchema.safeParse(invalid).success).toBe(false);
    const duplicate = structuredClone(quiz);
    duplicate.questions[0].options[1].text =
      duplicate.questions[0].options[0].text;
    expect(generatedSchema.safeParse(duplicate).success).toBe(false);
  });
  it("utilise Responses avec JSON strict sans conserver la réponse distante", async () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "test-key-never-real");
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "completed",
          usage: { input_tokens: 120, output_tokens: 200 },
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify(mockQuiz(input)),
                },
              ],
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetcher);
    const result = await new OpenAiProvider().generate(input);
    expect(result.inputTokens).toBe(120);
    const payload = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(payload.store).toBe(false);
    expect(payload.text.format.strict).toBe(true);
    expect(payload.input).not.toContain("email");
  });
  it.each([429, 500, 401])(
    "classe une réponse HTTP %s sans exposer le corps fournisseur",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response("private", { status })),
      );
      await expect(new OpenAiProvider().generate(input)).rejects.toMatchObject({
        retryable: status !== 401,
      });
    },
  );
  it("traite refus, timeout et JSON invalide sans faux succès", async () => {
    const provider = new OpenAiProvider();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("private timeout")),
    );
    await expect(provider.generate(input)).rejects.toMatchObject({
      code: "AI_TIMEOUT",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: "completed",
            output: [{ type: "message", content: [{ type: "refusal" }] }],
          }),
        ),
      ),
    );
    await expect(provider.generate(input)).rejects.toMatchObject({
      code: "AI_REFUSED",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: "completed",
            usage: { input_tokens: 1, output_tokens: 2 },
            output: [
              {
                type: "message",
                content: [{ type: "output_text", text: "invalid" }],
              },
            ],
          }),
        ),
      ),
    );
    await expect(provider.generate(input)).rejects.toBeInstanceOf(
      ProviderError,
    );
  });
});
