import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseService } from "../database/database.service";
import { GetProgress } from "./application/progress.use-cases";
import { PrismaProgressReader } from "./infrastructure/progress.reader";
import { ProgressController } from "./presentation/progress.controller";
@Module({
  imports: [AuthModule],
  controllers: [ProgressController],
  providers: [
    {
      provide: GetProgress,
      inject: [DatabaseService],
      useFactory: (db: DatabaseService) =>
        new GetProgress(new PrismaProgressReader(db.client)),
    },
  ],
})
export class ProgressModule {}
