import { Module } from "@nestjs/common";
import { AuthController, UsersController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { StudentGuard } from "./student.guard";
@Module({
  controllers: [AuthController, UsersController],
  providers: [AuthService, StudentGuard],
  exports: [AuthService, StudentGuard],
})
export class AuthModule {}
