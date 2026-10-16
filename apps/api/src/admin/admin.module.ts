import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseService } from "../database/database.service";
import { AdminUseCases } from "./application/admin.use-cases";
import { PrismaAdminRepository } from "./infrastructure/admin.repository";
import { AdminController } from "./presentation/admin.controller";
@Module({
  imports: [AuthModule],
  controllers: [AdminController],
  providers: [
    {
      provide: AdminUseCases,
      inject: [DatabaseService],
      useFactory: (db: DatabaseService) =>
        new AdminUseCases(new PrismaAdminRepository(db.client)),
    },
  ],
})
export class AdminModule {}
