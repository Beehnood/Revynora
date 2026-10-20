import {
  adminAccessChangeSchema,
  adminCatalogQuerySchema,
  adminStatisticsPeriodSchema,
} from "@revynora/validation";
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
import { ApiQuery, ApiOperation } from "@nestjs/swagger";
import { AdminGuard } from "../../auth/session.guard";
import type { AuthRequest } from "../../auth/auth.service";
import { parse } from "../../shared/http/errors";
import { AdminUseCases } from "../application/admin.use-cases";
import { paymentQuery, subscriptionQuery } from "../domain/finance";
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
  @Get("payments")
  @ApiOperation({
    summary:
      "Paiements enregistrés, sans preuve d’encaissement réel ni données privées",
  })
  payments(@Req() r: AuthRequest, @Query() q: unknown) {
    return this.use.payments(parse(paymentQuery, q), r.student.role);
  }
  @Get("subscriptions")
  @ApiOperation({
    summary: "Périodes enregistrées uniquement ; aucune mutation financière",
  })
  subscriptions(@Req() r: AuthRequest, @Query() q: unknown) {
    return this.use.subscriptions(parse(subscriptionQuery, q), r.student.role);
  }
  @Get("supervision")
  @ApiOperation({
    summary:
      "Comptages agrégés uniquement, sans donnée pédagogique individuelle",
  })
  @ApiQuery({
    name: "from",
    required: true,
    schema: { type: "string", format: "date" },
  })
  @ApiQuery({
    name: "to",
    required: true,
    description: "Fin exclusive UTC",
    schema: { type: "string", format: "date" },
  })
  supervision(@Req() r: AuthRequest, @Query() q: unknown) {
    const p = parse(adminStatisticsPeriodSchema, q);
    return this.use.supervision(
      { from: new Date(p.from), to: new Date(p.to) },
      r.student.role,
    );
  }
  @Get("catalog/courses")
  @ApiOperation({
    summary: "Catalogue éditorial uniquement, aucun contenu privé",
  })
  @ApiQuery({
    name: "page",
    required: false,
    schema: { type: "integer", minimum: 1, maximum: 10000 },
  })
  @ApiQuery({
    name: "search",
    required: false,
    schema: { type: "string", maxLength: 100 },
  })
  catalogCourses(@Req() r: AuthRequest, @Query() q: unknown) {
    return this.use.catalogCourses(
      parse(adminCatalogQuerySchema, q),
      r.student.role,
    );
  }
  @Get("catalog/courses/:id")
  @ApiOperation({ summary: "Consultation d’un cours du catalogue éditorial" })
  catalogCourse(@Req() r: AuthRequest, @Param("id") id: string) {
    return this.use.catalogCourse(parse(z.string().uuid(), id), r.student.role);
  }
  @ApiOperation({
    summary: "Agrégats Admin sur une période UTC de 1 à 366 jours",
  })
  @ApiQuery({
    name: "from",
    required: true,
    schema: { type: "string", format: "date" },
  })
  @ApiQuery({
    name: "to",
    required: true,
    description: "Fin exclusive UTC",
    schema: { type: "string", format: "date" },
  })
  @Get("statistics")
  statistics(@Req() r: AuthRequest, @Query() q: unknown) {
    const p = parse(adminStatisticsPeriodSchema, q);
    return this.use.statistics(
      { from: new Date(p.from), to: new Date(p.to) },
      r.student.role,
    );
  }
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
