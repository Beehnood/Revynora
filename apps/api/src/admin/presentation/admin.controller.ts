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
  @Get("metrics") metrics(@Query() q: unknown) {
    return this.use.metrics(parse(filter, q));
  }
  @Get("users") users(@Query() q: unknown) {
    return this.use.users(parse(filter, q));
  }
  @Get("events") events(@Query() q: unknown) {
    return this.use.events(parse(filter, q));
  }
  @Get("offers") offers() {
    return this.use.offers();
  }
  @Patch("users/:id") disable(
    @Req() r: AuthRequest,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.use.disable(
      r.student.id,
      parse(z.string().uuid(), id),
      parse(z.object({ disabled: z.boolean() }).strict(), b).disabled,
    );
  }
}
