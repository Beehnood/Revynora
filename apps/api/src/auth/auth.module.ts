import { SessionGuard, AdminGuard } from "./session.guard";
import { Module } from "@nestjs/common";
import { AuthController, UsersController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { StudentGuard } from "./student.guard";
@Module({
  controllers: [AuthController, UsersController],
  providers: [AuthService, StudentGuard, SessionGuard, AdminGuard],
  exports: [AuthService, StudentGuard, SessionGuard, AdminGuard],
})
export class AuthModule {}
