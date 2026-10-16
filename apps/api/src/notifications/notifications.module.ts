import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseService } from "../database/database.service";
import { GetEntitlements } from "../billing/application/billing.use-cases";
import { NotificationUseCases } from "./application/notifications.use-cases";
import { NotificationRepository } from "./infrastructure/notifications.repository";
import { ReminderWorker } from "./infrastructure/reminder.worker";
import { NotificationsController } from "./presentation/notifications.controller";
@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [
    ReminderWorker,
    {
      provide: NotificationUseCases,
      inject: [DatabaseService, GetEntitlements],
      useFactory: (db: DatabaseService, access: GetEntitlements) =>
        new NotificationUseCases(new NotificationRepository(db.client), access),
    },
  ],
})
export class NotificationsModule {}
