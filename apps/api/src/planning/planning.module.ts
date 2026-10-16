import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseService } from "../database/database.service";
import { GetEntitlements } from "../billing/application/billing.use-cases";
import { PlanningUseCases } from "./application/planning.use-cases";
import { PrismaPlanRepository } from "./infrastructure/prisma-plan.repository";
import { PlanningController } from "./presentation/planning.controller";
@Module({
  imports: [AuthModule],
  controllers: [PlanningController],
  providers: [
    {
      provide: PlanningUseCases,
      inject: [DatabaseService, GetEntitlements],
      useFactory: (db: DatabaseService, access: GetEntitlements) =>
        new PlanningUseCases(new PrismaPlanRepository(db.client), access),
    },
  ],
})
export class PlanningModule {}
