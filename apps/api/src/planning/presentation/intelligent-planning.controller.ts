import { Body, Controller, Inject, Post, Req, UseGuards } from "@nestjs/common";
import {
  aiPlanningRequestSchema,
  aiPlanningConfirmSchema,
} from "@revynora/validation";
import { StudentGuard } from "../../auth/student.guard";
import type { AuthRequest } from "../../auth/auth.service";
import { parse } from "../../shared/http/errors";
import { IntelligentPlanning } from "../application/intelligent-planning.use-cases";
@Controller("study-plans/ai")
@UseGuards(StudentGuard)
export class IntelligentPlanningController {
  constructor(
    @Inject(IntelligentPlanning) private readonly use: IntelligentPlanning,
  ) {}
  @Post("propose") propose(@Req() r: AuthRequest, @Body() b: unknown) {
    return this.use.propose(
      r.student.id,
      parse(aiPlanningRequestSchema, b).timeZone,
    );
  }
  @Post("confirm") confirm(@Req() r: AuthRequest, @Body() b: unknown) {
    return this.use.confirm(r.student.id, parse(aiPlanningConfirmSchema, b));
  }
}
