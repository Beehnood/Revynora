import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { DatabaseService } from "../database/database.service";
import { loadEnvironment } from "../shared/config/environment";
import { ApiError } from "../shared/http/errors";
import { AiProvider, ProviderError } from "./ai.provider";
import { generatedSchema, type DiagnosticInput } from "./ai.schema";
import { mockTopics } from "./mock-bank";
@Injectable()
export class AiService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(AiProvider) private readonly provider: AiProvider,
  ) {}
  private readonly env = loadEnvironment();
  private startOfDay() {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    return date;
  }
  async configuration(userId: string) {
    const used = await this.db.client.aIUsage.count({
      where: { userId, createdAt: { gte: this.startOfDay() } },
    });
    return {
      provider: this.provider.name,
      mockTopics: this.provider.name === "mock" ? mockTopics : [],
      dailyLimit: this.env.AI_DAILY_LIMIT,
      used,
      remaining: Math.max(0, this.env.AI_DAILY_LIMIT - used),
      reset: "00:00 UTC",
    };
  }
  async generate(userId: string, input: DiagnosticInput) {
    const usage = await this.db.client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
      const count = await tx.aIUsage.count({
        where: { userId, createdAt: { gte: this.startOfDay() } },
      });
      if (count >= this.env.AI_DAILY_LIMIT)
        throw new ApiError(
          429,
          "AI_QUOTA",
          "Votre quota quotidien est atteint. Revenez après 00:00 UTC.",
        );
      return tx.aIUsage.create({
        data: {
          userId,
          provider: this.provider.name,
          model: this.provider.name === "openai" ? this.env.OPENAI_MODEL : null,
        },
      });
    });
    let inputTokens = 0,
      outputTokens = 0;
    for (let attempt = 1; attempt <= this.env.AI_MAX_ATTEMPTS; attempt++) {
      try {
        const output = await this.provider.generate(input);
        inputTokens += output.inputTokens;
        outputTokens += output.outputTokens;
        const quiz = generatedSchema.parse(output.quiz);
        await this.db.client.aIUsage.update({
          where: { id: usage.id },
          data: {
            status: "SUCCESS",
            attempts: attempt,
            inputTokens,
            outputTokens,
            estimatedCostUsd: this.cost(inputTokens, outputTokens),
          },
        });
        return { quiz, provider: this.provider.name };
      } catch (error) {
        const failure =
          error instanceof ProviderError
            ? error
            : new ProviderError("AI_INVALID_RESPONSE", true);
        inputTokens += failure.inputTokens;
        outputTokens += failure.outputTokens;
        if (!failure.retryable || attempt === this.env.AI_MAX_ATTEMPTS) {
          await this.db.client.aIUsage.update({
            where: { id: usage.id },
            data: {
              status: "ERROR",
              attempts: attempt,
              inputTokens,
              outputTokens,
              estimatedCostUsd: this.cost(inputTokens, outputTokens),
              errorCode: failure.code,
            },
          });
          throw new ApiError(
            failure.code === "MOCK_TOPIC_UNSUPPORTED" ? 400 : 503,
            failure.code,
            failure.code === "MOCK_TOPIC_UNSUPPORTED"
              ? "En démonstration, choisissez un sujet proposé et le niveau Débutant."
              : "La génération n’a pas abouti. Vos précédents tests sont conservés. Réessayez plus tard.",
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
      }
    }
    throw new ApiError(503, "AI_UNAVAILABLE", "Génération indisponible.");
  }
  private cost(input: number, output: number) {
    if (this.provider.name === "mock") return new Prisma.Decimal(0);
    if (
      this.env.AI_INPUT_USD_PER_MILLION === undefined ||
      this.env.AI_OUTPUT_USD_PER_MILLION === undefined
    )
      return null;
    return new Prisma.Decimal(
      (input * this.env.AI_INPUT_USD_PER_MILLION +
        output * this.env.AI_OUTPUT_USD_PER_MILLION) /
        1e6,
    );
  }
}
