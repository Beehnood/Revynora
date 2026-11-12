import { geminiStructured } from "../ai/gemini.client";
import { geminiGenerationSchema } from "../ai/gemini.schema";
import { loadEnvironment } from "../shared/config/environment";
import { z } from "zod";
export function pdfProviderAvailable() {
  const env = loadEnvironment();
  return (
    (env.AI_PROVIDER === "openai" && !!env.OPENAI_API_KEY?.trim()) ||
    (env.AI_PROVIDER === "gemini" && !!env.GEMINI_API_KEY?.trim())
  );
}
// One transport request, no retry, tools or provider fallback. Never log bodies.
export async function generatePdfJson(
  instructions: string,
  input: unknown,
  schema: Record<string, unknown>,
  maxOutputTokens = 7000,
): Promise<unknown> {
  const env = loadEnvironment();
  if (!pdfProviderAvailable()) throw Error("Real PDF provider unavailable");
  if (env.AI_PROVIDER === "gemini") {
    const result = await geminiStructured(
      instructions,
      input,
      geminiGenerationSchema(schema),
      maxOutputTokens,
    );
    return JSON.parse(result.text);
  }
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    redirect: "error",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      store: false,
      max_output_tokens: maxOutputTokens,
      instructions,
      input: JSON.stringify(input),
      text: {
        format: {
          type: "json_schema",
          name: "course_analysis",
          strict: true,
          schema,
        },
      },
    }),
    signal: AbortSignal.timeout(env.AI_TIMEOUT_MS),
  });
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw Error("Provider unavailable");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      text += decoder.decode(part.value, { stream: true });
      if (text.length > 150000) throw Error("Response too large");
    }
  } finally {
    await reader.cancel();
  }
  const payload = z
    .object({
      status: z.literal("completed"),
      output: z.array(
        z.object({
          content: z
            .array(z.object({ type: z.string(), text: z.string().optional() }))
            .optional(),
        }),
      ),
    })
    .parse(JSON.parse(text));
  const parts = payload.output.flatMap((o) => o.content ?? []);
  if (parts.some((p) => p.type === "refusal")) throw Error("Refused");
  return JSON.parse(
    parts
      .filter((p) => p.type === "output_text")
      .map((p) => p.text ?? "")
      .join(""),
  );
}
