import {
  Body,
  Controller,
  Get,
  Inject,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { StudentGuard } from "../../auth/student.guard";
import type { AuthRequest } from "../../auth/auth.service";
import { parse } from "../../shared/http/errors";
import { NotificationUseCases } from "../application/notifications.use-cases";
@Controller("notifications")
@UseGuards(StudentGuard)
export class NotificationsController {
  constructor(
    @Inject(NotificationUseCases) private readonly use: NotificationUseCases,
  ) {}
  @Get("preferences") preferences(@Req() r: AuthRequest) {
    return this.use.preferences(r.student.id);
  }
  @Put("preferences") update(@Req() r: AuthRequest, @Body() body: unknown) {
    const b = parse(
      z
        .object({
          enabled: z.boolean(),
          timeZone: z
            .string()
            .max(100)
            .refine((zone) => {
              try {
                new Intl.DateTimeFormat("fr", { timeZone: zone });
                return true;
              } catch {
                return false;
              }
            }),
        })
        .strict(),
      body,
    );
    return this.use.update(r.student.id, b.enabled, b.timeZone);
  }
  @Get("me") inbox(@Req() r: AuthRequest) {
    return this.use.inbox(r.student.id);
  }
}
