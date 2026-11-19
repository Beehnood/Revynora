import { Injectable } from "@nestjs/common";
import { diagnosticSchema } from "@revynora/validation";
import { DIAGNOSTIC_INSTRUCTIONS } from "../shared/domain/diagnostic-design";
import { AiProvider, ProviderError, type Generation } from "./ai.provider";
import {
  progressiveGeneratedSchema,
  outputJsonSchema,
  type DiagnosticInput,
} from "./ai.schema";
import { geminiStructured } from "./gemini.client";
@Injectable()
export class GeminiProvider extends AiProvider {
  readonly name = "gemini";
  async generate(input: DiagnosticInput): Promise<Generation> {
    const result = await geminiStructured(
      DIAGNOSTIC_INSTRUCTIONS,
      diagnosticSchema.parse(input),
      outputJsonSchema,
      5000,
    );
    try {
      return {
        quiz: progressiveGeneratedSchema.parse(JSON.parse(result.text)),
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      };
    } catch {
      throw new ProviderError(
        "AI_INVALID_RESPONSE",
        false,
        result.inputTokens,
        result.outputTokens,
      );
    }
  }
}
