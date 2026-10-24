import { ProgressModule } from "./progress/progress.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { AdminModule } from "./admin/admin.module";
import { PrivacyModule } from "./privacy/privacy.module";
import { LeitnerModule } from "./leitner/leitner.module";
import { PlanningModule } from "./planning/planning.module";
import { BillingModule } from "./billing/billing.module";
import { BillingController } from "./billing/presentation/billing.controller";
import { Module } from "@nestjs/common";
import { HealthController } from "./health/health.controller";
import { DatabaseModule } from "./database/database.module";
import { AuthModule } from "./auth/auth.module";
import { LearningModule } from "./learning/learning.module";
@Module({
  imports: [
    DatabaseModule,
    BillingModule,
    AuthModule,
    LearningModule,
    LeitnerModule,
    PlanningModule,
    ProgressModule,
    NotificationsModule,
    AdminModule,
    PrivacyModule,
  ],
  controllers: [HealthController, BillingController],
})
export class AppModule {}
