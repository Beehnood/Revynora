import { adminAccessChangeSchema } from "@revynora/validation";
import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { AdminGuard } from "../../auth/session.guard";
import type { AuthRequest } from "../../auth/auth.service";
import { parse } from "../../shared/http/errors";
import { AdminUseCases } from "../application/admin.use-cases";
const filter = z
  .object({
    from: z.coerce.date().default(() => new Date(Date.now() - 30 * 86400000)),
    to: z.coerce.date().default(() => new Date()),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    search: z.string().trim().max(100).default(""),
  })
  .refine((x) => +x.to > +x.from && +x.to - +x.from <= 366 * 86400000);
@Controller("admin")
@UseGuards(AdminGuard)
export class AdminController {
  constructor(@Inject(AdminUseCases) private readonly use: AdminUseCases) {}
  @Get("metrics") metrics(@Req() r: AuthRequest, @Query() q: unknown) {
    return this.use.metrics(parse(filter, q), r.student.role);
  }
  @Get("users") users(@Req() r: AuthRequest, @Query() q: unknown) {
    return this.use.users(parse(filter, q), r.student.role);
  }
  @Get("users/:id") user(@Req() r: AuthRequest, @Param("id") id: string) {
    return this.use.user(parse(z.string().uuid(), id), r.student.role);
  }
  @Get("events") events(@Req() r: AuthRequest, @Query() q: unknown) {
    return this.use.events(parse(filter, q), r.student.role);
  }
  @Get("offers") offers(@Req() r: AuthRequest) {
    return this.use.offers(r.student.role);
  }
  @Patch("users/:id") disable(
    @Req() r: AuthRequest,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.use.disable(
      r.student,
      parse(z.string().uuid(), id),
      parse(adminAccessChangeSchema, b),
    );
  }
}
