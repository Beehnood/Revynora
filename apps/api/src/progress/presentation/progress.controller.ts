import { Controller, Get, Inject, Req, UseGuards } from "@nestjs/common";
import { LearningAccessGuard } from "../../auth/learning-access.guard";
import type { AuthRequest } from "../../auth/auth.service";
import { GetProgress } from "../application/progress.use-cases";
@Controller("progress")
@UseGuards(LearningAccessGuard)
export class ProgressController {
  constructor(@Inject(GetProgress) private readonly use: GetProgress) {}
  @Get() summary(@Req() r: AuthRequest) {
    return this.use.execute(r.student.id);
  }
}
