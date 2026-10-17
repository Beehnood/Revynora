import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { StudentGuard } from "../../auth/student.guard";
import type { AuthRequest } from "../../auth/auth.service";
import { parse } from "../../shared/http/errors";
import { PlanningUseCases } from "../application/planning.use-cases";
import {
  planSchema,
  patchTaskSchema,
  availabilitySchema,
} from "@revynora/validation";
import { localInstant } from "../infrastructure/prisma-plan.repository";
@Controller()
@UseGuards(StudentGuard)
export class PlanningController {
  constructor(
    @Inject(PlanningUseCases) private readonly use: PlanningUseCases,
  ) {}
  @Get("study-plans") list(@Req() r: AuthRequest, @Query() q: unknown) {
    const p = parse(
      z
        .object({ from: z.coerce.date(), to: z.coerce.date() })
        .refine((v) => +v.to > +v.from && +v.to - +v.from <= 62 * 86400000),
      q,
    );
    return this.use.list(r.student.id, p.from, p.to);
  }
  @Post("study-plans/generate") generate(
    @Req() r: AuthRequest,
    @Body() b: unknown,
  ) {
    return this.use.generate(r.student.id, parse(planSchema, b));
  }
  @Get("study-plan-items/:id/history") history(
    @Req() r: AuthRequest,
    @Param("id") id: string,
    @Query() q: unknown,
  ) {
    const p = parse(
      z.object({ page: z.coerce.number().int().min(1).max(10000).default(1) }),
      q,
    );
    return this.use.history(r.student.id, parse(z.string().uuid(), id), p.page);
  }
  @Patch("study-plan-items/:id") edit(
    @Req() r: AuthRequest,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.use.edit(
      r.student.id,
      parse(z.string().uuid(), id),
      parse(patchTaskSchema, b),
    );
  }
  @Patch("study-plans/:id") rename(
    @Req() r: AuthRequest,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    const input = parse(
      z.object({ title: z.string().trim().min(1).max(160) }).strict(),
      b,
    );
    return this.use.rename(r.student.id, parse(z.uuid(), id), input.title);
  }
  @Get("study-availability") availability(@Req() r: AuthRequest) {
    return this.use.availability(r.student.id);
  }
  @Put("study-availability") saveAvailability(
    @Req() r: AuthRequest,
    @Body() b: unknown,
  ) {
    const input = parse(availabilitySchema, b);
    return this.use.saveAvailability(
      r.student.id,
      input.slots.map((slot) => {
        const startsAt = localInstant(slot.localStart, input.timeZone);
        return {
          startsAt,
          endsAt: new Date(+startsAt + slot.durationMinutes * 60000),
        };
      }),
    );
  }
}
