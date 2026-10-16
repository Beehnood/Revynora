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
import { StudentGuard } from "../../auth/student.guard";
import type { AuthRequest } from "../../auth/auth.service";
import { parse } from "../../shared/http/errors";
import { PlanningUseCases } from "../application/planning.use-cases";
const title = z.string().trim().min(1).max(160),
  local = z.string().regex(/^\d{4}-\d\d-\d\dT\d\d:\d\d$/),
  duration = z.number().int().min(15).max(180),
  reminder = z.number().int().min(5).max(1440).nullable();
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
    return this.use.generate(
      r.student.id,
      parse(
        z
          .object({
            title,
            timeZone: z.string().min(1).max(100),
            resolveConflicts: z.boolean().default(false),
            tasks: z
              .array(
                z
                  .object({
                    title,
                    localStart: local,
                    durationMinutes: duration,
                    reminderMinutes: reminder.default(null),
                  })
                  .strict(),
              )
              .min(1)
              .max(20),
          })
          .strict(),
        b,
      ),
    );
  }
  @Patch("study-plan-items/:id") edit(
    @Req() r: AuthRequest,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.use.edit(
      r.student.id,
      parse(z.string().uuid(), id),
      parse(
        z
          .object({
            version: z.number().int().min(0),
            title: title.optional(),
            localStart: local.optional(),
            durationMinutes: duration.optional(),
            reminderMinutes: reminder.optional(),
            status: z.enum(["PLANNED", "DONE", "CANCELLED"]).optional(),
            resolveConflicts: z.boolean().default(false),
          })
          .strict(),
        b,
      ),
    );
  }
}
