import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { z } from "zod";
import { StudentGuard } from "../../auth/student.guard";
import type { AuthRequest } from "../../auth/auth.service";
import { parse } from "../../shared/http/errors";
import { PrivacyUseCases } from "../application/privacy.use-cases";
@Controller("privacy")
@UseGuards(StudentGuard)
export class PrivacyController {
  constructor(@Inject(PrivacyUseCases) private readonly use: PrivacyUseCases) {}
  @Get("export") export(
    @Req() r: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="revynora-export.json"',
    );
    return this.use.export(r.student.id);
  }
  @Delete("account") async remove(
    @Req() r: AuthRequest,
    @Body() b: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const input = parse(
      z
        .object({
          password: z.string().min(1).max(128),
          confirmation: z.literal("SUPPRIMER"),
        })
        .strict(),
      b,
    );
    const result = await this.use.remove(r.student.id, input.password);
    res.clearCookie("revynora_session", { path: "/" });
    return result;
  }
}
