import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AiModule } from "../ai/ai.module";
import { LearningController } from "./learning.controller";
import { LearningService } from "./learning.service";
@Module({
  imports: [AuthModule, AiModule],
  controllers: [LearningController],
  providers: [LearningService],
})
export class LearningModule {}
