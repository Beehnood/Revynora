import { loadEnvironment } from "../shared/config/environment";
import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseService } from "../database/database.service";
import { GetEntitlements } from "../billing/application/billing.use-cases";
import { LeitnerUseCases } from "./application/leitner.use-cases";
import { PrismaCardRepository } from "./infrastructure/prisma-card.repository";
import { LeitnerController } from "./presentation/leitner.controller";
@Module({
  imports: [AuthModule],
  controllers: [LeitnerController],
  providers: [
    {
      provide: LeitnerUseCases,
      inject: [DatabaseService, GetEntitlements],
      useFactory: (db: DatabaseService, access: GetEntitlements) =>
        new LeitnerUseCases(
          new PrismaCardRepository(
            db.client,
            loadEnvironment().LEITNER_INTERVAL_DAYS,
          ),
          access,
        ),
    },
  ],
})
export class LeitnerModule {}
