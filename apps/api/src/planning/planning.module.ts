import { createHash } from "node:crypto";
import { IntelligentPlanning } from "./application/intelligent-planning.use-cases";
import { IntelligentPlanningController } from "./presentation/intelligent-planning.controller";
import { PrismaPlanningContext } from "./infrastructure/planning-context.reader";
import {
  MockPlanningGenerator,
  OpenAiPlanningGenerator,
} from "./infrastructure/planning.generator";
import { localInstant } from "./infrastructure/prisma-plan.repository";
import { loadEnvironment } from "../shared/config/environment";
import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseService } from "../database/database.service";
import { GetLearningAccess } from "../learning-access/application/learning-access";
import { PlanningUseCases } from "./application/planning.use-cases";
import { PrismaPlanRepository } from "./infrastructure/prisma-plan.repository";
import { PlanningController } from "./presentation/planning.controller";
@Module({
  imports: [AuthModule],
  controllers: [PlanningController, IntelligentPlanningController],
  providers: [
    {
      provide: IntelligentPlanning,
      inject: [DatabaseService, GetLearningAccess],
      useFactory: (db: DatabaseService, access: GetLearningAccess) =>
        new IntelligentPlanning(
          access,
          new PrismaPlanningContext(db.client),
          loadEnvironment().AI_PROVIDER === "mock"
            ? new MockPlanningGenerator()
            : new OpenAiPlanningGenerator(db.client),
          new PrismaPlanRepository(db.client),
          localInstant,
          (value) => createHash("sha256").update(value).digest("hex"),
        ),
    },
    {
      provide: PlanningUseCases,
      inject: [DatabaseService, GetLearningAccess],
      useFactory: (db: DatabaseService, access: GetLearningAccess) =>
        new PlanningUseCases(new PrismaPlanRepository(db.client), access),
    },
  ],
})
export class PlanningModule {}
