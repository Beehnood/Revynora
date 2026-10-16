import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
  Req,
  UseGuards,
  type RawBodyRequest,
} from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";
import { StudentGuard } from "../../auth/student.guard";
import type { AuthRequest } from "../../auth/auth.service";
import { parse, ApiError } from "../../shared/http/errors";
import {
  BillingUseCases,
  ProcessBillingWebhook,
} from "../application/billing.use-cases";
import { BILLING_PROVIDER, type BillingProvider } from "../domain/billing";
import { MockBillingProvider } from "../infrastructure/billing.provider";
const pagination = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
@Controller()
export class BillingController {
  constructor(
    @Inject(BillingUseCases) private readonly billing: BillingUseCases,
    @Inject(ProcessBillingWebhook)
    private readonly webhook: ProcessBillingWebhook,
    @Inject(BILLING_PROVIDER) private readonly provider: BillingProvider,
  ) {}
  @Get("subscriptions/plans") plans() {
    return this.billing.catalog();
  }
  @Get("subscriptions/me") @UseGuards(StudentGuard) current(
    @Req() r: AuthRequest,
  ) {
    return this.billing.current(r.student.id);
  }
  @Get("subscriptions/history") @UseGuards(StudentGuard) history(
    @Req() r: AuthRequest,
    @Query() q: unknown,
  ) {
    const p = parse(pagination, q);
    return this.billing.history(r.student.id, p.page, p.pageSize);
  }
  @Get("payments/me") @UseGuards(StudentGuard) payments(
    @Req() r: AuthRequest,
    @Query() q: unknown,
  ) {
    const p = parse(pagination, q);
    return this.billing.payments(r.student.id, p.page, p.pageSize);
  }
  @Post("billing/checkout-session") @UseGuards(StudentGuard) checkout(
    @Req() r: AuthRequest,
    @Body() body: unknown,
  ) {
    return this.billing.checkout(
      r.student.id,
      parse(z.object({ plan: z.enum(["PLUS", "PRO"]) }).strict(), body).plan,
    );
  }
  @Post("billing/change-plan")
  @UseGuards(StudentGuard)
  change(@Req() r: AuthRequest, @Body() b: unknown) {
    return this.billing.change(
      r.student.id,
      parse(z.object({ plan: z.enum(["PLUS", "PRO"]) }).strict(), b).plan,
    );
  }
  @Post("billing/portal-session") @UseGuards(StudentGuard) portal(
    @Req() r: AuthRequest,
  ) {
    return this.billing.portal(r.student.id);
  }
  @Get("billing/checkout-status") @UseGuards(StudentGuard) status(
    @Req() r: AuthRequest,
    @Query("id") id: string,
  ) {
    return this.billing.checkoutStatus(
      r.student.id,
      parse(z.string().uuid(), id),
    );
  }
  @Post("billing/mock-complete") @UseGuards(StudentGuard) async simulate(
    @Req() r: AuthRequest,
    @Body() body: unknown,
  ) {
    if (!(this.provider instanceof MockBillingProvider))
      throw new ApiError(404, "NOT_FOUND", "Ressource introuvable.");
    const data = parse(
      z.object({ intentId: z.string().uuid(), success: z.boolean() }).strict(),
      body,
    );
    const event = await this.provider.complete(
      r.student.id,
      data.intentId,
      data.success,
    );
    return this.webhook.execute(event.raw, event.signature);
  }
  @Post("billing/mock-cancel") @UseGuards(StudentGuard) async cancel(
    @Req() r: AuthRequest,
  ) {
    if (!(this.provider instanceof MockBillingProvider))
      throw new ApiError(404, "NOT_FOUND", "Ressource introuvable.");
    const event = await this.provider.cancel(r.student.id);
    return this.webhook.execute(event.raw, event.signature);
  }
  @Post("webhooks/stripe") receive(@Req() r: RawBodyRequest<Request>) {
    if (!r.rawBody)
      throw new ApiError(400, "RAW_BODY_REQUIRED", "Corps brut requis.");
    return this.webhook.execute(
      r.rawBody,
      String(r.headers["stripe-signature"] ?? ""),
    );
  }
}
