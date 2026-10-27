import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { AdminGuard } from "../auth/session.guard";
import type { AuthRequest } from "../auth/auth.service";
import { parse } from "../shared/http/errors";
import { draftSchema, publishSchema } from "./domain";
import { CommercialCatalogService } from "./service";
@Controller("admin/commercial")
@UseGuards(AdminGuard)
export class CommercialCatalogController {
  constructor(
    @Inject(CommercialCatalogService)
    private readonly service: CommercialCatalogService,
  ) {}
  @Get("offers") list(@Req() r: AuthRequest) {
    return this.service.list(r.student.id);
  }
  @Get("history") history(@Req() r: AuthRequest, @Query("page") p: unknown) {
    return this.service.history(
      r.student.id,
      parse(z.coerce.number().int().min(1).max(10000).default(1), p),
    );
  }
  @Post("offers/:id/drafts") draft(
    @Req() r: AuthRequest,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.service.draft(
      r.student.id,
      parse(z.string().uuid(), id),
      parse(draftSchema, b),
    );
  }
  @Post("versions/:id/verify-price") verify(
    @Req() r: AuthRequest,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.service.verifyStripe(
      r.student.id,
      parse(z.string().uuid(), id),
      parse(
        z
          .object({
            priceId: z
              .string()
              .regex(/^price_[a-zA-Z0-9]+$/)
              .max(200),
          })
          .strict(),
        b,
      ).priceId,
    );
  }
  @Post("versions/:id/publish") publish(
    @Req() r: AuthRequest,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    const d = parse(publishSchema, b);
    return this.service.publish(
      r.student.id,
      parse(z.string().uuid(), id),
      d.expectedRevision,
      d.confirmVersionId,
    );
  }
}
