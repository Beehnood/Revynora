import { LearningAccessModule } from "../learning-access/learning-access.module";
import { LearningAccessGuard } from "./learning-access.guard";
import { LearningAccessController } from "./learning-access.controller";
import { SessionGuard, AdminGuard } from "./session.guard";
import { Module } from "@nestjs/common";
import { AuthController, UsersController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { StudentGuard } from "./student.guard";
@Module({
  imports: [LearningAccessModule],
  controllers: [AuthController, UsersController, LearningAccessController],
  providers: [
    AuthService,
    StudentGuard,
    SessionGuard,
    AdminGuard,
    LearningAccessGuard,
  ],
  exports: [
    AuthService,
    StudentGuard,
    SessionGuard,
    AdminGuard,
    LearningAccessGuard,
  ],
})
export class AuthModule {}
