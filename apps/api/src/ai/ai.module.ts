import { Module } from "@nestjs/common";
import { AiService } from "./ai.service";
import { AiProvider, MockProvider, OpenAiProvider } from "./ai.provider";
import { loadEnvironment } from "../shared/config/environment";
@Module({
  providers: [
    AiService,
    {
      provide: AiProvider,
      useFactory: () =>
        loadEnvironment().AI_PROVIDER === "openai"
          ? new OpenAiProvider()
          : new MockProvider(),
    },
  ],
  exports: [AiService],
})
export class AiModule {}
