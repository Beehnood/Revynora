import { z } from "zod";
import { loadEnvironment } from "../shared/config/environment";
import { ProviderError } from "./ai.provider";
const responseSchema = z.object({
  promptFeedback: z.object({ blockReason: z.string().optional() }).optional(),
  candidates: z
    .array(
      z.object({
        finishReason: z.string(),
        content: z
          .object({
            parts: z.array(
              z.object({
                text: z.string().optional(),
                thought: z.boolean().optional(),
              }),
            ),
          })
          .optional(),
      }),
    )
    .max(1)
    .optional(),
  usageMetadata: z
    .object({
      promptTokenCount: z.number().int().nonnegative().optional(),
      candidatesTokenCount: z.number().int().nonnegative().optional(),
      thoughtsTokenCount: z.number().int().nonnegative().optional(),
    })
    .optional(),
});
// No SDK, key in URL, tool, fallback provider, or automatic retry in this transport.
export async function geminiStructured(
  instructions: string,
  input: unknown,
  schema: Record<string, unknown>,
  maxOutputTokens: number,
) {
  const env = loadEnvironment();
  if (!env.GEMINI_API_KEY?.trim())
    throw new ProviderError("AI_UNAVAILABLE", false);
  const cleanSchema = { ...schema };
  delete cleanSchema.$schema;
  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent`,
      {
        method: "POST",
        redirect: "error",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.GEMINI_API_KEY.trim(),
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: instructions }] },
          contents: [
            { role: "user", parts: [{ text: JSON.stringify(input) }] },
          ],
          generationConfig: {
            candidateCount: 1,
            maxOutputTokens,
            responseMimeType: "application/json",
            responseJsonSchema: cleanSchema,
          },
        }),
        signal: AbortSignal.timeout(env.AI_TIMEOUT_MS),
      },
    );
  } catch {
    throw new ProviderError("AI_TIMEOUT", true);
  }
  if (!response.ok) {
    try {
      await response.body?.cancel();
    } catch {
      /* Discard diagnostics. */
    }
    throw new ProviderError(
      response.status === 429 ? "AI_RATE_LIMIT" : "AI_UNAVAILABLE",
      response.status === 429 || response.status >= 500,
    );
  }
  try {
    if (!response.body) throw Error("Empty response");
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
    const value = responseSchema.parse(JSON.parse(text));
    const inputTokens = value.usageMetadata?.promptTokenCount ?? 0;
    const outputTokens =
      (value.usageMetadata?.candidatesTokenCount ?? 0) +
      (value.usageMetadata?.thoughtsTokenCount ?? 0);
    if (
      value.promptFeedback?.blockReason &&
      value.promptFeedback.blockReason !== "BLOCK_REASON_UNSPECIFIED"
    )
      throw new ProviderError("AI_REFUSED", false, inputTokens, outputTokens);
    const candidate = value.candidates?.[0];
    if (!candidate || candidate.finishReason !== "STOP")
      throw new ProviderError(
        candidate?.finishReason === "MAX_TOKENS"
          ? "AI_INCOMPLETE"
          : "AI_REFUSED",
        false,
        inputTokens,
        outputTokens,
      );
    const output =
      candidate.content?.parts
        .filter((p) => p.thought !== true)
        .map((p) => p.text ?? "")
        .join("") ?? "";
    if (!output)
      throw new ProviderError(
        "AI_INVALID_RESPONSE",
        false,
        inputTokens,
        outputTokens,
      );
    return { text: output, inputTokens, outputTokens };
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    // Never surface provider body, document content, auth header or diagnostics.
    throw new ProviderError("AI_INVALID_RESPONSE", false);
  }
}
