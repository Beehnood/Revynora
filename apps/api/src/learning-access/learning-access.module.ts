import { Global, Module } from "@nestjs/common";
import { BillingModule } from "../billing/billing.module";
import { GetEntitlements } from "../billing/application/billing.use-cases";
import { DatabaseService } from "../database/database.service";
import { GetLearningAccess } from "./application/learning-access";
import { PrismaLearningAccessRepository } from "./infrastructure/access.repository";
@Global()
@Module({
  imports: [BillingModule],
  providers: [
    {
      provide: GetLearningAccess,
      inject: [GetEntitlements, DatabaseService],
      useFactory: (commercial: GetEntitlements, db: DatabaseService) =>
        new GetLearningAccess(
          commercial,
          new PrismaLearningAccessRepository(db.client),
        ),
    },
  ],
  exports: [GetLearningAccess],
})
export class LearningAccessModule {}
