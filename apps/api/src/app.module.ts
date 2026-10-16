import { Module } from "@nestjs/common";
import { HealthController } from "./health/health.controller";
import { DatabaseModule } from "./database/database.module";
import { AuthModule } from "./auth/auth.module";
import { LearningModule } from "./learning/learning.module";
@Module({
  imports: [DatabaseModule, AuthModule, LearningModule],
  controllers: [HealthController],
})
export class AppModule {}
