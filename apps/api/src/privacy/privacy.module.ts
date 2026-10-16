import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseService } from "../database/database.service";
import {
  BILLING_PROVIDER,
  type BillingProvider,
} from "../billing/domain/billing";
import { PrivacyUseCases } from "./application/privacy.use-cases";
import { PrismaPrivacyRepository } from "./infrastructure/privacy.repository";
import { PrivacyController } from "./presentation/privacy.controller";
@Module({
  imports: [AuthModule],
  controllers: [PrivacyController],
  providers: [
    {
      provide: PrivacyUseCases,
      inject: [DatabaseService, BILLING_PROVIDER],
      useFactory: (db: DatabaseService, p: BillingProvider) =>
        new PrivacyUseCases(new PrismaPrivacyRepository(db.client, p)),
    },
  ],
})
export class PrivacyModule {}
