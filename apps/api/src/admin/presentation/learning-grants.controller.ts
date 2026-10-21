import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { AdminGuard } from "../../auth/session.guard";
import { AuthService, type AuthRequest } from "../../auth/auth.service";
import { ManageLearningGrants } from "../../learning-access/application/manage-grants";
import { parse } from "../../shared/http/errors";
const grant = z
  .object({
    startsAt: z.string().datetime(),
    expiresAt: z.string().datetime().optional(),
    provenance: z.string().trim().min(3).max(100),
    justification: z.string().trim().min(10).max(500),
  })
  .strict();
const revocation = z
  .object({ reason: z.string().trim().min(10).max(500) })
  .strict();
@Controller("admin")
@UseGuards(AdminGuard)
export class LearningGrantsController {
  constructor(
    @Inject(ManageLearningGrants) private readonly use: ManageLearningGrants,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}
  @Get("users/:id/learning-grants") list(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Query() query: unknown,
  ) {
    const { page } = parse(
      z
        .object({ page: z.coerce.number().int().min(1).max(10000).default(1) })
        .strict(),
      query,
    );
    return this.use.list(req.student.role, parse(z.string().uuid(), id), page);
  }
  @Post("users/:id/learning-grants") issue(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    this.auth.limit(req);
    return this.use.issue(
      req.student.id,
      req.student.role,
      parse(z.string().uuid(), id),
      parse(grant, body),
    );
  }
  @Patch("learning-grants/:id/revoke") revoke(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    this.auth.limit(req);
    return this.use.revoke(
      req.student.id,
      req.student.role,
      parse(z.string().uuid(), id),
      parse(revocation, body).reason,
    );
  }
}
