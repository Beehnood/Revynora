import { GeminiProvider } from "./gemini.provider";
import { Module } from "@nestjs/common";
import { AiService } from "./ai.service";
import { AiProvider, MockProvider, OpenAiProvider } from "./ai.provider";
import { loadEnvironment } from "../shared/config/environment";
@Module({
  providers: [
    AiService,
    {
      provide: AiProvider,
      useFactory: () => {
        const provider = loadEnvironment().AI_PROVIDER;
        if (provider === "openai") return new OpenAiProvider();
        if (provider === "gemini") return new GeminiProvider();
        return new MockProvider();
      },
    },
  ],
  exports: [AiService],
})
export class AiModule {}
