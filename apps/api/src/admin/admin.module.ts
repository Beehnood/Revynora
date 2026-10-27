import { CommercialCatalogController } from "../commercial-catalog/controller";
import { CommercialCatalogService } from "../commercial-catalog/service";
import { ManageLearningGrants } from "../learning-access/application/manage-grants";
import { PrismaInternalGrantRepository } from "../learning-access/infrastructure/manage-grants";
import { LearningGrantsController } from "./presentation/learning-grants.controller";
import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseService } from "../database/database.service";
import { AdminUseCases } from "./application/admin.use-cases";
import { PrismaAdminRepository } from "./infrastructure/admin.repository";
import { AdminController } from "./presentation/admin.controller";
@Module({
  imports: [AuthModule],
  controllers: [
    AdminController,
    LearningGrantsController,
    CommercialCatalogController,
  ],
  providers: [
    CommercialCatalogService,
    {
      provide: ManageLearningGrants,
      inject: [DatabaseService],
      useFactory: (db: DatabaseService) =>
        new ManageLearningGrants(new PrismaInternalGrantRepository(db.client)),
    },
    {
      provide: AdminUseCases,
      inject: [DatabaseService],
      useFactory: (db: DatabaseService) =>
        new AdminUseCases(new PrismaAdminRepository(db.client)),
    },
  ],
})
export class AdminModule {}
