import { Controller, Get, Inject, Req, UseGuards } from "@nestjs/common";
import { SessionGuard } from "./session.guard";
import type { AuthRequest } from "./auth.service";
import { GetLearningAccess } from "../learning-access/application/learning-access";
@Controller("learning/access")
@UseGuards(SessionGuard)
export class LearningAccessController {
  constructor(
    @Inject(GetLearningAccess) private readonly access: GetLearningAccess,
  ) {}
  @Get() current(@Req() req: AuthRequest) {
    return this.access.execute(req.student.id);
  }
}
