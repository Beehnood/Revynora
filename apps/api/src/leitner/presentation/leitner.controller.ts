import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  Query,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { StudentGuard } from "../../auth/student.guard";
import type { AuthRequest } from "../../auth/auth.service";
import { parse } from "../../shared/http/errors";
import { LeitnerUseCases } from "../application/leitner.use-cases";
const pagination = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(100),
});
const card = z
  .object({
    front: z.string().trim().min(1).max(1000),
    back: z.string().trim().min(1).max(4000),
    courseId: z.string().uuid().optional(),
  })
  .strict();
@Controller("leitner")
@UseGuards(StudentGuard)
export class LeitnerController {
  constructor(@Inject(LeitnerUseCases) private readonly use: LeitnerUseCases) {}
  @Get("cards") list(@Req() r: AuthRequest, @Query() q: unknown) {
    const p = parse(pagination, q);
    return this.use.list(r.student.id, false, p.page, p.pageSize);
  }
  @Get("cards/due") due(@Req() r: AuthRequest, @Query() q: unknown) {
    const p = parse(pagination, q);
    return this.use.list(r.student.id, true, p.page, p.pageSize);
  }
  @Get("stats") stats(@Req() r: AuthRequest) {
    return this.use.stats(r.student.id);
  }
  @Post("cards") create(@Req() r: AuthRequest, @Body() b: unknown) {
    return this.use.create(r.student.id, parse(card, b));
  }
  @Patch("cards/:id") edit(
    @Req() r: AuthRequest,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    const { version, ...input } = parse(
      card.extend({ version: z.number().int().min(0) }),
      b,
    );
    return this.use.edit(
      r.student.id,
      parse(z.string().uuid(), id),
      version,
      input,
    );
  }
  @Delete("cards/:id") archive(@Req() r: AuthRequest, @Param("id") id: string) {
    return this.use.archive(r.student.id, parse(z.string().uuid(), id));
  }
  @Post("cards/:id/review") review(
    @Req() r: AuthRequest,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.use.review(
      r.student.id,
      parse(z.string().uuid(), id),
      parse(
        z
          .object({
            requestId: z.string().uuid(),
            version: z.number().int().min(0),
            remembered: z.boolean(),
          })
          .strict(),
        b,
      ),
    );
  }
}
